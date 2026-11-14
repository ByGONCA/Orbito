import type { CLIProvider } from '../../shared/cli';
import type {
  TaskCategory,
  OptimizationMode,
  RoutingMode,
  AdaptiveRoutingDecision
} from '../../shared/intelligence';
import type { ModelRecord } from '../../shared/model-registry';
import { modelRegistry } from './model-registry';
import { modelCapabilityEngine, type TaskCapabilityRequirements } from './model-capability-engine';
import { taskIntelligenceEngine, type ComplexityTier } from './task-intelligence-engine';
import { airGapManager } from '../services/air-gap.manager';

export interface RouteOperationOptions {
  taskDescription: string;
  category?: TaskCategory;
  complexity?: ComplexityTier;
  stageName?: string;
  requiredCapabilities?: TaskCapabilityRequirements;
  preferredModel?: string;
  preferredProvider?: CLIProvider;
  routingMode?: RoutingMode;
  optimizationMode?: OptimizationMode;
  allowedModels?: string[];
  excludedModels?: string[];
  allowedProviders?: CLIProvider[];
  singleProviderOnly?: boolean;
  isEscalation?: boolean;
  failedModelId?: string;
  estimatedInputTokens?: number;
}

export class AdaptiveModelRouter {
  private static instance: AdaptiveModelRouter;

  private constructor() {}

  public static getInstance(): AdaptiveModelRouter {
    if (!AdaptiveModelRouter.instance) {
      AdaptiveModelRouter.instance = new AdaptiveModelRouter();
    }
    return AdaptiveModelRouter.instance;
  }

  /**
   * Main entry point for dynamic model selection per task operation.
   */
  public routeOperation(options: RouteOperationOptions): AdaptiveRoutingDecision {
    const {
      taskDescription,
      routingMode = 'adaptive',
      optimizationMode = 'balanced',
      isEscalation = false,
      failedModelId,
      estimatedInputTokens = 1500
    } = options;

    // 1. Air-Gap Mode Enforcement (Unconditional Local Override)
    if (airGapManager.isAirGapEnabled()) {
      return this.routeAirGap(options);
    }

    // 2. Task Intelligence Analysis (if not pre-computed)
    const category = options.category || taskIntelligenceEngine.inferCategory(taskDescription);

    // 3. Manual Mode
    if (routingMode === 'manual' && options.preferredModel) {
      const explicit = modelRegistry.resolveModel(options.preferredModel);
      if (explicit) {
        return {
          selectedModelId: explicit.id,
          officialModelId: explicit.officialModelId,
          selectedProvider: explicit.provider,
          displayName: explicit.displayName,
          taskCategory: category,
          routingMode: 'manual',
          reason: `Manual Mode active: User explicitly selected model [${explicit.displayName}].`,
          confidence: 1.0,
          isAirGapEnforced: false,
          estimatedCostRateUsd: {
            inRate: explicit.pricing.inRatePerM,
            outRate: explicit.pricing.outRatePerM
          },
          fallbackModelIds: [],
          capabilitiesSummary: {
            reasoning: explicit.capabilities.reasoning,
            coding: explicit.capabilities.coding,
            toolUse: explicit.capabilities.toolUse,
            latencyMs: explicit.capabilities.typicalLatencyMs
          }
        };
      }
    }

    // 4. Discover Available Candidate Models
    let candidates = modelRegistry.getAvailableModels();

    // If discovery found zero available models (e.g. offline/unauthenticated mock test environment),
    // fall back to complete catalog for graceful degraded operation with clear rationale
    if (candidates.length === 0) {
      candidates = modelRegistry.listModels();
    }

    // Filter by allowed / excluded models and providers
    if (options.allowedProviders && options.allowedProviders.length > 0) {
      candidates = candidates.filter((m) => options.allowedProviders!.includes(m.provider));
    }

    if (options.allowedModels && options.allowedModels.length > 0) {
      const allowedClean = options.allowedModels.map((a) => a.toLowerCase());
      candidates = candidates.filter(
        (m) =>
          allowedClean.includes(m.id.toLowerCase()) ||
          allowedClean.includes(m.officialModelId.toLowerCase()) ||
          m.aliases.some((alias) => allowedClean.includes(alias.toLowerCase()))
      );
    }

    if (options.excludedModels && options.excludedModels.length > 0) {
      const excludedClean = options.excludedModels.map((e) => e.toLowerCase());
      candidates = candidates.filter(
        (m) =>
          !excludedClean.includes(m.id.toLowerCase()) &&
          !excludedClean.includes(m.officialModelId.toLowerCase()) &&
          !m.aliases.some((alias) => excludedClean.includes(alias.toLowerCase()))
      );
    }

    // Exclude previously failed model during escalation retry
    if (isEscalation && failedModelId) {
      candidates = candidates.filter(
        (m) => m.id.toLowerCase() !== failedModelId.toLowerCase() && m.officialModelId.toLowerCase() !== failedModelId.toLowerCase()
      );
    }

    // 5. Single-Provider Awareness & Optimization
    // Check if user has only one provider configured or explicitly requested single provider
    const availableProviders = Array.from(new Set(candidates.map((m) => m.provider)));
    const targetProvider = options.preferredProvider || (availableProviders.length === 1 ? availableProviders[0] : undefined);

    let eligibleCandidates = candidates;
    if (targetProvider || options.singleProviderOnly) {
      const providerFiltered = candidates.filter((m) => m.provider === (targetProvider || availableProviders[0]));
      if (providerFiltered.length > 0) {
        eligibleCandidates = providerFiltered;
      }
    }

    // 6. Capability Matching & Ranking
    const requirements: TaskCapabilityRequirements = options.requiredCapabilities || this.deriveRequirements(category, options.complexity, isEscalation);
    requirements.estimatedInputTokens = estimatedInputTokens;

    const ranked = modelCapabilityEngine.rankEligibleModels(eligibleCandidates, requirements);

    // 7. Apply Optimization Mode Selection
    let selected: ModelRecord;
    let fallbackCandidates: ModelRecord[] = [];
    let reason = '';

    if (ranked.length > 0) {
      if (optimizationMode === 'cost_efficient') {
        // Sort eligible candidates by cost efficiency then score
        const costSorted = [...ranked].sort((a, b) => b.match.relativeCostEfficiency - a.match.relativeCostEfficiency);
        selected = costSorted[0].model;
        fallbackCandidates = costSorted.slice(1, 4).map((c) => c.model);
        reason = `Cost-Efficient policy: Selected [${selected.displayName}] ($${selected.pricing.inRatePerM}/$${selected.pricing.outRatePerM}) matching minimum capability thresholds.`;
      } else if (optimizationMode === 'max_quality' || isEscalation) {
        // Pure quality / highest capability model
        selected = ranked[0].model;
        fallbackCandidates = ranked.slice(1, 4).map((c) => c.model);
        reason = isEscalation
          ? `Escalation policy: Switched to frontier model [${selected.displayName}] (score: ${ranked[0].match.overallScore}) following previous failure.`
          : `Max-Quality policy: Selected top-ranked frontier model [${selected.displayName}] (score: ${ranked[0].match.overallScore}).`;
      } else {
        // Balanced (Default): If lightweight task, pick economical; if complex/reasoning, pick capable
        if (category === 'classification' || category === 'summarization') {
          // Prefer high-speed economical
          const fastCandidates = ranked.filter((r) => r.model.capabilities.typicalLatencyMs <= 600);
          selected = fastCandidates.length > 0 ? fastCandidates[0].model : ranked[0].model;
          fallbackCandidates = ranked.filter((r) => r.model.id !== selected.id).slice(0, 3).map((c) => c.model);
          reason = `Balanced policy: Fast & economical model [${selected.displayName}] chosen for lightweight operation (${category}).`;
        } else {
          selected = ranked[0].model;
          fallbackCandidates = ranked.slice(1, 4).map((c) => c.model);
          reason = `Balanced policy: Selected capable model [${selected.displayName}] (score: ${ranked[0].match.overallScore}) for operation (${category}).`;
        }
      }
    } else {
      // Emergency fallback if no model met strict requirements
      selected = eligibleCandidates[0] || modelRegistry.listModels()[0];
      reason = `Fallback: No model met all strict requirements; selected widest-coverage available candidate [${selected.displayName}].`;
    }

    return {
      selectedModelId: selected.id,
      officialModelId: selected.officialModelId,
      selectedProvider: selected.provider,
      displayName: selected.displayName,
      taskCategory: category,
      routingMode,
      reason,
      confidence: ranked.length > 0 ? (isEscalation ? 0.95 : 0.90) : 0.65,
      isAirGapEnforced: false,
      estimatedCostRateUsd: {
        inRate: selected.pricing.inRatePerM,
        outRate: selected.pricing.outRatePerM
      },
      fallbackModelIds: fallbackCandidates.map((m) => m.id),
      capabilitiesSummary: {
        reasoning: selected.capabilities.reasoning,
        coding: selected.capabilities.coding,
        toolUse: selected.capabilities.toolUse,
        latencyMs: selected.capabilities.typicalLatencyMs
      }
    };
  }

  private routeAirGap(options: RouteOperationOptions): AdaptiveRoutingDecision {
    const config = airGapManager.getConfig();
    const targetModelName = config.defaultLocalModel || 'llama3:latest';
    const local = modelRegistry.resolveModel(targetModelName) || modelRegistry.listModels({ provider: 'ollama' })[0];

    const modelRecord: ModelRecord = local || {
      id: `ollama:${targetModelName}`,
      officialModelId: targetModelName,
      displayName: `${targetModelName} (Local Air-Gap)`,
      provider: 'ollama',
      family: 'llama',
      version: 'local',
      contextWindow: 32000,
      maxOutputTokens: 4096,
      executionInterface: 'local_daemon',
      supportedInterfaces: ['local_daemon'],
      authMethod: 'local_daemon',
      availability: 'available',
      pricing: { inRatePerM: 0, outRatePerM: 0, currency: 'USD' },
      capabilities: {
        reasoning: 75,
        coding: 75,
        debugging: 70,
        architecture: 70,
        research: 75,
        summarization: 80,
        classification: 85,
        toolUse: 70,
        structuredOutput: 75,
        longContext: 70,
        vision: false,
        streaming: true,
        typicalLatencyMs: 600
      },
      supportedTools: false,
      mcpCompatible: false,
      aliases: [targetModelName],
      lastDiscoveredAt: Date.now(),
      metadataConfidence: 'verified'
    };

    return {
      selectedModelId: modelRecord.id,
      officialModelId: modelRecord.officialModelId,
      selectedProvider: 'ollama',
      displayName: modelRecord.displayName,
      taskCategory: options.category || 'general',
      routingMode: options.routingMode || 'adaptive',
      reason: 'Air-Gap Isolation active: Outbound network blocked. Enforcing local execution via Ollama.',
      confidence: 1.0,
      isAirGapEnforced: true,
      estimatedCostRateUsd: { inRate: 0, outRate: 0 },
      fallbackModelIds: [],
      capabilitiesSummary: {
        reasoning: modelRecord.capabilities.reasoning,
        coding: modelRecord.capabilities.coding,
        toolUse: modelRecord.capabilities.toolUse,
        latencyMs: modelRecord.capabilities.typicalLatencyMs
      }
    };
  }

  private deriveRequirements(
    category: TaskCategory,
    complexity?: ComplexityTier,
    isEscalation?: boolean
  ): TaskCapabilityRequirements {
    const base: TaskCapabilityRequirements = {};

    if (category === 'classification') {
      base.minClassification = 80;
      base.maxAcceptableLatencyMs = 800;
    } else if (category === 'summarization') {
      base.minSummarization = 85;
      base.maxAcceptableLatencyMs = 1200;
    } else if (category === 'code_generation') {
      base.minCoding = isEscalation ? 95 : 85;
      base.minDebugging = isEscalation ? 92 : 80;
      base.minToolUse = 80;
    } else if (category === 'deep_reasoning' || category === 'architecture') {
      base.minReasoning = isEscalation ? 96 : 90;
      base.minArchitecture = isEscalation ? 95 : 88;
      base.minStructuredOutput = 85;
    } else if (category === 'security_review') {
      base.minReasoning = 90;
      base.minDebugging = 90;
    } else if (category === 'research') {
      base.minResearch = 88;
      base.minSummarization = 85;
    } else if (category === 'large_context') {
      base.minLongContext = 95;
      base.estimatedInputTokens = 120000;
    }

    if (complexity === 'critical' || complexity === 'complex') {
      base.minReasoning = Math.max(base.minReasoning || 0, 90);
      base.minCoding = Math.max(base.minCoding || 0, 88);
    }

    return base;
  }
}

export const adaptiveModelRouter = AdaptiveModelRouter.getInstance();
