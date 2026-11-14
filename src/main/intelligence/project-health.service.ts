import fs from 'node:fs';
import path from 'node:path';
import type {
  ProjectHealthReport,
  HealthFinding,
  TechStackInfo,
  ArchitecturalOverview
} from '../../shared/project-intelligence';

export class ProjectHealthService {
  public evaluateHealth(
    projectPath: string,
    techStack: TechStackInfo,
    architecture: ArchitecturalOverview
  ): ProjectHealthReport {
    const findings: HealthFinding[] = [];

    let architectureScore = 100;
    let dependenciesScore = 100;
    let testingScore = 100;
    let documentationScore = 100;
    let securityScore = 100;
    let buildScore = 100;

    // 1. Architecture Evaluation
    if (architecture.circularDependencies.length > 0) {
      const penalty = Math.min(45, architecture.circularDependencies.length * 15);
      architectureScore -= penalty;
      for (const c of architecture.circularDependencies) {
        findings.push({
          id: `arch-circ-${findings.length}`,
          category: 'architecture',
          severity: 'warning',
          title: 'Circular Module Dependency Detected',
          message: `Detected circular dependency cycle: ${c.cycle.join(' -> ')}`,
          evidence: c.cycle.join(' -> '),
          remediation: 'Refactor shared interfaces or types into a lower-level shared module to break the cycle.'
        });
      }
    }

    if (architecture.entryPoints.length === 0) {
      architectureScore -= 20;
      findings.push({
        id: `arch-no-entry-${findings.length}`,
        category: 'architecture',
        severity: 'info',
        title: 'No Explicit Application Entry Point Detected',
        message: 'Could not identify a standard entry point (index.ts, main.ts, main in package.json).',
        remediation: 'Declare standard entry points in manifests or project configuration.'
      });
    }

    // 2. Dependencies Evaluation
    const hasPackageJson = fs.existsSync(path.join(projectPath, 'package.json'));
    const hasLockfile =
      fs.existsSync(path.join(projectPath, 'package-lock.json')) ||
      fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml')) ||
      fs.existsSync(path.join(projectPath, 'yarn.lock')) ||
      fs.existsSync(path.join(projectPath, 'Cargo.lock'));

    if (hasPackageJson && !hasLockfile) {
      dependenciesScore -= 30;
      findings.push({
        id: `dep-no-lock-${findings.length}`,
        category: 'dependencies',
        severity: 'warning',
        title: 'Missing Package Lockfile',
        message: 'package.json exists but no package-lock.json, pnpm-lock.yaml or yarn.lock was found.',
        remediation: 'Run your package manager to generate a deterministic lockfile before deploying.'
      });
    }

    // 3. Testing Evaluation
    if (techStack.testFrameworks.length === 0) {
      testingScore -= 40;
      findings.push({
        id: `test-no-framework-${findings.length}`,
        category: 'testing',
        severity: 'warning',
        title: 'No Automated Testing Framework Detected',
        message: 'No standard testing framework (Vitest, Jest, Pytest, Cargo test) was detected in dependencies.',
        remediation: 'Configure an automated testing harness like Vitest or Jest to ensure code reliability.'
      });
    }

    const testDirExists =
      fs.existsSync(path.join(projectPath, 'tests')) ||
      fs.existsSync(path.join(projectPath, 'test')) ||
      fs.existsSync(path.join(projectPath, '__tests__'));

    if (!testDirExists) {
      testingScore -= 30;
      findings.push({
        id: `test-no-dir-${findings.length}`,
        category: 'testing',
        severity: 'info',
        title: 'No Dedicated Test Directory Found',
        message: 'Could not locate a tests/ or __tests__/ directory.',
        remediation: 'Create a dedicated test suite directory for unit and integration tests.'
      });
    }

    // 4. Documentation Evaluation
    const hasReadme = fs.existsSync(path.join(projectPath, 'README.md')) || fs.existsSync(path.join(projectPath, 'readme.md'));
    const hasAgentsMd = fs.existsSync(path.join(projectPath, 'AGENTS.md'));
    const hasDocsDir = fs.existsSync(path.join(projectPath, 'docs'));

    if (!hasReadme) {
      documentationScore -= 35;
      findings.push({
        id: `doc-no-readme-${findings.length}`,
        category: 'documentation',
        severity: 'warning',
        title: 'Missing Project README.md',
        message: 'Project does not contain a root README.md documentation file.',
        remediation: 'Create a root README.md describing the project, installation, and run commands.'
      });
    }

    if (!hasAgentsMd) {
      documentationScore -= 25;
      findings.push({
        id: `doc-no-agents-${findings.length}`,
        category: 'documentation',
        severity: 'info',
        title: 'No AI Agent Context Instructions (AGENTS.md)',
        message: 'An AGENTS.md guide provides autonomous coding agents with explicit architectural rules and conventions.',
        remediation: 'Add an AGENTS.md file in the project root.'
      });
    }

    if (!hasDocsDir) {
      documentationScore -= 20;
    }

    // 5. Security & Secret Exposure Evaluation
    const envFile = path.join(projectPath, '.env');
    if (fs.existsSync(envFile)) {
      try {
        const envContent = fs.readFileSync(envFile, 'utf8');
        if (/([A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASS)[A-Z0-9_]*\s*=\s*[^\s#]+)/i.test(envContent)) {
          securityScore -= 40;
          findings.push({
            id: `sec-env-secrets-${findings.length}`,
            category: 'security',
            severity: 'critical',
            filePath: '.env',
            title: 'Potential Secrets Detected in Local .env File',
            message: 'Local .env file contains credentials or keys. Ensure this file is ignored by Git.',
            remediation: 'Verify .env is added to .gitignore and rotate any committed secrets.'
          });
        }
      } catch {}
    }

    // 6. Build Readiness Evaluation
    const hasTsConfig = fs.existsSync(path.join(projectPath, 'tsconfig.json'));
    if (techStack.languages.some((l) => l.name.includes('TypeScript')) && !hasTsConfig) {
      buildScore -= 35;
      findings.push({
        id: `build-no-tsconfig-${findings.length}`,
        category: 'build',
        severity: 'warning',
        title: 'Missing TypeScript Configuration (tsconfig.json)',
        message: 'TypeScript source files detected, but no tsconfig.json file was found.',
        remediation: 'Add a tsconfig.json file to configure compiler options.'
      });
    }

    if (techStack.buildSystems.length === 0) {
      buildScore -= 20;
      findings.push({
        id: `build-no-tool-${findings.length}`,
        category: 'build',
        severity: 'info',
        title: 'No Standard Build System Detected',
        message: 'Could not identify a configured bundler or compiler (Vite, Webpack, tsc, Cargo).',
        remediation: 'Define standard build scripts in package.json or Makefile.'
      });
    }

    // Clamp category scores 0-100
    const clamp = (val: number) => Math.max(0, Math.min(100, Math.round(val)));
    const categoryScores = {
      architecture: clamp(architectureScore),
      dependencies: clamp(dependenciesScore),
      testing: clamp(testingScore),
      documentation: clamp(documentationScore),
      security: clamp(securityScore),
      build: clamp(buildScore)
    };

    // Calculate weighted overall score
    const overallScore = Math.round(
      categoryScores.architecture * 0.2 +
      categoryScores.dependencies * 0.15 +
      categoryScores.testing * 0.2 +
      categoryScores.documentation * 0.15 +
      categoryScores.security * 0.15 +
      categoryScores.build * 0.15
    );

    return {
      overallScore,
      categoryScores,
      findings,
      evaluatedAt: Date.now()
    };
  }
}

export const projectHealthService = new ProjectHealthService();
