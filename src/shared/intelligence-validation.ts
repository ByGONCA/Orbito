import { z } from 'zod';
import type { FindingCategory, FindingSeverity } from './continuous-intelligence';

export type HealthStatusState =
  | 'healthy'
  | 'warning'
  | 'degraded'
  | 'critical'
  | 'insufficient_data'
  | 'stale_data'
  | 'analysis_unavailable';

export type AgentEvidenceTier =
  | 'insufficient_evidence'
  | 'exploratory'
  | 'preliminary'
  | 'statistically_supported';

export interface ExpectedFindingCriteria {
  idPattern: string;
  category: FindingCategory;
  severity: FindingSeverity;
  minConfidence: number;
  maxConfidence?: number;
  affectedFilePattern?: string;
  evidencePattern?: string;
}

export interface GroundTruthScenario {
  id: string;
  name: string;
  domain: FindingCategory;
  fixtureProfile: 'small' | 'medium' | 'large' | 'pathological-circular' | 'pathological-complexity' | 'pathological-security' | 'pathological-negative';
  description: string;
  isNegativeScenario: boolean; // true = expects zero findings (testing false-positive prevention)
  expectedFindings: ExpectedFindingCriteria[];
  expectedNonDetections: string[];
}

export interface DomainConfusionMatrix {
  domain: FindingCategory;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  precision: number; // TP / (TP + FP)
  recall: number; // TP / (TP + FN)
  f1Score: number; // 2 * (P * R) / (P + R)
  severityAccuracy: number; // percentage where detected severity matches expected
  status: 'passed' | 'failed' | 'insufficient_data';
}

export interface OverallValidationReport {
  timestamp: number;
  methodologyVersion: string;
  totalScenariosExecuted: number;
  positiveScenariosPassed: number;
  negativeScenariosPassed: number;
  domainResults: Record<FindingCategory, DomainConfusionMatrix>;
  overallPrecision: number;
  overallRecall: number;
  overallF1Score: number;
  passedAllGates: boolean;
}

export interface BenchmarkMeasurement {
  profile: 'small' | 'medium' | 'large';
  fileCount: number;
  initialDiscoveryMs: number;
  incrementalAnalysisMs: number;
  speedupRatio: number; // initialDiscoveryMs / incrementalAnalysisMs
  incrementalEquivalenceVerified: boolean; // true if incremental findings match full scan
  mainProcessHeapMb: number;
  dbQueryAvgLatencyMs: number;
  dbWriteLatencyMs: number;
  timestamp: number;
}

export interface ScoringAuditResult {
  methodologyVersion: string;
  severityFloorsEnforced: boolean;
  criticalFloorMinimum: number; // e.g. 80.0
  monotonicityPreserved: boolean;
  scoreRangeVerified: { min: number; max: number };
  sampleComparisons: Array<{
    findingId: string;
    category: string;
    severity: string;
    effort: string;
    confidence: number;
    debtScore: number;
    explanation: string;
  }>;
}

export const RunValidationSchema = z.object({
  domain: z.enum(['architecture', 'technical_debt', 'performance', 'security', 'agent_performance']).optional(),
  includePathological: z.boolean().default(true)
});

export const RunBenchmarkSchema = z.object({
  profile: z.enum(['small', 'medium', 'large']).default('small')
});
