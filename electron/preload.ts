import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('auraApi', {
  hideWindow: () => ipcRenderer.send('window-hide'),
  closeApp: () => ipcRenderer.send('window-close'),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => 
    ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  onSettings: (callback: () => void) => ipcRenderer.on('open-settings', (event) => callback()),
  
  // Audio Capture & STT
  startAudioCapture: () => ipcRenderer.send('start-audio-capture'),
  stopAudioCapture: () => ipcRenderer.send('stop-audio-capture'),
  sendAudioChunk: (chunk: Uint8Array) => ipcRenderer.send('audio-chunk', Buffer.from(chunk)),
  
  onInitCapture: (callback: () => void) => ipcRenderer.on('init-audio-capture', (event) => callback()),
  onTranscript: (callback: (data: { text: string, isFinal: boolean }) => void) => 
    ipcRenderer.on('new-transcript', (event, data) => callback(data)),
});
