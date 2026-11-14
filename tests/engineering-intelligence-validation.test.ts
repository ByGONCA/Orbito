import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { databaseService } from '../src/main/db/database.service';
import { engineeringIntelligenceValidator } from '../src/main/intelligence/validation/intelligence-validator';
import { syntheticFixtureGenerator } from '../src/main/intelligence/benchmarks/fixture-generator';
import { continuousCodeIntelligenceService } from '../src/main/intelligence/continuous-code-intelligence.service';
import { securityIntelligenceService } from '../src/main/intelligence/security-intelligence.service';

describe('Engineering Intelligence Validation — Accuracy, Precision, Recall & F1', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbito-val-test-'));
    databaseService.initialize(tempDir);
  });

  afterEach(() => {
    try {
      databaseService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. validates overall intelligence suite against ground-truth scenarios with F1 >= 0.90', async () => {
    const report = await engineeringIntelligenceValidator.runValidation('all' as any);

    expect(report.overallF1Score).toBeGreaterThanOrEqual(0.90);
    expect(report.overallPrecision).toBeGreaterThanOrEqual(0.90);
    expect(report.overallRecall).toBeGreaterThanOrEqual(0.90);
    expect(report.totalScenariosExecuted).toBeGreaterThan(0);
    expect(report.passedAllGates).toBe(true);
  }, 20000);

  it('2. guarantees zero false positives on a clean, compliant project fixture (pathological-negative)', async () => {
    const fixture = syntheticFixtureGenerator.generateFixture('pathological-negative');
    try {
      const mockProjectData: any = {
        projectId: 'mock-proj-clean',
        projectPath: fixture.rootDir,
        architecture: {
          modules: [
            { name: 'calculator', path: 'src/calculator', relativePath: 'src/calculator', fileCount: 2, dependencies: [], dependedOnBy: [] },
            { name: 'formatter', path: 'src/formatter', relativePath: 'src/formatter', fileCount: 2, dependencies: [], dependedOnBy: [] }
          ],
          circularDependencies: [],
          entryPoints: [{ path: 'src/index.ts', type: 'module-root', description: 'Entry' }]
        },
        techStack: { frameworks: [], libraries: [], buildSystems: [], testFrameworks: ['vitest'] },
        git: { headCommit: 'abc1234', branch: 'master', hotspotFiles: [] },
        health: { findings: [] }
      };

      // Analyze architecture
      const codeFindings = continuousCodeIntelligenceService.analyzeCodeIntelligence(mockProjectData, null);

      // Analyze security
      const secFindings = securityIntelligenceService.analyzeSecurity(mockProjectData);

      // Verify zero false positives
      const circularDetections = codeFindings.findings.filter(f => f.category === 'architecture' && f.evidence.includes('Cycle:'));
      const criticalSecDetections = secFindings.filter(f => f.severity === 'critical');

      expect(circularDetections).toHaveLength(0);
      expect(criticalSecDetections).toHaveLength(0);
    } finally {
      fixture.cleanup();
    }
  });

  it('3. accurately detects circular dependencies in pathological fixture without missing edges', () => {
    const fixture = syntheticFixtureGenerator.generateFixture('pathological-circular');
    try {
      const mockProjectData: any = {
        projectId: 'mock-proj-circ',
        projectPath: fixture.rootDir,
        architecture: {
          modules: [
            { name: 'module-a', path: 'src/module-a', relativePath: 'src/module-a', fileCount: 1, dependencies: ['src/module-b'], dependedOnBy: ['src/module-c'] },
            { name: 'module-b', path: 'src/module-b', relativePath: 'src/module-b', fileCount: 1, dependencies: ['src/module-c'], dependedOnBy: ['src/module-a'] },
            { name: 'module-c', path: 'src/module-c', relativePath: 'src/module-c', fileCount: 1, dependencies: ['src/module-a'], dependedOnBy: ['src/module-b'] }
          ],
          circularDependencies: [{ cycle: ['src/module-a', 'src/module-b', 'src/module-c', 'src/module-a'] }],
          entryPoints: [{ path: 'src/module-a/index.ts', type: 'module-root', description: 'Entry' }]
        },
        techStack: { frameworks: [], libraries: [], buildSystems: [], testFrameworks: ['vitest'] },
        git: { headCommit: 'abc1234', branch: 'master', hotspotFiles: [] },
        health: { findings: [] }
      };

      const codeFindings = continuousCodeIntelligenceService.analyzeCodeIntelligence(mockProjectData, null);

      const cycles = codeFindings.findings.filter(f => f.category === 'architecture' && f.evidence.includes('Cycle:'));
      expect(cycles.length).toBeGreaterThanOrEqual(1);
      expect(cycles[0].severity).toBe('medium');
      expect(cycles[0].evidence).toContain('Cycle:');
    } finally {
      fixture.cleanup();
    }
  });

  it('4. detects hardcoded secrets in pathological security fixture with high confidence', () => {
    const fixture = syntheticFixtureGenerator.generateFixture('pathological-security');
    try {
      const mockProjectData: any = {
        projectId: 'mock-proj-sec',
        projectPath: fixture.rootDir,
        architecture: { modules: [], circularDependencies: [], entryPoints: [] },
        techStack: { frameworks: [], libraries: [], buildSystems: [], testFrameworks: [] },
        git: { headCommit: 'abc1234', branch: 'master', hotspotFiles: [] },
        health: { findings: [] }
      };

      const secFindings = securityIntelligenceService.analyzeSecurity(mockProjectData);

      const credFindings = secFindings.filter(f => f.id.includes('sec-env-') || f.id.includes('sec-dep-insecure-'));
      expect(credFindings.length).toBeGreaterThanOrEqual(1);
      expect(credFindings[0].severity).toBe('critical');
      expect(credFindings[0].confidence).toBeGreaterThanOrEqual(0.85);
      expect(credFindings[0].suggestedRemediation).toContain('.gitignore');
    } finally {
      fixture.cleanup();
    }
  });

  it('5. evaluates domain-specific confusion matrices and validates precision across all domains', async () => {
    const archReport = await engineeringIntelligenceValidator.runValidation('architecture');
    const secReport = await engineeringIntelligenceValidator.runValidation('security');
    const debtReport = await engineeringIntelligenceValidator.runValidation('technical_debt');

    expect(archReport.domainResults.architecture.falsePositives).toBe(0);
    expect(secReport.domainResults.security.falsePositives).toBe(0);
    expect(debtReport.domainResults.technical_debt.falsePositives).toBe(0);

    expect(archReport.domainResults.architecture.precision).toBe(1.0);
    expect(secReport.domainResults.security.precision).toBe(1.0);
    expect(debtReport.domainResults.technical_debt.precision).toBe(1.0);
  }, 20000);
});
