import axios from 'axios';
import { EventEmitter } from 'events';
import { MemoryManager } from './MemoryManager';

export type InterviewPersona = 'Technical' | 'SystemDesign' | 'Behavioral';
export type ModelMode = 'Turbo' | 'Genius';

const MODELS = {
  Turbo: 'meta-llama/llama-3.1-8b-instruct:free',
  Genius: 'anthropic/claude-3.5-sonnet',
};

const MASTER_PROMPT = `EXAM SPECIALIST MODE: Your goal is to provide perfectly accurate answers for proctored exams.
- Output EXACTLY 6 sentences in a single paragraph. 
- Prioritize technical accuracy and conciseness.
- For MCQs, state the correct option first, then explain why.
- NO filler, NO preamble. 100% logic.`;

export class OpenRouterService extends EventEmitter {
  private apiKey: string;
  private memoryManager: MemoryManager;
  private abortController: AbortController | null = null;
  public isStreaming: boolean = false;
  private streamBuffer: string = '';

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
    this.memoryManager = new MemoryManager(apiKey);
  }

  public setApiKey(newKey: string) {
    this.apiKey = newKey;
    this.memoryManager.setApiKey(newKey);
  }

  private selectBestModel(question: string, hasImage: boolean): string {
    if (hasImage) return MODELS.Genius;
    const complexityKeywords = ['code', 'function', 'class', 'implement', 'algorithm', 'complexity', 'design', 'architecture'];
    const isComplex = complexityKeywords.some(kw => question.toLowerCase().includes(kw));
    return isComplex ? MODELS.Genius : MODELS.Turbo;
  }

  public abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async getAnswer(question: string, base64Image?: string): Promise<void> {
    const model = this.selectBestModel(question, !!base64Image);
    const systemPrompt = MASTER_PROMPT;

    let userContent: any = question;
    if (base64Image) {
      userContent = [
        { type: 'text', text: question || "Identify the code or diagram in this screenshot and provide a clear, technical explanation or solution." },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
      ];
    }

    const messages = this.memoryManager.getContext(systemPrompt);
    messages.push({ role: 'user', content: userContent });

    this.isStreaming = true;
    this.streamBuffer = '';
    this.abort();
    this.abortController = new AbortController();

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/Hey-Astreon/Altus-Ai-Platinum',
          'X-Title': 'Altus AI Platinum',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_tokens: 150,
          stream: true,
        }),
        signal: this.abortController.signal as any
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter error ${response.status}: ${errText}`);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        this.streamBuffer += chunk;
        const lines = this.streamBuffer.split('\n');
        this.streamBuffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const data = JSON.parse(dataStr);
              const text = data.choices[0]?.delta?.content || '';
              if (text) {
                fullText += text;
                this.emit('answer-chunk', text);
              }
            } catch (e) {}
          }
        }
      }

      this.memoryManager.addInteraction({ role: 'user', content: userContent }, fullText);
      this.emit('answer-end', fullText);
    } catch (error: any) {
      if (model === MODELS.Genius && !base64Image) {
        return this.getAnswer(question, base64Image);
      }
      this.emit('error', error.message || 'Intelligence link severed.');
    } finally {
      this.isStreaming = false;
    }
  }

  public async analyzeVision(question: string, base64Image?: string): Promise<string> {
    return new Promise((resolve) => {
      const model = MODELS.Genius;
      let userContent: any = question || "Solve this question.";
      if (base64Image) {
        userContent = [
          { type: 'text', text: userContent },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
        ];
      }

      const messages = this.memoryManager.getContext(MASTER_PROMPT);
      messages.push({ role: 'user', content: userContent });

      fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/Hey-Astreon/Altus-Ai-Platinum',
          'X-Title': 'Altus AI Platinum',
        },
        body: JSON.stringify({ model, messages, max_tokens: 150, stream: false }),
      })
      .then(res => res.json())
      .then(data => {
        const answer = data.choices[0]?.message?.content || 'Metadata analysis failed.';
        this.memoryManager.addInteraction({ role: 'user', content: userContent }, answer);
        resolve(answer);
      })
      .catch(() => resolve('Intelligence link severed.'));
    });
  }

  public clearMemory() {
    this.memoryManager.clear();
  }
}
