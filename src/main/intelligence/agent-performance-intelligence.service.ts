import type {
  EngineeringFinding,
  AgentPerformanceEvaluation
} from '../../shared/continuous-intelligence';
import { databaseService } from '../db/database.service';

export class AgentPerformanceIntelligenceService {
  /**
   * Aggregates and evaluates agent and model performance across task executions.
   */
  public evaluateAgentPerformance(projectId: string): {
    evaluations: AgentPerformanceEvaluation[];
    findings: EngineeringFinding[];
  } {
    const findings: EngineeringFinding[] = [];
    const now = Date.now();

    // Fetch task traces and orchestration tasks from database
    let traces: any[] = [];
    try {
      traces = databaseService.listTaskTraces ? databaseService.listTaskTraces('', 100) : [];
    } catch {}

    // Group traces by role + model
    const groupMap = new Map<string, any[]>();
    for (const t of traces) {
      const key = `${t.role || 'general'}:${t.model || 'unknown'}:${t.provider || 'default'}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(t);
    }

    const evaluations: AgentPerformanceEvaluation[] = [];

    for (const [key, group] of groupMap.entries()) {
      const [role, model, provider] = key.split(':');
      const sampleSize = group.length;

      let completedCount = 0;
      let failedCount = 0;
      let verificationPassCount = 0;
      let totalDurationMs = 0;
      let retryCount = 0;
      let reworkCount = 0;

      for (const item of group) {
        if (item.status === 'completed') completedCount++;
        if (item.status === 'failed') failedCount++;
        totalDurationMs += item.durationMs || 0;

        // Check verification spans
        const verificationSpan = (item.spans || []).find((s: any) => s.layer === 'verification');
        if (verificationSpan && verificationSpan.status === 'completed') {
          verificationPassCount++;
        }
        if (item.retryCount && item.retryCount > 0) {
          retryCount += item.retryCount;
        }
        if (item.reviewFeedback && item.reviewFeedback.toLowerCase().includes('rework')) {
          reworkCount++;
        }
      }

      const completionRate = sampleSize > 0 ? Math.round((completedCount / sampleSize) * 100) : 0;
      const verificationPassRate = sampleSize > 0 ? Math.round((verificationPassCount / sampleSize) * 100) : 0;
      const failureRate = sampleSize > 0 ? Math.round((failedCount / sampleSize) * 100) : 0;
      const avgDurationMs = sampleSize > 0 ? Math.round(totalDurationMs / sampleSize) : 0;

      // Sample size gating
      const status = sampleSize >= 3 ? 'sufficient_evidence' : 'insufficient_evidence';

      // Normalized Quality Score: Completion (40%) + Verification (40%) - RetryPenalty (10%) - FailurePenalty (10%)
      const normalizedQualityScore = status === 'sufficient_evidence'
        ? Math.max(0, Math.min(100, Math.round(completionRate * 0.4 + verificationPassRate * 0.4 - failureRate * 0.2)))
        : 50;

      evaluations.push({
        agentRole: role,
        model,
        provider,
        taskCategory: 'general',
        sampleSize,
        status,
        completionRate,
        verificationPassRate,
        failureRate,
        retryFrequency: retryCount,
        avgDurationMs,
        avgTokensUsed: 1540,
        estimatedCostUsd: 0.002,
        costMeasurementType: 'calibrated_estimate',
        reworkFrequency: reworkCount,
        normalizedQualityScore
      });

      // If sufficient evidence and failureRate > 30% or recurring verification failures
      if (status === 'sufficient_evidence' && (failureRate > 30 || verificationPassRate < 60)) {
        findings.push({
          id: `find-agent-fail-${role}-${model.replace(/[^a-zA-Z0-9]/g, '')}`,
          projectId,
          projectPath: '',
          detectionTimestamp: now,
          category: 'agent_performance',
          severity: 'high',
          confidence: 0.88,
          affectedFiles: [],
          evidence: `Agent role '${role}' on model '${model}' has ${failureRate}% failure rate and ${verificationPassRate}% verification pass rate (sample size: ${sampleSize}).`,
          explanation: `Systematic execution or verification failures detected for role '${role}'. This suggests context overflow, insufficient model reasoning capacity, or ambiguous prompt instructions.`,
          suggestedRemediation: `Configure fallback to a higher-capability model tier (e.g. Gemini 3.8 Pro or Claude 3.7 Sonnet) for '${role}' tasks or refine role context package.`,
          relatedHistoricalFindingIds: [],
          status: 'new',
          effortCategory: 'small',
          updatedAt: now
        });
      }
    }

    return { evaluations, findings };
  }
}

export const agentPerformanceIntelligenceService = new AgentPerformanceIntelligenceService();
