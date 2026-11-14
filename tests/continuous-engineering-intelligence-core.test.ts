import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { databaseService } from '../src/main/db/database.service';
import { technicalDebtIntelligenceService } from '../src/main/intelligence/technical-debt-intelligence.service';
import { trendAndBaselineService, CURRENT_METHODOLOGY_VERSION } from '../src/main/intelligence/trend-and-baseline.service';
import { continuousCodeIntelligenceService } from '../src/main/intelligence/continuous-code-intelligence.service';
import { securityIntelligenceService } from '../src/main/intelligence/security-intelligence.service';
import { agentPerformanceIntelligenceService } from '../src/main/intelligence/agent-performance-intelligence.service';
import { recommendationEngineService } from '../src/main/intelligence/recommendation-engine.service';
import { continuousIntelligenceCoordinator } from '../src/main/intelligence/continuous-intelligence-coordinator';
import { SecretRedactor } from '../src/main/mcp/security/secret-redactor';
import type {
  EngineeringFinding,
  EngineeringMetricSnapshot
} from '../src/shared/continuous-intelligence';
import type { ProjectIntelligenceData } from '../src/shared/project-intelligence';

describe('Continuous Engineering Intelligence — Core Unit & Integration Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbito-eng-intel-test-'));
    databaseService.initialize(tempDir);
  });

  afterEach(() => {
    try {
      databaseService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // -------------------------------------------------------------
  // 1. Technical Debt Prioritization Model
  // -------------------------------------------------------------
  it('1. calculates explainable technical debt priority score with effort and confidence weighting', () => {
    const highDebtScore = technicalDebtIntelligenceService.calculateDebtPriorityScore({
      technicalImpact: 9,
      securityImplications: 9,
      maintainabilityImpact: 8,
      changeFrequency: 7,
      failureHistory: 8,
      dependencyCentrality: 8,
      confidence: 0.95,
      effort: 'small'
    });

    const lowDebtScore = technicalDebtIntelligenceService.calculateDebtPriorityScore({
      technicalImpact: 3,
      securityImplications: 1,
      maintainabilityImpact: 4,
      changeFrequency: 2,
      failureHistory: 1,
      dependencyCentrality: 2,
      confidence: 0.7,
      effort: 'epic'
    });

    expect(highDebtScore).toBeGreaterThan(70);
    expect(lowDebtScore).toBeLessThan(40);
    expect(highDebtScore).toBeGreaterThan(lowDebtScore);
  });

  // -------------------------------------------------------------
  // 2. Trend Analysis & Methodology Versioning
  // -------------------------------------------------------------
  it('2. computes historical trends respecting methodology versioning and sample size', () => {
    const projectId = 'test-proj-001';

    // Insufficient samples (< 2)
    const singleSnapshot: EngineeringMetricSnapshot[] = [
      {
        id: 's1',
        projectId,
        timestamp: Date.now() - 86400000,
        methodologyVersion: CURRENT_METHODOLOGY_VERSION,
        overallHealthScore: 85,
        architectureScore: 80,
        technicalDebtScore: 85,
        performanceScore: 90,
        securityScore: 85,
        testingScore: 85,
        agentPassRate: 90,
        activeFindingsCount: { critical: 0, high: 1, medium: 2, low: 0, info: 0 },
        totalOpenDebtItems: 2,
        totalRecommendationsActive: 1
      }
    ];

    const trendInsufficient = trendAndBaselineService.computeTrend(projectId, 85, singleSnapshot);
    expect(trendInsufficient.trendDirection).toBe('insufficiently_observed');
    expect(trendInsufficient.confidence).toBeLessThan(0.5);

    // Multi-sample improving trend
    const multipleSnapshots: EngineeringMetricSnapshot[] = [
      ...singleSnapshot,
      {
        id: 's2',
        projectId,
        timestamp: Date.now(),
        methodologyVersion: CURRENT_METHODOLOGY_VERSION,
        overallHealthScore: 95,
        architectureScore: 95,
        technicalDebtScore: 95,
        performanceScore: 95,
        securityScore: 95,
        testingScore: 95,
        agentPassRate: 95,
        activeFindingsCount: { critical: 0, high: 0, medium: 1, low: 0, info: 0 },
        totalOpenDebtItems: 1,
        totalRecommendationsActive: 0
      }
    ];

    const trendImproving = trendAndBaselineService.computeTrend(projectId, 95, multipleSnapshots);
    expect(trendImproving.trendDirection).toBe('improving');
    expect(trendImproving.scoreChange).toBe(10);
    expect(trendImproving.confidence).toBeGreaterThan(0.6);

    // Incompatible methodology version is filtered out to prevent false regression
    const incompatibleSnapshots: EngineeringMetricSnapshot[] = [
      {
        ...singleSnapshot[0],
        methodologyVersion: '0.9.0-legacy',
        overallHealthScore: 60
      }
    ];
    const trendFiltered = trendAndBaselineService.computeTrend(projectId, 95, incompatibleSnapshots);
    expect(trendFiltered.trendDirection).toBe('insufficiently_observed');
  });

  // -------------------------------------------------------------
  // 3. SQLite Persistence Lifecycle (Migration 009)
  // -------------------------------------------------------------
  it('3. persists and retrieves engineering analysis runs, findings, and recommendations', () => {
    const projectId = 'test-proj-persistence';
    const now = Date.now();

    // 1. Run persistence
    databaseService.saveEngineeringAnalysisRun({
      id: 'run-test-01',
      projectId,
      projectPath: tempDir,
      triggerType: 'manual',
      scope: 'incremental',
      status: 'completed',
      startedAt: now - 500,
      completedAt: now,
      durationMs: 500,
      categoriesAnalyzed: ['architecture', 'security'],
      findingsGeneratedCount: 2,
      newFindingsCount: 2,
      resolvedFindingsCount: 0
    });

    const runs = databaseService.listEngineeringAnalysisRuns(projectId);
    expect(runs.length).toBe(1);
    expect(runs[0].id).toBe('run-test-01');
    expect(runs[0].categoriesAnalyzed).toContain('architecture');

    // 2. Finding persistence
    const finding: EngineeringFinding = {
      id: 'find-test-01',
      projectId,
      projectPath: tempDir,
      detectionTimestamp: now,
      category: 'architecture',
      severity: 'high',
      confidence: 0.9,
      affectedFiles: ['src/core/index.ts'],
      evidence: 'Cycle: a -> b -> a',
      explanation: 'Circular dependency between modules',
      suggestedRemediation: 'Refactor shared types',
      relatedHistoricalFindingIds: [],
      status: 'new',
      effortCategory: 'small',
      technicalDebtScore: 7.5,
      updatedAt: now
    };

    databaseService.saveEngineeringFinding(finding);
    const stored = databaseService.getEngineeringFinding('find-test-01');
    expect(stored).not.toBeNull();
    expect(stored?.evidence).toBe('Cycle: a -> b -> a');

    // 3. Status transition & lifecycle event
    const updated = databaseService.updateFindingStatus(
      'find-test-01',
      projectId,
      'resolved',
      'Refactored shared interfaces.'
    );
    expect(updated).toBe(true);

    const reloaded = databaseService.getEngineeringFinding('find-test-01');
    expect(reloaded?.status).toBe('resolved');
    expect(reloaded?.resolvedAt).toBeDefined();

    const events = databaseService.listFindingLifecycleEvents('find-test-01');
    expect(events.length).toBe(1);
    expect(events[0].newStatus).toBe('resolved');
  });

  // -------------------------------------------------------------
  // 4. Recommendation Generation & Autonomous Task Prompt
  // -------------------------------------------------------------
  it('4. generates prioritized recommendations with pre-formatted task goal prompt', () => {
    const projectId = 'test-proj-recs';
    const findings: EngineeringFinding[] = [
      {
        id: 'find-sec-01',
        projectId,
        projectPath: tempDir,
        detectionTimestamp: Date.now(),
        category: 'security',
        severity: 'critical',
        confidence: 0.95,
        affectedFiles: ['.env'],
        evidence: 'Exposed credentials in .env',
        explanation: 'Sensitive credentials not in .gitignore',
        suggestedRemediation: 'Add .env to .gitignore and rotate keys',
        relatedHistoricalFindingIds: [],
        status: 'new',
        effortCategory: 'trivial',
        technicalDebtScore: 9.5,
        updatedAt: Date.now()
      }
    ];

    const recs = recommendationEngineService.generateRecommendations(projectId, tempDir, findings);
    expect(recs.length).toBe(1);
    expect(recs[0].priority).toBe('critical');
    expect(recs[0].taskGoalPrompt).toBeDefined();
    expect(recs[0].taskGoalPrompt).toContain('.env');
  });

  // -------------------------------------------------------------
  // 5. Data Pruning and Retention
  // -------------------------------------------------------------
  it('5. prunes expired runs and resolved findings while preserving active debt', () => {
    const projectId = 'test-proj-prune';
    const oldTimestamp = Date.now() - 40 * 86400000; // 40 days ago

    // Old resolved finding
    databaseService.saveEngineeringFinding({
      id: 'find-old-resolved',
      projectId,
      projectPath: tempDir,
      detectionTimestamp: oldTimestamp,
      category: 'architecture',
      severity: 'low',
      confidence: 0.8,
      affectedFiles: [],
      evidence: 'old',
      explanation: 'old',
      suggestedRemediation: 'none',
      relatedHistoricalFindingIds: [],
      status: 'resolved',
      updatedAt: oldTimestamp
    });

    // Old active finding (must NOT be pruned)
    databaseService.saveEngineeringFinding({
      id: 'find-old-active',
      projectId,
      projectPath: tempDir,
      detectionTimestamp: oldTimestamp,
      category: 'technical_debt',
      severity: 'high',
      confidence: 0.9,
      affectedFiles: [],
      evidence: 'active debt',
      explanation: 'active debt',
      suggestedRemediation: 'fix',
      relatedHistoricalFindingIds: [],
      status: 'new',
      updatedAt: oldTimestamp
    });

    // Prune with 30-day retention
    const result = databaseService.pruneEngineeringData(projectId, 30);
    expect(result.prunedFindings).toBe(1);

    expect(databaseService.getEngineeringFinding('find-old-resolved')).toBeNull();
    expect(databaseService.getEngineeringFinding('find-old-active')).not.toBeNull();
  });
});
