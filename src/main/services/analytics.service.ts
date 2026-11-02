import type {
  AnalyticsEvent,
  AnalyticsSummary,
  ProviderCostMetrics
} from '../../shared/analytics';
import { databaseService } from '../db/database.service';
import { MultiTierCacheService } from './cache.service';

export class AnalyticsService {
  /**
   * Cost rates per 1,000,000 tokens (Input / Output) in USD
   */
  private readonly costRates: Record<string, { inRate: number; outRate: number }> = {
    // Claude models
    'claude-3-5-sonnet': { inRate: 3.0, outRate: 15.0 },
    'claude-3-opus': { inRate: 15.0, outRate: 75.0 },
    'claude-3-haiku': { inRate: 0.25, outRate: 1.25 },
    claude: { inRate: 3.0, outRate: 15.0 },

    // OpenAI models
    'gpt-4o': { inRate: 2.5, outRate: 10.0 },
    'gpt-4o-mini': { inRate: 0.15, outRate: 0.6 },
    codex: { inRate: 2.5, outRate: 10.0 },

    // Google Gemini models
    'gemini-1.5-pro': { inRate: 1.25, outRate: 5.0 },
    'gemini-1.5-flash': { inRate: 0.075, outRate: 0.3 },
    gemini: { inRate: 1.25, outRate: 5.0 },

    // Local air-gapped models (Ollama, llama.cpp, etc.)
    ollama: { inRate: 0.0, outRate: 0.0 },
    'llama3:latest': { inRate: 0.0, outRate: 0.0 },
    'llama3.1': { inRate: 0.0, outRate: 0.0 },
    'deepseek-r1': { inRate: 0.0, outRate: 0.0 },
    mistral: { inRate: 0.0, outRate: 0.0 }
  };

  /**
   * Estimate cost in USD for a given token usage and model/provider.
   */
  public estimateCost(provider: string, model: string, tokensIn: number, tokensOut: number): number {
    const key = model.toLowerCase();
    const providerKey = provider.toLowerCase();

    // Check specific model, then provider fallback, default to Claude rates if unknown cloud model
    const rate = this.costRates[key] || this.costRates[providerKey] || (providerKey === 'ollama' ? { inRate: 0, outRate: 0 } : { inRate: 2.0, outRate: 8.0 });

    const costIn = (tokensIn / 1_000_000) * rate.inRate;
    const costOut = (tokensOut / 1_000_000) * rate.outRate;
    return Number((costIn + costOut).toFixed(6));
  }

  /**
   * Records an analytics event with calculated cost.
   */
  public recordEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'> & { costUsd?: number }): AnalyticsEvent {
    const costUsd =
      event.costUsd !== undefined
        ? event.costUsd
        : this.estimateCost(event.provider, event.model, event.tokensIn, event.tokensOut);

    if (!databaseService.isInitialized()) {
      return {
        id: `ana_uninit_${Date.now()}`,
        timestamp: Date.now(),
        provider: event.provider,
        model: event.model,
        tokensIn: event.tokensIn,
        tokensOut: event.tokensOut,
        durationMs: event.durationMs,
        costUsd,
        status: event.status,
        feature: event.feature,
        details: event.details
      };
    }

    return databaseService.insertAnalyticsEvent({
      ...event,
      costUsd
    });
  }

  /**
   * Get summarized analytics and token metrics.
   */
  public getSummary(options?: { projectId?: string; timeRangeMs?: number }): AnalyticsSummary {
    const summary = databaseService.getAnalyticsSummary(options);
    const cacheStats = MultiTierCacheService.getAggregatedStats();

    summary.optimization = {
      tokensSavedCaching: cacheStats.totalTokensSaved,
      tokensSavedDeduplication: 0,
      tokensSavedCompression: 0,
      totalTokensSaved: cacheStats.totalTokensSaved,
      estimatedCostSavedUsd: Number(((cacheStats.totalTokensSaved / 1_000_000) * 3.0).toFixed(4))
    };

    return summary;
  }

  /**
   * Get detailed breakdown per provider/model.
   */
  public getProviderCostMetrics(): ProviderCostMetrics[] {
    return databaseService.getProviderCostMetrics();
  }

  /**
   * Export analytics data to JSON or CSV.
   */
  public exportData(format: 'json' | 'csv'): string {
    return databaseService.exportAnalyticsData(format);
  }

  /**
   * Clear local analytics.
   */
  public clear(): void {
    databaseService.clearAnalytics();
  }
}

export const analyticsService = new AnalyticsService();
