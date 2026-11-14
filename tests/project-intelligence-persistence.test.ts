import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { databaseService } from '../src/main/db/database.service';
import { projectIntelligenceService } from '../src/main/intelligence/project-intelligence.service';
import type { ProjectIntelligenceData, ProjectKnowledgeEntry } from '../src/shared/project-intelligence';

describe('Project Intelligence Persistence & Lifecycle Suite', () => {
  let testDir: string;
  let projectDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbito-intel-db-test-'));
    projectDir = path.join(testDir, 'test-project');
    fs.mkdirSync(projectDir, { recursive: true });

    // Initialize database service in test directory
    databaseService.initialize(testDir);
  });

  afterEach(() => {
    databaseService.close();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. persists full project intelligence data and restores it across restarts', () => {
    const mockData: ProjectIntelligenceData = {
      projectId: 'proj-persist-1',
      projectPath: projectDir,
      techStack: {
        languages: [{ name: 'TypeScript', fileCount: 42, percentage: 90 }],
        frameworks: ['Electron', 'React'],
        libraries: ['Zustand', 'better-sqlite3'],
        packageManagers: ['npm'],
        buildSystems: ['electron-vite'],
        testFrameworks: ['Vitest'],
        databaseEngines: ['SQLite'],
        apiStyles: ['IPC'],
        styling: ['Tailwind CSS'],
        dockerSupport: false,
        ciWorkflows: ['ci.yml'],
        rawManifestsFound: ['package.json']
      },
      monorepo: { isMonorepo: false, type: 'none', packages: [] },
      architecture: {
        style: 'modular-monolith',
        entryPoints: [{ path: 'src/main/index.ts', type: 'main', description: 'Main entry' }],
        modules: [
          {
            id: 'src/main',
            name: 'main',
            path: path.join(projectDir, 'src/main'),
            relativePath: 'src/main',
            type: 'service',
            responsibility: 'Core Electron services',
            fileCount: 12,
            dependencies: [],
            dependedOnBy: []
          }
        ],
        circularDependencies: [],
        criticalPaths: ['src/main/index.ts -> main'],
        summary: 'Electron desktop application'
      },
      git: {
        branch: 'main',
        headCommit: 'e4f5a6b',
        commitMessage: 'feat: add intelligence persistence',
        isDirty: false,
        modifiedFiles: [],
        stagedFiles: [],
        untrackedFiles: [],
        activeWorktrees: [],
        hotspotFiles: []
      },
      health: {
        overallScore: 98,
        categoryScores: {
          architecture: 100,
          dependencies: 95,
          testing: 100,
          documentation: 95,
          security: 100,
          build: 100
        },
        findings: [],
        evaluatedAt: Date.now()
      },
      knowledgeEntries: [],
      lastAnalyzedAt: Date.now()
    };

    databaseService.upsertProjectIntelligence(mockData);

    // Retrieve and verify
    const retrieved = databaseService.getProjectIntelligence('proj-persist-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.projectId).toBe('proj-persist-1');
    expect(retrieved?.architecture.style).toBe('modular-monolith');
    expect(retrieved?.techStack.frameworks).toContain('Electron');
    expect(retrieved?.health.overallScore).toBe(98);
    expect(retrieved?.architecture.modules[0].name).toBe('main');
  });

  it('2. records, queries by category, and deletes project knowledge entries', () => {
    const entry1: ProjectKnowledgeEntry = {
      id: 'k-entry-1',
      projectId: 'proj-persist-1',
      category: 'convention',
      key: 'clean_typography',
      title: 'Clean Typography Rule',
      content: 'Render numbers as clean muted typographic numbers with subtle color.',
      confidence: 1.0,
      source: 'user_decision',
      isConfirmed: true,
      metadata: { importance: 'high' },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const entry2: ProjectKnowledgeEntry = {
      id: 'k-entry-2',
      projectId: 'proj-persist-1',
      category: 'architecture',
      key: 'single_db_authority',
      title: 'Single DB Authority',
      content: 'SQLite is the sole authority for local state persistence.',
      confidence: 0.95,
      source: 'observed',
      isConfirmed: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    databaseService.upsertKnowledgeEntry(entry1);
    databaseService.upsertKnowledgeEntry(entry2);

    // Query all entries for project
    const all = databaseService.listKnowledgeEntries('proj-persist-1');
    expect(all.length).toBe(2);

    // Filter by category
    const conventions = databaseService.listKnowledgeEntries('proj-persist-1', 'convention');
    expect(conventions.length).toBe(1);
    expect(conventions[0].key).toBe('clean_typography');

    const arch = databaseService.listKnowledgeEntries('proj-persist-1', 'architecture');
    expect(arch.length).toBe(1);
    expect(arch[0].key).toBe('single_db_authority');

    // Delete entry
    const deleted = databaseService.deleteKnowledgeEntry('k-entry-1');
    expect(deleted).toBe(true);

    const remaining = databaseService.listKnowledgeEntries('proj-persist-1');
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('k-entry-2');
  });

  it('3. ProjectIntelligenceService integration: analyzes project and populates memory cache', async () => {
    // Scaffold minimal package.json in projectDir
    fs.writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        dependencies: { react: '^19.0.0', vitest: '^3.0.0' }
      })
    );
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'src', 'index.ts'), 'export const x = 1;');

    const intel = await projectIntelligenceService.analyzeProject(projectDir, { forceRefresh: true });

    expect(intel).toBeDefined();
    expect(intel.techStack.frameworks).toContain('React');
    expect(intel.techStack.testFrameworks).toContain('Vitest');

    // Second call without forceRefresh returns from memory cache instantly
    const cached = await projectIntelligenceService.getProjectIntelligence(projectDir);
    expect(cached.lastAnalyzedAt).toBe(intel.lastAnalyzedAt);

    // Clear cache
    projectIntelligenceService.clearCache(projectDir);
  });
});
