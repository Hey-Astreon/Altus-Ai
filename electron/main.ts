import { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, screen, session, desktopCapturer } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { AssemblyAIService } from './AssemblyAIService';
import { OpenRouterService, ModelMode, InterviewPersona } from './OpenRouterService';
import { OllamaService } from './OllamaService';
import { QuestionDetector } from './QuestionDetector';
import { VisionService } from './VisionService';
import { Exporter } from './Exporter';
import { SettingsService } from './SettingsService';
import { StealthService } from './StealthService';
import { AccessibilityService } from './AccessibilityService';

const isDev = !app.isPackaged;

// SILENT SENTRY: Suppress all forensic footprints in production
if (!isDev) {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let sttService: AssemblyAIService | null = null;
let aiService: OpenRouterService | OllamaService | null = null;
let settings: SettingsService = new SettingsService();
let visionService: VisionService = new VisionService();
let stealthService: StealthService = new StealthService();
let accessibilityService: AccessibilityService = new AccessibilityService();
let detector: QuestionDetector = new QuestionDetector();

let isAutoVisionEnabled: boolean = false;
let visionInterval: NodeJS.Timeout | null = null;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 800,
    height: 800,
    frame: false,
    transparent: true, // ELITE: RESTORE TRANSPARENCY
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.setContentProtection(true); // ELITE: RESTORE PROTECTION
  
  const startUrl = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    // mainWindow?.webContents.openDevTools({ mode: 'detach' }); // DIAGNOSTICS COMPLETED
    mainWindow?.center();
    mainWindow?.setOpacity(1.0);
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerShortcuts() {
  globalShortcut.unregisterAll();
  const hotkeys = settings.getSetting('hotkeys', {
    toggleVisibility: 'CommandOrControl+Shift+V',
    visionCapture: 'CommandOrControl+Shift+S'
  });

  try {
    globalShortcut.register(hotkeys.toggleVisibility, () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow?.show();
      }
    });
    
    globalShortcut.register(hotkeys.visionCapture, () => {
       performVisionSolve();
    });
    
    globalShortcut.register('CommandOrControl+Shift+Q', () => {
      app.quit();
    });
  } catch (e) { console.error('Hotkey registration failed:', e); }
}

async function performVisionSolve(customText?: string) {
  try {
    if (!aiService) {
      const key = settings.getKey('openrouter');
      if (key) {
        aiService = new OpenRouterService(key);
        bindAiEvents();
      } else {
        mainWindow?.webContents.send('ai-error', 'OpenRouter Key Missing');
        return;
      }
    }

    mainWindow?.webContents.send('ai-thinking');
    
    let response;
    if (customText) {
      // Direct solve for text extracted via Accessibility Bridge
      response = await aiService.getAnswer(customText);
    } else {
      // Vision solve for screen capture
      const image = await visionService.captureScreen();
      response = await (aiService as OpenRouterService).analyzeVision('SOLVE THIS QUESTION. BE CONCISE.', image);
    }
    
    if (response) {
      mainWindow?.webContents.send('ai-answer-end', response);
    }
  } catch (error) {
    mainWindow?.webContents.send('ai-error', 'Solve Failed');
  }
}

function bindAiEvents() {
  if (!aiService) return;
  aiService.removeAllListeners();
  aiService.on('answer-chunk', (chunk) => mainWindow?.webContents.send('ai-answer-chunk', chunk));
  aiService.on('answer-end', (full) => mainWindow?.webContents.send('ai-answer-end', full));
  aiService.on('error', (err) => mainWindow?.webContents.send('ai-error', err));
}

function initializeApp() {
  createWindow();
  registerShortcuts();
  
  // START STEALTH SENTRY
  stealthService.start();
  stealthService.on('threat-state-change', (detected) => {
    if (detected) {
      mainWindow?.setOpacity(0.4); // Force Ghost Mode
      mainWindow?.setTitle('Windows System Diagnostic');
    } else {
      const savedOpacity = settings.getSetting('globalOpacity', 1.0);
      mainWindow?.setOpacity(savedOpacity);
      mainWindow?.setTitle('Altus AI');
    }
    mainWindow?.webContents.send('camouflage-state-change', detected);
  });

  // START ACCESSIBILITY BRIDGE (Auto-Pilot)
  accessibilityService.start();
  accessibilityService.on('question-detected', (text) => {
    if (isAutoVisionEnabled) {
      performVisionSolve(text);
    }
  });
}

app.whenReady().then(() => {
  initializeApp();
  
  // CONFIG AUTO-UPDATER
  autoUpdater.autoDownload = true;
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update-available');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-ready');
  });
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// IPC Handlers
ipcMain.on('window-hide', () => mainWindow?.hide());
ipcMain.on('window-close', () => app.quit());
ipcMain.on('set-opacity', (event, opacity: number) => {
  const safeOpacity = Math.max(0.4, opacity);
  mainWindow?.setOpacity(safeOpacity);
  settings.saveSetting('globalOpacity', safeOpacity);
});

ipcMain.handle('get-settings', () => {
  return {
    assembly: settings.getKey('assembly'),
    openrouter: settings.getKey('openrouter'),
    globalOpacity: settings.getSetting('globalOpacity', 0.85),
    selectedDeviceId: settings.getSetting('selectedDeviceId', 'default'),
    hotkeys: settings.getSetting('hotkeys', {
      toggleVisibility: 'CommandOrControl+Shift+V',
      visionCapture: 'CommandOrControl+Shift+S'
    })
  };
});

ipcMain.on('save-keys', (event, { assembly, openrouter }) => {
  if (assembly) settings.saveKey('assembly', assembly);
  if (openrouter) settings.saveKey('openrouter', openrouter);
  sttService = null;
  aiService = null;
});

ipcMain.on('start-audio-capture', () => {
  const assemblyKey = settings.getKey('assembly');
  const openRouterKey = settings.getKey('openrouter');
  if (!assemblyKey || !openRouterKey) return;

  if (!sttService) {
    sttService = new AssemblyAIService(assemblyKey);
    sttService.connect();
    sttService.on('transcript', (data) => {
      mainWindow?.webContents.send('new-transcript', data);
      if (data.isFinal && detector.isQuestion(data.text)) {
        aiService?.getAnswer(data.text);
      }
    });
  }
  
  if (!aiService) {
    aiService = new OpenRouterService(openRouterKey);
    bindAiEvents();
  }
});

ipcMain.on('audio-chunk', (event, chunk: ArrayBuffer) => {
  sttService?.sendAudio(Buffer.from(chunk));
});

ipcMain.on('stop-audio-capture', () => {
  sttService?.disconnect();
  sttService = null;
});

ipcMain.on('capture-screen', () => {
  performVisionSolve();
});

ipcMain.on('toggle-auto-vision', (event, enabled: boolean) => {
  isAutoVisionEnabled = enabled;
  if (visionInterval) { clearInterval(visionInterval); visionInterval = null; }
  if (isAutoVisionEnabled) {
    visionInterval = setInterval(() => {
      if (mainWindow && !mainWindow.isDestroyed()) performVisionSolve();
    }, 10000); 
  }
});

ipcMain.on('clear-stream', () => {
  if (aiService instanceof OpenRouterService) {
    aiService.clearMemory();
  }
  detector.reset();
});
