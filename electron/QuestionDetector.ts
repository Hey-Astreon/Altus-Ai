export class QuestionDetector {
  private lastTriggeredText: string = '';

  /**
   * Simple heuristic to detect if a transcript contains a question.
   * We look for question marks or starting keywords.
   */
  public isQuestion(text: string): boolean {
    const trimmed = text.trim().toLowerCase();
    
    // Avoid re-triggering on the exact same text
    if (trimmed === this.lastTriggeredText) return false;

    const questionKeywords = [
      'who', 'what', 'where', 'when', 'why', 'how', 
      'can you', 'could you', 'would you', 'describe',
      'explain', 'tell me', 'show me', 'give me',
      'what is', 'how does'
    ];

    const hasQuestionMark = trimmed.includes('?');
    const startsWithKeyword = questionKeywords.some(keyword => trimmed.startsWith(keyword));
    
    // We also want to capture sentences that sound like instructions or questions 
    // even without a '?' if they are long enough to be an interview question.
    const isLikelyQuestion = hasQuestionMark || (startsWithKeyword && trimmed.split(' ').length > 3);

    if (isLikelyQuestion) {
      this.lastTriggeredText = trimmed;
      return true;
    }

    return false;
  }

  public reset() {
    this.lastTriggeredText = '';
  }
}
