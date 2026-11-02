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
  providerStatus?: Partial<Record<CLIProvider, { isInstalled: boolean; isAuthenticated?: boolean }>>;
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
   * Checks whether a provider is available and authenticated based on provided status.
   */
  private static isProviderAvailable(
    provider: CLIProvider,
    providerStatus?: Partial<Record<CLIProvider, { isInstalled: boolean; isAuthenticated?: boolean }>>
  ): boolean {
    if (!providerStatus || !providerStatus[provider]) return true;
    const status = providerStatus[provider]!;
    if (status.isInstalled === false) return false;
    if (status.isAuthenticated === false) return false;
    return true;
  }

  /**
   * Helper to pick the best model candidate satisfying context window and provider availability constraints.
   */
  private static selectBestCandidate(
    candidateKeys: string[],
    category: TaskCategory,
    reasonBase: string,
    options: RouteTaskOptions
  ): ModelRoutingDecision {
    const { estimatedInputTokens = 1500, providerStatus } = options;
    const disqualifications: string[] = [];

    for (const key of candidateKeys) {
      const spec = this.MODEL_SPECS[key];
      if (!spec) continue;

      // 1. Check provider installation & auth availability
      if (!this.isProviderAvailable(spec.provider, providerStatus)) {
        disqualifications.push(`Provider '${spec.provider}' not installed/authenticated`);
        continue;
      }

      // 2. Check context limit
      if (estimatedInputTokens > spec.contextWindow) {
        disqualifications.push(`Model '${spec.modelName}' window (${spec.contextWindow.toLocaleString()}) < estimated tokens (${estimatedInputTokens.toLocaleString()})`);
        continue;
      }

      // Candidate matches all constraints
      const reason = disqualifications.length > 0
        ? `${reasonBase} [Fallback applied: ${disqualifications.join('; ')}]`
        : reasonBase;

      return {
        selectedProvider: spec.provider,
        selectedModel: spec.modelName,
        taskCategory: category,
        reason,
        isAirGapEnforced: false,
        estimatedCostRateUsd: { inRate: spec.inRate, outRate: spec.outRate },
        confidence: disqualifications.length > 0 ? 0.82 : 0.92
      };
    }

    // Ultimate fallback: widest context model available (gemini-pro or claude-sonnet)
    const fallbackCandidates = ['gemini-pro', 'claude-sonnet', 'gpt-4o', 'ollama'];
    for (const key of fallbackCandidates) {
      const spec = this.MODEL_SPECS[key];
      if (this.isProviderAvailable(spec.provider, providerStatus)) {
        return {
          selectedProvider: spec.provider,
          selectedModel: spec.modelName,
          taskCategory: category,
          reason: `${reasonBase} [Enforced fallback: ${disqualifications.join('; ')}]`,
          isAirGapEnforced: false,
          estimatedCostRateUsd: { inRate: spec.inRate, outRate: spec.outRate },
          confidence: 0.75
        };
      }
    }

    // Default if all providers unavailable
    const def = this.MODEL_SPECS['gemini-flash'];
    return {
      selectedProvider: def.provider,
      selectedModel: def.modelName,
      taskCategory: category,
      reason: `${reasonBase} [Warning: No verified providers available; defaulting to ${def.provider}]`,
      isAirGapEnforced: false,
      estimatedCostRateUsd: { inRate: def.inRate, outRate: def.outRate },
      confidence: 0.5
    };
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
      const localModel = config.defaultLocalModel || 'llama3:latest';
      const ollamaContextLimit = 32000;

      let reason = 'Air-Gap isolation mode is active. Enforcing local Ollama execution.';
      let confidence = 1.0;

      if (estimatedInputTokens > ollamaContextLimit) {
        reason = `Air-Gap isolation mode active. Context size (${estimatedInputTokens.toLocaleString()} tokens) exceeds Ollama context window (${ollamaContextLimit.toLocaleString()} tokens) - prompt compression required. Cloud routing strictly blocked.`;
        confidence = 0.6;
      }

      return {
        selectedProvider: 'ollama',
        selectedModel: localModel,
        taskCategory: category,
        reason,
        isAirGapEnforced: true,
        estimatedCostRateUsd: { inRate: 0, outRate: 0 },
        confidence
      };
    }

    // 2. Large Context Routing (> 100k tokens)
    if (estimatedInputTokens > 100000) {
      const candidates = preferredProvider === 'gemini'
        ? ['gemini-pro']
        : preferredProvider === 'claude'
        ? ['claude-sonnet', 'gemini-pro']
        : ['gemini-pro', 'claude-sonnet'];

      return this.selectBestCandidate(
        candidates,
        'large_context',
        `Context size (${estimatedInputTokens.toLocaleString()} tokens) requires ultra-wide context window.`,
        options
      );
    }

    // 3. Lightweight Tasks: Classification & Simple Summarization
    if (category === 'classification' || category === 'summarization') {
      if (optimizationMode === 'cost_efficient' || optimizationMode === 'balanced') {
        const candidates = preferredProvider === 'claude'
          ? ['claude-haiku', 'gemini-flash', 'gpt-4o-mini']
          : preferredProvider === 'codex'
          ? ['gpt-4o-mini', 'gemini-flash', 'claude-haiku']
          : ['gemini-flash', 'gpt-4o-mini', 'claude-haiku'];

        return this.selectBestCandidate(
          candidates,
          category,
          `Lightweight task category (${category}) routed to cost-efficient, fast model.`,
          options
        );
      }
    }

    // 4. Deep Reasoning, Security Review & Complex Architecture
    if (
      category === 'deep_reasoning' ||
      category === 'security_review' ||
      category === 'architecture' ||
      options.requiresReasoning
    ) {
      const candidates = preferredProvider === 'codex'
        ? ['gpt-4o', 'claude-sonnet', 'gemini-pro']
        : preferredProvider === 'gemini'
        ? ['gemini-pro', 'claude-sonnet', 'gpt-4o']
        : ['claude-sonnet', 'gpt-4o', 'gemini-pro'];

      return this.selectBestCandidate(
        candidates,
        category,
        `High complexity task category (${category}) routed to frontier reasoning model.`,
        options
      );
    }

    // 5. Code Generation & Implementation
    if (category === 'code_generation' || options.requiresModifications) {
      if (optimizationMode === 'cost_efficient' && !options.requiresReasoning) {
        const candidates = preferredProvider === 'codex'
          ? ['gpt-4o-mini', 'gemini-pro', 'claude-haiku']
          : preferredProvider === 'claude'
          ? ['claude-haiku', 'gemini-pro', 'gpt-4o-mini']
          : ['gemini-pro', 'gpt-4o-mini', 'claude-haiku'];

        return this.selectBestCandidate(
          candidates,
          category,
          `Standard code generation routed to balanced model under ${optimizationMode} policy.`,
          options
        );
      }

      // Default high-precision coding model
      const candidates = preferredProvider === 'codex'
        ? ['gpt-4o', 'claude-sonnet', 'gemini-pro']
        : preferredProvider === 'gemini'
        ? ['gemini-pro', 'claude-sonnet', 'gpt-4o']
        : ['claude-sonnet', 'gpt-4o', 'gemini-pro'];

      return this.selectBestCandidate(
        candidates,
        category,
        'Code generation routed to primary coding-optimized frontier model.',
        options
      );
    }

    // Default / General Fallback
    const fallbackCandidates = preferredProvider === 'codex'
      ? ['gpt-4o', 'gemini-pro', 'claude-sonnet']
      : preferredProvider === 'gemini'
      ? ['gemini-pro', 'claude-sonnet', 'gpt-4o']
      : ['claude-sonnet', 'gemini-pro', 'gpt-4o'];

    return this.selectBestCandidate(
      fallbackCandidates,
      category,
      'Standard task execution routed to balanced default provider.',
      options
    );
  }
}
