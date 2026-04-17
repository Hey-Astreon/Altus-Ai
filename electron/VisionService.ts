import screenshot from 'screenshot-desktop';

export class VisionService {
  /**
   * Captures the primary screen as a base64 string.
   * Silent on Windows (no shutter sound).
   */
  public async captureScreen(): Promise<string> {
    try {
      const imgBuffer = await screenshot({ format: 'jpg' });
      return imgBuffer.toString('base64');
    } catch (error) {
      console.error('[VisionService] Capture failed:', error);
      throw error;
    }
  }
}
