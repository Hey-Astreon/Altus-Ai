import axios from 'axios';

const COMPRESSION_MODEL = 'openrouter/auto';

export class MemoryManager {
  private apiKey: string;
  private shortTermHistory: { role: 'user' | 'assistant' | 'system', content: string | any[] }[] = [];
  private semanticSummary: string = '';
  private isCompressing: boolean = false;
  
  private readonly VERBATIM_LIMIT = 4; // Keep last 2 Q&A pairs verbatim for speed

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public setApiKey(key: string) {
    this.apiKey = key;
  }

  public clear() {
    this.shortTermHistory = [];
    this.semanticSummary = '';
    this.isCompressing = false;
  }

  public addInteraction(userMsg: any, assistantContent: string) {
    this.shortTermHistory.push(userMsg);
    this.shortTermHistory.push({ role: 'assistant', content: assistantContent });

    // Trigger background compression if history exceeds limit
    if (this.shortTermHistory.length > this.VERBATIM_LIMIT && !this.isCompressing) {
      this.triggerCompressionLoop();
    }
  }

  public getContext(systemPrompt: string): any[] {
    const messages: any[] = [{ role: 'system', content: systemPrompt }];
    
    if (this.semanticSummary) {
      messages.push({ role: 'system', content: `PREVIOUS CONTEXT SUMMARY: ${this.semanticSummary}` });
    }

    // Add last few verbatim interactions
    messages.push(...this.shortTermHistory.slice(-this.VERBATIM_LIMIT));
    
    return messages;
  }

  private async triggerCompressionLoop() {
    if (this.isCompressing || this.shortTermHistory.length <= this.VERBATIM_LIMIT) return;

    this.isCompressing = true;
    const agingContext = this.shortTermHistory.splice(0, 2);
    
    try {
      const qText = typeof agingContext[0].content === 'string' 
        ? agingContext[0].content 
        : (agingContext[0].content as any[]).map(c => c.text || '').join(' ');
      
      const aText = agingContext[1].content as string;

      const prompt = `Update the interview summary. Be extremely concise.
      CURRENT SUMMARY: "${this.semanticSummary || "Fresh start."}"
      ADD INTERACTION:
      User: ${qText}
      Assistant: ${aText}`;

      await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: COMPRESSION_MODEL,
          messages: [{ role: 'system', content: prompt }],
          max_tokens: 500,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          }
        }
      ).then(response => {
        if (response.data?.choices[0]?.message?.content) {
          this.semanticSummary = response.data.choices[0].message.content.trim();
        }
      });
    } catch (err) {
      // Put them back on failure
      this.shortTermHistory.unshift(...agingContext);
    } finally {
      this.isCompressing = false;
    }
  }
}
