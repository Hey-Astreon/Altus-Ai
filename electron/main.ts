import { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, screen, session, desktopCapturer } from 'electron';
import path from 'path';
import { AssemblyAIService } from './AssemblyAIService';
import { OpenRouterService, ModelMode, InterviewPersona } from './OpenRouterService';
import { QuestionDetector } from './QuestionDetector';
import { VisionService } from './VisionService';
import { SettingsService } from './SettingsService';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let sttService: AssemblyAIService | null = null;
let aiService: OpenRouterService | null = null;
let settings: SettingsService = new SettingsService();
let visionService: VisionService = new VisionService();
let detector: QuestionDetector = new QuestionDetector();


function createTray() {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Aura', click: () => mainWindow?.show() },
    { label: 'Hide Aura', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: 'Settings', click: () => mainWindow?.webContents.send('open-settings') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setToolTip('Aura — AI Interview Assistant');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    x: width - 420,
    y: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  // STEALTH MODE: Exclude from screen capture tools (Zoom, Teams, OBS, etc.)
  mainWindow.setContentProtection(true);

  const startUrl = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerShortcuts() {
  // Toggle Visibility: Ctrl+Shift+V
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });

  // Emergency Hide: Ctrl+Shift+Q
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    app.quit();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // STEALTH AUDIO HANDLER
  // Automatically approves requests for system audio capture without showing the picker.
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      // Find the screen or window to capture. For system audio loopback on Windows,
      // any valid source with audio: true usually works if the OS supports it.
      callback({ video: sources[0], audio: 'loopback' });
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Use IPC to handle common window actions from renderer
ipcMain.on('window-hide', () => mainWindow?.hide());
ipcMain.on('window-close', () => app.quit());
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  mainWindow?.setIgnoreMouseEvents(ignore, options);
});

// AUDIO ENGINE BRIDGING
ipcMain.on('start-audio-capture', () => {
  const assemblyKey = settings.getKey('assembly');
  const openRouterKey = settings.getKey('openrouter');

  if (!assemblyKey || !openRouterKey) {
    mainWindow?.webContents.send('open-settings');
    return;
  }

  if (!sttService) {
    sttService = new AssemblyAIService(assemblyKey);
    aiService = new OpenRouterService(openRouterKey);

    sttService.on('transcript', (result) => {
      mainWindow?.webContents.send('new-transcript', result);
      
      // AUTO-DETECTION: If the transcript is final and is a question, trigger AI
      if (result.isFinal && detector.isQuestion(result.text)) {
        mainWindow?.webContents.send('ai-thinking');
        aiService?.getAnswer(result.text);
      }
    });

    aiService.on('answer-chunk', (chunk) => {
      mainWindow?.webContents.send('ai-answer-chunk', chunk);
    });

    aiService.on('answer-end', (fullAnswer) => {
      mainWindow?.webContents.send('ai-answer-end', fullAnswer);
    });

    sttService.connect();
  }
  mainWindow?.webContents.send('init-audio-capture');
});

ipcMain.on('set-ai-mode', (event, mode: ModelMode) => {
  aiService?.setMode(mode);
});

ipcMain.on('set-ai-persona', (event, persona: InterviewPersona) => {
  aiService?.setPersona(persona);
});

ipcMain.on('capture-screen', async () => {
  const openRouterKey = settings.getKey('openrouter');
  if (!openRouterKey) {
    mainWindow?.webContents.send('open-settings');
    return;
  }
  
  try {
    const base64Image = await visionService.captureScreen();
    mainWindow?.webContents.send('ai-thinking');
    // For vision, we send a generic prompt to analyze the image
    aiService?.getAnswer('', base64Image);
  } catch (err) {
    console.error('Vision trigger failed:', err);
  }
});

ipcMain.on('get-settings-status', (event) => {
  event.reply('settings-status', { hasKeys: settings.hasKeys() });
});

ipcMain.on('save-settings', (event, { assembly, openrouter }) => {
  if (assembly) settings.saveKey('assembly', assembly);
  if (openrouter) settings.saveKey('openrouter', openrouter);
  event.reply('settings-saved');
});

ipcMain.on('audio-chunk', (event, chunk: Buffer) => {
  sttService?.sendAudio(chunk);
});

ipcMain.on('stop-audio-capture', () => {
  sttService?.disconnect();
  sttService = null;
});
