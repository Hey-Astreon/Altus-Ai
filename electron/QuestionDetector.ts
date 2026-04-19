export class QuestionDetector {
  private lastTriggeredText: string = '';

  /**
   * Simple heuristic to detect if a transcript contains a question.
   * We look for question marks or starting keywords.
   */
  private lastTriggeredTime: number = 0;
  private readonly TRIGGER_COOLDOWN = 3000; // 3 seconds cooldown

  /**
   * Simple heuristic to detect if a transcript contains a question.
   */
  public isQuestion(text: string): boolean {
    const trimmed = text.trim().toLowerCase();
    const now = Date.now();
    
    // Minimum length check and cooldown
    if (trimmed.length < 15) return false;
    if (now - this.lastTriggeredTime < this.TRIGGER_COOLDOWN) return false;
    if (trimmed === this.lastTriggeredText) return false;

    const questionKeywords = [
      'who', 'what', 'where', 'when', 'why', 'how', 
      'can you', 'could you', 'would you', 'describe',
      'explain', 'tell me', 'show me', 'give me',
      'what is', 'how does', 'write a', 'implement a'
    ];

    const hasQuestionMark = trimmed.includes('?');
    const startsWithKeyword = questionKeywords.some(keyword => trimmed.startsWith(keyword));
    
    // Interview questions are usually longer than 5 words
    const wordCount = trimmed.split(/\s+/).length;
    const isLikelyQuestion = hasQuestionMark || (startsWithKeyword && wordCount >= 4);

    if (isLikelyQuestion) {
      this.lastTriggeredText = trimmed;
      this.lastTriggeredTime = now;
      return true;
    }

    return false;
  }

  public reset() {
    this.lastTriggeredText = '';
  }
}
