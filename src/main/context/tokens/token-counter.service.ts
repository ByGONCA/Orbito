import { getEncoding, type Tiktoken } from 'js-tiktoken';

export interface TokenCountResult {
  actualTokens: number;
  estimatedTokens: number;
}

export interface ModelWindowConfig {
  provider: 'claude' | 'codex' | 'gemini' | 'custom';
  contextWindow: number;
  maxOutputTokens: number;
  reservedSystemTokens: number;
  safetyMarginRatio: number; // e.g. 0.10 for 10% safety buffer
}

export const MODEL_WINDOW_CONFIGS: Record<'claude' | 'codex' | 'gemini', ModelWindowConfig> = {
  claude: {
    provider: 'claude',
    contextWindow: 200000, // 200k context (Claude 3.5 / 3.7)
    maxOutputTokens: 8192,
    reservedSystemTokens: 4000,
    safetyMarginRatio: 0.1 // 10% safety margin buffer
  },
  codex: {
    provider: 'codex',
    contextWindow: 128000, // 128k context (GPT-4o / Codex)
    maxOutputTokens: 16384,
    reservedSystemTokens: 4000,
    safetyMarginRatio: 0.1
  },
  gemini: {
    provider: 'gemini',
    contextWindow: 1000000, // 1M context (Gemini 1.5 / 2.0)
    maxOutputTokens: 8192,
    reservedSystemTokens: 4000,
    safetyMarginRatio: 0.1
  }
};

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
   * Retrieves context window specifications for a target model/provider.
   */
  public getModelConfig(modelTarget: 'claude' | 'codex' | 'gemini' | string): ModelWindowConfig {
    const key = modelTarget.toLowerCase();
    if (key.includes('gemini')) return MODEL_WINDOW_CONFIGS.gemini;
    if (key.includes('codex') || key.includes('openai') || key.includes('gpt')) return MODEL_WINDOW_CONFIGS.codex;
    if (key.includes('claude') || key.includes('anthropic')) return MODEL_WINDOW_CONFIGS.claude;

    // Default conservative fallback
    return {
      provider: 'custom',
      contextWindow: 32000,
      maxOutputTokens: 4096,
      reservedSystemTokens: 2000,
      safetyMarginRatio: 0.1
    };
  }

  /**
   * Calculates safe usable context budget for retrieval assembly, subtracting
   * max output, reserved system prompt, and applying a protective safety margin buffer.
   */
  public calculateAvailableContextBudget(
    modelTarget: 'claude' | 'codex' | 'gemini' | string,
    customSafetyMarginRatio?: number
  ): number {
    const config = this.getModelConfig(modelTarget);
    const margin = customSafetyMarginRatio !== undefined ? customSafetyMarginRatio : config.safetyMarginRatio;
    const grossBudget = config.contextWindow - config.maxOutputTokens - config.reservedSystemTokens;
    if (grossBudget <= 0) return 4000;
    return Math.floor(grossBudget * (1 - margin));
  }

  /**
   * Model target token limits reference (for backward compatibility).
   */
  public getModelMaxBudget(modelTarget: 'claude' | 'codex' | 'gemini' | string): number {
    return this.calculateAvailableContextBudget(modelTarget);
  }
}

export const tokenCounterService = new TokenCounterService();
