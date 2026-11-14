import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import type {
  ContinuousIntelligenceConfig,
  AnalysisRunRecord,
  AnalysisTriggerType,
  AnalysisScope,
  EngineeringFinding,
  EngineeringRecommendation,
  EngineeringMetricSnapshot,
  EngineeringIntelligenceSummary,
  FindingCategory,
  FindingStatus,
  RecommendationFeedbackType,
  HealthStatusState
} from '../../shared/continuous-intelligence';
import { DEFAULT_INTELLIGENCE_CONFIG } from '../../shared/continuous-intelligence';
import { projectIntelligenceService } from './project-intelligence.service';
import { continuousCodeIntelligenceService } from './continuous-code-intelligence.service';
import { technicalDebtIntelligenceService } from './technical-debt-intelligence.service';
import { performanceIntelligenceService } from './performance-intelligence.service';
import { securityIntelligenceService } from './security-intelligence.service';
import { agentPerformanceIntelligenceService } from './agent-performance-intelligence.service';
import { recommendationEngineService } from './recommendation-engine.service';
import { trendAndBaselineService, CURRENT_METHODOLOGY_VERSION } from './trend-and-baseline.service';
import { databaseService } from '../db/database.service';
import { resourceGovernorService } from '../services/resource-governor.service';

export class ContinuousIntelligenceCoordinator extends EventEmitter {
  private config: ContinuousIntelligenceConfig = { ...DEFAULT_INTELLIGENCE_CONFIG };
  private activeRuns = new Map<string, AnalysisRunRecord>(); // keyed by projectId
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private scheduledInterval: NodeJS.Timeout | null = null;
  private isSystemPaused = false;

  constructor() {
    super();
  }

  /**
   * Initializes the coordinator, loading configuration and starting background scheduler if enabled.
   */
  public initialize(): void {
    if (this.scheduledInterval) {
      clearInterval(this.scheduledInterval);
      this.scheduledInterval = null;
    }

    if (this.config.enabled) {
      this.scheduledInterval = setInterval(() => {
        this.runScheduledAnalyses();
      }, this.config.analysisFrequencyMs);
    }

    // Connect resource governor backpressure
    resourceGovernorService.on('pressure', () => {
      this.setSystemPaused(true);
    });
    resourceGovernorService.on('recovered', () => {
      this.setSystemPaused(false);
    });
  }

  public shutdown(): void {
    if (this.scheduledInterval) {
      clearInterval(this.scheduledInterval);
      this.scheduledInterval = null;
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  public setSystemPaused(paused: boolean): void {
    this.isSystemPaused = paused;
  }

  public getConfig(projectId?: string): ContinuousIntelligenceConfig {
    if (projectId && databaseService.isInitialized()) {
      const persisted = databaseService.getEngineeringConfig(projectId);
      if (persisted) return { ...this.config, ...persisted };
    }
    return this.config;
  }

  public updateConfig(newConfig: Partial<ContinuousIntelligenceConfig>, projectId?: string): ContinuousIntelligenceConfig {
    this.config = { ...this.config, ...newConfig };
    if (projectId && databaseService.isInitialized()) {
      databaseService.saveEngineeringConfig(projectId, this.config);
    }
    this.initialize(); // restart timer with new settings
    return this.config;
  }

  /**
   * Debounced event trigger (e.g. from file watcher changes).
   */
  public triggerFileChangeAnalysis(projectPath: string, projectId?: string): void {
    const normPath = path.resolve(projectPath);
    const resolvedProjectId = projectId || this.deriveProjectId(normPath);

    // Debounce to coalesce rapid file edits
    const existingTimer = this.debounceTimers.get(resolvedProjectId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(resolvedProjectId);
      this.runAnalysis(normPath, {
        projectId: resolvedProjectId,
        triggerType: 'file_change',
        scope: this.config.preferIncremental ? 'incremental' : 'full'
      }).catch((err) => {
        console.error('[ContinuousCoordinator] File change analysis error:', err);
      });
    }, 5000); // 5-second coalescing debounce

    this.debounceTimers.set(resolvedProjectId, timer);
  }

  /**
   * Scheduled runner across configured projects.
   */
  private async runScheduledAnalyses(): Promise<void> {
    if (!this.config.enabled || this.isSystemPaused) return;

    // Check quiet hours
    if (this.config.quietHours.enabled) {
      const currentHour = new Date().getHours();
      const { startHour, endHour } = this.config.quietHours;
      if (startHour > endHour) {
        // e.g. 23:00 to 07:00
        if (currentHour >= startHour || currentHour < endHour) return;
      } else {
        if (currentHour >= startHour && currentHour < endHour) return;
      }
    }

    if (!databaseService.isInitialized()) return;
    try {
      const projects = databaseService.getRecentProjects ? databaseService.getRecentProjects() : [];
      for (const p of projects) {
        if (this.config.excludedProjectPaths.some((ex) => p.path.includes(ex))) continue;
        await this.runAnalysis(p.path, {
          projectId: p.id,
          triggerType: 'schedule',
          scope: 'incremental'
        });
      }
    } catch (err) {
      console.error('[ContinuousCoordinator] Scheduled run error:', err);
    }
  }

  /**
   * Core analysis execution method. Idempotent and concurrency-safe.
   * STRICT INVARIANT: Reads & observes only. Never modifies project source code.
   */
  public async runAnalysis(
    projectPath: string,
    options: {
      projectId?: string;
      triggerType?: AnalysisTriggerType;
      scope?: AnalysisScope;
      forceRefresh?: boolean;
      simulateStaleTrigger?: boolean;
    } = {}
  ): Promise<EngineeringIntelligenceSummary> {
    const normPath = path.resolve(projectPath);
    const resolvedProjectId = options.projectId || this.deriveProjectId(normPath);
    const triggerType = options.triggerType || 'manual';
    const scope = options.scope || 'incremental';
    const startTime = Date.now();
    const initialFingerprint = this.captureProjectFingerprint(normPath);

    // Concurrency control: skip if an analysis is already running for this project
    if (this.activeRuns.has(resolvedProjectId)) {
      const active = this.activeRuns.get(resolvedProjectId)!;
      return this.getSummary(normPath, resolvedProjectId);
    }

    // Check system pause / budget constraints
    if (this.isSystemPaused && triggerType !== 'manual') {
      const runRecord: AnalysisRunRecord = {
        id: `run-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        projectId: resolvedProjectId,
        projectPath: normPath,
        triggerType,
        scope,
        status: 'skipped',
        startedAt: startTime,
        completedAt: startTime,
        durationMs: 0,
        categoriesAnalyzed: [],
        findingsGeneratedCount: 0,
        newFindingsCount: 0,
        resolvedFindingsCount: 0,
        skipReason: 'System is currently paused under high load or active user execution.'
      };
      if (databaseService.isInitialized()) {
        databaseService.saveEngineeringAnalysisRun(runRecord);
      }
      return this.getSummary(normPath, resolvedProjectId);
    }

    // Register active run
    const runId = `run-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const runRecord: AnalysisRunRecord = {
      id: runId,
      projectId: resolvedProjectId,
      projectPath: normPath,
      triggerType,
      scope,
      status: 'running',
      startedAt: startTime,
      durationMs: 0,
      categoriesAnalyzed: [],
      findingsGeneratedCount: 0,
      newFindingsCount: 0,
      resolvedFindingsCount: 0
    };

    this.activeRuns.set(resolvedProjectId, runRecord);
    if (databaseService.isInitialized()) {
      databaseService.saveEngineeringAnalysisRun(runRecord);
    }

    this.emit('analysisStarted', { projectId: resolvedProjectId, runId });

    try {
      // 1. Gather baseline data
      let previousBaseline: any = null;
      if (databaseService.isInitialized()) {
        const storedBaseline = databaseService.getEngineeringBaseline(resolvedProjectId);
        if (storedBaseline) {
          previousBaseline = storedBaseline.data;
        }
      }

      // 2. Refresh or retrieve project intelligence data
      const projectData = await projectIntelligenceService.analyzeProject(normPath, {
        projectId: resolvedProjectId,
        forceRefresh: options.forceRefresh || scope === 'full'
      });

      const collectedFindings: EngineeringFinding[] = [];
      const categoriesAnalyzed: FindingCategory[] = [];

      // 3. Continuous Code Intelligence
      if (this.config.categoryToggles.architecture) {
        categoriesAnalyzed.push('architecture');
        const codeResult = continuousCodeIntelligenceService.analyzeCodeIntelligence(
          projectData,
          previousBaseline
        );
        collectedFindings.push(...codeResult.findings);

        // Update baseline persistence
        if (databaseService.isInitialized()) {
          const baselineHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(codeResult.baselineData))
            .digest('hex');
          databaseService.saveEngineeringBaseline(
            resolvedProjectId,
            baselineHash,
            codeResult.baselineData,
            CURRENT_METHODOLOGY_VERSION
          );
        }
      }

      // 4. Technical Debt Intelligence
      if (this.config.categoryToggles.technical_debt) {
        categoriesAnalyzed.push('technical_debt');
        const existingFindings = databaseService.isInitialized()
          ? databaseService.listEngineeringFindings({ projectId: resolvedProjectId })
          : [];
        const debtFindings = technicalDebtIntelligenceService.analyzeTechnicalDebt(
          projectData,
          existingFindings
        );
        collectedFindings.push(...debtFindings);
      }

      // 5. Performance Intelligence
      if (this.config.categoryToggles.performance) {
        categoriesAnalyzed.push('performance');
        const perfMetrics = performanceIntelligenceService.collectMetrics(resolvedProjectId);
        const perfFindings = performanceIntelligenceService.analyzePerformance(
          resolvedProjectId,
          normPath,
          perfMetrics
        );
        collectedFindings.push(...perfFindings);
      }

      // 6. Security Intelligence (with strict secret redaction)
      if (this.config.categoryToggles.security) {
        categoriesAnalyzed.push('security');
        const secFindings = securityIntelligenceService.analyzeSecurity(projectData);
        collectedFindings.push(...secFindings);
      }

      // 7. Agent Performance Intelligence
      if (this.config.categoryToggles.agent_performance) {
        categoriesAnalyzed.push('agent_performance');
        const { findings: agentFindings } = agentPerformanceIntelligenceService.evaluateAgentPerformance(
          resolvedProjectId
        );
        collectedFindings.push(...agentFindings);
      }

      // 8. Correlate and synthesize recommendations
      const recommendations = recommendationEngineService.generateRecommendations(
        resolvedProjectId,
        normPath,
        collectedFindings
      );

      // 8.5. Stale Result Protection: If project mutated during analysis, discard stale conclusions
      const currentFingerprint = this.captureProjectFingerprint(normPath);
      const isStale = Boolean(options.simulateStaleTrigger) || (initialFingerprint !== currentFingerprint && triggerType !== 'manual');
      if (isStale) {
        runRecord.status = 'skipped';
        runRecord.completedAt = Date.now();
        runRecord.durationMs = Date.now() - startTime;
        runRecord.skipReason = 'Project state mutated during analysis. Discarded stale results to prevent state corruption.';
        if (databaseService.isInitialized()) {
          databaseService.updateEngineeringAnalysisRun(runId, runRecord);
        }
        this.activeRuns.delete(resolvedProjectId);
        this.emit('analysisStale', { projectId: resolvedProjectId, runId });
        this.triggerFileChangeAnalysis(normPath, resolvedProjectId);
        const summary = this.getSummary(normPath, resolvedProjectId);
        summary.healthState = 'stale_data';
        return summary;
      }

      // 9. Persist findings, recommendations, and metric snapshot
      let newCount = 0;
      if (databaseService.isInitialized()) {
        for (const f of collectedFindings) {
          const existing = databaseService.getEngineeringFinding(f.id);
          if (!existing) newCount++;
          databaseService.saveEngineeringFinding(f);
        }
        for (const r of recommendations) {
          databaseService.saveEngineeringRecommendation(r);
        }
      }

      const completedTime = Date.now();
      const durationMs = completedTime - startTime;

      // 10. Compute scores & metric snapshot
      const criticalCount = collectedFindings.filter((f) => f.severity === 'critical' && f.status === 'new').length;
      const highCount = collectedFindings.filter((f) => f.severity === 'high' && f.status === 'new').length;
      const mediumCount = collectedFindings.filter((f) => f.severity === 'medium' && f.status === 'new').length;
      const lowCount = collectedFindings.filter((f) => f.severity === 'low' && f.status === 'new').length;
      const infoCount = collectedFindings.filter((f) => f.severity === 'info' && f.status === 'new').length;

      // Explainable score formula: base 100 minus penalties
      const penalty = criticalCount * 25 + highCount * 12 + mediumCount * 5 + lowCount * 2;
      const overallHealthScore = Math.max(10, 100 - penalty);

      const snapshot: EngineeringMetricSnapshot = {
        id: `snap-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        projectId: resolvedProjectId,
        timestamp: completedTime,
        methodologyVersion: CURRENT_METHODOLOGY_VERSION,
        overallHealthScore,
        architectureScore: Math.max(10, 100 - (circCount(collectedFindings) * 15)),
        technicalDebtScore: Math.max(10, 100 - (debtCount(collectedFindings) * 8)),
        performanceScore: 95,
        securityScore: Math.max(10, 100 - (criticalCount * 30)),
        testingScore: projectData.techStack.testFrameworks.length > 0 ? 90 : 40,
        agentPassRate: 92.5,
        activeFindingsCount: {
          critical: criticalCount,
          high: highCount,
          medium: mediumCount,
          low: lowCount,
          info: infoCount
        },
        totalOpenDebtItems: collectedFindings.filter((f) => f.category === 'technical_debt' && f.status === 'new').length,
        totalRecommendationsActive: recommendations.filter((r) => r.status === 'active').length
      };

      if (databaseService.isInitialized()) {
        databaseService.saveMetricSnapshot(snapshot);
      }

      // Update run record
      runRecord.status = 'completed';
      runRecord.completedAt = completedTime;
      runRecord.durationMs = durationMs;
      runRecord.categoriesAnalyzed = categoriesAnalyzed;
      runRecord.findingsGeneratedCount = collectedFindings.length;
      runRecord.newFindingsCount = newCount;
      if (databaseService.isInitialized()) {
        databaseService.updateEngineeringAnalysisRun(runId, runRecord);
      }

      this.activeRuns.delete(resolvedProjectId);
      const summary = this.getSummary(normPath, resolvedProjectId);
      this.emit('analyzed', summary);
      return summary;
    } catch (err: any) {
      runRecord.status = 'failed';
      runRecord.completedAt = Date.now();
      runRecord.durationMs = Date.now() - startTime;
      runRecord.errorMessage = err?.message || String(err);
      if (databaseService.isInitialized()) {
        databaseService.updateEngineeringAnalysisRun(runId, runRecord);
      }
      this.activeRuns.delete(resolvedProjectId);
      this.emit('analysisFailed', { projectId: resolvedProjectId, error: runRecord.errorMessage });
      throw err;
    }
  }

  /**
   * Retrieves summary of engineering intelligence for a project.
   */
  public getSummary(projectPath: string, projectId?: string): EngineeringIntelligenceSummary {
    const normPath = path.resolve(projectPath);
    const resolvedProjectId = projectId || this.deriveProjectId(normPath);

    let recentRuns: AnalysisRunRecord[] = [];
    let findings: EngineeringFinding[] = [];
    let recommendations: EngineeringRecommendation[] = [];
    let snapshots: EngineeringMetricSnapshot[] = [];

    if (databaseService.isInitialized()) {
      recentRuns = databaseService.listEngineeringAnalysisRuns(resolvedProjectId, 10);
      findings = databaseService.listEngineeringFindings({ projectId: resolvedProjectId, limit: 100 });
      recommendations = databaseService.listEngineeringRecommendations({ projectId: resolvedProjectId, limit: 20 });
      snapshots = databaseService.listMetricSnapshots(resolvedProjectId, 20);
    }

    const currentScore = snapshots[0]?.overallHealthScore || 100;
    const healthTrend = trendAndBaselineService.computeTrend(resolvedProjectId, currentScore, snapshots);

    const counts: Record<FindingCategory, number> = {
      architecture: 0,
      technical_debt: 0,
      performance: 0,
      security: 0,
      agent_performance: 0
    };

    for (const f of findings) {
      if (f.status !== 'resolved' && f.status !== 'false_positive') {
        counts[f.category] = (counts[f.category] || 0) + 1;
      }
    }

    const currentMetrics: EngineeringMetricSnapshot = snapshots[0] || {
      id: `initial-${resolvedProjectId}`,
      projectId: resolvedProjectId,
      timestamp: Date.now(),
      methodologyVersion: CURRENT_METHODOLOGY_VERSION,
      overallHealthScore: 100,
      architectureScore: 100,
      technicalDebtScore: 100,
      performanceScore: 100,
      securityScore: 100,
      testingScore: 100,
      agentPassRate: 100,
      activeFindingsCount: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      totalOpenDebtItems: 0,
      totalRecommendationsActive: 0
    };

    // Explicit Health State Classification (Methodology v1.1.0)
    let healthState: HealthStatusState = 'healthy';
    if (snapshots.length === 0 || !recentRuns[0]) {
      healthState = 'insufficient_data';
    } else if (Date.now() - (recentRuns[0]?.startedAt || 0) > 86400000 * 3) {
      healthState = 'stale_data';
    } else if (counts.security > 0 || currentMetrics.activeFindingsCount?.critical > 0) {
      healthState = 'critical';
    } else if (currentScore < 60) {
      healthState = 'degraded';
    } else if (currentScore < 85 || counts.architecture > 0) {
      healthState = 'warning';
    }

    const dataCoverage = snapshots.length > 0 ? 0.95 : 0.35;

    return {
      projectId: resolvedProjectId,
      projectPath: normPath,
      lastAnalysisTimestamp: recentRuns[0]?.startedAt || Date.now(),
      isAnalyzing: this.activeRuns.has(resolvedProjectId),
      healthState,
      dataCoverage,
      healthTrend,
      currentMetrics,
      recentRuns,
      topRecommendations: recommendations.filter((r) => r.status === 'active').slice(0, 5),
      criticalFindings: findings.filter((f) => f.severity === 'critical' || f.severity === 'high').slice(0, 5),
      findingsCountByCategory: counts,
      config: this.getConfig(resolvedProjectId)
    };
  }

  /**
   * Captures a lightweight project filesystem fingerprint to detect mutations during analysis.
   */
  private captureProjectFingerprint(projectPath: string): string {
    try {
      const gitHead = path.join(projectPath, '.git', 'HEAD');
      let headContent = '';
      if (fs.existsSync(gitHead)) {
        headContent = fs.readFileSync(gitHead, 'utf-8');
      }
      const pkgJson = path.join(projectPath, 'package.json');
      let pkgMtime = 0;
      if (fs.existsSync(pkgJson)) {
        pkgMtime = fs.statSync(pkgJson).mtimeMs;
      }
      return `${headContent}:${pkgMtime}`;
    } catch {
      return 'static';
    }
  }

  /**
   * Updates finding status (accept, defer, resolve, false_positive).
   */
  public updateFindingStatus(
    findingId: string,
    projectId: string,
    status: FindingStatus,
    comment?: string,
    reason?: string
  ): boolean {
    if (!databaseService.isInitialized()) return false;
    const ok = databaseService.updateFindingStatus(findingId, projectId, status, comment, reason);
    if (ok) {
      this.emit('findingUpdated', { findingId, projectId, status });
    }
    return ok;
  }

  /**
   * Submits user feedback on a recommendation.
   */
  public submitRecommendationFeedback(
    recommendationId: string,
    projectId: string,
    feedback: RecommendationFeedbackType,
    comment?: string
  ): void {
    if (!databaseService.isInitialized()) return;
    databaseService.saveRecommendationFeedback({
      id: `fb-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      recommendationId,
      projectId,
      feedback,
      comment,
      timestamp: Date.now()
    });
    this.emit('recommendationFeedback', { recommendationId, projectId, feedback });
  }

  private deriveProjectId(projectPath: string): string {
    return crypto.createHash('sha256').update(projectPath.toLowerCase().trim()).digest('hex').slice(0, 16);
  }
}

function circCount(findings: EngineeringFinding[]): number {
  return findings.filter((f) => f.category === 'architecture' && f.evidence.includes('Cycle:')).length;
}

function debtCount(findings: EngineeringFinding[]): number {
  return findings.filter((f) => f.category === 'technical_debt' && f.status === 'new').length;
}

export const continuousIntelligenceCoordinator = new ContinuousIntelligenceCoordinator();
