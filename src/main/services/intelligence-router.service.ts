import type { CLIProvider } from '../../shared/cli';
import type {
  TaskCategory,
  ModelRoutingDecision,
  OptimizationMode
} from '../../shared/intelligence';
import { airGapManager } from './air-gap.manager';

export interface RouteTaskOptions {
  taskDescription: string;
  category?: TaskCategory;
  estimatedInputTokens?: number;
  requiresModifications?: boolean;
  requiresReasoning?: boolean;
  preferredProvider?: CLIProvider;
  optimizationMode?: OptimizationMode;
}

export class IntelligenceRouter {
  /**
   * Model cost rates per 1M tokens: [inRate, outRate] USD
   */
  private static readonly MODEL_SPECS: Record<
    string,
    {
      provider: CLIProvider;
      modelName: string;
      contextWindow: number;
      inRate: number;
      outRate: number;
      capabilities: string[];
    }
  > = {
    'gemini-flash': {
      provider: 'gemini',
      modelName: 'gemini-1.5-flash',
      contextWindow: 1000000,
      inRate: 0.075,
      outRate: 0.3,
      capabilities: ['fast', 'classification', 'summarization', 'cheap']
    },
    'gemini-pro': {
      provider: 'gemini',
      modelName: 'gemini-1.5-pro',
      contextWindow: 1000000,
      inRate: 1.25,
      outRate: 5.0,
      capabilities: ['large_context', 'reasoning', 'coding']
    },
    'claude-haiku': {
      provider: 'claude',
      modelName: 'claude-3-haiku',
      contextWindow: 200000,
      inRate: 0.25,
      outRate: 1.25,
      capabilities: ['fast', 'summarization', 'classification']
    },
    'claude-sonnet': {
      provider: 'claude',
      modelName: 'claude-3-5-sonnet',
      contextWindow: 200000,
      inRate: 3.0,
      outRate: 15.0,
      capabilities: ['coding', 'reasoning', 'architecture', 'security']
    },
    'gpt-4o-mini': {
      provider: 'codex',
      modelName: 'gpt-4o-mini',
      contextWindow: 128000,
      inRate: 0.15,
      outRate: 0.6,
      capabilities: ['fast', 'classification', 'summarization']
    },
    'gpt-4o': {
      provider: 'codex',
      modelName: 'gpt-4o',
      contextWindow: 128000,
      inRate: 2.5,
      outRate: 10.0,
      capabilities: ['coding', 'reasoning', 'tools']
    },
    ollama: {
      provider: 'ollama',
      modelName: 'llama3:latest',
      contextWindow: 32000,
      inRate: 0.0,
      outRate: 0.0,
      capabilities: ['local', 'offline', 'privacy']
    }
  };

  /**
   * Infers task category from task text and parameters.
   */
  public static inferCategory(task: string): TaskCategory {
    const lower = task.toLowerCase();

    if (/(classify|intent|categorize|is this|label|filter)/i.test(lower)) {
      return 'classification';
    }
    if (/(summarize|summary|tldr|changelog|diff summary|brief)/i.test(lower)) {
      return 'summarization';
    }
    if (/(security|vulnerability|audit|owasp|cve|injection|leak)/i.test(lower)) {
      return 'security_review';
    }
    if (/(architect|architecture|system design|topology|structure|scaffold)/i.test(lower)) {
      return 'architecture';
    }
    if (/(why does this crash|root cause|diagnose|debug|deadlock|race condition)/i.test(lower)) {
      return 'deep_reasoning';
    }
    if (/(write|generate|implement|refactor|fix|patch|create|build)/i.test(lower)) {
      return 'code_generation';
    }
    return 'general';
  }

  /**
   * Selects the optimal model and provider based on task complexity, context size, and cost policies.
   */
  public static routeTask(options: RouteTaskOptions): ModelRoutingDecision {
    const {
      taskDescription,
      estimatedInputTokens = 1500,
      preferredProvider,
      optimizationMode = 'balanced'
    } = options;

    const category = options.category || this.inferCategory(taskDescription);

    // 1. Air-Gap Mode Override (Highest Priority)
    if (airGapManager.isAirGapEnabled()) {
      const config = airGapManager.getConfig();
      return {
        selectedProvider: 'ollama',
        selectedModel: config.defaultLocalModel || 'llama3:latest',
        taskCategory: category,
        reason: 'Air-Gap isolation mode is active. Enforcing local Ollama execution.',
        isAirGapEnforced: true,
        estimatedCostRateUsd: { inRate: 0, outRate: 0 },
        confidence: 1.0
      };
    }

    // 2. Large Context Routing (> 100k tokens)
    if (estimatedInputTokens > 100000) {
      const spec = this.MODEL_SPECS['gemini-pro'];
      return {
        selectedProvider: spec.provider,
        selectedModel: spec.modelName,
        taskCategory: 'large_context',
        reason: `Context size (${estimatedInputTokens.toLocaleString()} tokens) requires ultra-wide context window.`,
        isAirGapEnforced: false,
        estimatedCostRateUsd: { inRate: spec.inRate, outRate: spec.outRate },
        confidence: 0.95
      };
    }

    // 3. Lightweight Tasks: Classification & Simple Summarization
    if (category === 'classification' || category === 'summarization') {
      if (optimizationMode === 'cost_efficient' || optimizationMode === 'balanced') {
        const spec =
          preferredProvider === 'claude'
            ? this.MODEL_SPECS['claude-haiku']
            : preferredProvider === 'codex'
            ? this.MODEL_SPECS['gpt-4o-mini']
            : this.MODEL_SPECS['gemini-flash'];

        return {
          selectedProvider: spec.provider,
          selectedModel: spec.modelName,
          taskCategory: category,
          reason: `Lightweight task category (${category}) routed to cost-efficient, fast model.`,
          isAirGapEnforced: false,
          estimatedCostRateUsd: { inRate: spec.inRate, outRate: spec.outRate },
          confidence: 0.9
        };
      }
    }

    // 4. Deep Reasoning, Security Review & Complex Architecture
    if (
      category === 'deep_reasoning' ||
      category === 'security_review' ||
      category === 'architecture' ||
      options.requiresReasoning
    ) {
      const spec =
        preferredProvider === 'codex'
          ? this.MODEL_SPECS['gpt-4o']
          : this.MODEL_SPECS['claude-sonnet'];

      return {
        selectedProvider: spec.provider,
        selectedModel: spec.modelName,
        taskCategory: category,
        reason: `High complexity task category (${category}) routed to frontier reasoning model.`,
        isAirGapEnforced: false,
        estimatedCostRateUsd: { inRate: spec.inRate, outRate: spec.outRate },
        confidence: 0.95
      };
    }

    // 5. Code Generation & Implementation
    if (category === 'code_generation' || options.requiresModifications) {
      if (optimizationMode === 'cost_efficient' && !options.requiresReasoning) {
        // Balanced coding model
        const spec =
          preferredProvider === 'codex'
            ? this.MODEL_SPECS['gpt-4o-mini']
            : this.MODEL_SPECS['gemini-pro'];

        return {
          selectedProvider: spec.provider,
          selectedModel: spec.modelName,
          taskCategory: category,
          reason: `Standard code generation routed to balanced model under ${optimizationMode} policy.`,
          isAirGapEnforced: false,
          estimatedCostRateUsd: { inRate: spec.inRate, outRate: spec.outRate },
          confidence: 0.85
        };
      }

      // Default high-precision coding model
      const spec =
        preferredProvider === 'codex'
          ? this.MODEL_SPECS['gpt-4o']
          : preferredProvider === 'gemini'
          ? this.MODEL_SPECS['gemini-pro']
          : this.MODEL_SPECS['claude-sonnet'];

      return {
        selectedProvider: spec.provider,
        selectedModel: spec.modelName,
        taskCategory: category,
        reason: `Code generation routed to primary coding-optimized frontier model.`,
        isAirGapEnforced: false,
        estimatedCostRateUsd: { inRate: spec.inRate, outRate: spec.outRate },
        confidence: 0.92
      };
    }

    // Default / General Fallback
    const fallback =
      preferredProvider === 'codex'
        ? this.MODEL_SPECS['gpt-4o']
        : preferredProvider === 'gemini'
        ? this.MODEL_SPECS['gemini-pro']
        : this.MODEL_SPECS['claude-sonnet'];

    return {
      selectedProvider: fallback.provider,
      selectedModel: fallback.modelName,
      taskCategory: category,
      reason: 'Standard task execution routed to balanced default provider.',
      isAirGapEnforced: false,
      estimatedCostRateUsd: { inRate: fallback.inRate, outRate: fallback.outRate },
      confidence: 0.8
    };
  }
}
