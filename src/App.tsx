import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Cpu, Zap, Brain, MessageSquare, Settings, Eye, Trash2, Activity } from 'lucide-react';

// Safe accessor — returns undefined when running outside Electron
const getApi = () => (window as any).auraApi as Record<string, Function> | undefined;
const IS_ELECTRON = typeof (window as any).auraApi !== 'undefined';

const App: React.FC = () => {
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [tempKeys, setTempKeys] = useState({ assembly: '', openrouter: '' });
  
  const [aiMode, setAiMode] = useState<'Turbo' | 'Genius'>('Turbo');
  const [persona, setPersona] = useState<'Technical' | 'SystemDesign' | 'Behavioral'>('Technical');
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [autoVision, setAutoVision] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const answerEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const api = getApi();

    if (!api) {
      console.warn('[Aura] Running in browser preview mode — Electron IPC not available.');
      return;
    }

    // Listen for transcripts from main process
    api.onTranscript((data: { text: string, isFinal: boolean }) => {
      if (data.isFinal) {
        setTranscript(prev => [...prev.slice(-10), data.text]);
      }
    });

    // AI Engine listeners
    api.onAiThinking(() => {
      setIsThinking(true);
      setCurrentAnswer('');
    });

    api.onAiAnswerChunk((chunk: string) => {
      setIsThinking(false);
      setCurrentAnswer(prev => prev + chunk);
    });

    api.onAiAnswerEnd((fullAnswer: string) => {
      setAnswers(prev => [...prev, fullAnswer]);
      setCurrentAnswer('');
    });

    // Settings listeners
    api.onSettings(() => setShowSettings(true));
    api.onSettingsStatus((data: { hasKeys: boolean }) => setHasKeys(data.hasKeys));
    api.onSettingsSaved(() => {
      setShowSettings(false);
      api.getSettingsStatus();
    });

    api.getSettingsStatus();

    api.onInitCapture(() => {
      handleToggleCapture();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    answerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentAnswer, answers]);

  const toggleMode = () => {
    const next = aiMode === 'Turbo' ? 'Genius' : 'Turbo';
    setAiMode(next);
    getApi()?.setAiMode(next);
  };

  const cyclePersona = () => {
    const list: ('Technical' | 'SystemDesign' | 'Behavioral')[] = ['Technical', 'SystemDesign', 'Behavioral'];
    const idx = list.indexOf(persona);
    const next = list[(idx + 1) % list.length];
    setPersona(next);
    getApi()?.setAiPersona(next);
  };

  const toggleAutoVision = () => {
    const next = !autoVision;
    setAutoVision(next);
    getApi()?.setAutoVision(next);
  };

  const clearAll = () => {
    setTranscript([]);
    setAnswers([]);
    setCurrentAnswer('');
  };

  const handleCapture = () => {
    if (!IS_ELECTRON) return;
    if (!hasKeys) {
      setShowSettings(true);
      return;
    }
    getApi()?.captureScreen();
  };

  const handleSaveSettings = () => {
    getApi()?.saveSettings(tempKeys);
  };

  const handleToggleCapture = async () => {
    if (isCapturing) {
      stopCapture();
    } else {
      await startCapture();
    }
  };

  const startCapture = async () => {
    if (!IS_ELECTRON) {
      console.warn('[Aura] Audio capture requires Electron');
      return;
    }
    try {
      // Trigger the stealth capture in Main process first (setDisplayMediaRequestHandler)
      getApi()?.startAudioCapture();

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required for getDisplayMedia, but we'll ignore it
        audio: true
      });

      streamRef.current = stream;
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        getApi()?.sendAudioChunk(new Uint8Array(pcmData.buffer));
      };

      setIsCapturing(true);
      console.log('[Aura] Audio capture started');
    } catch (err) {
      console.error('[Aura] Failed to start capture:', err);
    }
  };

  const stopCapture = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    audioContextRef.current?.close();
    getApi()?.stopAudioCapture();
    setIsCapturing(false);
    console.log('[Aura] Audio capture stopped');
  };

  const handleClose = () => {
    getApi()?.closeApp();
  };

  return (
    <div className="aura-container">
      <header className="header">
        <div className="title-group">
          <h1 className="title">Aura</h1>
          <span className="persona-badge" onClick={cyclePersona}>
            {persona}
          </span>
        </div>
        <div className="controls">
          <button 
            className={`mode-btn ${aiMode.toLowerCase()}`} 
            onClick={toggleMode}
            title={`Switch to ${aiMode === 'Turbo' ? 'Genius (Claude)' : 'Turbo (Gemma)'}`}
          >
            {aiMode === 'Turbo' ? <Zap size={14} /> : <Brain size={14} />}
            {aiMode}
          </button>
          <button 
            className={`control-btn ${autoVision ? 'active' : ''}`} 
            onClick={toggleAutoVision}
            title="Auto-Vision: Proactively sync screen context"
          >
            <Activity size={16} color={autoVision ? 'var(--accent-cyan)' : 'white'} />
          </button>
          <button 
            className="control-btn" 
            onClick={handleCapture}
            title="Vision: Manual Screen Capture"
          >
            <Eye size={16} />
          </button>
          <button 
            className="control-btn" 
            onClick={clearAll}
            title="Clear History"
          >
            <Trash2 size={16} />
          </button>
          <button 
            className="control-btn" 
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings size={16} />
          </button>
          <button className="control-btn close" onClick={handleClose}>×</button>
        </div>
      </header>

      <main className="content">
        {showSettings && (
          <div className="settings-overlay">
            <h3 style={{color: 'var(--accent-cyan)', marginBottom: '16px'}}>Configuration</h3>
            <div className="input-group">
              <label>AssemblyAI API Key</label>
              <input 
                type="password" 
                placeholder="Paste key here..."
                value={tempKeys.assembly}
                onChange={(e) => setTempKeys({...tempKeys, assembly: e.target.value})}
              />
            </div>
            <div className="input-group">
              <label>OpenRouter API Key</label>
              <input 
                type="password" 
                placeholder="Paste key here..."
                value={tempKeys.openrouter}
                onChange={(e) => setTempKeys({...tempKeys, openrouter: e.target.value})}
              />
            </div>
            <button className="save-btn" onClick={handleSaveSettings}>Save & Encrypt</button>
            <p className="hint">Keys are encrypted using Windows SafeStorage.</p>
          </div>
        )}

        {!showSettings && (
          <>
            <div className="transcript-area">
              {transcript.length === 0 && !isCapturing && <p className="text-secondary">Ready for interview...</p>}
              {transcript.map((line, i) => (
                <p key={i} className="transcript-line">{line}</p>
              ))}
            </div>

            <div className="answers-container">
              {answers.map((ans, i) => (
                <div key={i} className="answer-card">
                  <ReactMarkdown>{ans}</ReactMarkdown>
                </div>
              ))}
              
              {isThinking && (
                <div className="answer-card thinking">
                  <div className="pulse"></div>
                  <span>Aura is thinking...</span>
                </div>
              )}

              {currentAnswer && (
                <div className="answer-card live">
                  <ReactMarkdown>{currentAnswer}</ReactMarkdown>
                </div>
              )}
              <div ref={answerEndRef} />
            </div>
          </>
        )}
      </main>

      <footer className="status-bar">
        <div className={`status-item ${isCapturing ? 'active' : ''}`}>
          <Cpu size={12} />
          <span>STT: {isCapturing ? 'Listening' : 'Idle'}</span>
        </div>
        <div className={`status-item ${autoVision ? 'active' : ''}`}>
          <Activity size={12} />
          <span>Auto-Vision: {autoVision ? 'Linked' : 'Off'}</span>
        </div>
        <div className="status-item active">
          <MessageSquare size={12} />
          <span>LLM: {aiMode}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
