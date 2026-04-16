import WebSocket from 'ws';
import { EventEmitter } from 'events';

export class AssemblyAIService extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private sampleRate: number;

  constructor(apiKey: string, sampleRate: number = 16000) {
    super();
    this.apiKey = apiKey;
    this.sampleRate = sampleRate;
  }

  public connect() {
    if (this.ws) return;

    const url = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=${this.sampleRate}`;
    
    this.ws = new WebSocket(url, {
      headers: {
        Authorization: this.apiKey,
      },
    });

    this.ws.on('open', () => {
      console.log('[AssemblyAI] WebSocket connected');
      this.emit('connect');
    });

    this.ws.on('message', (data) => {
      const response = JSON.parse(data.toString());
      
      if (response.message_type === 'SessionBegins') {
        console.log('[AssemblyAI] Session started:', response.session_id);
      } else if (response.message_type === 'PartialTranscript' || response.message_type === 'FinalTranscript') {
        this.emit('transcript', {
          text: response.text,
          isFinal: response.message_type === 'FinalTranscript',
          confidence: response.confidence,
        });
      } else if (response.error) {
        console.error('[AssemblyAI] Error:', response.error);
        this.emit('error', response.error);
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log('[AssemblyAI] WebSocket closed:', code, reason.toString());
      this.ws = null;
      this.emit('disconnect');
    });

    this.ws.on('error', (err) => {
      console.error('[AssemblyAI] WebSocket error:', err);
      this.emit('error', err);
    });
  }

  public sendAudio(chunk: Buffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // AssemblyAI expects base64 encoded audio strings in a JSON object
      // or raw binary if configured. The real-time API v2 uses JSON for metadata 
      // but binary for audio samples is also supported in some versions.
      // According to official docs for streaming: send { "audio_data": "base64..." }
      
      const message = JSON.stringify({
        audio_data: chunk.toString('base64'),
      });
      this.ws.send(message);
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.send(JSON.stringify({ terminate_session: true }));
      this.ws.close();
      this.ws = null;
    }
  }
}
