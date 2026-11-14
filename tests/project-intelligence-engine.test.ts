import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { projectDiscoveryService } from '../src/main/intelligence/project-discovery.service';
import { architecturalIntelligenceService } from '../src/main/intelligence/architectural-intelligence.service';
import { gitIntelligenceService } from '../src/main/intelligence/git-intelligence.service';
import { projectHealthService } from '../src/main/intelligence/project-health.service';
import { roleContextAssemblerService } from '../src/main/intelligence/role-context-assembler.service';

describe('Orbito Project Intelligence Engine Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbito-project-intel-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. discovers Node/TypeScript repository with React, Electron and Vitest frameworks', async () => {
    // Scaffold test repository structure
    fs.mkdirSync(path.join(tempDir, 'src', 'main'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src', 'renderer'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'tests'), { recursive: true });

    fs.writeFileSync(path.join(tempDir, 'src', 'main', 'index.ts'), 'export const start = () => {};');
    fs.writeFileSync(path.join(tempDir, 'src', 'renderer', 'App.tsx'), 'export const App = () => <div>Hello</div>;');
    fs.writeFileSync(path.join(tempDir, 'tests', 'app.test.ts'), 'test("runs", () => {});');

    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'sample-electron-app',
        main: './src/main/index.ts',
        dependencies: {
          electron: '^34.0.0',
          react: '^19.0.0',
          'better-sqlite3': '^11.8.0',
          tailwindcss: '^3.4.0'
        },
        devDependencies: {
          typescript: '^5.0.0',
          vitest: '^3.0.0',
          'electron-vite': '^3.0.0'
        }
      })
    );
    fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');

    const result = await projectDiscoveryService.discover(tempDir, 'proj-node-1');

    expect(result.techStack.languages.some((l) => l.name.includes('TypeScript'))).toBe(true);
    expect(result.techStack.frameworks).toContain('Electron');
    expect(result.techStack.frameworks).toContain('React');
    expect(result.techStack.databaseEngines).toContain('SQLite');
    expect(result.techStack.styling).toContain('Tailwind CSS');
    expect(result.techStack.testFrameworks).toContain('Vitest');
    expect(result.techStack.buildSystems).toContain('electron-vite');
    expect(result.monorepo.isMonorepo).toBe(false);
    expect(result.knowledgeEntries.length).toBeGreaterThanOrEqual(2);
  });

  it('2. discovers monorepo workspaces and identifies nested packages', async () => {
    // Scaffold pnpm monorepo
    fs.writeFileSync(path.join(tempDir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n  - "apps/*"');
    fs.mkdirSync(path.join(tempDir, 'apps', 'web'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'packages', 'core'), { recursive: true });

    fs.writeFileSync(
      path.join(tempDir, 'apps', 'web', 'package.json'),
      JSON.stringify({ name: '@monorepo/web', main: 'index.js' })
    );
    fs.writeFileSync(
      path.join(tempDir, 'packages', 'core', 'package.json'),
      JSON.stringify({ name: '@monorepo/core', main: 'lib.js' })
    );

    const result = await projectDiscoveryService.discover(tempDir, 'proj-mono-1');

    expect(result.monorepo.isMonorepo).toBe(true);
    expect(result.monorepo.type).toBe('pnpm');
    expect(result.monorepo.packages.length).toBe(2);
    expect(result.monorepo.packages.map((p) => p.name).sort()).toEqual(['@monorepo/core', '@monorepo/web']);

    const monorepoEntry = result.knowledgeEntries.find((k) => k.key === 'monorepo_layout');
    expect(monorepoEntry).toBeDefined();
    expect(monorepoEntry?.content).toContain('@monorepo/web');
  });

  it('3. discovers Python ecosystem with FastAPI and Pytest', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'requirements.txt'),
      'fastapi==0.110.0\nuvicorn==0.28.0\npytest==8.0.0\nsqlalchemy==2.0.0\n'
    );
    fs.mkdirSync(path.join(tempDir, 'app'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'app', 'main.py'), 'from fastapi import FastAPI\napp = FastAPI()');

    const result = await projectDiscoveryService.discover(tempDir, 'proj-py-1');

    expect(result.techStack.frameworks).toContain('FastAPI');
    expect(result.techStack.testFrameworks).toContain('Pytest');
    expect(result.techStack.databaseEngines).toContain('SQLAlchemy');
    expect(result.techStack.packageManagers).toContain('pip');
    expect(result.techStack.languages.some((l) => l.name === 'Python')).toBe(true);
  });

  it('4. analyzes architecture, identifies module responsibilities and entry points', async () => {
    // Structure: src/services, src/ui, src/types
    fs.mkdirSync(path.join(tempDir, 'src', 'services'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src', 'ui'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src', 'types'), { recursive: true });

    fs.writeFileSync(path.join(tempDir, 'src', 'types', 'index.ts'), 'export interface User { id: string; }');
    fs.writeFileSync(
      path.join(tempDir, 'src', 'services', 'user.service.ts'),
      'import { User } from "../types"; export class UserService {}'
    );
    fs.writeFileSync(
      path.join(tempDir, 'src', 'ui', 'UserProfile.tsx'),
      'import { UserService } from "../services/user.service";'
    );
    fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), 'export * from "./services/user.service";');

    const arch = await architecturalIntelligenceService.analyzeArchitecture(tempDir, false);

    expect(arch.style).toBe('modular-monolith');
    expect(arch.modules.length).toBe(3);

    const uiMod = arch.modules.find((m) => m.name === 'ui');
    const serviceMod = arch.modules.find((m) => m.name === 'services');
    const typesMod = arch.modules.find((m) => m.name === 'types');

    expect(uiMod?.type).toBe('ui');
    expect(serviceMod?.type).toBe('service');
    expect(typesMod?.type).toBe('types');

    // Dependencies
    expect(uiMod?.dependencies).toContain('src/services');
    expect(serviceMod?.dependencies).toContain('src/types');
    expect(arch.circularDependencies.length).toBe(0);
  });

  it('5. detects circular dependency cycles between application modules', async () => {
    fs.mkdirSync(path.join(tempDir, 'src', 'moduleA'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src', 'moduleB'), { recursive: true });

    // Module A imports Module B, and Module B imports Module A
    fs.writeFileSync(
      path.join(tempDir, 'src', 'moduleA', 'a.ts'),
      'import { bFunc } from "../moduleB/b"; export const aFunc = () => bFunc();'
    );
    fs.writeFileSync(
      path.join(tempDir, 'src', 'moduleB', 'b.ts'),
      'import { aFunc } from "../moduleA/a"; export const bFunc = () => {};'
    );

    const arch = await architecturalIntelligenceService.analyzeArchitecture(tempDir, false);

    expect(arch.circularDependencies.length).toBeGreaterThan(0);
    expect(arch.circularDependencies[0].cycle).toContain('src/moduleA');
    expect(arch.circularDependencies[0].cycle).toContain('src/moduleB');
    expect(arch.summary).toContain('circular dependency');
  });

  it('6. evaluates project health and detects potential .env secret exposure and missing lockfile', () => {
    // Missing lockfile, missing README, exposed .env secrets
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'unhealthy-app' }));
    fs.writeFileSync(path.join(tempDir, '.env'), 'DATABASE_URL=postgres://\nOPENAI_API_KEY=sk-proj-testsecret1234567890\n');

    const techStack = {
      languages: [{ name: 'JavaScript', fileCount: 2, percentage: 100 }],
      frameworks: [],
      libraries: [],
      packageManagers: ['npm'],
      buildSystems: [],
      testFrameworks: [],
      databaseEngines: [],
      apiStyles: [],
      styling: [],
      dockerSupport: false,
      ciWorkflows: [],
      rawManifestsFound: ['package.json']
    };

    const architecture = {
      style: 'layered' as const,
      entryPoints: [],
      modules: [],
      circularDependencies: [],
      criticalPaths: [],
      summary: 'Basic app'
    };

    const health = projectHealthService.evaluateHealth(tempDir, techStack, architecture);

    expect(health.overallScore).toBeLessThan(75);
    expect(health.findings.some((f) => f.category === 'security' && f.severity === 'critical')).toBe(true);
    expect(health.findings.some((f) => f.category === 'dependencies' && f.title.includes('Lockfile'))).toBe(true);
    expect(health.findings.some((f) => f.category === 'documentation' && f.title.includes('README'))).toBe(true);
  });

  it('7. assembles tailored context packages for specialist agent roles', () => {
    const mockIntel = {
      projectId: 'proj-role-test',
      projectPath: tempDir,
      techStack: {
        languages: [{ name: 'TypeScript', fileCount: 20, percentage: 80 }],
        frameworks: ['React', 'Electron'],
        libraries: ['Zustand'],
        packageManagers: ['npm'],
        buildSystems: ['electron-vite'],
        testFrameworks: ['Vitest'],
        databaseEngines: ['SQLite'],
        apiStyles: ['IPC'],
        styling: ['Tailwind CSS'],
        dockerSupport: false,
        ciWorkflows: [],
        rawManifestsFound: ['package.json']
      },
      monorepo: { isMonorepo: false, type: 'none' as const, packages: [] },
      architecture: {
        style: 'modular-monolith' as const,
        entryPoints: [
          { path: 'src/main/index.ts', type: 'electron-main', description: 'Main entry' },
          { path: 'src/renderer/App.tsx', type: 'electron-renderer', description: 'UI root' }
        ],
        modules: [
          { id: 'src/main', name: 'main', path: '/src/main', relativePath: 'src/main', type: 'service' as const, responsibility: 'Backend', fileCount: 10, dependencies: [], dependedOnBy: [] },
          { id: 'src/renderer', name: 'renderer', path: '/src/renderer', relativePath: 'src/renderer', type: 'ui' as const, responsibility: 'Frontend', fileCount: 15, dependencies: [], dependedOnBy: [] }
        ],
        circularDependencies: [],
        criticalPaths: [],
        summary: 'Modular Electron application'
      },
      git: {
        branch: 'feature/agent-roles',
        headCommit: 'a1b2c3d',
        commitMessage: 'feat: add roles',
        isDirty: true,
        modifiedFiles: ['src/renderer/App.tsx'],
        stagedFiles: [],
        untrackedFiles: [],
        activeWorktrees: [],
        hotspotFiles: []
      },
      health: {
        overallScore: 95,
        categoryScores: { architecture: 100, dependencies: 90, testing: 95, documentation: 90, security: 100, build: 95 },
        findings: [],
        evaluatedAt: Date.now()
      },
      knowledgeEntries: [
        {
          id: 'k-1',
          projectId: 'proj-role-test',
          category: 'convention' as const,
          key: 'zero_white_borders',
          title: 'Zero White Borders',
          content: 'Strictly avoid white borders in UI cards and buttons.',
          confidence: 1.0,
          source: 'user_decision' as const,
          isConfirmed: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ],
      lastAnalyzedAt: Date.now()
    };

    // Test frontend specialist assembly
    const frontendPkg = roleContextAssemblerService.assembleForRole('frontend', 'Style the dashboard', mockIntel);
    expect(frontendPkg.role).toBe('frontend');
    expect(frontendPkg.relevantModules).toContain('renderer');
    expect(frontendPkg.suggestedSkills).toContain('frontend-design');
    expect(frontendPkg.keyConventions).toContain('Zero White Borders: Strictly avoid white borders in UI cards and buttons.');

    // Test architect specialist assembly
    const architectPkg = roleContextAssemblerService.assembleForRole('architect', 'Refactor module contracts', mockIntel);
    expect(architectPkg.role).toBe('architect');
    expect(architectPkg.suggestedSkills).toContain('architect');
    expect(architectPkg.architecturalNotes).toContain('modular-monolith');

    // Formatted prompt text check
    const prompt = roleContextAssemblerService.formatContextPrompt(frontendPkg);
    expect(prompt).toContain('PROJECT INTELLIGENCE CONTEXT — FRONTEND');
    expect(prompt).toContain('Zero White Borders');
  });

  it('8. handles non-git directory gracefully in git intelligence service', async () => {
    const git = await gitIntelligenceService.getGitIntelligence(tempDir);
    expect(git.branch).toBe('none (not a git repo)');
    expect(git.isDirty).toBe(false);
    expect(git.modifiedFiles.length).toBe(0);
    expect(git.activeWorktrees.length).toBe(0);
  });
});
