import { getEncoding, type Tiktoken } from 'js-tiktoken';

export interface TokenCountResult {
  actualTokens: number;
  estimatedTokens: number;
}

export class TokenCounterService {
  private encoding: Tiktoken | null = null;

  constructor() {
    try {
      this.encoding = getEncoding('cl100k_base');
    } catch (err) {
      console.warn('[TokenCounterService] Could not initialize cl100k_base encoding, using heuristic fallback:', err);
      this.encoding = null;
    }
  }

  /**
   * Fast heuristic estimation (~3.8 characters per token for English & code).
   */
  public estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;
    return Math.ceil(text.length / 3.8);
  }

  /**
   * Accurate BPE token count using cl100k_base tokenizer.
   */
  public countActualTokens(text: string): number {
    if (!text || text.length === 0) return 0;
    if (this.encoding) {
      try {
        return this.encoding.encode(text).length;
      } catch {
        return this.estimateTokens(text);
      }
    }
    return this.estimateTokens(text);
  }

  /**
   * Returns both actual and estimated token counts clearly differentiated.
   */
  public count(text: string): TokenCountResult {
    return {
      actualTokens: this.countActualTokens(text),
      estimatedTokens: this.estimateTokens(text)
    };
  }

  /**
   * Model target token limits reference.
   */
  public getModelMaxBudget(modelTarget: 'claude' | 'codex' | 'gemini'): number {
    switch (modelTarget) {
      case 'gemini':
        return 1000000; // 1M context
      case 'claude':
        return 200000; // 200k context
      case 'codex':
        return 128000; // 128k context
      default:
        return 8000;
    }
  }
}

export const tokenCounterService = new TokenCounterService();
