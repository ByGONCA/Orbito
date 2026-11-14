import { z } from 'zod';
import type { CLIProvider } from './cli';

export type FindingCategory =
  | 'architecture'
  | 'technical_debt'
  | 'performance'
  | 'security'
  | 'agent_performance';

export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type FindingStatus =
  | 'new'
  | 'confirmed'
  | 'accepted'
  | 'deferred'
  | 'in_progress'
  | 'resolved'
  | 'reopened'
  | 'false_positive';

export type RemediationEffortCategory = 'trivial' | 'small' | 'medium' | 'large' | 'epic';

export interface BaselineComparison {
  metricKey?: string;
  previousValue?: string | number;
  currentValue?: string | number;
  diffSummary?: string;
}

export interface EngineeringFinding {
  id: string;
  projectId: string;
  projectPath: string;
  detectionTimestamp: number;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: number; // 0.0 to 1.0
  affectedFiles: string[];
  evidence: string;
  explanation: string;
  baselineComparison?: BaselineComparison;
  suggestedRemediation: string;
  relatedHistoricalFindingIds: string[];
  status: FindingStatus;
  effortCategory?: RemediationEffortCategory;
  technicalDebtScore?: number; // Calculated priority score for debt
  userDismissed?: boolean;
  userDismissalReason?: string;
  resolvedAt?: number;
  updatedAt: number;
}

export interface FindingLifecycleEvent {
  id: string;
  findingId: string;
  projectId: string;
  eventType: 'detected' | 'status_changed' | 'user_feedback' | 'resolved' | 'reopened';
  previousStatus?: FindingStatus;
  newStatus: FindingStatus;
  comment?: string;
  timestamp: number;
}

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export type RecommendationFeedbackType =
  | 'useful'
  | 'not_useful'
  | 'already_addressed'
  | 'incorrect'
  | 'defer'
  | 'accept';

export interface EngineeringRecommendation {
  id: string;
  projectId: string;
  projectPath: string;
  title: string;
  problem: string;
  supportingEvidence: string;
  expectedImpact: string;
  confidence: number; // 0.0 to 1.0
  estimatedEffort: RemediationEffortCategory;
  priority: RecommendationPriority;
  category: FindingCategory;
  relatedFindingIds: string[];
  suggestedNextAction: string;
  taskGoalPrompt?: string; // Pre-formatted prompt for AutonomousPlan when approved
  status: 'active' | 'accepted' | 'deferred' | 'dismissed' | 'executed';
  createdAt: number;
  updatedAt: number;
}

export interface RecommendationFeedback {
  id: string;
  recommendationId: string;
  projectId: string;
  feedback: RecommendationFeedbackType;
  comment?: string;
  timestamp: number;
}

export type AnalysisTriggerType = 'event' | 'schedule' | 'manual' | 'file_change';
export type AnalysisScope = 'incremental' | 'full';
export type AnalysisRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped';

export interface AnalysisRunRecord {
  id: string;
  projectId: string;
  projectPath: string;
  triggerType: AnalysisTriggerType;
  scope: AnalysisScope;
  status: AnalysisRunStatus;
  startedAt: number;
  completedAt?: number;
  durationMs: number;
  categoriesAnalyzed: FindingCategory[];
  findingsGeneratedCount: number;
  newFindingsCount: number;
  resolvedFindingsCount: number;
  skipReason?: string;
  errorMessage?: string;
}

export type TrendDirection = 'improving' | 'stable' | 'degrading' | 'isolated_regressions' | 'insufficiently_observed';

export interface ProjectHealthTrend {
  projectId: string;
  methodologyVersion: string;
  currentScore: number;
  previousScore?: number;
  trendDirection: TrendDirection;
  confidence: number;
  evaluationWindowDays: number;
  samplesCount: number;
  scoreChange: number;
  explanation: string;
}

export interface EngineeringMetricSnapshot {
  id: string;
  projectId: string;
  timestamp: number;
  methodologyVersion: string; // e.g., '1.0.0'
  overallHealthScore: number;
  architectureScore: number;
  technicalDebtScore: number;
  performanceScore: number;
  securityScore: number;
  testingScore: number;
  agentPassRate: number;
  activeFindingsCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  totalOpenDebtItems: number;
  totalRecommendationsActive: number;
}

export interface AgentPerformanceEvaluation {
  agentRole: string;
  model: string;
  provider: CLIProvider | string;
  taskCategory: string;
  sampleSize: number;
  status: 'sufficient_evidence' | 'insufficient_evidence';
  completionRate: number;
  verificationPassRate: number;
  failureRate: number;
  retryFrequency: number;
  avgDurationMs: number;
  avgTokensUsed: number;
  estimatedCostUsd: number;
  costMeasurementType: 'exact_metered' | 'calibrated_estimate' | 'subscription_unmetered';
  reworkFrequency: number;
  normalizedQualityScore: number; // 0 - 100
}

export interface PerformanceIntelligenceMetrics {
  application: {
    startupDurationMs: number;
    rendererResponsivenessScore: number;
    mainProcessMemoryMb: number;
    dbQueryLatencyAvgMs: number;
    cacheHitRate: number;
    activeWatchersCount: number;
  };
  engineeringExecution: {
    avgTaskExecutionMs: number;
    avgAgentStartupMs: number;
    avgContextPrepMs: number;
    avgVerificationMs: number;
    retryRatePercent: number;
    failedTaskRatePercent: number;
  };
  slowOperationsDetected: Array<{
    operation: string;
    avgDurationMs: number;
    occurrences: number;
    recommendation: string;
  }>;
}

export interface ContinuousIntelligenceConfig {
  enabled: boolean;
  analysisFrequencyMs: number;
  cpuBudgetPercent: number;
  maxConcurrentAnalyses: number;
  preferIncremental: boolean;
  excludedProjectPaths: string[];
  quietHours: {
    enabled: boolean;
    startHour: number;
    endHour: number;
  };
  categoryToggles: {
    architecture: boolean;
    technical_debt: boolean;
    performance: boolean;
    security: boolean;
    agent_performance: boolean;
  };
  retentionDays: number;
}

export const DEFAULT_INTELLIGENCE_CONFIG: ContinuousIntelligenceConfig = {
  enabled: true,
  analysisFrequencyMs: 300000, // 5 minutes
  cpuBudgetPercent: 50,
  maxConcurrentAnalyses: 1,
  preferIncremental: true,
  excludedProjectPaths: ['node_modules', '.git', 'dist', 'out'],
  quietHours: {
    enabled: false,
    startHour: 23,
    endHour: 7
  },
  categoryToggles: {
    architecture: true,
    technical_debt: true,
    performance: true,
    security: true,
    agent_performance: true
  },
  retentionDays: 30
};

export type HealthStatusState =
  | 'healthy'
  | 'warning'
  | 'degraded'
  | 'critical'
  | 'insufficient_data'
  | 'stale_data'
  | 'analysis_unavailable';

export interface EngineeringIntelligenceSummary {
  projectId: string;
  projectPath: string;
  lastAnalysisTimestamp: number;
  isAnalyzing: boolean;
  healthState: HealthStatusState;
  dataCoverage: number; // 0.0 - 1.0 (coverage of analyzed modules/files)
  healthTrend: ProjectHealthTrend;
  currentMetrics: EngineeringMetricSnapshot;
  recentRuns: AnalysisRunRecord[];
  topRecommendations: EngineeringRecommendation[];
  criticalFindings: EngineeringFinding[];
  findingsCountByCategory: Record<FindingCategory, number>;
  config: ContinuousIntelligenceConfig;
}

// Zod schemas for IPC boundaries
export const TriggerEngineeringAnalysisSchema = z.object({
  projectPath: z.string().min(1),
  projectId: z.string().optional(),
  scope: z.enum(['incremental', 'full']).optional(),
  triggerType: z.enum(['event', 'schedule', 'manual', 'file_change']).optional()
});

export const QueryEngineeringFindingsSchema = z.object({
  projectId: z.string().optional(),
  projectPath: z.string().optional(),
  category: z.enum(['architecture', 'technical_debt', 'performance', 'security', 'agent_performance']).optional(),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['new', 'confirmed', 'accepted', 'deferred', 'in_progress', 'resolved', 'reopened', 'false_positive']).optional(),
  limit: z.number().optional()
});

export const UpdateFindingStatusSchema = z.object({
  findingId: z.string().min(1),
  projectId: z.string().min(1),
  status: z.enum(['new', 'confirmed', 'accepted', 'deferred', 'in_progress', 'resolved', 'reopened', 'false_positive']),
  comment: z.string().optional(),
  reason: z.string().optional()
});

export const QueryRecommendationsSchema = z.object({
  projectId: z.string().optional(),
  projectPath: z.string().optional(),
  category: z.enum(['architecture', 'technical_debt', 'performance', 'security', 'agent_performance']).optional(),
  status: z.enum(['active', 'accepted', 'deferred', 'dismissed', 'executed']).optional(),
  limit: z.number().optional()
});

export const SubmitRecommendationFeedbackSchema = z.object({
  recommendationId: z.string().min(1),
  projectId: z.string().min(1),
  feedback: z.enum(['useful', 'not_useful', 'already_addressed', 'incorrect', 'defer', 'accept']),
  comment: z.string().optional()
});

export const ApproveRecommendationSchema = z.object({
  recommendationId: z.string().min(1),
  projectId: z.string().min(1),
  projectPath: z.string().min(1),
  provider: z.string().optional(),
  model: z.string().optional(),
  mode: z.enum(['supervised', 'autonomous', 'manual']).optional()
});

export const UpdateContinuousIntelligenceConfigSchema = z.object({
  config: z.object({
    enabled: z.boolean().optional(),
    analysisFrequencyMs: z.number().optional(),
    cpuBudgetPercent: z.number().optional(),
    maxConcurrentAnalyses: z.number().optional(),
    preferIncremental: z.boolean().optional(),
    excludedProjectPaths: z.array(z.string()).optional(),
    quietHours: z.object({
      enabled: z.boolean(),
      startHour: z.number(),
      endHour: z.number()
    }).optional(),
    categoryToggles: z.object({
      architecture: z.boolean().optional(),
      technical_debt: z.boolean().optional(),
      performance: z.boolean().optional(),
      security: z.boolean().optional(),
      agent_performance: z.boolean().optional()
    }).optional(),
    retentionDays: z.number().optional()
  })
});
