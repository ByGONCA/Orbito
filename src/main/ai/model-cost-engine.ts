import type { CLIProvider } from '../../shared/cli';
import { modelRegistry } from './model-registry';

export type CostMeasurementMethod = 'exact_metered' | 'calibrated_estimate' | 'subscription_unmetered';

export interface TaskCostRecord {
  taskId: string;
  orchestrationId: string;
  modelId: string;
  provider: CLIProvider;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  costMethod: CostMeasurementMethod;
  estimatedCostUsd: number;
  exactCostUsd?: number;
  durationMs: number;
  timestamp: number;
}

export interface BudgetPolicy {
  maxCostPerTaskUsd: number;
  maxCostPerOrchestrationUsd: number;
  maxSwitchesPerTask: number;
  approvalThresholdUsd: number;
  haltOnBudgetExceeded: boolean;
}

export class ModelCostEngine {
  private static instance: ModelCostEngine;
  private costRecords: Map<string, TaskCostRecord[]> = new Map(); // orchestrationId -> records
  private policy: BudgetPolicy = {
    maxCostPerTaskUsd: 10.0,
    maxCostPerOrchestrationUsd: 25.0,
    maxSwitchesPerTask: 5,
    approvalThresholdUsd: 3.0,
    haltOnBudgetExceeded: true
  };

  private constructor() {}

  public static getInstance(): ModelCostEngine {
    if (!ModelCostEngine.instance) {
      ModelCostEngine.instance = new ModelCostEngine();
    }
    return ModelCostEngine.instance;
  }

  /**
   * Records usage metrics for a task execution.
   */
  public recordUsage(params: {
    taskId: string;
    orchestrationId: string;
    modelId: string;
    provider: CLIProvider;
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    reasoningTokens?: number;
    durationMs: number;
    exactCostUsd?: number;
  }): TaskCostRecord {
    const {
      taskId,
      orchestrationId,
      modelId,
      provider,
      inputTokens,
      outputTokens,
      cachedTokens = 0,
      reasoningTokens = 0,
      durationMs,
      exactCostUsd
    } = params;

    // Resolve model pricing
    const model = modelRegistry.resolveModel(modelId);
    let estimatedCostUsd = 0;
    let costMethod: CostMeasurementMethod = 'calibrated_estimate';

    if (exactCostUsd !== undefined && exactCostUsd >= 0) {
      estimatedCostUsd = exactCostUsd;
      costMethod = 'exact_metered';
    } else if (model && model.pricing) {
      const inCost = (inputTokens / 1_000_000) * model.pricing.inRatePerM;
      const outCost = (outputTokens / 1_000_000) * model.pricing.outRatePerM;
      const cachedCost = cachedTokens && model.pricing.cachedInRatePerM ? (cachedTokens / 1_000_000) * model.pricing.cachedInRatePerM : 0;

      estimatedCostUsd = Math.round((inCost + outCost + cachedCost) * 10000) / 10000;
      costMethod = model.provider === 'ollama' ? 'exact_metered' : 'calibrated_estimate';
    } else {
      costMethod = 'subscription_unmetered';
      estimatedCostUsd = 0;
    }

    const record: TaskCostRecord = {
      taskId,
      orchestrationId,
      modelId,
      provider,
      inputTokens,
      outputTokens,
      cachedTokens,
      reasoningTokens,
      costMethod,
      estimatedCostUsd,
      exactCostUsd,
      durationMs,
      timestamp: Date.now()
    };

    let list = this.costRecords.get(orchestrationId);
    if (!list) {
      list = [];
      this.costRecords.set(orchestrationId, list);
    }
    list.push(record);

    return record;
  }

  /**
   * Retrieves summary of consumed resources for an orchestration.
   */
  public getOrchestrationCost(orchestrationId: string): {
    totalEstimatedUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    recordsCount: number;
    records: TaskCostRecord[];
  } {
    const records = this.costRecords.get(orchestrationId) || [];
    let totalEstimatedUsd = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const r of records) {
      totalEstimatedUsd += r.estimatedCostUsd;
      totalInputTokens += r.inputTokens;
      totalOutputTokens += r.outputTokens;
    }

    return {
      totalEstimatedUsd: Math.round(totalEstimatedUsd * 10000) / 10000,
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      recordsCount: records.length,
      records
    };
  }

  /**
   * Validates planned resource usage against budget policy thresholds.
   */
  public checkBudget(
    orchestrationId: string,
    projectedAdditionalUsd: number = 0
  ): { allowed: boolean; requiresApproval: boolean; reason?: string } {
    const summary = this.getOrchestrationCost(orchestrationId);
    const projectedTotal = summary.totalEstimatedUsd + projectedAdditionalUsd;

    // Check hard limit
    if (this.policy.haltOnBudgetExceeded && projectedTotal > this.policy.maxCostPerOrchestrationUsd) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: `Projected orchestration cost ($${projectedTotal.toFixed(2)}) exceeds maximum budget limit ($${this.policy.maxCostPerOrchestrationUsd.toFixed(2)}). Execution halted.`
      };
    }

    // Check soft approval threshold
    if (projectedTotal > this.policy.approvalThresholdUsd) {
      return {
        allowed: true,
        requiresApproval: true,
        reason: `Projected cost ($${projectedTotal.toFixed(2)}) exceeds notification threshold ($${this.policy.approvalThresholdUsd.toFixed(2)}). Approval recommended.`
      };
    }

    return { allowed: true, requiresApproval: false };
  }

  public updateBudgetPolicy(update: Partial<BudgetPolicy>): void {
    this.policy = { ...this.policy, ...update };
  }

  public getBudgetPolicy(): BudgetPolicy {
    return { ...this.policy };
  }
}

export const modelCostEngine = ModelCostEngine.getInstance();
