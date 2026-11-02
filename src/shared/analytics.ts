import { z } from 'zod';

export type AnalyticsFeature = 'cli' | 'workflow' | 'orchestration' | 'skill' | 'chat';
export type AnalyticsStatus = 'success' | 'failure' | 'timeout' | 'cancelled';

export interface TokenBreakdown {
  system: number;
  context: number;
  skills: number;
  tools: number;
  prompt: number;
}

export interface OptimizationMetrics {
  tokensSavedCaching: number;
  tokensSavedDeduplication: number;
  tokensSavedCompression: number;
  totalTokensSaved: number;
  estimatedCostSavedUsd: number;
}

export interface AnalyticsEvent {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  costUsd?: number;
  status: AnalyticsStatus;
  feature: AnalyticsFeature;
  tokensCached?: number;
  tokensSavedDeduplication?: number;
  isActual?: boolean;
  tokenBreakdown?: TokenBreakdown;
  details?: Record<string, unknown>;
}

export interface ProviderCostMetrics {
  provider: string;
  model: string;
  totalCalls: number;
  tokensIn: number;
  tokensOut: number;
  totalCostUsd: number;
  avgDurationMs: number;
  errorRate: number;
}

export interface AnalyticsSummary {
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  byProvider: Record<string, { calls: number; tokensIn: number; tokensOut: number; costUsd: number }>;
  byFeature: Record<string, { calls: number; tokensIn: number; tokensOut: number; costUsd: number }>;
  optimization?: OptimizationMetrics;
  timeline: Array<{
    date: string;
    calls: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
  }>;
}

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  eventType: string;
  severity: AuditSeverity;
  actor: string;
  action: string;
  target?: string;
  details: Record<string, unknown>;
  projectPath?: string;
}

export interface AuditLogFilter {
  eventType?: string;
  severity?: AuditSeverity;
  actor?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

export interface AirGapConfig {
  enabled: boolean;
  allowedHosts: string[];
  blockExternalNetwork: boolean;
  enforceLocalModels: boolean;
  defaultLocalModel: string;
  localOllamaUrl: string;
}

export const AirGapConfigSchema = z.object({
  enabled: z.boolean(),
  allowedHosts: z.array(z.string()).default(['127.0.0.1', 'localhost', '::1']),
  blockExternalNetwork: z.boolean().default(true),
  enforceLocalModels: z.boolean().default(true),
  defaultLocalModel: z.string().default('llama3:latest'),
  localOllamaUrl: z.string().default('http://127.0.0.1:11434')
});
