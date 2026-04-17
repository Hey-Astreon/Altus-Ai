import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('auraApi', {
  hideWindow: () => ipcRenderer.send('window-hide'),
  closeApp: () => ipcRenderer.send('window-close'),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => 
    ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  onSettings: (callback: () => void) => ipcRenderer.on('open-settings', (event) => callback()),
  
  saveSettings: (keys: { assembly: string, openrouter: string }) => ipcRenderer.send('save-settings', keys),
  getSettingsStatus: () => ipcRenderer.send('get-settings-status'),
  onSettingsStatus: (callback: (data: { hasKeys: boolean }) => void) => 
    ipcRenderer.on('settings-status', (event, data) => callback(data)),
  onSettingsSaved: (callback: () => void) => ipcRenderer.on('settings-saved', (event) => callback()),

  // Audio Capture & STT
  startAudioCapture: () => ipcRenderer.send('start-audio-capture'),
  stopAudioCapture: () => ipcRenderer.send('stop-audio-capture'),
  sendAudioChunk: (chunk: Uint8Array) => ipcRenderer.send('audio-chunk', Buffer.from(chunk)),
  
  onInitCapture: (callback: () => void) => ipcRenderer.on('init-audio-capture', (event) => callback()),
  onTranscript: (callback: (data: { text: string, isFinal: boolean }) => void) => 
    ipcRenderer.on('new-transcript', (event, data) => callback(data)),

  // AI Answer Engine
  setAiMode: (mode: 'Turbo' | 'Genius') => ipcRenderer.send('set-ai-mode', mode),
  setAiPersona: (persona: 'Technical' | 'SystemDesign' | 'Behavioral') => ipcRenderer.send('set-ai-persona', persona),
  
  captureScreen: () => ipcRenderer.send('capture-screen'),

  onAiThinking: (callback: () => void) => ipcRenderer.on('ai-thinking', (event) => callback()),
  onAiAnswerChunk: (callback: (chunk: string) => void) => ipcRenderer.on('ai-answer-chunk', (event, chunk) => callback(chunk)),
  onAiAnswerEnd: (callback: (fullAnswer: string) => void) => ipcRenderer.on('ai-answer-end', (event, fullAnswer) => callback(fullAnswer)),
});
