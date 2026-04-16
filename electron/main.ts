import { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, screen, session, desktopCapturer } from 'electron';
import path from 'path';
import { AssemblyAIService } from './AssemblyAIService';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let sttService: AssemblyAIService | null = null;

const ASSEMBLY_AI_KEY = '16f0d7cd505d44cb927b2dc3e85c0559'; // User provided

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
  if (!sttService) {
    sttService = new AssemblyAIService(ASSEMBLY_AI_KEY);
    sttService.on('transcript', (result) => {
      mainWindow?.webContents.send('new-transcript', result);
    });
    sttService.connect();
  }
  mainWindow?.webContents.send('init-audio-capture');
});

ipcMain.on('audio-chunk', (event, chunk: Buffer) => {
  sttService?.sendAudio(chunk);
});

ipcMain.on('stop-audio-capture', () => {
  sttService?.disconnect();
  sttService = null;
});
