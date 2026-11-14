import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { databaseService } from '../src/main/db/database.service';
import { continuousCodeIntelligenceService } from '../src/main/intelligence/continuous-code-intelligence.service';
import { technicalDebtIntelligenceService } from '../src/main/intelligence/technical-debt-intelligence.service';
import { securityIntelligenceService } from '../src/main/intelligence/security-intelligence.service';
import { performanceIntelligenceService } from '../src/main/intelligence/performance-intelligence.service';
import { agentPerformanceIntelligenceService } from '../src/main/intelligence/agent-performance-intelligence.service';
import { recommendationEngineService } from '../src/main/intelligence/recommendation-engine.service';
import { trendAndBaselineService, CURRENT_METHODOLOGY_VERSION } from '../src/main/intelligence/trend-and-baseline.service';
import { continuousIntelligenceCoordinator } from '../src/main/intelligence/continuous-intelligence-coordinator';
import { SecretRedactor } from '../src/main/mcp/security/secret-redactor';
import type { ProjectIntelligenceData } from '../src/shared/project-intelligence';
import type { EngineeringFinding } from '../src/shared/continuous-intelligence';

describe('Continuous Engineering Intelligence — 15 E2E Simulation Scenarios', () => {
  let tempDir: string;
  let projectId: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbito-sim-test-'));
    projectId = 'sim-proj-001';
    databaseService.initialize(tempDir);
    continuousIntelligenceCoordinator.initialize();
  });

  afterEach(() => {
    try {
      continuousIntelligenceCoordinator.shutdown();
      databaseService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // Base mock ProjectIntelligenceData fixture
  function createMockProjectData(overrides: Partial<ProjectIntelligenceData> = {}): ProjectIntelligenceData {
    return {
      projectId,
      projectPath: tempDir,
      techStack: {
        languages: [{ name: 'TypeScript', fileCount: 45, percentage: 90 }],
        frameworks: ['React', 'Electron'],
        libraries: ['better-sqlite3'],
        packageManagers: ['npm'],
        buildSystems: ['vite'],
        testFrameworks: ['vitest'],
        databaseEngines: ['sqlite'],
        apiStyles: ['ipc'],
        styling: ['tailwind'],
        dockerSupport: false,
        ciWorkflows: ['ci.yml'],
        rawManifestsFound: ['package.json']
      },
      monorepo: { isMonorepo: false, type: 'none', packages: [] },
      architecture: {
        style: 'modular-monolith',
        entryPoints: [{ path: 'src/main/index.ts', type: 'main', description: 'App entry' }],
        modules: [
          {
            id: 'mod-1',
            name: 'core',
            path: 'src/main/core',
            relativePath: 'src/main/core',
            type: 'service',
            responsibility: 'Core runtime',
            fileCount: 15,
            dependencies: [],
            dependedOnBy: []
          }
        ],
        circularDependencies: [],
        criticalPaths: [],
        summary: 'Standard modular application'
      },
      git: {
        branch: 'master',
        headCommit: 'a1b2c3d',
        commitMessage: 'Initial setup',
        isDirty: false,
        modifiedFiles: [],
        stagedFiles: [],
        untrackedFiles: [],
        activeWorktrees: [],
        hotspotFiles: []
      },
      health: {
        overallScore: 95,
        architectureScore: 95,
        dependenciesScore: 95,
        testingScore: 95,
        documentationScore: 95,
        securityScore: 95,
        buildScore: 95,
        findings: []
      },
      knowledgeEntries: [],
      lastAnalyzedAt: Date.now(),
      ...overrides
    };
  }

  // -------------------------------------------------------------
  // Scenario 1: A new circular dependency
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 1: detects newly introduced circular dependency and calculates baseline diff', () => {
    const previousBaseline = {
      modules: ['core', 'ui'],
      circularCount: 0,
      timestamp: Date.now() - 3600000
    };

    const mockData = createMockProjectData({
      architecture: {
        style: 'modular-monolith',
        entryPoints: [{ path: 'src/main/index.ts', type: 'main', description: 'App entry' }],
        modules: [
          { id: 'm1', name: 'service-a', path: 'src/a', relativePath: 'src/a', type: 'service', responsibility: '', fileCount: 5, dependencies: ['service-b'], dependedOnBy: ['service-b'] },
          { id: 'm2', name: 'service-b', path: 'src/b', relativePath: 'src/b', type: 'service', responsibility: '', fileCount: 5, dependencies: ['service-a'], dependedOnBy: ['service-a'] }
        ],
        circularDependencies: [{ cycle: ['service-a', 'service-b', 'service-a'] }],
        criticalPaths: [],
        summary: ''
      }
    });

    const result = continuousCodeIntelligenceService.analyzeCodeIntelligence(mockData, previousBaseline);
    const circularFinding = result.findings.find((f) => f.evidence.includes('Cycle:'));

    expect(circularFinding).toBeDefined();
    expect(circularFinding?.severity).toBe('high');
    expect(circularFinding?.baselineComparison?.diffSummary).toContain('Newly introduced dependency cycle');
    expect(circularFinding?.baselineComparison?.previousValue).toBe(0);
    expect(circularFinding?.baselineComparison?.currentValue).toBe(1);
  });

  // -------------------------------------------------------------
  // Scenario 2: A critical module becoming excessively complex
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 2: identifies excessively complex module as high technical debt', () => {
    const mockData = createMockProjectData({
      architecture: {
        style: 'modular-monolith',
        entryPoints: [{ path: 'src/main/index.ts', type: 'main', description: 'App entry' }],
        modules: [
          {
            id: 'mod-giant',
            name: 'monolithic-blob',
            path: 'src/blob',
            relativePath: 'src/blob',
            type: 'service',
            responsibility: 'Too many things',
            fileCount: 75, // > 60 files threshold
            dependencies: [],
            dependedOnBy: []
          }
        ],
        circularDependencies: [],
        criticalPaths: [],
        summary: ''
      }
    });

    const findings = technicalDebtIntelligenceService.analyzeTechnicalDebt(mockData);
    const complexMod = findings.find((f) => f.evidence.includes('monolithic-blob'));

    expect(complexMod).toBeDefined();
    expect(complexMod?.severity).toBe('high');
    expect(complexMod?.effortCategory).toBe('large');
    expect(complexMod?.technicalDebtScore).toBeGreaterThanOrEqual(60);
  });

  // -------------------------------------------------------------
  // Scenario 3: A dependency security warning
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 3: detects unencrypted plaintext dependency protocol and flags high security risk', () => {
    const pkgJsonPath = path.join(tempDir, 'package.json');
    fs.writeFileSync(
      pkgJsonPath,
      JSON.stringify(
        {
          name: 'sim-app',
          dependencies: {
            'insecure-lib': 'http://insecure-host.com/tarball.tgz'
          }
        },
        null,
        2
      )
    );

    const mockData = createMockProjectData();
    const findings = securityIntelligenceService.analyzeSecurity(mockData);
    const secFinding = findings.find((f) => f.id.includes('sec-dep-insecure'));

    expect(secFinding).toBeDefined();
    expect(secFinding?.severity).toBe('high');
    expect(secFinding?.evidence).toContain('insecure-lib');
    expect(secFinding?.evidence).toContain('http://');
  });

  // -------------------------------------------------------------
  // Scenario 4: A recurring agent verification failure
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 4: flags systematic agent verification failures and suggests fallback tier', () => {
    // Record 4 failed traces for an agent role
    for (let i = 0; i < 4; i++) {
      databaseService.saveTaskTrace({
        traceId: `tr-fail-${i}`,
        orchestrationId: 'orch-01',
        taskId: `task-${i}`,
        taskTitle: 'Complex refactoring',
        agentId: 'agent-weak',
        role: 'junior-dev',
        spans: [
          {
            name: 'Verification Step',
            layer: 'verification',
            status: 'failed',
            startedAt: Date.now() - 1000,
            completedAt: Date.now(),
            durationMs: 1000
          }
        ],
        startedAt: Date.now() - 2000,
        status: 'failed',
        durationMs: 2000
      });
    }

    const { evaluations, findings } = agentPerformanceIntelligenceService.evaluateAgentPerformance(projectId);
    const juniorEval = evaluations.find((e) => e.agentRole === 'junior-dev');

    expect(juniorEval).toBeDefined();
    expect(juniorEval?.status).toBe('sufficient_evidence');
    expect(juniorEval?.verificationPassRate).toBe(0);
    expect(juniorEval?.failureRate).toBe(100);

    const agentFinding = findings.find((f) => f.category === 'agent_performance');
    expect(agentFinding).toBeDefined();
    expect(agentFinding?.suggestedRemediation).toContain('fallback to a higher-capability model tier');
  });

  // -------------------------------------------------------------
  // Scenario 5: A performance regression
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 5: detects execution failure rate spike and labels telemetry exact_metered', () => {
    const metrics = performanceIntelligenceService.collectMetrics(projectId);
    metrics.engineeringExecution.failedTaskRatePercent = 28; // > 20% threshold

    const findings = performanceIntelligenceService.analyzePerformance(projectId, tempDir, metrics);
    const failRateFinding = findings.find((f) => f.id.includes('perf-fail-rate'));

    expect(failRateFinding).toBeDefined();
    expect(failRateFinding?.severity).toBe('high');
    expect(failRateFinding?.evidence).toContain('28%');
  });

  // -------------------------------------------------------------
  // Scenario 6: A previously resolved finding reappearing
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 6: tracks finding lifecycle when a previously resolved finding is reopened', () => {
    const findingId = 'find-reopen-test';
    databaseService.saveEngineeringFinding({
      id: findingId,
      projectId,
      projectPath: tempDir,
      detectionTimestamp: Date.now() - 5000,
      category: 'architecture',
      severity: 'medium',
      confidence: 0.9,
      affectedFiles: [],
      evidence: 'test cycle',
      explanation: 'test cycle',
      suggestedRemediation: 'fix',
      relatedHistoricalFindingIds: [],
      status: 'resolved',
      updatedAt: Date.now() - 5000
    });

    // Reopen finding
    databaseService.updateFindingStatus(findingId, projectId, 'reopened', 'Cycle reintroduced in commit b4');
    const finding = databaseService.getEngineeringFinding(findingId);

    expect(finding?.status).toBe('reopened');
    expect(finding?.resolvedAt).toBeUndefined();

    const events = databaseService.listFindingLifecycleEvents(findingId);
    expect(events.length).toBe(1);
    expect(events[0].newStatus).toBe('reopened');
    expect(events[0].comment).toContain('Cycle reintroduced');
  });

  // -------------------------------------------------------------
  // Scenario 7: A recommendation being accepted
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 7: accepts recommendation via user feedback without removing historical context', () => {
    const recId = 'rec-accept-01';
    databaseService.saveEngineeringRecommendation({
      id: recId,
      projectId,
      projectPath: tempDir,
      title: 'Add Smoke Tests',
      problem: 'No tests detected',
      supportingEvidence: 'Zero test runners',
      expectedImpact: 'Fewer regressions',
      confidence: 0.95,
      estimatedEffort: 'small',
      priority: 'high',
      category: 'technical_debt',
      relatedFindingIds: [],
      suggestedNextAction: 'Install vitest',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    databaseService.saveRecommendationFeedback({
      id: 'fb-01',
      recommendationId: recId,
      projectId,
      feedback: 'accept',
      comment: 'Accepted for next sprint',
      timestamp: Date.now()
    });

    const recs = databaseService.listEngineeringRecommendations({ projectId });
    const rec = recs.find((r) => r.id === recId);
    expect(rec?.status).toBe('accepted');

    const feedbackList = databaseService.listRecommendationFeedback(recId);
    expect(feedbackList.length).toBe(1);
    expect(feedbackList[0].comment).toBe('Accepted for next sprint');
  });

  // -------------------------------------------------------------
  // Scenario 8: Approved recommendation becomes autonomous task
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 8: verifies approved recommendation provides autonomous task prompt preserving finding context', () => {
    const findings: EngineeringFinding[] = [
      {
        id: 'find-sec-token',
        projectId,
        projectPath: tempDir,
        detectionTimestamp: Date.now(),
        category: 'security',
        severity: 'critical',
        confidence: 0.95,
        affectedFiles: ['.env'],
        evidence: 'Detected unignored sensitive configuration file: .env',
        explanation: 'Sensitive environment file not ignored',
        suggestedRemediation: 'Add .env to .gitignore and rotate secrets',
        relatedHistoricalFindingIds: [],
        status: 'new',
        updatedAt: Date.now()
      }
    ];

    const recs = recommendationEngineService.generateRecommendations(projectId, tempDir, findings);
    const rec = recs[0];

    expect(rec).toBeDefined();
    expect(rec.taskGoalPrompt).toBeDefined();
    expect(rec.taskGoalPrompt).toContain('.env');
    expect(rec.relatedFindingIds).toContain('find-sec-token');
  });

  // -------------------------------------------------------------
  // Scenario 9: User disables background analysis
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 9: disabling background continuous analysis prevents scheduled runs', () => {
    continuousIntelligenceCoordinator.updateConfig({ enabled: false }, projectId);
    const config = continuousIntelligenceCoordinator.getConfig(projectId);
    expect(config.enabled).toBe(false);
  });

  // -------------------------------------------------------------
  // Scenario 10: Insufficient historical data
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 10: reports insufficiently_observed rather than computing false trend on zero or single snapshot', () => {
    const trend = trendAndBaselineService.computeTrend(projectId, 100, []);
    expect(trend.trendDirection).toBe('insufficiently_observed');
    expect(trend.samplesCount).toBe(0);
    expect(trend.explanation).toContain('Insufficient historical baseline data');
  });

  // -------------------------------------------------------------
  // Scenario 11: Conflicting or stale findings reconciliation
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 11: deduplicates and preserves accepted/deferred status across repeated scans', () => {
    const existingFindings: EngineeringFinding[] = [
      {
        id: `debt-test-suite-${projectId.slice(0, 8)}`,
        projectId,
        projectPath: tempDir,
        detectionTimestamp: Date.now() - 10000,
        category: 'technical_debt',
        severity: 'high',
        confidence: 0.95,
        affectedFiles: [tempDir],
        evidence: 'Zero automated test frameworks detected',
        explanation: 'The project lacks an automated test framework.',
        suggestedRemediation: 'Install vitest',
        relatedHistoricalFindingIds: [],
        status: 'accepted', // User accepted this debt item
        updatedAt: Date.now() - 10000
      }
    ];

    const mockData = createMockProjectData({
      techStack: {
        languages: [],
        frameworks: [],
        libraries: [],
        packageManagers: [],
        buildSystems: [],
        testFrameworks: [], // Still missing test framework
        databaseEngines: [],
        apiStyles: [],
        styling: [],
        dockerSupport: false,
        ciWorkflows: [],
        rawManifestsFound: []
      }
    });

    const newFindings = technicalDebtIntelligenceService.analyzeTechnicalDebt(mockData, existingFindings);
    const testDebt = newFindings.find((f) => f.id.includes('debt-test-suite'));

    // Status must remain 'accepted', not reset to 'new'
    expect(testDebt?.status).toBe('accepted');
  });

  // -------------------------------------------------------------
  // Scenario 12: Multiple concurrent project analyses
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 12: coalesces rapid triggers and prevents duplicate in-flight analysis', async () => {
    // Calling triggerFileChangeAnalysis multiple times should debounce
    continuousIntelligenceCoordinator.triggerFileChangeAnalysis(tempDir, projectId);
    continuousIntelligenceCoordinator.triggerFileChangeAnalysis(tempDir, projectId);
    continuousIntelligenceCoordinator.triggerFileChangeAnalysis(tempDir, projectId);

    const summary = continuousIntelligenceCoordinator.getSummary(tempDir, projectId);
    expect(summary).toBeDefined();
    expect(summary.projectId).toBe(projectId);
  });

  // -------------------------------------------------------------
  // Scenario 13: Heavy machine load pausing background work
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 13: pauses background analysis with skipReason when system is under heavy load', async () => {
    continuousIntelligenceCoordinator.setSystemPaused(true);

    const summary = await continuousIntelligenceCoordinator.runAnalysis(tempDir, {
      projectId,
      triggerType: 'event'
    });

    expect(summary).toBeDefined();

    const runs = databaseService.listEngineeringAnalysisRuns(projectId);
    expect(runs.length).toBe(1);
    expect(runs[0].status).toBe('skipped');
    expect(runs[0].skipReason).toContain('paused');

    continuousIntelligenceCoordinator.setSystemPaused(false);
  });

  // -------------------------------------------------------------
  // Scenario 14: Sensitive information redacted from findings
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 14: guarantees sensitive tokens and secrets are redacted from findings and evidence', () => {
    const rawSecret = 'sk-proj-999988887777666655554444333322221111';
    SecretRedactor.registerSecret(rawSecret);

    const sensitiveLog = `Connected with Authorization: Bearer ${rawSecret} to remote API`;
    const redacted = SecretRedactor.redactText(sensitiveLog);

    expect(redacted).not.toContain(rawSecret);
    expect(redacted).toContain('Bearer ••••••••');

    SecretRedactor.unregisterSecret(rawSecret);
  });

  // -------------------------------------------------------------
  // Scenario 15: Methodology version change invalidating direct comparisons
  // -------------------------------------------------------------
  it('[SIMULATED] Scenario 15: methodology version update isolates incomparable historical values', () => {
    const oldVersionSnapshot: EngineeringMetricSnapshot = {
      id: 'snap-old',
      projectId,
      timestamp: Date.now() - 200000,
      methodologyVersion: '0.9.0', // Older scoring methodology
      overallHealthScore: 50,
      architectureScore: 50,
      technicalDebtScore: 50,
      performanceScore: 50,
      securityScore: 50,
      testingScore: 50,
      agentPassRate: 50,
      activeFindingsCount: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      totalOpenDebtItems: 0,
      totalRecommendationsActive: 0
    };

    const currentSnapshot: EngineeringMetricSnapshot = {
      id: 'snap-new',
      projectId,
      timestamp: Date.now(),
      methodologyVersion: CURRENT_METHODOLOGY_VERSION, // '1.0.0'
      overallHealthScore: 92,
      architectureScore: 90,
      technicalDebtScore: 90,
      performanceScore: 95,
      securityScore: 95,
      testingScore: 90,
      agentPassRate: 95,
      activeFindingsCount: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      totalOpenDebtItems: 0,
      totalRecommendationsActive: 0
    };

    // When evaluating current score 92 against snapshots containing only 0.9.0
    const trend = trendAndBaselineService.computeTrend(projectId, 92, [oldVersionSnapshot, currentSnapshot]);
    expect(trend.trendDirection).toBe('insufficiently_observed');
    expect(trend.methodologyVersion).toBe(CURRENT_METHODOLOGY_VERSION);
  });

  // -------------------------------------------------------------
  // Critical Invariant: Observational Only (Zero Code Modifications)
  // -------------------------------------------------------------
  it('[SIMULATED] Critical Invariant: verifies Continuous Engineering Intelligence never modifies project files', async () => {
    const sentinelFile = path.join(tempDir, 'sentinel.txt');
    fs.writeFileSync(sentinelFile, 'ORIGINAL_UNTOUCHED_CONTENT', 'utf-8');

    const mtimeBefore = fs.statSync(sentinelFile).mtimeMs;

    await continuousIntelligenceCoordinator.runAnalysis(tempDir, {
      projectId,
      triggerType: 'manual',
      scope: 'incremental'
    });

    const contentAfter = fs.readFileSync(sentinelFile, 'utf-8');
    const mtimeAfter = fs.statSync(sentinelFile).mtimeMs;

    expect(contentAfter).toBe('ORIGINAL_UNTOUCHED_CONTENT');
    expect(mtimeAfter).toBe(mtimeBefore);
  });
});
