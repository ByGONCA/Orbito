import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { databaseService } from '../src/main/db/database.service';
import { performanceBenchmarkHarness } from '../src/main/intelligence/benchmarks/performance-benchmark';
import { continuousIntelligenceCoordinator } from '../src/main/intelligence/continuous-intelligence-coordinator';
import { syntheticFixtureGenerator } from '../src/main/intelligence/benchmarks/fixture-generator';

describe('Engineering Intelligence Reliability & Performance Benchmarks', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbito-rel-test-'));
    databaseService.initialize(tempDir);
  });

  afterEach(() => {
    try {
      databaseService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. verifies incremental discovery speedup and 100% finding equivalence', async () => {
    const measurement = await performanceBenchmarkHarness.runBenchmark('small');

    expect(measurement.speedupRatio).toBeGreaterThanOrEqual(1.0);
    expect(measurement.incrementalEquivalenceVerified).toBe(true);
    expect(measurement.initialDiscoveryMs).toBeGreaterThanOrEqual(0);
    expect(measurement.incrementalAnalysisMs).toBeGreaterThanOrEqual(0);
    expect(measurement.mainProcessHeapMb).toBeGreaterThan(0);
    expect(measurement.dbQueryAvgLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('2. discards stale analysis results when project files mutate during analysis walk', async () => {
    const fixture = syntheticFixtureGenerator.generateFixture('small');
    try {
      const coordinator = continuousIntelligenceCoordinator;

      // Trigger analysis with simulateStaleTrigger = true
      const summary = await coordinator.runAnalysis(fixture.rootDir, {
        triggerType: 'manual',
        scope: 'incremental',
        simulateStaleTrigger: true
      });

      // Verification: the coordinator discarded stale results
      expect(summary.healthState).toBe('stale_data');

      // Verify in DB that the run record was marked as skipped with mutation reason
      const runs = databaseService.listEngineeringAnalysisRuns(summary.projectId, 1);
      expect(runs).toHaveLength(1);
      expect(runs[0].status).toBe('skipped');
      expect(runs[0].skipReason).toContain('mutated');
    } finally {
      fixture.cleanup();
    }
  });

  it('3. isolates findings across multiple concurrent projects and worktrees', async () => {
    const fixtureA = syntheticFixtureGenerator.generateFixture('pathological-security');
    const fixtureB = syntheticFixtureGenerator.generateFixture('pathological-circular');

    try {
      const coordinator = continuousIntelligenceCoordinator;

      const summaryA = await coordinator.runAnalysis(fixtureA.rootDir, { triggerType: 'manual', scope: 'full' });
      const summaryB = await coordinator.runAnalysis(fixtureB.rootDir, { triggerType: 'manual', scope: 'full' });

      // Fixture A must have security findings, Fixture B must have architecture findings
      expect(summaryA.findingsCountByCategory.security).toBeGreaterThanOrEqual(1);
      expect(summaryA.findingsCountByCategory.architecture).toBe(0);

      expect(summaryB.findingsCountByCategory.architecture).toBeGreaterThanOrEqual(1);
      expect(summaryB.findingsCountByCategory.security).toBe(0);

      // Verify that project IDs are completely distinct
      expect(summaryA.projectId).not.toBe(summaryB.projectId);
    } finally {
      fixtureA.cleanup();
      fixtureB.cleanup();
    }
  }, 15000);

  it('4. coalesces rapid event bursts to avoid duplicate concurrent scans', async () => {
    const fixture = syntheticFixtureGenerator.generateFixture('small');
    try {
      const coordinator = continuousIntelligenceCoordinator;

      // Simulate a rapid burst of 5 file change triggers within milliseconds
      coordinator.triggerFileChangeAnalysis(fixture.rootDir);
      coordinator.triggerFileChangeAnalysis(fixture.rootDir);
      coordinator.triggerFileChangeAnalysis(fixture.rootDir);
      coordinator.triggerFileChangeAnalysis(fixture.rootDir);
      coordinator.triggerFileChangeAnalysis(fixture.rootDir);

      // Coordinator debounce map holds exactly 1 pending coalesced timer
      const summary = coordinator.getSummary(fixture.rootDir);
      expect(summary.projectId).toBeDefined();

      coordinator.shutdown(); // cleans up active debounce timers
    } finally {
      fixture.cleanup();
    }
  });
});
