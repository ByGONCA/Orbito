import { getEncoding, type Tiktoken } from 'js-tiktoken';

export interface TokenCountResult {
  actualTokens: number;
  estimatedTokens: number;
}

export type TokenCountConfidence = 'exact' | 'high' | 'medium' | 'approximate';
export type TokenCountMethod = 'exact_bpe' | 'calibrated_estimate' | 'heuristic_estimate' | 'provider_reported';

export interface TokenEvaluationResult {
  tokens: number;
  isExact: boolean;
  method: TokenCountMethod;
  encodingUsed: 'o200k_base' | 'cl100k_base' | 'heuristic';
  confidence: TokenCountConfidence;
  modelTarget: string;
}

export interface ModelWindowConfig {
  provider: 'claude' | 'codex' | 'gemini' | 'ollama' | 'custom';
  contextWindow: number;
  maxOutputTokens: number;
  reservedSystemTokens: number;
  safetyMarginRatio: number; // e.g. 0.10 for 10% safety buffer
}

export const MODEL_WINDOW_CONFIGS: Record<string, ModelWindowConfig> = {
  // Claude models
  'claude-3-7-sonnet': {
    provider: 'claude',
    contextWindow: 200000,
    maxOutputTokens: 64000,
    reservedSystemTokens: 4000,
    safetyMarginRatio: 0.1
  },
  'claude-3-5-sonnet': {
    provider: 'claude',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    reservedSystemTokens: 4000,
    safetyMarginRatio: 0.1
  },
  'claude-3-haiku': {
    provider: 'claude',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    reservedSystemTokens: 2000,
    safetyMarginRatio: 0.1
  },
  claude: {
    provider: 'claude',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    reservedSystemTokens: 4000,
    safetyMarginRatio: 0.1
  },

  // OpenAI Codex / GPT models
  'gpt-4o': {
    provider: 'codex',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    reservedSystemTokens: 4000,
    safetyMarginRatio: 0.1
  },
  'gpt-4o-mini': {
    provider: 'codex',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    reservedSystemTokens: 2000,
    safetyMarginRatio: 0.1
  },
  codex: {
    provider: 'codex',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    reservedSystemTokens: 4000,
    safetyMarginRatio: 0.1
  },

  // Google Gemini models
  'gemini-1.5-pro': {
    provider: 'gemini',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    reservedSystemTokens: 4000,
    safetyMarginRatio: 0.05
  },
  'gemini-2.0-flash': {
    provider: 'gemini',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    reservedSystemTokens: 2000,
    safetyMarginRatio: 0.05
  },
  gemini: {
    provider: 'gemini',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    reservedSystemTokens: 4000,
    safetyMarginRatio: 0.1
  },

  // Local Ollama models
  ollama: {
    provider: 'ollama',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    reservedSystemTokens: 2000,
    safetyMarginRatio: 0.15
  },
  'llama3:latest': {
    provider: 'ollama',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    reservedSystemTokens: 2000,
    safetyMarginRatio: 0.15
  }
};

export class TokenCounterService {
  private cl100kEncoding: Tiktoken | null = null;
  private o200kEncoding: Tiktoken | null = null;

  constructor() {
    try {
      this.cl100kEncoding = getEncoding('cl100k_base');
    } catch (err) {
      console.warn('[TokenCounterService] Could not initialize cl100k_base encoding:', err);
      this.cl100kEncoding = null;
    }

    try {
      this.o200kEncoding = getEncoding('o200k_base');
    } catch (err) {
      console.warn('[TokenCounterService] Could not initialize o200k_base encoding:', err);
      this.o200kEncoding = null;
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
   * Evaluates token count with provider/model awareness and explicit confidence classification.
   */
  public evaluateTokens(text: string, modelTarget: string = 'claude'): TokenEvaluationResult {
    if (!text || text.length === 0) {
      return {
        tokens: 0,
        isExact: true,
        method: 'exact_bpe',
        encodingUsed: 'cl100k_base',
        confidence: 'exact',
        modelTarget
      };
    }

    const targetLower = (modelTarget || '').toLowerCase();

    // 1. OpenAI GPT-4o / GPT-4o-mini / o1 / o3 native o200k_base BPE
    if (
      targetLower.includes('gpt-4o') ||
      targetLower.includes('o1') ||
      targetLower.includes('o3') ||
      targetLower.includes('o200k')
    ) {
      if (this.o200kEncoding) {
        try {
          const tokens = this.o200kEncoding.encode(text).length;
          return {
            tokens,
            isExact: true,
            method: 'exact_bpe',
            encodingUsed: 'o200k_base',
            confidence: 'exact',
            modelTarget
          };
        } catch {
          // Fallback below
        }
      }
    }

    // 2. OpenAI GPT-4 / GPT-3.5 / Codex native cl100k_base BPE
    if (
      targetLower.includes('codex') ||
      targetLower.includes('gpt-4') ||
      targetLower.includes('gpt-3.5')
    ) {
      if (this.cl100kEncoding) {
        try {
          const tokens = this.cl100kEncoding.encode(text).length;
          return {
            tokens,
            isExact: true,
            method: 'exact_bpe',
            encodingUsed: 'cl100k_base',
            confidence: 'exact',
            modelTarget
          };
        } catch {
          // Fallback below
        }
      }
    }

    // 3. Anthropic Claude (Calibrated BPE Estimate)
    // Claude uses proprietary byte-level BPE (~1.06x ratio relative to cl100k for code/mixed text)
    if (targetLower.includes('claude') || targetLower.includes('anthropic') || targetLower.includes('sonnet') || targetLower.includes('haiku')) {
      if (this.cl100kEncoding) {
        try {
          const baseTokens = this.cl100kEncoding.encode(text).length;
          const calibrated = Math.ceil(baseTokens * 1.06);
          return {
            tokens: calibrated,
            isExact: false, // Labelled honestly as calibrated estimate
            method: 'calibrated_estimate',
            encodingUsed: 'cl100k_base',
            confidence: 'high',
            modelTarget
          };
        } catch {
          // Fallback below
        }
      }
    }

    // 4. Google Gemini (SentencePiece 256k vocab, ~0.96x ratio relative to cl100k)
    if (targetLower.includes('gemini')) {
      if (this.cl100kEncoding) {
        try {
          const baseTokens = this.cl100kEncoding.encode(text).length;
          const calibrated = Math.ceil(baseTokens * 0.96);
          return {
            tokens: calibrated,
            isExact: false,
            method: 'calibrated_estimate',
            encodingUsed: 'cl100k_base',
            confidence: 'high',
            modelTarget
          };
        } catch {
          // Fallback below
        }
      }
    }

    // 5. Local Ollama (Llama 3 / Mistral 128k BPE, ~1.02x relative to cl100k)
    if (targetLower.includes('ollama') || targetLower.includes('llama') || targetLower.includes('mistral')) {
      if (this.cl100kEncoding) {
        try {
          const baseTokens = this.cl100kEncoding.encode(text).length;
          const calibrated = Math.ceil(baseTokens * 1.02);
          return {
            tokens: calibrated,
            isExact: false,
            method: 'calibrated_estimate',
            encodingUsed: 'cl100k_base',
            confidence: 'medium',
            modelTarget
          };
        } catch {
          // Fallback below
        }
      }
    }

    // 6. Generic BPE Fallback using cl100k_base
    if (this.cl100kEncoding) {
      try {
        const tokens = this.cl100kEncoding.encode(text).length;
        return {
          tokens,
          isExact: false,
          method: 'calibrated_estimate',
          encodingUsed: 'cl100k_base',
          confidence: 'medium',
          modelTarget
        };
      } catch {
        // Fallback below
      }
    }

    // 7. Heuristic Fallback
    const heuristic = this.estimateTokens(text);
    return {
      tokens: heuristic,
      isExact: false,
      method: 'heuristic_estimate',
      encodingUsed: 'heuristic',
      confidence: 'approximate',
      modelTarget
    };
  }

  /**
   * Model-aware actual or calibrated token count.
   */
  public countActualTokens(text: string, modelTarget: string = 'claude'): number {
    return this.evaluateTokens(text, modelTarget).tokens;
  }

  /**
   * Alias for countActualTokens with explicit model target.
   */
  public countModelTokens(text: string, modelTarget: string): number {
    return this.countActualTokens(text, modelTarget);
  }

  /**
   * Returns both actual/calibrated and heuristic estimated token counts.
   */
  public count(text: string, modelTarget: string = 'claude'): TokenCountResult {
    return {
      actualTokens: this.countActualTokens(text, modelTarget),
      estimatedTokens: this.estimateTokens(text)
    };
  }

  /**
   * Reconciles a local token estimation against official provider-reported usage.
   */
  public reconcileWithProviderUsage(
    estimatedPromptTokens: number,
    reportedProviderTokens: number
  ): {
    estimatedTokens: number;
    reportedTokens: number;
    varianceTokens: number;
    varianceRatio: number;
    variancePercentage: number;
    isAligned: boolean;
  } {
    if (reportedProviderTokens <= 0) {
      return {
        estimatedTokens: estimatedPromptTokens,
        reportedTokens: reportedProviderTokens,
        varianceTokens: 0,
        varianceRatio: 0,
        variancePercentage: 0,
        isAligned: true
      };
    }

    const varianceTokens = Math.abs(reportedProviderTokens - estimatedPromptTokens);
    const varianceRatio = Number((varianceTokens / reportedProviderTokens).toFixed(4));
    const variancePercentage = Number((varianceRatio * 100).toFixed(2));
    const isAligned = Math.abs(varianceRatio) <= 0.15; // Within 15% tolerance

    return {
      estimatedTokens: estimatedPromptTokens,
      reportedTokens: reportedProviderTokens,
      varianceTokens,
      varianceRatio,
      variancePercentage,
      isAligned
    };
  }

  /**
   * Returns exact context window size for target model.
   */
  public getModelContextLimit(modelTarget: string): number {
    return this.getModelConfig(modelTarget).contextWindow;
  }

  /**
   * Retrieves context window specifications for a target model/provider.
   */
  public getModelConfig(modelTarget: string): ModelWindowConfig {
    const key = (modelTarget || '').toLowerCase();

    // Direct match
    if (MODEL_WINDOW_CONFIGS[key]) {
      return MODEL_WINDOW_CONFIGS[key];
    }

    // Pattern match
    for (const [modelKey, cfg] of Object.entries(MODEL_WINDOW_CONFIGS)) {
      if (key.includes(modelKey) || modelKey.includes(key)) {
        return cfg;
      }
    }

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
    modelTarget: string = 'claude',
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
  public getModelMaxBudget(modelTarget: string): number {
    return this.calculateAvailableContextBudget(modelTarget);
  }
}

export const tokenCounterService = new TokenCounterService();
