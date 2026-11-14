import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { databaseService } from '../src/main/db/database.service';
import { technicalDebtIntelligenceService } from '../src/main/intelligence/technical-debt-intelligence.service';
import { trendAndBaselineService, CURRENT_METHODOLOGY_VERSION } from '../src/main/intelligence/trend-and-baseline.service';
import type { EngineeringMetricSnapshot } from '../src/shared/continuous-intelligence';

describe('Engineering Intelligence Scoring Calibration — Monotonicity & Severity Floor', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbito-cal-test-'));
    databaseService.initialize(tempDir);
  });

  afterEach(() => {
    try {
      databaseService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. enforces critical severity floor (P_floor >= 80.0) for critical security implications', () => {
    // Under uncalibrated v1.0.0, multiplying by epic effort (0.8) and low confidence (0.5) would give:
    // Raw (96) * 0.8 * 0.5 = 38.4, demoting a critical vulnerability to low priority.
    // Under calibrated v1.1.0, the severity floor guarantees >= 80.0.
    const score = technicalDebtIntelligenceService.calculateDebtPriorityScore({
      technicalImpact: 5,
      securityImplications: 10, // Critical security issue
      maintainabilityImpact: 5,
      changeFrequency: 3,
      failureHistory: 3,
      dependencyCentrality: 3,
      confidence: 0.5,
      effort: 'epic'
    });

    expect(score).toBeGreaterThanOrEqual(80.0);
  });

  it('2. enforces critical severity floor (P_floor >= 75.0) for critical technical defects', () => {
    const score = technicalDebtIntelligenceService.calculateDebtPriorityScore({
      technicalImpact: 10, // Critical technical impact
      securityImplications: 2,
      maintainabilityImpact: 6,
      changeFrequency: 4,
      failureHistory: 4,
      dependencyCentrality: 4,
      confidence: 0.5,
      effort: 'epic'
    });

    expect(score).toBeGreaterThanOrEqual(75.0);
  });

  it('3. mathematically verifies scoring monotonicity across escalating severity levels', () => {
    const lowScore = technicalDebtIntelligenceService.calculateDebtPriorityScore({
      technicalImpact: 2,
      securityImplications: 1,
      maintainabilityImpact: 2,
      changeFrequency: 1,
      failureHistory: 1,
      dependencyCentrality: 1,
      confidence: 0.9,
      effort: 'trivial'
    });

    const mediumScore = technicalDebtIntelligenceService.calculateDebtPriorityScore({
      technicalImpact: 5,
      securityImplications: 4,
      maintainabilityImpact: 5,
      changeFrequency: 4,
      failureHistory: 3,
      dependencyCentrality: 4,
      confidence: 0.9,
      effort: 'medium'
    });

    const highScore = technicalDebtIntelligenceService.calculateDebtPriorityScore({
      technicalImpact: 8,
      securityImplications: 7,
      maintainabilityImpact: 8,
      changeFrequency: 7,
      failureHistory: 6,
      dependencyCentrality: 7,
      confidence: 0.9,
      effort: 'high'
    });

    const criticalScore = technicalDebtIntelligenceService.calculateDebtPriorityScore({
      technicalImpact: 10,
      securityImplications: 10,
      maintainabilityImpact: 9,
      changeFrequency: 8,
      failureHistory: 9,
      dependencyCentrality: 9,
      confidence: 0.95,
      effort: 'large'
    });

    expect(lowScore).toBeLessThan(mediumScore);
    expect(mediumScore).toBeLessThan(highScore);
    expect(highScore).toBeLessThan(criticalScore);
    expect(criticalScore).toBeGreaterThanOrEqual(80.0);
  });

  it('4. isolates legacy snapshot methodologies to prevent false degradation trends', () => {
    const projectId = 'proj-calib-trend-1';
    const now = Date.now();

    const legacySnapshot: EngineeringMetricSnapshot = {
      id: 'snap-legacy-1',
      projectId,
      timestamp: now - 100000,
      overallHealthScore: 92,
      architectureScore: 90,
      technicalDebtScore: 90,
      performanceScore: 95,
      securityScore: 95,
      testingScore: 90,
      agentPassRate: 95,
      activeFindingsCount: { critical: 0, high: 1, medium: 2, low: 3, info: 0 },
      totalOpenDebtItems: 3,
      totalRecommendationsActive: 2,
      methodologyVersion: '1.0.0' // Legacy!
    };

    const currentSnapshot: EngineeringMetricSnapshot = {
      id: 'snap-current-1',
      projectId,
      timestamp: now,
      overallHealthScore: 84, // Calibrated score reflects stricter severity floor
      architectureScore: 85,
      technicalDebtScore: 80,
      performanceScore: 90,
      securityScore: 85,
      testingScore: 80,
      agentPassRate: 90,
      activeFindingsCount: { critical: 1, high: 2, medium: 3, low: 1, info: 0 },
      totalOpenDebtItems: 3,
      totalRecommendationsActive: 2,
      methodologyVersion: CURRENT_METHODOLOGY_VERSION // '1.1.0'
    };

    // Check trend computation
    const trend = trendAndBaselineService.computeTrend(projectId, 84, [legacySnapshot, currentSnapshot]);

    // Because legacy snapshot was v1.0.0 and only 1 snapshot exists under v1.1.0,
    // the system correctly identifies insufficient data under the current methodology
    // rather than triggering an erroneous 'degrading' alert.
    expect(trend.trendDirection).toBe('insufficiently_observed');
    expect(trend.scoreChange).toBe(0);
  });

  it('5. computes accurate trends when multiple snapshots share current methodology', () => {
    const projectId = 'proj-calib-trend-2';
    const now = Date.now();

    const snap1: EngineeringMetricSnapshot = {
      id: 'snap-v11-1',
      projectId,
      timestamp: now - 50000,
      overallHealthScore: 78,
      architectureScore: 75,
      technicalDebtScore: 75,
      performanceScore: 80,
      securityScore: 80,
      testingScore: 80,
      agentPassRate: 80,
      activeFindingsCount: { critical: 1, high: 2, medium: 3, low: 1, info: 0 },
      totalOpenDebtItems: 3,
      totalRecommendationsActive: 2,
      methodologyVersion: CURRENT_METHODOLOGY_VERSION
    };

    const snap2: EngineeringMetricSnapshot = {
      id: 'snap-v11-2',
      projectId,
      timestamp: now,
      overallHealthScore: 86,
      architectureScore: 85,
      technicalDebtScore: 85,
      performanceScore: 88,
      securityScore: 90,
      testingScore: 85,
      agentPassRate: 85,
      activeFindingsCount: { critical: 0, high: 1, medium: 2, low: 1, info: 0 },
      totalOpenDebtItems: 1,
      totalRecommendationsActive: 1,
      methodologyVersion: CURRENT_METHODOLOGY_VERSION
    };

    const trend = trendAndBaselineService.computeTrend(projectId, 86, [snap1, snap2]);
    expect(trend.trendDirection).toBe('improving');
    expect(trend.scoreChange).toBe(8);
  });
});
