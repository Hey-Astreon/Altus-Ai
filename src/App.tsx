import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Cpu, Zap, Brain, MessageSquare, Settings, Eye, Camera, Maximize } from 'lucide-react';

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
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const answerEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const api = (window as any).auraApi;

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
  }, []);

  useEffect(() => {
    answerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentAnswer, answers]);

  const toggleMode = () => {
    const next = aiMode === 'Turbo' ? 'Genius' : 'Turbo';
    setAiMode(next);
    (window as any).auraApi.setAiMode(next);
  };

  const cyclePersona = () => {
    const list: ('Technical' | 'SystemDesign' | 'Behavioral')[] = ['Technical', 'SystemDesign', 'Behavioral'];
    const idx = list.indexOf(persona);
    const next = list[(idx + 1) % list.length];
    setPersona(next);
    (window as any).auraApi.setAiPersona(next);
  };

  const handleCapture = () => {
    if (!hasKeys) {
      setShowSettings(true);
      return;
    }
    (window as any).auraApi.captureScreen();
  };

  const handleSaveSettings = () => {
    (window as any).auraApi.saveSettings(tempKeys);
  };

  const handleToggleCapture = async () => {
    if (isCapturing) {
      stopCapture();
    } else {
      await startCapture();
    }
  };

  const startCapture = async () => {
    try {
      // Trigger the stealth capture in Main process first (setDisplayMediaRequestHandler)
      (window as any).auraApi.startAudioCapture();

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
        (window as any).auraApi.sendAudioChunk(new Uint8Array(pcmData.buffer));
      };

      setIsCapturing(true);
      console.log('Audio capture started');
    } catch (err) {
      console.error('Failed to start capture:', err);
    }
  };

  const stopCapture = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    audioContextRef.current?.close();
    (window as any).auraApi.stopAudioCapture();
    setIsCapturing(false);
    console.log('Audio capture stopped');
  };

  const handleClose = () => {
    (window as any).auraApi.closeApp();
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
            className="control-btn" 
            onClick={handleCapture}
            title="Vision: Analyze Screen Content"
            style={{ color: !hasKeys ? 'var(--text-secondary)' : 'white' }}
          >
            <Eye size={16} />
          </button>
          <button 
            className="control-btn" 
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings size={16} />
          </button>
          <button className="control-btn" onClick={handleClose}>×</button>
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
        <div className="status-item">
          <Cpu size={12} />
          <span>STT: {isCapturing ? 'Active' : 'Idle'}</span>
        </div>
        <div className="status-item">
          <MessageSquare size={12} />
          <span>LLM: {aiMode}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
