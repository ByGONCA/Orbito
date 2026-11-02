import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type { ProjectDescriptor, WorkspaceConfig, MemoryRecord, MemoryTier } from '../../shared/types';
import type { CLISessionRecord, CLISessionMessage, CLISessionStatus, CLIProvider } from '../../shared/cli';
import type { FileSymbol, CodeChunk, SearchResult, IndexStats } from '../../shared/context';
import type { SkillMetadata, SkillExecutionRecord, SkillManifest } from '../../shared/skills';
import type { OrchestrationRecord, OrchestrationTask, ApprovalRequest } from '../../shared/agents';

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

      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        version TEXT NOT NULL,
        author TEXT NOT NULL,
        category TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        supported_providers TEXT NOT NULL DEFAULT '[]',
        is_builtin INTEGER NOT NULL DEFAULT 1,
        enabled INTEGER NOT NULL DEFAULT 1,
        manifest_json TEXT NOT NULL,
        instructions_path TEXT NOT NULL,
        checksum TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS skill_executions (
        id TEXT PRIMARY KEY,
        skill_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT,
        status TEXT NOT NULL,
        input_summary TEXT NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        tokens_used INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        error_message TEXT,
        FOREIGN KEY(skill_id) REFERENCES skills(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_skill_exec_skill ON skill_executions(skill_id);
      CREATE INDEX IF NOT EXISTS idx_skill_exec_proj ON skill_executions(project_id);

      CREATE TABLE IF NOT EXISTS orchestrations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        project_path TEXT NOT NULL,
        user_goal TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'supervised',
        status TEXT NOT NULL DEFAULT 'planning',
        tasks_json TEXT NOT NULL DEFAULT '[]',
        summary TEXT,
        error_message TEXT,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_orch_proj ON orchestrations(project_id);

      CREATE TABLE IF NOT EXISTS orchestration_tasks (
        id TEXT PRIMARY KEY,
        orchestration_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        role TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        dependencies_json TEXT NOT NULL DEFAULT '[]',
        acceptance_criteria_json TEXT NOT NULL DEFAULT '[]',
        required_skills_json TEXT NOT NULL DEFAULT '[]',
        permissions_json TEXT NOT NULL,
        is_modifying INTEGER NOT NULL DEFAULT 0,
        worktree_path TEXT,
        branch_name TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 1,
        timeout_seconds INTEGER NOT NULL DEFAULT 180,
        changed_files_json TEXT NOT NULL DEFAULT '[]',
        diff TEXT,
        result_summary TEXT,
        review_feedback TEXT,
        review_status TEXT,
        error_message TEXT,
        created_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,
        FOREIGN KEY(orchestration_id) REFERENCES orchestrations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_orch_tasks_orch ON orchestration_tasks(orchestration_id);

      CREATE TABLE IF NOT EXISTS approval_requests (
        id TEXT PRIMARY KEY,
        orchestration_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        diff TEXT,
        changed_files_json TEXT DEFAULT '[]',
        command TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        rejection_reason TEXT,
        created_at INTEGER NOT NULL,
        resolved_at INTEGER,
        FOREIGN KEY(orchestration_id) REFERENCES orchestrations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_approval_orch ON approval_requests(orchestration_id);
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
        language TEXT NOT NULL DEFAULT 'plaintext',
        last_indexed_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS symbols (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        line INTEGER NOT NULL,
        end_line INTEGER,
        container_name TEXT,
        signature TEXT,
        FOREIGN KEY(file_path) REFERENCES file_hashes(file_path) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
      CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_path);

      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        symbol_name TEXT,
        content TEXT NOT NULL,
        token_count INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(file_path) REFERENCES file_hashes(file_path) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_path);
    `);

    // Safe column migrations if existing tables were initialized in Phase 1
    try {
      db.exec(`ALTER TABLE file_hashes ADD COLUMN language TEXT NOT NULL DEFAULT 'plaintext'`);
    } catch {}
    try {
      db.exec(`ALTER TABLE symbols ADD COLUMN end_line INTEGER`);
    } catch {}
    try {
      db.exec(`ALTER TABLE symbols ADD COLUMN container_name TEXT`);
    } catch {}
    try {
      db.exec(`ALTER TABLE symbols ADD COLUMN signature TEXT`);
    } catch {}

    // Check if fts_chunks needs chunk_id column
    try {
      const cols = db.prepare(`PRAGMA table_info(fts_chunks)`).all() as any[];
      const hasChunkId = cols.some((c: any) => c.name === 'chunk_id');
      if (!hasChunkId && cols.length > 0) {
        db.exec(`DROP TABLE IF EXISTS fts_chunks`);
      }
    } catch {}

    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_chunks USING fts5(
        chunk_id UNINDEXED,
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
  // Index DB Operations (Phase 3)
  // ==========================================

  public getAllFileHashes(): Map<string, { contentHash: string; size: number; mtimeMs: number; language: string }> {
    const db = this.getIndexDb();
    const rows = db.prepare('SELECT file_path, content_hash, size, mtime_ms, language FROM file_hashes').all() as any[];
    const map = new Map<string, { contentHash: string; size: number; mtimeMs: number; language: string }>();
    for (const r of rows) {
      map.set(r.file_path, {
        contentHash: r.content_hash,
        size: r.size,
        mtimeMs: r.mtime_ms,
        language: r.language
      });
    }
    return map;
  }

  public getFileHash(filePath: string): { contentHash: string; size: number; mtimeMs: number; language: string } | null {
    const db = this.getIndexDb();
    const r = db.prepare('SELECT file_path, content_hash, size, mtime_ms, language FROM file_hashes WHERE file_path = ?').get(filePath) as any;
    if (!r) return null;
    return {
      contentHash: r.content_hash,
      size: r.size,
      mtimeMs: r.mtime_ms,
      language: r.language
    };
  }

  public upsertFileIndex(
    filePath: string,
    contentHash: string,
    size: number,
    mtimeMs: number,
    language: string,
    symbols: FileSymbol[],
    chunks: CodeChunk[]
  ): void {
    const db = this.getIndexDb();

    const insertTx = db.transaction(() => {
      // 1. Remove previous entries for file
      db.prepare('DELETE FROM fts_chunks WHERE file_path = ?').run(filePath);
      db.prepare('DELETE FROM chunks WHERE file_path = ?').run(filePath);
      db.prepare('DELETE FROM symbols WHERE file_path = ?').run(filePath);

      // 2. Insert or replace file hash
      db.prepare(`
        INSERT OR REPLACE INTO file_hashes (file_path, content_hash, size, mtime_ms, language, last_indexed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(filePath, contentHash, size, mtimeMs, language, Date.now());

      // 3. Insert symbols
      const insertSym = db.prepare(`
        INSERT INTO symbols (id, file_path, name, kind, line, end_line, container_name, signature)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of symbols) {
        insertSym.run(s.id, filePath, s.name, s.kind, s.line, s.endLine || null, s.containerName || null, s.signature || null);
      }

      // 4. Insert chunks & fts
      const insertChk = db.prepare(`
        INSERT INTO chunks (id, file_path, start_line, end_line, symbol_name, content, token_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const insertFts = db.prepare(`
        INSERT INTO fts_chunks (chunk_id, file_path, chunk_content, symbol_name)
        VALUES (?, ?, ?, ?)
      `);

      for (const c of chunks) {
        insertChk.run(c.id, filePath, c.startLine, c.endLine, c.symbolName || null, c.content, Math.ceil(c.content.length / 4));
        insertFts.run(c.id, filePath, c.content, c.symbolName || null);
      }
    });

    insertTx();
  }

  public deleteFileIndex(filePath: string): void {
    const db = this.getIndexDb();
    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM fts_chunks WHERE file_path = ?').run(filePath);
      db.prepare('DELETE FROM chunks WHERE file_path = ?').run(filePath);
      db.prepare('DELETE FROM symbols WHERE file_path = ?').run(filePath);
      db.prepare('DELETE FROM file_hashes WHERE file_path = ?').run(filePath);
    });
    deleteTx();
  }

  public searchFTS(query: string, limit = 20): SearchResult[] {
    const db = this.getIndexDb();
    const sanitized = query.replace(/[^\w\s]/g, ' ').trim();
    if (!sanitized) return [];

    try {
      const rows = db.prepare(`
        SELECT f.chunk_id, f.file_path, f.chunk_content, f.symbol_name, c.start_line, c.end_line, bm25(fts_chunks) AS rank
        FROM fts_chunks f
        LEFT JOIN chunks c ON c.id = f.chunk_id
        WHERE fts_chunks MATCH ?
        ORDER BY rank ASC
        LIMIT ?
      `).all(sanitized, limit) as any[];

      return rows.map((r) => ({
        chunkId: r.chunk_id || `chk-${r.file_path}`,
        filePath: r.file_path,
        content: r.chunk_content,
        symbolName: r.symbol_name || undefined,
        startLine: r.start_line || 1,
        endLine: r.end_line || 50,
        score: Math.max(0, 10 - (r.rank || 0)),
        matchType: 'fts'
      }));
    } catch {
      return [];
    }
  }

  public searchSymbols(query: string, limit = 20): SearchResult[] {
    const db = this.getIndexDb();
    const rows = db.prepare(`
      SELECT s.id, s.file_path, s.name, s.kind, s.line, s.end_line, s.signature, c.content, c.id AS chunk_id
      FROM symbols s
      LEFT JOIN chunks c ON c.file_path = s.file_path AND s.line >= c.start_line AND s.line <= c.end_line
      WHERE s.name LIKE ?
      LIMIT ?
    `).all(`%${query}%`, limit) as any[];

    return rows.map((r) => ({
      chunkId: r.chunk_id || `sym-chk-${r.id}`,
      filePath: r.file_path,
      content: r.content || r.signature || r.name,
      symbolName: r.name,
      startLine: r.line,
      endLine: r.end_line || r.line + 10,
      score: r.name.toLowerCase() === query.toLowerCase() ? 10 : 7,
      matchType: 'symbol'
    }));
  }

  public searchFilePaths(query: string, limit = 20): SearchResult[] {
    const db = this.getIndexDb();
    const rows = db.prepare(`
      SELECT file_path, language
      FROM file_hashes
      WHERE file_path LIKE ?
      LIMIT ?
    `).all(`%${query}%`, limit) as any[];

    return rows.map((r) => ({
      chunkId: `path-${r.file_path}`,
      filePath: r.file_path,
      content: `File: ${r.file_path} (${r.language})`,
      startLine: 1,
      endLine: 1,
      score: 5,
      matchType: 'filename'
    }));
  }

  public getIndexStats(): IndexStats {
    const db = this.getIndexDb();
    const totalFiles = (db.prepare('SELECT COUNT(*) as count FROM file_hashes').get() as any)?.count || 0;
    const totalSymbols = (db.prepare('SELECT COUNT(*) as count FROM symbols').get() as any)?.count || 0;
    const totalChunks = (db.prepare('SELECT COUNT(*) as count FROM chunks').get() as any)?.count || 0;
    
    const lastIndexedRow = db.prepare('SELECT MAX(last_indexed_at) as last FROM file_hashes').get() as any;
    const lastIndexedAt = lastIndexedRow?.last || 0;

    const langRows = db.prepare('SELECT language, COUNT(*) as count FROM file_hashes GROUP BY language').all() as any[];
    const indexedLanguages: Record<string, number> = {};
    for (const lr of langRows) {
      indexedLanguages[lr.language] = lr.count;
    }

    return {
      totalFiles,
      totalSymbols,
      totalChunks,
      indexedLanguages,
      lastIndexedAt,
      isIndexing: false,
      isWatching: false
    };
  }

  public getChunksForFile(filePath: string): CodeChunk[] {
    const db = this.getIndexDb();
    const rows = db.prepare('SELECT * FROM chunks WHERE file_path = ? ORDER BY start_line ASC').all(filePath) as any[];
    return rows.map((r) => ({
      id: r.id,
      filePath: r.file_path,
      startLine: r.start_line,
      endLine: r.end_line,
      content: r.content,
      symbolName: r.symbol_name || undefined,
      language: 'plaintext'
    }));
  }

  public getSymbolsForFile(filePath: string): FileSymbol[] {
    const db = this.getIndexDb();
    const rows = db.prepare('SELECT * FROM symbols WHERE file_path = ? ORDER BY line ASC').all(filePath) as any[];
    return rows.map((r) => ({
      id: r.id,
      filePath: r.file_path,
      name: r.name,
      kind: r.kind,
      line: r.line,
      endLine: r.end_line,
      containerName: r.container_name || undefined,
      signature: r.signature || undefined
    }));
  }

  // ==========================================
  // Skills Engine Persistence
  // ==========================================

  public upsertSkill(skill: {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    category: string;
    tags: string[];
    supportedProviders: string[];
    isBuiltIn: boolean;
    enabled: boolean;
    manifestJson: string;
    instructionsPath: string;
    checksum: string;
  }): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO skills (
        id, name, description, version, author, category, tags,
        supported_providers, is_builtin, enabled, manifest_json,
        instructions_path, checksum, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        version = excluded.version,
        author = excluded.author,
        category = excluded.category,
        tags = excluded.tags,
        supported_providers = excluded.supported_providers,
        manifest_json = excluded.manifest_json,
        instructions_path = excluded.instructions_path,
        checksum = excluded.checksum,
        updated_at = excluded.updated_at
    `).run(
      skill.id,
      skill.name,
      skill.description,
      skill.version,
      skill.author,
      skill.category,
      JSON.stringify(skill.tags),
      JSON.stringify(skill.supportedProviders),
      skill.isBuiltIn ? 1 : 0,
      skill.enabled ? 1 : 0,
      skill.manifestJson,
      skill.instructionsPath,
      skill.checksum,
      Date.now()
    );
  }

  public listSkills(): SkillMetadata[] {
    const db = this.getAppDb();
    const rows = db.prepare(`SELECT * FROM skills ORDER BY is_builtin DESC, name ASC`).all() as any[];
    return rows.map((r) => {
      const manifest: SkillManifest = JSON.parse(r.manifest_json);
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        version: r.version,
        author: r.author,
        category: r.category,
        tags: JSON.parse(r.tags),
        supportedProviders: JSON.parse(r.supported_providers),
        isBuiltIn: r.is_builtin === 1,
        enabled: r.enabled === 1,
        checksum: r.checksum,
        manifestPath: '',
        instructionsPath: r.instructions_path,
        permissions: manifest.requiredPermissions,
        contextRequirements: manifest.contextRequirements
      };
    });
  }

  public getSkill(id: string): (SkillMetadata & { manifestJson: string }) | null {
    const db = this.getAppDb();
    const r = db.prepare(`SELECT * FROM skills WHERE id = ?`).get(id) as any;
    if (!r) return null;
    const manifest: SkillManifest = JSON.parse(r.manifest_json);
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      version: r.version,
      author: r.author,
      category: r.category,
      tags: JSON.parse(r.tags),
      supportedProviders: JSON.parse(r.supported_providers),
      isBuiltIn: r.is_builtin === 1,
      enabled: r.enabled === 1,
      checksum: r.checksum,
      manifestPath: '',
      instructionsPath: r.instructions_path,
      permissions: manifest.requiredPermissions,
      contextRequirements: manifest.contextRequirements,
      manifestJson: r.manifest_json
    };
  }

  public toggleSkill(id: string, enabled: boolean): void {
    const db = this.getAppDb();
    db.prepare(`UPDATE skills SET enabled = ?, updated_at = ? WHERE id = ?`).run(
      enabled ? 1 : 0,
      Date.now(),
      id
    );
  }

  public deleteSkill(id: string): void {
    const db = this.getAppDb();
    db.prepare(`DELETE FROM skills WHERE id = ? AND is_builtin = 0`).run(id);
  }

  public recordSkillExecution(record: SkillExecutionRecord): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO skill_executions (
        id, skill_id, project_id, provider, model, status,
        input_summary, duration_ms, tokens_used, created_at, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        duration_ms = excluded.duration_ms,
        tokens_used = excluded.tokens_used,
        error_message = excluded.error_message
    `).run(
      record.id,
      record.skillId,
      record.projectId,
      record.provider,
      record.model || null,
      record.status,
      record.inputSummary,
      record.durationMs,
      record.tokensUsed,
      record.createdAt,
      record.errorMessage || null
    );
  }

  public listSkillExecutions(projectId?: string, limit = 50): SkillExecutionRecord[] {
    const db = this.getAppDb();
    let query = `SELECT * FROM skill_executions`;
    const params: any[] = [];
    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }
    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      skillId: r.skill_id,
      projectId: r.project_id,
      provider: r.provider,
      model: r.model || undefined,
      status: r.status,
      inputSummary: r.input_summary,
      durationMs: r.duration_ms,
      tokensUsed: r.tokens_used,
      createdAt: r.created_at,
      errorMessage: r.error_message || undefined
    }));
  }

  // ==========================================
  // Multi-Agent Orchestration Persistence (Phase 5)
  // ==========================================

  public upsertOrchestration(orch: OrchestrationRecord): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO orchestrations (
        id, project_id, project_path, user_goal, mode, status,
        tasks_json, summary, error_message, total_tokens, duration_ms,
        created_at, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        tasks_json = excluded.tasks_json,
        summary = excluded.summary,
        error_message = excluded.error_message,
        total_tokens = excluded.total_tokens,
        duration_ms = excluded.duration_ms,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at
    `).run(
      orch.id,
      orch.projectId,
      orch.projectPath,
      orch.userGoal,
      orch.mode,
      orch.status,
      JSON.stringify(orch.tasks.map((t) => t.id)),
      orch.summary || null,
      orch.errorMessage || null,
      orch.totalTokensUsed,
      orch.durationMs,
      orch.createdAt,
      orch.startedAt || null,
      orch.completedAt || null
    );

    // Also upsert tasks
    for (const task of orch.tasks) {
      this.upsertOrchestrationTask(task);
    }
  }

  public getOrchestration(id: string): OrchestrationRecord | null {
    const db = this.getAppDb();
    const row = db.prepare(`SELECT * FROM orchestrations WHERE id = ?`).get(id) as any;
    if (!row) return null;

    const tasks = this.getOrchestrationTasks(id);

    return {
      id: row.id,
      projectId: row.project_id,
      projectPath: row.project_path,
      userGoal: row.user_goal,
      mode: row.mode,
      status: row.status,
      tasks,
      createdAt: row.created_at,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined,
      durationMs: row.duration_ms,
      totalTokensUsed: row.total_tokens,
      summary: row.summary || undefined,
      errorMessage: row.error_message || undefined
    };
  }

  public listOrchestrations(projectId?: string, limit = 20): OrchestrationRecord[] {
    const db = this.getAppDb();
    let query = `SELECT * FROM orchestrations`;
    const params: any[] = [];
    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }
    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((r) => {
      const tasks = this.getOrchestrationTasks(r.id);
      return {
        id: r.id,
        projectId: r.project_id,
        projectPath: r.project_path,
        userGoal: r.user_goal,
        mode: r.mode,
        status: r.status,
        tasks,
        createdAt: r.created_at,
        startedAt: r.started_at || undefined,
        completedAt: r.completed_at || undefined,
        durationMs: r.duration_ms,
        totalTokensUsed: r.total_tokens,
        summary: r.summary || undefined,
        errorMessage: r.error_message || undefined
      };
    });
  }

  public updateOrchestration(
    id: string,
    updates: {
      status?: string;
      summary?: string;
      errorMessage?: string;
      startedAt?: number;
      completedAt?: number;
      durationMs?: number;
      totalTokensUsed?: number;
    }
  ): void {
    const db = this.getAppDb();
    const sets: string[] = [];
    const params: any[] = [];

    if (updates.status !== undefined) {
      sets.push('status = ?');
      params.push(updates.status);
    }
    if (updates.summary !== undefined) {
      sets.push('summary = ?');
      params.push(updates.summary);
    }
    if (updates.errorMessage !== undefined) {
      sets.push('error_message = ?');
      params.push(updates.errorMessage);
    }
    if (updates.startedAt !== undefined) {
      sets.push('started_at = ?');
      params.push(updates.startedAt);
    }
    if (updates.completedAt !== undefined) {
      sets.push('completed_at = ?');
      params.push(updates.completedAt);
    }
    if (updates.durationMs !== undefined) {
      sets.push('duration_ms = ?');
      params.push(updates.durationMs);
    }
    if (updates.totalTokensUsed !== undefined) {
      sets.push('total_tokens = ?');
      params.push(updates.totalTokensUsed);
    }

    if (sets.length === 0) return;
    params.push(id);
    db.prepare(`UPDATE orchestrations SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  public upsertOrchestrationTask(task: OrchestrationTask): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO orchestration_tasks (
        id, orchestration_id, title, description, role, provider, model,
        status, dependencies_json, acceptance_criteria_json, required_skills_json, permissions_json,
        is_modifying, worktree_path, branch_name, retry_count, max_retries,
        timeout_seconds, changed_files_json, diff, result_summary,
        review_feedback, review_status, error_message, created_at, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        retry_count = excluded.retry_count,
        worktree_path = excluded.worktree_path,
        branch_name = excluded.branch_name,
        changed_files_json = excluded.changed_files_json,
        diff = excluded.diff,
        result_summary = excluded.result_summary,
        review_feedback = excluded.review_feedback,
        review_status = excluded.review_status,
        error_message = excluded.error_message,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at
    `).run(
      task.id,
      task.orchestrationId,
      task.title,
      task.description,
      task.role,
      task.assignedProvider,
      task.assignedModel || null,
      task.status,
      JSON.stringify(task.dependencies),
      JSON.stringify(task.acceptanceCriteria || []),
      JSON.stringify(task.requiredSkills),
      JSON.stringify(task.requiredPermissions),
      task.isModifying ? 1 : 0,
      task.worktreePath || null,
      task.branchName || null,
      task.retryCount,
      task.maxRetries,
      task.timeoutSeconds,
      JSON.stringify(task.changedFiles),
      task.diff || null,
      task.resultSummary || null,
      task.reviewFeedback || null,
      task.reviewStatus || null,
      task.errorMessage || null,
      task.createdAt,
      task.startedAt || null,
      task.completedAt || null
    );
  }

  public getOrchestrationTasks(orchestrationId: string): OrchestrationTask[] {
    const db = this.getAppDb();
    const rows = db.prepare(`SELECT * FROM orchestration_tasks WHERE orchestration_id = ? ORDER BY created_at ASC`).all(orchestrationId) as any[];
    return rows.map((r) => ({
      id: r.id,
      orchestrationId: r.orchestration_id,
      title: r.title,
      description: r.description,
      acceptanceCriteria: JSON.parse(r.acceptance_criteria_json || '[]'),
      role: r.role,
      assignedProvider: r.provider,
      assignedModel: r.model || undefined,
      status: r.status,
      dependencies: JSON.parse(r.dependencies_json || '[]'),
      requiredSkills: JSON.parse(r.required_skills_json || '[]'),
      requiredPermissions: JSON.parse(r.permissions_json || '{}'),
      isModifying: r.is_modifying === 1,
      worktreePath: r.worktree_path || undefined,
      branchName: r.branch_name || undefined,
      retryCount: r.retry_count,
      maxRetries: r.max_retries,
      timeoutSeconds: r.timeout_seconds,
      changedFiles: JSON.parse(r.changed_files_json || '[]'),
      diff: r.diff || undefined,
      resultSummary: r.result_summary || undefined,
      reviewFeedback: r.review_feedback || undefined,
      reviewStatus: r.review_status || undefined,
      errorMessage: r.error_message || undefined,
      createdAt: r.created_at,
      startedAt: r.started_at || undefined,
      completedAt: r.completed_at || undefined
    }));
  }

  public getOrchestrationTask(taskId: string): OrchestrationTask | null {
    const db = this.getAppDb();
    const r = db.prepare(`SELECT * FROM orchestration_tasks WHERE id = ?`).get(taskId) as any;
    if (!r) return null;
    return {
      id: r.id,
      orchestrationId: r.orchestration_id,
      title: r.title,
      description: r.description,
      acceptanceCriteria: JSON.parse(r.acceptance_criteria_json || '[]'),
      role: r.role,
      assignedProvider: r.provider,
      assignedModel: r.model || undefined,
      status: r.status,
      dependencies: JSON.parse(r.dependencies_json || '[]'),
      requiredSkills: JSON.parse(r.required_skills_json || '[]'),
      requiredPermissions: JSON.parse(r.permissions_json || '{}'),
      isModifying: r.is_modifying === 1,
      worktreePath: r.worktree_path || undefined,
      branchName: r.branch_name || undefined,
      retryCount: r.retry_count,
      maxRetries: r.max_retries,
      timeoutSeconds: r.timeout_seconds,
      changedFiles: JSON.parse(r.changed_files_json || '[]'),
      diff: r.diff || undefined,
      resultSummary: r.result_summary || undefined,
      reviewFeedback: r.review_feedback || undefined,
      reviewStatus: r.review_status || undefined,
      errorMessage: r.error_message || undefined,
      createdAt: r.created_at,
      startedAt: r.started_at || undefined,
      completedAt: r.completed_at || undefined
    };
  }

  public updateOrchestrationTask(
    taskId: string,
    updates: Partial<OrchestrationTask>
  ): void {
    const db = this.getAppDb();
    const sets: string[] = [];
    const params: any[] = [];

    if (updates.status !== undefined) {
      sets.push('status = ?');
      params.push(updates.status);
    }
    if (updates.retryCount !== undefined) {
      sets.push('retry_count = ?');
      params.push(updates.retryCount);
    }
    if (updates.worktreePath !== undefined) {
      sets.push('worktree_path = ?');
      params.push(updates.worktreePath);
    }
    if (updates.branchName !== undefined) {
      sets.push('branch_name = ?');
      params.push(updates.branchName);
    }
    if (updates.changedFiles !== undefined) {
      sets.push('changed_files_json = ?');
      params.push(JSON.stringify(updates.changedFiles));
    }
    if (updates.diff !== undefined) {
      sets.push('diff = ?');
      params.push(updates.diff);
    }
    if (updates.resultSummary !== undefined) {
      sets.push('result_summary = ?');
      params.push(updates.resultSummary);
    }
    if (updates.reviewFeedback !== undefined) {
      sets.push('review_feedback = ?');
      params.push(updates.reviewFeedback);
    }
    if (updates.reviewStatus !== undefined) {
      sets.push('review_status = ?');
      params.push(updates.reviewStatus);
    }
    if (updates.errorMessage !== undefined) {
      sets.push('error_message = ?');
      params.push(updates.errorMessage);
    }
    if (updates.startedAt !== undefined) {
      sets.push('started_at = ?');
      params.push(updates.startedAt);
    }
    if (updates.completedAt !== undefined) {
      sets.push('completed_at = ?');
      params.push(updates.completedAt);
    }

    if (sets.length === 0) return;
    params.push(taskId);
    db.prepare(`UPDATE orchestration_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  public createApprovalRequest(req: ApprovalRequest): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO approval_requests (
        id, orchestration_id, task_id, type, title, description,
        diff, changed_files_json, command, status, rejection_reason,
        created_at, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        rejection_reason = excluded.rejection_reason,
        resolved_at = excluded.resolved_at
    `).run(
      req.id,
      req.orchestrationId,
      req.taskId,
      req.type,
      req.title,
      req.description,
      req.diff || null,
      JSON.stringify(req.changedFiles || []),
      req.command || null,
      req.status,
      req.rejectionReason || null,
      req.createdAt,
      req.resolvedAt || null
    );
  }

  public getApprovalRequest(id: string): ApprovalRequest | null {
    const db = this.getAppDb();
    const r = db.prepare(`SELECT * FROM approval_requests WHERE id = ?`).get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      orchestrationId: r.orchestration_id,
      taskId: r.task_id,
      type: r.type,
      title: r.title,
      description: r.description,
      diff: r.diff || undefined,
      changedFiles: JSON.parse(r.changed_files_json || '[]'),
      command: r.command || undefined,
      status: r.status,
      rejectionReason: r.rejection_reason || undefined,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at || undefined
    };
  }

  public getPendingApprovals(orchestrationId?: string): ApprovalRequest[] {
    const db = this.getAppDb();
    let query = `SELECT * FROM approval_requests WHERE status = 'pending'`;
    const params: any[] = [];
    if (orchestrationId) {
      query += ` AND orchestration_id = ?`;
      params.push(orchestrationId);
    }
    query += ` ORDER BY created_at ASC`;
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      orchestrationId: r.orchestration_id,
      taskId: r.task_id,
      type: r.type,
      title: r.title,
      description: r.description,
      diff: r.diff || undefined,
      changedFiles: JSON.parse(r.changed_files_json || '[]'),
      command: r.command || undefined,
      status: r.status,
      rejectionReason: r.rejection_reason || undefined,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at || undefined
    }));
  }

  public resolveApprovalRequest(id: string, status: 'approved' | 'rejected', rejectionReason?: string): void {
    const db = this.getAppDb();
    db.prepare(`UPDATE approval_requests SET status = ?, rejection_reason = ?, resolved_at = ? WHERE id = ?`).run(
      status,
      rejectionReason || null,
      Date.now(),
      id
    );
  }

  public recoverOrchestrationsOnStartup(): { recoveredOrchestrations: number; recoveredTasks: number } {
    const db = this.getAppDb();
    // 1. Mark any active 'running' or 'planning' orchestrations as 'failed' (interrupted by shutdown)
    const activeOrchs = db.prepare(`SELECT id FROM orchestrations WHERE status IN ('planning', 'running', 'reviewing')`).all() as any[];
    for (const o of activeOrchs) {
      db.prepare(`UPDATE orchestrations SET status = 'failed', error_message = 'Interrupted by application shutdown/restart', completed_at = ? WHERE id = ?`).run(
        Date.now(),
        o.id
      );
    }

    // 2. Mark any active 'running' or 'reviewing' tasks as 'failed'
    const activeTasks = db.prepare(`SELECT id FROM orchestration_tasks WHERE status IN ('running', 'reviewing')`).all() as any[];
    for (const t of activeTasks) {
      db.prepare(`UPDATE orchestration_tasks SET status = 'failed', error_message = 'Interrupted by application restart', completed_at = ? WHERE id = ?`).run(
        Date.now(),
        t.id
      );
    }

    return {
      recoveredOrchestrations: activeOrchs.length,
      recoveredTasks: activeTasks.length
    };
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
