import axios from 'axios';
import { EventEmitter } from 'events';

export type InterviewPersona = 'Technical' | 'SystemDesign' | 'Behavioral';
export type ModelMode = 'Turbo' | 'Genius';

const MODELS = {
  Turbo: 'google/gemma-4-31b:free',
  Genius: 'anthropic/claude-3.5-sonnet',
};

const SYSTEM_PROMPTS: Record<InterviewPersona, string> = {
  Technical: `You are an elite Software Engineer interview assistant. 
    Provide concise, technical answers to coding and logic questions. 
    Skip all conversational filler. Use bullet points for steps. 
    For code snippets, provide the most optimal solution using professional patterns.`,
    
  SystemDesign: `You are a Principal Architect. 
    Focus on scalability, reliability, and modern architectural patterns (Microservices, Load Balancing, Database Sharding). 
    Provide clear diagrams in text/mermaid format if applicable. 
    Highlight trade-offs for every decision.`,
    
  Behavioral: `You are an expert Career Coach. 
    Help answer HR and leadership questions using the STAR method (Situation, Task, Action, Result). 
    Focus on impact, growth, and team collaboration.`,
};

export class OpenRouterService extends EventEmitter {
  private apiKey: string;
  private currentMode: ModelMode = 'Turbo';
  private currentPersona: InterviewPersona = 'Technical';
  private history: { role: 'user' | 'assistant' | 'system', content: string }[] = [];

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  public setMode(mode: ModelMode) {
    this.currentMode = mode;
  }

  public setPersona(persona: InterviewPersona) {
    this.currentPersona = persona;
  }

  public async getAnswer(question: string, base64Image?: string) {
    // If an image is provided, we MUST use a vision-capable model.
    // Claude-3.5-Sonnet is significantly better at diagram/code analysis than Gemma.
    const model = base64Image ? MODELS.Genius : MODELS[this.currentMode];
    const systemPrompt = SYSTEM_PROMPTS[this.currentPersona];

    let userContent: any = question;
    if (base64Image) {
      userContent = [
        { type: 'text', text: question || "Identify the code or diagram in this screenshot and provide a clear, technical explanation or solution." },
        { 
          type: 'image_url', 
          image_url: { 
            url: `data:image/jpeg;base64,${base64Image}` 
          } 
        }
      ];
    }

    // Build message context
    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.history.slice(-6), // Context
      { role: 'user', content: userContent }
    ];

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/aura-ai', // Required by OpenRouter
          'X-Title': 'Aura Interview Assistant',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          stream: true,
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
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
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      // Save to history
      this.history.push({ role: 'user', content: question });
      this.history.push({ role: 'assistant', content: fullText });
      
      this.emit('answer-end', fullText);
    } catch (error) {
      console.error('[OpenRouter] Global error:', error);
      this.emit('error', error);
    }
  }

  public clearHistory() {
    this.history = [];
  }
}
