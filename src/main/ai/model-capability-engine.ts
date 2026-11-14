import type { ModelRecord, ModelCognitiveCapabilities } from '../../shared/model-registry';

export interface TaskCapabilityRequirements {
  minReasoning?: number;
  minCoding?: number;
  minDebugging?: number;
  minArchitecture?: number;
  minResearch?: number;
  minSummarization?: number;
  minClassification?: number;
  minToolUse?: number;
  minStructuredOutput?: number;
  minLongContext?: number;
  requiresVision?: boolean;
  requiresStreaming?: boolean;
  maxAcceptableLatencyMs?: number;
  estimatedInputTokens?: number;
}

export interface CapabilityMatchResult {
  modelId: string;
  isEligible: boolean;
  overallScore: number; // 0 - 100
  disqualificationReasons: string[];
  dimensionScores: Record<string, number>;
  relativeCostEfficiency: number; // 0 - 100
}

export class ModelCapabilityEngine {
  private static instance: ModelCapabilityEngine;

  private constructor() {}

  public static getInstance(): ModelCapabilityEngine {
    if (!ModelCapabilityEngine.instance) {
      ModelCapabilityEngine.instance = new ModelCapabilityEngine();
    }
    return ModelCapabilityEngine.instance;
  }

  /**
   * Scores a model's fit against a set of required cognitive capabilities.
   */
  public evaluateModelFitness(
    model: ModelRecord,
    requirements: TaskCapabilityRequirements
  ): CapabilityMatchResult {
    const caps = model.capabilities;
    const disqualifications: string[] = [];
    const dimensionScores: Record<string, number> = {};

    // 1. Hard requirements check
    if (requirements.requiresVision && !caps.vision) {
      disqualifications.push('Model lacks required vision processing capability');
    }

    if (requirements.requiresStreaming && !caps.streaming) {
      disqualifications.push('Model does not support streaming response generation');
    }

    if (requirements.estimatedInputTokens && requirements.estimatedInputTokens > model.contextWindow) {
      disqualifications.push(
        `Estimated tokens (${requirements.estimatedInputTokens.toLocaleString()}) exceed model window (${model.contextWindow.toLocaleString()})`
      );
    }

    // 2. Dimension scoring (0 - 100)
    const checkDim = (name: keyof ModelCognitiveCapabilities, required?: number, weight: number = 1.0) => {
      const val = typeof caps[name] === 'number' ? (caps[name] as number) : 0;
      dimensionScores[name] = val;

      if (required && required > 0) {
        if (val < required) {
          // If deficient (> 12 points below requirement), flag disqualification
          if (required - val > 12) {
            disqualifications.push(
              `Insufficient ${name} capability (requires ${required}, model delivers ${val})`
            );
          }
        }
      }
    };

    checkDim('reasoning', requirements.minReasoning, 1.5);
    checkDim('coding', requirements.minCoding, 1.4);
    checkDim('debugging', requirements.minDebugging, 1.2);
    checkDim('architecture', requirements.minArchitecture, 1.3);
    checkDim('research', requirements.minResearch, 1.0);
    checkDim('summarization', requirements.minSummarization, 0.8);
    checkDim('classification', requirements.minClassification, 0.8);
    checkDim('toolUse', requirements.minToolUse, 1.2);
    checkDim('structuredOutput', requirements.minStructuredOutput, 1.0);
    checkDim('longContext', requirements.minLongContext, 1.1);

    // Latency evaluation
    if (requirements.maxAcceptableLatencyMs && caps.typicalLatencyMs > requirements.maxAcceptableLatencyMs) {
      disqualifications.push(
        `Typical latency (${caps.typicalLatencyMs}ms) exceeds threshold (${requirements.maxAcceptableLatencyMs}ms)`
      );
    }

    // Calculate weighted average capability score
    let scoreSum = 0;
    let weightSum = 0;

    const weights: Record<string, number> = {
      reasoning: requirements.minReasoning ? 2.0 : 1.0,
      coding: requirements.minCoding ? 2.0 : 1.0,
      debugging: requirements.minDebugging ? 1.5 : 1.0,
      architecture: requirements.minArchitecture ? 1.8 : 1.0,
      research: requirements.minResearch ? 1.5 : 0.8,
      toolUse: requirements.minToolUse ? 1.8 : 1.0,
      structuredOutput: requirements.minStructuredOutput ? 1.5 : 0.8,
      summarization: requirements.minSummarization ? 1.5 : 0.7,
      classification: requirements.minClassification ? 1.5 : 0.7,
      longContext: requirements.minLongContext ? 1.5 : 0.8
    };

    for (const [key, w] of Object.entries(weights)) {
      if (dimensionScores[key] !== undefined) {
        scoreSum += dimensionScores[key] * w;
        weightSum += w;
      }
    }

    const overallScore = Math.round(weightSum > 0 ? scoreSum / weightSum : 75);

    // Cost efficiency metric (lower price = higher efficiency)
    const combinedPrice = model.pricing.inRatePerM + model.pricing.outRatePerM;
    let costEfficiency = 100;
    if (combinedPrice > 0) {
      // Scale: $0 -> 100, $1 -> 90, $10 -> 60, $50 -> 20, $90 -> 10
      costEfficiency = Math.max(10, Math.round(100 / (1 + combinedPrice * 0.1)));
    }

    return {
      modelId: model.id,
      isEligible: disqualifications.length === 0,
      overallScore,
      disqualificationReasons: disqualifications,
      dimensionScores,
      relativeCostEfficiency: costEfficiency
    };
  }

  /**
   * Compares multiple models and returns them sorted by fitness score, filtering out ineligible ones.
   */
  public rankEligibleModels(
    models: ModelRecord[],
    requirements: TaskCapabilityRequirements
  ): { model: ModelRecord; match: CapabilityMatchResult }[] {
    const scored = models.map((m) => ({
      model: m,
      match: this.evaluateModelFitness(m, requirements)
    }));

    return scored
      .filter((s) => s.match.isEligible)
      .sort((a, b) => b.match.overallScore - a.match.overallScore);
  }
}

export const modelCapabilityEngine = ModelCapabilityEngine.getInstance();
