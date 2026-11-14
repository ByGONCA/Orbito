import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { databaseService } from '../src/main/db/database.service';

// Mock electron dependencies
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (plain: string) => Buffer.from(`encrypted:${plain}`),
    decryptString: (buf: Buffer) => {
      const str = buf.toString();
      return str.startsWith('encrypted:') ? str.replace('encrypted:', '') : str;
    }
  },
  BrowserWindow: {
    getAllWindows: () => []
  }
}));

describe('Orbito Database Migration & Upgrade Lifecycle Suite', () => {
  const testDir = path.join(process.cwd(), '.ai-workspace-data-test-migration');
  const appDbPath = path.join(testDir, 'app.sqlite');
  const indexDbPath = path.join(testDir, 'index.sqlite');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      try {
        databaseService.close();
      } catch {}
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    try {
      databaseService.close();
    } catch {}
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------
  // 1. Fresh Database Initialization & Pragma Verification
  // -------------------------------------------------------------
  it('1. performs fresh database initialization with WAL pragmas and migration tracking', () => {
    const { appDbPath: returnedAppPath, indexDbPath: returnedIndexPath } = databaseService.initialize(testDir);

    expect(fs.existsSync(returnedAppPath)).toBe(true);
    expect(fs.existsSync(returnedIndexPath)).toBe(true);

    const db = databaseService.getAppDb();

    // Verify WAL journal mode and busy timeout
    const journalMode = db.prepare('PRAGMA journal_mode').get() as any;
    expect(journalMode.journal_mode.toLowerCase()).toBe('wal');

    const busyTimeout = db.prepare('PRAGMA busy_timeout').get() as any;
    expect(busyTimeout.timeout).toBe(5000);

    // Verify schema_migrations ledger exists and is populated
    const migrations = databaseService.getAppliedMigrations();
    expect(migrations.length).toBeGreaterThanOrEqual(8);
    expect(migrations.map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(migrations.find((m) => m.version === 1)?.name).toBe('001_core_baseline');
    expect(migrations.find((m) => m.version === 6)?.name).toBe('006_pre_production_hardening');
    expect(migrations.find((m) => m.version === 7)?.name).toBe('007_project_intelligence_engine');
    expect(migrations.find((m) => m.version === 8)?.name).toBe('008_autonomous_engineering_intelligence');
  });

  // -------------------------------------------------------------
  // 2. Migration Idempotency & Re-Initialization Safety
  // -------------------------------------------------------------
  it('2. guarantees migration idempotency on repeated initializations without data alteration', () => {
    databaseService.initialize(testDir);

    // Insert test project and settings
    const testProject = {
      id: 'proj-idempotency',
      name: 'Idempotency Project',
      path: path.join(testDir, 'proj-idempotency'),
      lastOpenedAt: Date.now(),
      isGitRepo: true,
      activeBranch: 'master',
      permissionLevel: 'standard' as const,
      isFavorite: true,
      customColor: '#4f46e5'
    };
    databaseService.recordProjectOpen(testProject);
    databaseService.updateProject('proj-idempotency', { customColor: '#4f46e5' });

    // Call initialize() second and third time
    databaseService.initialize(testDir);
    databaseService.initialize(testDir);

    // Verify project remained completely intact
    const fetched = databaseService.getProject('proj-idempotency');
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe('Idempotency Project');
    expect(fetched?.customColor).toBe('#4f46e5');
    expect(fetched?.isFavorite).toBe(true);

    // Verify migration count did not duplicate
    const migrations = databaseService.getAppliedMigrations();
    expect(migrations.length).toBe(8);
  });

  // -------------------------------------------------------------
  // 3. Legacy Schema Upgrade (v0.0.1 to v0.1.0) with Data Preservation
  // -------------------------------------------------------------
  it('3. upgrades legacy database schema without data loss, applying new columns and tables', () => {
    fs.mkdirSync(testDir, { recursive: true });

    // Seed raw legacy SQLite database (simulating early pre-MCP v0.0.1)
    const rawDb = new Database(appDbPath);
    rawDb.exec(`
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        current_project_id TEXT,
        ui_mode TEXT NOT NULL DEFAULT 'simple',
        theme TEXT NOT NULL DEFAULT 'glass',
        auto_index INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        last_opened_at INTEGER NOT NULL,
        is_git_repo INTEGER NOT NULL DEFAULT 0,
        active_branch TEXT,
        permission_level TEXT NOT NULL DEFAULT 'standard'
      );

      CREATE TABLE memories (
        id TEXT PRIMARY KEY,
        tier TEXT NOT NULL,
        entity_key TEXT NOT NULL,
        content TEXT NOT NULL,
        tokens INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE secrets_store (
        key TEXT PRIMARY KEY,
        encrypted_value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Insert legacy records that must survive upgrade
      INSERT INTO workspaces (id, name, current_project_id, created_at, updated_at)
      VALUES ('legacy-workspace', 'Legacy Workspace', 'legacy-proj-1', 1700000000000, 1700000000000);

      INSERT INTO projects (id, name, path, last_opened_at, is_git_repo, active_branch)
      VALUES ('legacy-proj-1', 'Legacy User Project', '/user/legacy/repo', 1700000000000, 1, 'main');

      INSERT INTO memories (id, tier, entity_key, content, tokens, created_at, updated_at)
      VALUES ('mem-1', 'global', 'rule-1', 'Do not delete user data', 10, 1700000000000, 1700000000000);

      INSERT INTO secrets_store (key, encrypted_value, updated_at)
      VALUES ('OPENAI_API_KEY', 'unencrypted:c2stMTIzNDU2Nzg5', 1700000000000);
    `);
    rawDb.close();

    // Now run Orbito v0.1.0 database service initialization against the legacy DB
    databaseService.initialize(testDir);

    const db = databaseService.getAppDb();

    // 1. Verify legacy data was preserved
    const workspace = databaseService.getSettings();
    expect(workspace.id).toBe('legacy-workspace');
    expect(workspace.currentProjectId).toBe('legacy-proj-1');

    const project = databaseService.getProject('legacy-proj-1');
    expect(project).toBeDefined();
    expect(project?.name).toBe('Legacy User Project');

    const memory = databaseService.listMemories('global');
    expect(memory.length).toBe(1);
    expect(memory[0].content).toBe('Do not delete user data');

    const secret = databaseService.getEncryptedSecret('OPENAI_API_KEY');
    expect(secret).toBe('unencrypted:c2stMTIzNDU2Nzg5');

    // 2. Verify all upgraded columns and tables now exist
    const mcpServers = databaseService.listMCPServers();
    expect(Array.isArray(mcpServers)).toBe(true);

    const traces = databaseService.listTaskTraces();
    expect(Array.isArray(traces)).toBe(true);

    // 3. Verify new columns in projects table
    const projCols = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
    const colNames = projCols.map((c) => c.name);
    expect(colNames).toContain('custom_name');
    expect(colNames).toContain('custom_color');
    expect(colNames).toContain('custom_icon');
    expect(colNames).toContain('is_favorite');

    // 4. Verify schema_migrations ledger was recorded
    const migrations = databaseService.getAppliedMigrations();
    expect(migrations.length).toBe(8);
  });

  // -------------------------------------------------------------
  // 4. Interrupted Migration Recovery & Clean State
  // -------------------------------------------------------------
  it('4. recovers safely from interrupted migrations or uncommitted operations', () => {
    databaseService.initialize(testDir);

    // Simulate an interrupted operation with an uncommitted transaction
    const db = databaseService.getAppDb();
    db.prepare(`
      INSERT INTO orchestrations (id, project_id, project_path, user_goal, mode, status, created_at, started_at)
      VALUES ('orch-crash', 'proj-1', '${testDir.replace(/\\/g, '/')}', 'Interrupted task', 'autonomous', 'running', ${Date.now()}, ${Date.now()})
    `).run();

    // Simulate startup recovery
    const recovery = databaseService.recoverOrchestrationsOnStartup();
    expect(recovery.recoveredOrchestrations).toBe(1);

    const orch = databaseService.getOrchestration('orch-crash');
    expect(orch?.status).toBe('failed');
    expect(orch?.errorMessage).toContain('Interrupted by application shutdown/restart');
  });

  // -------------------------------------------------------------
  // 5. Windows File-Locking Resilience & Reopening
  // -------------------------------------------------------------
  it('5. handles sequential closing and reopening of SQLite handles without Windows file locks', () => {
    databaseService.initialize(testDir);
    expect(databaseService.isInitialized()).toBe(true);

    // Explicitly close
    databaseService.close();

    // Reopen immediately
    databaseService.initialize(testDir);
    expect(databaseService.isInitialized()).toBe(true);

    // Verify operations succeed immediately after reopen
    const settings = databaseService.getSettings();
    expect(settings).toBeDefined();
    expect(typeof settings.theme).toBe('string');
  });
});
