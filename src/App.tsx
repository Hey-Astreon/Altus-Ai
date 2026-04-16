import React, { useState, useEffect } from 'react';

const App: React.FC = () => {
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Listen for transcripts from main process
    (window as any).auraApi.onTranscript((data: { text: string, isFinal: boolean }) => {
      if (data.isFinal) {
        setTranscript(prev => [...prev.slice(-15), data.text]); // Keep last 15 lines
      } else {
        // Handle interim results (optional: show in a separate "live" line)
      }
    });

    // Listen for initialization triggers from tray/main
    (window as any).auraApi.onInitCapture(() => {
      handleToggleCapture();
    });
  }, []);

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
        <h1 className="title">Aura</h1>
        <div className="controls">
          <button 
            className="control-btn" 
            onClick={handleToggleCapture}
            style={{ color: isCapturing ? 'var(--accent-cyan)' : 'white' }}
          >
            {isCapturing ? '● Stop' : 'Ready'}
          </button>
          <button className="control-btn" onClick={handleClose}>×</button>
        </div>
      </header>

      <main className="content">
        <div className="transcript-area">
          {transcript.length === 0 && <p className="text-secondary">Waiting for audio...</p>}
          {transcript.map((line, i) => (
            <p key={i} style={{ marginBottom: '8px', animation: 'fadeIn 0.5s' }}>{line}</p>
          ))}
        </div>

        {/* Placeholder for AI Answers which will come in Phase 3 */}
        <div className="answer-card" style={{ opacity: 0.5 }}>
          <h3 style={{fontSize: '0.8rem', color: 'var(--accent-violet)', marginBottom: '4px'}}>
            Aura AI
          </h3>
          <p style={{fontSize: '0.9rem'}}>Phase 3: Intelligence Engine will populate this area.</p>
        </div>
      </main>

      <footer className="status-bar">
        <span>STT: {isCapturing ? 'Active' : 'Idle'} (AssemblyAI)</span>
        <span>Audio: System</span>
      </footer>
    </div>
  );
};

export default App;
