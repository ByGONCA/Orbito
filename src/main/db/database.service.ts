import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type { ProjectDescriptor, WorkspaceConfig, MemoryRecord, MemoryTier } from '../../shared/types';
import type { CLISessionRecord, CLISessionMessage, CLISessionStatus, CLIProvider } from '../../shared/cli';

export class DatabaseService {
  private appDb: Database.Database | null = null;
  private indexDb: Database.Database | null = null;
  private storageDir: string;

  constructor(customStorageDir?: string) {
    this.storageDir = customStorageDir || path.join(process.cwd(), '.ai-workspace-data');
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  public initialize(): { appDbPath: string; indexDbPath: string } {
    this.ensureStorageDir();
    const appDbPath = path.join(this.storageDir, 'app.sqlite');
    const indexDbPath = path.join(this.storageDir, 'index.sqlite');

    // 1. Initialize app.sqlite
    this.appDb = new Database(appDbPath, { timeout: 5000 });
    this.configurePragmas(this.appDb);
    this.migrateAppSchema(this.appDb);

    // 2. Initialize index.sqlite
    this.indexDb = new Database(indexDbPath, { timeout: 5000 });
    this.configurePragmas(this.indexDb);
    this.migrateIndexSchema(this.indexDb);

    return { appDbPath, indexDbPath };
  }

  private configurePragmas(db: Database.Database): void {
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -32000'); // 32MB cache limit
    db.pragma('temp_store = MEMORY');
  }

  private migrateAppSchema(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        current_project_id TEXT,
        ui_mode TEXT NOT NULL DEFAULT 'simple',
        theme TEXT NOT NULL DEFAULT 'system',
        auto_index INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        last_opened_at INTEGER NOT NULL,
        is_git_repo INTEGER NOT NULL DEFAULT 0,
        active_branch TEXT,
        permission_level TEXT NOT NULL DEFAULT 'standard'
      );

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        tier TEXT NOT NULL CHECK(tier IN ('global', 'workspace', 'project', 'task', 'session')),
        entity_key TEXT NOT NULL,
        content TEXT NOT NULL,
        tokens INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS secrets_store (
        key TEXT PRIMARY KEY,
        encrypted_value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cli_sessions (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_session_id TEXT,
        project_id TEXT,
        status TEXT NOT NULL DEFAULT 'idle',
        prompt TEXT NOT NULL,
        exit_code INTEGER,
        duration_ms INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cli_session_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY(session_id) REFERENCES cli_sessions(id) ON DELETE CASCADE
      );
    `);

    try {
      db.exec(`ALTER TABLE cli_sessions ADD COLUMN provider_session_id TEXT`);
    } catch {
      // Column already exists
    }
  }

  private migrateIndexSchema(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_hashes (
        file_path TEXT PRIMARY KEY,
        content_hash TEXT NOT NULL,
        size INTEGER NOT NULL,
        mtime_ms REAL NOT NULL,
        last_indexed_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS symbols (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        line INTEGER NOT NULL,
        FOREIGN KEY(file_path) REFERENCES file_hashes(file_path) ON DELETE CASCADE
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS fts_chunks USING fts5(
        file_path UNINDEXED,
        chunk_content,
        symbol_name,
        tokenize = 'porter unicode61'
      );
    `);
  }

  // ==========================================
  // App DB CRUD Operations
  // ==========================================

  public getAppDb(): Database.Database {
    if (!this.appDb) throw new Error('Database not initialized. Call initialize() first.');
    return this.appDb;
  }

  public getIndexDb(): Database.Database {
    if (!this.indexDb) throw new Error('Database not initialized. Call initialize() first.');
    return this.indexDb;
  }

  public getSettings(): WorkspaceConfig {
    const db = this.getAppDb();
    const row = db.prepare('SELECT * FROM workspaces LIMIT 1').get() as any;

    if (!row) {
      const defaultSettings: WorkspaceConfig = {
        id: 'default-workspace',
        name: 'Default Workspace',
        uiMode: 'simple',
        theme: 'system',
        autoIndex: true
      };
      db.prepare(`
        INSERT INTO workspaces (id, name, ui_mode, theme, auto_index, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        defaultSettings.id,
        defaultSettings.name,
        defaultSettings.uiMode,
        defaultSettings.theme,
        defaultSettings.autoIndex ? 1 : 0,
        Date.now(),
        Date.now()
      );
      return defaultSettings;
    }

    return {
      id: row.id,
      name: row.name,
      currentProjectId: row.current_project_id || undefined,
      uiMode: row.ui_mode as any,
      theme: row.theme as any,
      autoIndex: Boolean(row.auto_index)
    };
  }

  public updateSettings(updates: Partial<WorkspaceConfig>): WorkspaceConfig {
    const current = this.getSettings();
    const merged: WorkspaceConfig = { ...current, ...updates };

    const db = this.getAppDb();
    db.prepare(`
      UPDATE workspaces
      SET ui_mode = ?, theme = ?, auto_index = ?, current_project_id = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.uiMode,
      merged.theme,
      merged.autoIndex ? 1 : 0,
      merged.currentProjectId || null,
      Date.now(),
      merged.id
    );

    return merged;
  }

  public recordProjectOpen(project: ProjectDescriptor): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO projects (id, name, path, last_opened_at, is_git_repo, active_branch, permission_level)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        last_opened_at = excluded.last_opened_at,
        is_git_repo = excluded.is_git_repo,
        active_branch = excluded.active_branch,
        permission_level = excluded.permission_level
    `).run(
      project.id,
      project.name,
      project.path,
      Date.now(),
      project.isGitRepo ? 1 : 0,
      project.activeBranch || null,
      project.permissionLevel
    );
  }

  public getRecentProjects(): ProjectDescriptor[] {
    const db = this.getAppDb();
    const rows = db.prepare('SELECT * FROM projects ORDER BY last_opened_at DESC LIMIT 10').all() as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      path: r.path,
      lastOpenedAt: r.last_opened_at,
      isGitRepo: Boolean(r.is_git_repo),
      activeBranch: r.active_branch || undefined,
      permissionLevel: r.permission_level
    }));
  }

  public listMemories(tier?: string): MemoryRecord[] {
    const db = this.getAppDb();
    let query = 'SELECT * FROM memories';
    const params: any[] = [];

    if (tier) {
      query += ' WHERE tier = ?';
      params.push(tier);
    }
    query += ' ORDER BY updated_at DESC';

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      tier: r.tier as MemoryTier,
      entityKey: r.entity_key,
      content: r.content,
      tokens: r.tokens,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public saveMemory(memory: { tier: MemoryTier; entityKey: string; content: string }): MemoryRecord {
    const db = this.getAppDb();
    const id = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const tokens = Math.ceil(memory.content.length / 4); // Heuristic token estimate
    const now = Date.now();

    db.prepare(`
      INSERT INTO memories (id, tier, entity_key, content, tokens, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, memory.tier, memory.entityKey, memory.content, tokens, now, now);

    return {
      id,
      tier: memory.tier,
      entityKey: memory.entityKey,
      content: memory.content,
      tokens,
      createdAt: now,
      updatedAt: now
    };
  }

  public deleteMemory(id: string): boolean {
    const db = this.getAppDb();
    const res = db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public saveEncryptedSecret(key: string, encryptedBase64: string): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO secrets_store (key, encrypted_value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        encrypted_value = excluded.encrypted_value,
        updated_at = excluded.updated_at
    `).run(key, encryptedBase64, Date.now());
  }

  public getEncryptedSecret(key: string): string | null {
    const db = this.getAppDb();
    const row = db.prepare('SELECT encrypted_value FROM secrets_store WHERE key = ?').get(key) as any;
    return row ? row.encrypted_value : null;
  }

  // ==========================================
  // CLI Sessions & Messages (Phase 2)
  // ==========================================

  public createCLISession(session: CLISessionRecord): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO cli_sessions (id, provider, provider_session_id, project_id, status, prompt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.provider,
      session.providerSessionId || null,
      session.projectId || null,
      session.status,
      session.prompt,
      session.createdAt,
      session.updatedAt
    );
  }

  public updateCLISession(
    sessionId: string,
    status: CLISessionStatus,
    exitCode?: number,
    durationMs?: number,
    providerSessionId?: string
  ): void {
    const db = this.getAppDb();
    if (providerSessionId) {
      db.prepare(`
        UPDATE cli_sessions
        SET status = ?, exit_code = ?, duration_ms = ?, provider_session_id = ?, updated_at = ?
        WHERE id = ?
      `).run(status, exitCode !== undefined ? exitCode : null, durationMs !== undefined ? durationMs : null, providerSessionId, Date.now(), sessionId);
    } else {
      db.prepare(`
        UPDATE cli_sessions
        SET status = ?, exit_code = ?, duration_ms = ?, updated_at = ?
        WHERE id = ?
      `).run(status, exitCode !== undefined ? exitCode : null, durationMs !== undefined ? durationMs : null, Date.now(), sessionId);
    }
  }

  public addCLISessionMessage(msg: CLISessionMessage): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO cli_session_messages (id, session_id, role, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(msg.id, msg.sessionId, msg.role, msg.content, msg.timestamp);
  }

  public listCLISessions(projectId?: string, provider?: CLIProvider): CLISessionRecord[] {
    const db = this.getAppDb();
    let query = 'SELECT * FROM cli_sessions';
    const conditions: string[] = [];
    const params: any[] = [];

    if (projectId) {
      conditions.push('project_id = ?');
      params.push(projectId);
    }
    if (provider) {
      conditions.push('provider = ?');
      params.push(provider);
    }
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY created_at DESC LIMIT 50';

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      providerSessionId: r.provider_session_id || undefined,
      projectId: r.project_id || undefined,
      status: r.status,
      prompt: r.prompt,
      exitCode: r.exit_code !== null ? r.exit_code : undefined,
      durationMs: r.duration_ms !== null ? r.duration_ms : undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public getCLISession(sessionId: string): CLISessionRecord | null {
    const db = this.getAppDb();
    const r = db.prepare('SELECT * FROM cli_sessions WHERE id = ?').get(sessionId) as any;
    if (!r) return null;
    return {
      id: r.id,
      provider: r.provider,
      providerSessionId: r.provider_session_id || undefined,
      projectId: r.project_id || undefined,
      status: r.status,
      prompt: r.prompt,
      exitCode: r.exit_code !== null ? r.exit_code : undefined,
      durationMs: r.duration_ms !== null ? r.duration_ms : undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  public getCLISessionMessages(sessionId: string): CLISessionMessage[] {
    const db = this.getAppDb();
    const rows = db.prepare('SELECT * FROM cli_session_messages WHERE session_id = ? ORDER BY timestamp ASC').all(sessionId) as any[];
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      role: r.role,
      content: r.content,
      timestamp: r.timestamp
    }));
  }

  // ==========================================
  // Checkpoint & Shutdown
  // ==========================================

  public checkpointAll(): void {
    if (this.appDb) {
      this.appDb.pragma('wal_checkpoint(PASSIVE)');
    }
    if (this.indexDb) {
      this.indexDb.pragma('wal_checkpoint(PASSIVE)');
    }
  }

  public close(): void {
    if (this.appDb) {
      try {
        this.appDb.pragma('wal_checkpoint(TRUNCATE)');
        this.appDb.close();
      } catch (err) {
        console.error('Error closing appDb:', err);
      }
      this.appDb = null;
    }

    if (this.indexDb) {
      try {
        this.indexDb.pragma('wal_checkpoint(TRUNCATE)');
        this.indexDb.close();
      } catch (err) {
        console.error('Error closing indexDb:', err);
      }
      this.indexDb = null;
    }
  }
}

export const databaseService = new DatabaseService();
