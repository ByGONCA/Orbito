import type {
  EngineeringMetricSnapshot,
  ProjectHealthTrend,
  TrendDirection
} from '../../shared/continuous-intelligence';
import { databaseService } from '../db/database.service';

export const CURRENT_METHODOLOGY_VERSION = '1.1.0';

export class TrendAndBaselineService {
  /**
   * Computes confidence-aware trend analysis from historical snapshots.
   * Only compares snapshots sharing the active methodology version (v1.1.0)
   * to prevent false degradation/improvement alerts across formula upgrades.
   */
  public computeTrend(
    projectId: string,
    currentScore: number,
    snapshots: EngineeringMetricSnapshot[] = []
  ): ProjectHealthTrend {
    // Filter snapshots to those matching current methodology version
    const validSnapshots = snapshots.filter(
      (s) => (s.methodologyVersion || '1.0.0') === CURRENT_METHODOLOGY_VERSION
    );

    const samplesCount = validSnapshots.length;

    // If sample size < 2, cannot establish an authoritative trend
    if (samplesCount < 2) {
      return {
        projectId,
        methodologyVersion: CURRENT_METHODOLOGY_VERSION,
        currentScore,
        previousScore: validSnapshots[0]?.overallHealthScore,
        trendDirection: 'insufficiently_observed',
        confidence: 0.4,
        evaluationWindowDays: 1,
        samplesCount,
        scoreChange: 0,
        explanation: `Insufficient historical baseline data under current methodology version (v${CURRENT_METHODOLOGY_VERSION}) to calculate statistical trajectory.`
      };
    }

    // Sort by timestamp asc
    const sorted = [...validSnapshots].sort((a, b) => a.timestamp - b.timestamp);
    const baseline = sorted[0];
    const previous = sorted[sorted.length - 1];
    const scoreChange = currentScore - baseline.overallHealthScore;

    let trendDirection: TrendDirection = 'stable';
    let explanation = 'Project health score is stable across observed intervals.';

    if (scoreChange >= 5) {
      trendDirection = 'improving';
      explanation = `Engineering health improved by +${scoreChange} points across ${samplesCount} snapshots.`;
    } else if (scoreChange <= -10) {
      trendDirection = 'degrading';
      explanation = `Engineering health declined by ${scoreChange} points due to accumulated technical debt or architectural regressions.`;
    } else if (scoreChange < 0 && scoreChange > -10) {
      trendDirection = 'isolated_regressions';
      explanation = `Isolated regression of ${scoreChange} points observed. Overall architecture remains resilient.`;
    }

    const evaluationWindowDays = Math.max(
      1,
      Math.round((Date.now() - baseline.timestamp) / 86400000)
    );

    // Confidence scales with sample count up to 0.95
    const confidence = Math.min(0.95, 0.5 + samplesCount * 0.1);

    return {
      projectId,
      methodologyVersion: CURRENT_METHODOLOGY_VERSION,
      currentScore,
      previousScore: previous.overallHealthScore,
      trendDirection,
      confidence,
      evaluationWindowDays,
      samplesCount,
      scoreChange,
      explanation
    };
  }
}

export const trendAndBaselineService = new TrendAndBaselineService();
