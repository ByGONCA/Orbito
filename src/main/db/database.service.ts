import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type {
  ProjectDescriptor,
  WorkspaceConfig,
  AppLayoutConfig,
  ProjectWorkspaceState,
  PersistedWorkspaceTab,
  PersistedTerminalSession,
  MemoryRecord,
  MemoryTier
} from '../../shared/types';
import type { CLISessionRecord, CLISessionMessage, CLISessionStatus, CLIProvider } from '../../shared/cli';
import type { FileSymbol, CodeChunk, SearchResult, IndexStats } from '../../shared/context';
import type { SkillMetadata, SkillExecutionRecord, SkillManifest } from '../../shared/skills';
import type { OrchestrationRecord, OrchestrationTask, ApprovalRequest } from '../../shared/agents';
import type { WorkflowRecord, WorkflowExecutionRecord, NodeExecutionRecord } from '../../shared/workflows';
import type { ExtensionRecord, ExtensionManifest } from '../../shared/extensions';
import type {
  AnalyticsEvent,
  AnalyticsSummary,
  ProviderCostMetrics,
  AuditLogEntry,
  AuditLogFilter,
  AirGapConfig
} from '../../shared/analytics';

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

  public initialize(customStorageDir?: string): { appDbPath: string; indexDbPath: string } {
    if (customStorageDir) {
      this.storageDir = customStorageDir;
    }
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
        file_icon_theme TEXT NOT NULL DEFAULT 'material',
        show_git_file_colors INTEGER NOT NULL DEFAULT 1,
        discord_rpc_enabled INTEGER NOT NULL DEFAULT 0,
        discord_client_id TEXT,
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

      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        nodes_json TEXT NOT NULL,
        edges_json TEXT NOT NULL,
        variables_json TEXT NOT NULL DEFAULT '{}',
        trigger_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ready',
        version INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_workflows_proj ON workflows(project_id);

      CREATE TABLE IF NOT EXISTS workflow_versions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        nodes_json TEXT NOT NULL,
        edges_json TEXT NOT NULL,
        variables_json TEXT NOT NULL DEFAULT '{}',
        description TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_wf_versions_wf ON workflow_versions(workflow_id);

      CREATE TABLE IF NOT EXISTS workflow_executions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        status TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        inputs_json TEXT NOT NULL DEFAULT '{}',
        outputs_json TEXT NOT NULL DEFAULT '{}',
        variables_json TEXT NOT NULL DEFAULT '{}',
        duration_ms INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER,
        FOREIGN KEY(workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_wf_exec_wf ON workflow_executions(workflow_id);

      CREATE TABLE IF NOT EXISTS workflow_node_executions (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        node_type TEXT NOT NULL,
        status TEXT NOT NULL,
        inputs_json TEXT NOT NULL DEFAULT '{}',
        outputs_json TEXT NOT NULL DEFAULT '{}',
        duration_ms INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        FOREIGN KEY(execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_wf_node_exec ON workflow_node_executions(execution_id);

      -- Phase 7: Audit Logs (Enterprise Hardening)
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'error', 'critical')),
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT,
        details_json TEXT NOT NULL DEFAULT '{}',
        project_path TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_audit_sev ON audit_logs(severity);

      -- Phase 7: Analytics Events (Advanced Telemetry & Cost Tracking)
      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        tokens_in INTEGER NOT NULL DEFAULT 0,
        tokens_out INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        cost_usd REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'success',
        feature TEXT NOT NULL,
        details_json TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_time ON analytics_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_analytics_prov ON analytics_events(provider);
      CREATE INDEX IF NOT EXISTS idx_analytics_feat ON analytics_events(feature);

      -- Phase 7: Custom Extensions
      CREATE TABLE IF NOT EXISTS extensions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        version TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        author TEXT NOT NULL DEFAULT 'anonymous',
        enabled INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        install_path TEXT NOT NULL,
        checksum TEXT NOT NULL,
        manifest_json TEXT NOT NULL,
        error_message TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ext_enabled ON extensions(enabled);

      -- Phase 7: System Config (Air-gap mode, etc.)
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    try {
      db.exec(`ALTER TABLE cli_sessions ADD COLUMN provider_session_id TEXT`);
    } catch {
      // Column already exists
    }

    try {
      db.exec(`ALTER TABLE workspaces ADD COLUMN file_icon_theme TEXT DEFAULT 'material'`);
    } catch {
      // Column already exists
    }

    try {
      db.exec(`ALTER TABLE workspaces ADD COLUMN show_git_file_colors INTEGER DEFAULT 1`);
    } catch {
      // Column already exists
    }

    try {
      db.exec(`ALTER TABLE workspaces ADD COLUMN discord_rpc_enabled INTEGER DEFAULT 0`);
    } catch {
      // Column already exists
    }

    try {
      db.exec(`ALTER TABLE workspaces ADD COLUMN discord_client_id TEXT`);
    } catch {
      // Column already exists
    }

    // Projects table customization columns
    try {
      db.exec(`ALTER TABLE projects ADD COLUMN custom_name TEXT`);
    } catch {}
    try {
      db.exec(`ALTER TABLE projects ADD COLUMN custom_color TEXT`);
    } catch {}
    try {
      db.exec(`ALTER TABLE projects ADD COLUMN custom_icon TEXT`);
    } catch {}
    try {
      db.exec(`ALTER TABLE projects ADD COLUMN description TEXT`);
    } catch {}
    try {
      db.exec(`ALTER TABLE projects ADD COLUMN tag TEXT`);
    } catch {}
    try {
      db.exec(`ALTER TABLE projects ADD COLUMN is_favorite INTEGER DEFAULT 0`);
    } catch {}
    try {
      db.exec(`ALTER TABLE projects ADD COLUMN settings_json TEXT DEFAULT '{}'`);
    } catch {}

    // Layout configuration persistence
    try {
      db.exec(`ALTER TABLE workspaces ADD COLUMN layout_json TEXT DEFAULT '{}'`);
    } catch {}

    // Per-project workspace states (isolated tabs, active file, expanded folders, terminals)
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_workspace_states (
        project_id TEXT PRIMARY KEY,
        open_tabs_json TEXT NOT NULL DEFAULT '[]',
        active_tab_id TEXT,
        active_file_path TEXT,
        expanded_dirs_json TEXT NOT NULL DEFAULT '[]',
        file_filter TEXT NOT NULL DEFAULT '',
        terminal_sessions_json TEXT NOT NULL DEFAULT '[]',
        active_terminal_id TEXT,
        target_editor_line INTEGER,
        view_state_json TEXT NOT NULL DEFAULT '{}',
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_pws_updated ON project_workspace_states(updated_at);
    `);
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

  public isInitialized(): boolean {
    return this.appDb !== null;
  }

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
        autoIndex: true,
        discordRpcEnabled: false
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
      autoIndex: Boolean(row.auto_index),
      fileIconTheme: row.file_icon_theme || 'material',
      showGitFileColors: row.show_git_file_colors !== undefined ? Boolean(row.show_git_file_colors) : true,
      discordRpcEnabled: Boolean(row.discord_rpc_enabled),
      discordClientId: row.discord_client_id || undefined
    };
  }

  public updateSettings(updates: Partial<WorkspaceConfig>): WorkspaceConfig {
    const current = this.getSettings();
    const merged: WorkspaceConfig = { ...current, ...updates };

    const db = this.getAppDb();
    db.prepare(`
      UPDATE workspaces
      SET ui_mode = ?, theme = ?, auto_index = ?, current_project_id = ?, file_icon_theme = ?, show_git_file_colors = ?, discord_rpc_enabled = ?, discord_client_id = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.uiMode,
      merged.theme,
      merged.autoIndex ? 1 : 0,
      merged.currentProjectId || null,
      merged.fileIconTheme || 'material',
      merged.showGitFileColors ? 1 : 0,
      merged.discordRpcEnabled ? 1 : 0,
      merged.discordClientId || null,
      Date.now(),
      merged.id
    );

    return merged;
  }

  public getAppLayout(): AppLayoutConfig {
    const db = this.getAppDb();
    const row = db.prepare('SELECT layout_json FROM workspaces LIMIT 1').get() as any;
    const defaults: AppLayoutConfig = {
      isLeftSidebarOpen: true,
      leftSidebarWidth: 240,
      isRightPanelOpen: true,
      rightPanelWidth: 280,
      isBottomPanelOpen: false,
      bottomPanelHeight: 220,
      activeSection: 'editor',
      activeSidebarSection: 'projects',
      rightPanelTab: 'files',
      bottomPanelTab: 'terminal',
      terminalLayout: '1'
    };

    if (!row || !row.layout_json) {
      return defaults;
    }

    try {
      const parsed = JSON.parse(row.layout_json);
      return {
        isLeftSidebarOpen: parsed.isLeftSidebarOpen ?? defaults.isLeftSidebarOpen,
        leftSidebarWidth: typeof parsed.leftSidebarWidth === 'number' ? parsed.leftSidebarWidth : defaults.leftSidebarWidth,
        isRightPanelOpen: parsed.isRightPanelOpen ?? defaults.isRightPanelOpen,
        rightPanelWidth: typeof parsed.rightPanelWidth === 'number' ? parsed.rightPanelWidth : defaults.rightPanelWidth,
        isBottomPanelOpen: parsed.isBottomPanelOpen ?? defaults.isBottomPanelOpen,
        bottomPanelHeight: typeof parsed.bottomPanelHeight === 'number' ? parsed.bottomPanelHeight : defaults.bottomPanelHeight,
        activeSection: parsed.activeSection ?? defaults.activeSection,
        activeSidebarSection: parsed.activeSidebarSection ?? defaults.activeSidebarSection,
        rightPanelTab: parsed.rightPanelTab ?? defaults.rightPanelTab,
        bottomPanelTab: parsed.bottomPanelTab ?? defaults.bottomPanelTab,
        terminalLayout: parsed.terminalLayout ?? defaults.terminalLayout
      };
    } catch {
      return defaults;
    }
  }

  public updateAppLayout(updates: Partial<AppLayoutConfig>): AppLayoutConfig {
    const current = this.getAppLayout();
    const merged = { ...current, ...updates };
    const db = this.getAppDb();
    db.prepare('UPDATE workspaces SET layout_json = ?, updated_at = ?').run(
      JSON.stringify(merged),
      Date.now()
    );
    return merged;
  }

  public getProjectWorkspaceState(projectId: string): ProjectWorkspaceState | null {
    const db = this.getAppDb();
    const row = db.prepare('SELECT * FROM project_workspace_states WHERE project_id = ?').get(projectId) as any;
    if (!row) return null;

    let openTabs: PersistedWorkspaceTab[] = [];
    try {
      openTabs = JSON.parse(row.open_tabs_json || '[]');
      if (!Array.isArray(openTabs)) openTabs = [];
    } catch {
      openTabs = [];
    }

    let expandedDirs: string[] = [];
    try {
      expandedDirs = JSON.parse(row.expanded_dirs_json || '[]');
      if (!Array.isArray(expandedDirs)) expandedDirs = [];
    } catch {
      expandedDirs = [];
    }

    let terminalSessions: PersistedTerminalSession[] = [];
    try {
      terminalSessions = JSON.parse(row.terminal_sessions_json || '[]');
      if (!Array.isArray(terminalSessions)) terminalSessions = [];
    } catch {
      terminalSessions = [];
    }

    return {
      projectId: row.project_id,
      openTabs,
      activeTabId: row.active_tab_id || null,
      activeFilePath: row.active_file_path || null,
      expandedDirs,
      fileFilter: row.file_filter || '',
      terminalSessions,
      activeTerminalId: row.active_terminal_id || null,
      targetEditorLine: row.target_editor_line !== null ? Number(row.target_editor_line) : null,
      updatedAt: Number(row.updated_at)
    };
  }

  public saveProjectWorkspaceState(projectId: string, state: Partial<ProjectWorkspaceState>): void {
    const db = this.getAppDb();
    const existing = this.getProjectWorkspaceState(projectId);

    const openTabs = state.openTabs !== undefined ? state.openTabs : (existing?.openTabs || []);
    const activeTabId = state.activeTabId !== undefined ? state.activeTabId : (existing?.activeTabId || null);
    const activeFilePath = state.activeFilePath !== undefined ? state.activeFilePath : (existing?.activeFilePath || null);
    const expandedDirs = state.expandedDirs !== undefined ? state.expandedDirs : (existing?.expandedDirs || []);
    const fileFilter = state.fileFilter !== undefined ? state.fileFilter : (existing?.fileFilter || '');
    const terminalSessions = state.terminalSessions !== undefined ? state.terminalSessions : (existing?.terminalSessions || []);
    const activeTerminalId = state.activeTerminalId !== undefined ? state.activeTerminalId : (existing?.activeTerminalId || null);
    const targetEditorLine = state.targetEditorLine !== undefined ? state.targetEditorLine : (existing?.targetEditorLine || null);

    db.prepare(`
      INSERT INTO project_workspace_states (
        project_id, open_tabs_json, active_tab_id, active_file_path,
        expanded_dirs_json, file_filter, terminal_sessions_json,
        active_terminal_id, target_editor_line, view_state_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        open_tabs_json = excluded.open_tabs_json,
        active_tab_id = excluded.active_tab_id,
        active_file_path = excluded.active_file_path,
        expanded_dirs_json = excluded.expanded_dirs_json,
        file_filter = excluded.file_filter,
        terminal_sessions_json = excluded.terminal_sessions_json,
        active_terminal_id = excluded.active_terminal_id,
        target_editor_line = excluded.target_editor_line,
        updated_at = excluded.updated_at
    `).run(
      projectId,
      JSON.stringify(openTabs),
      activeTabId,
      activeFilePath,
      JSON.stringify(expandedDirs),
      fileFilter,
      JSON.stringify(terminalSessions),
      activeTerminalId,
      targetEditorLine,
      '{}',
      Date.now()
    );
  }

  public recordProjectOpen(project: ProjectDescriptor): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO projects (id, name, path, last_opened_at, is_git_repo, active_branch, permission_level, is_favorite, settings_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      project.permissionLevel,
      project.isFavorite ? 1 : 0,
      project.settings ? JSON.stringify(project.settings) : '{}'
    );
  }

  private mapProjectRow(r: any): ProjectDescriptor {
    let parsedSettings = {};
    try {
      if (r.settings_json) {
        parsedSettings = JSON.parse(r.settings_json);
      }
    } catch {}

    return {
      id: r.id,
      name: r.name,
      path: r.path,
      lastOpenedAt: r.last_opened_at,
      isGitRepo: Boolean(r.is_git_repo),
      activeBranch: r.active_branch || undefined,
      permissionLevel: r.permission_level,
      customName: r.custom_name || undefined,
      customColor: r.custom_color || undefined,
      customIcon: r.custom_icon || undefined,
      description: r.description || undefined,
      tag: r.tag || undefined,
      isFavorite: Boolean(r.is_favorite),
      settings: parsedSettings
    };
  }

  public getProject(projectId: string): ProjectDescriptor | null {
    const db = this.getAppDb();
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    return row ? this.mapProjectRow(row) : null;
  }

  public getProjectByPath(projectPath: string): ProjectDescriptor | null {
    const db = this.getAppDb();
    // Normalize path comparison
    const norm = projectPath.replace(/[/\\]+$/, '');
    const row = db.prepare('SELECT * FROM projects WHERE path = ? OR path = ?').get(norm, projectPath) as any;
    return row ? this.mapProjectRow(row) : null;
  }

  public getRecentProjects(): ProjectDescriptor[] {
    const db = this.getAppDb();
    const rows = db.prepare('SELECT * FROM projects ORDER BY last_opened_at DESC LIMIT 20').all() as any[];
    return rows.map((r) => this.mapProjectRow(r));
  }

  public updateProject(projectId: string, updates: Partial<ProjectDescriptor>): ProjectDescriptor {
    const db = this.getAppDb();
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    if (!existing) {
      throw new Error(`Project not found with id: ${projectId}`);
    }

    const customName = updates.customName !== undefined ? updates.customName : existing.custom_name;
    const customColor = updates.customColor !== undefined ? updates.customColor : existing.custom_color;
    const customIcon = updates.customIcon !== undefined ? updates.customIcon : existing.custom_icon;
    const description = updates.description !== undefined ? updates.description : existing.description;
    const tag = updates.tag !== undefined ? updates.tag : existing.tag;
    const isFavorite = updates.isFavorite !== undefined ? (updates.isFavorite ? 1 : 0) : (existing.is_favorite || 0);

    let settingsJson = existing.settings_json || '{}';
    if (updates.settings !== undefined) {
      settingsJson = JSON.stringify(updates.settings);
    }

    db.prepare(`
      UPDATE projects
      SET custom_name = ?, custom_color = ?, custom_icon = ?, description = ?, tag = ?, is_favorite = ?, settings_json = ?
      WHERE id = ?
    `).run(
      customName || null,
      customColor || null,
      customIcon || null,
      description || null,
      tag || null,
      isFavorite,
      settingsJson,
      projectId
    );

    let parsedSettings = {};
    try {
      parsedSettings = JSON.parse(settingsJson);
    } catch {}

    return {
      id: existing.id,
      name: existing.name,
      path: existing.path,
      lastOpenedAt: existing.last_opened_at,
      isGitRepo: Boolean(existing.is_git_repo),
      activeBranch: existing.active_branch || undefined,
      permissionLevel: existing.permission_level,
      customName: customName || undefined,
      customColor: customColor || undefined,
      customIcon: customIcon || undefined,
      description: description || undefined,
      tag: tag || undefined,
      isFavorite: Boolean(isFavorite),
      settings: parsedSettings
    };
  }

  public toggleProjectFavorite(projectId: string, isFavorite?: boolean): boolean {
    const db = this.getAppDb();
    const existing = db.prepare('SELECT is_favorite FROM projects WHERE id = ?').get(projectId) as any;
    if (!existing) return false;
    const nextVal = isFavorite !== undefined ? (isFavorite ? 1 : 0) : (existing.is_favorite ? 0 : 1);
    db.prepare('UPDATE projects SET is_favorite = ? WHERE id = ?').run(nextVal, projectId);
    return Boolean(nextVal);
  }

  public getProjectSettings(projectId: string): any {
    const db = this.getAppDb();
    const row = db.prepare('SELECT settings_json FROM projects WHERE id = ?').get(projectId) as any;
    if (!row || !row.settings_json) return {};
    try {
      return JSON.parse(row.settings_json);
    } catch {
      return {};
    }
  }

  public saveProjectSettings(projectId: string, settings: any): boolean {
    const db = this.getAppDb();
    const json = JSON.stringify(settings || {});
    db.prepare('UPDATE projects SET settings_json = ? WHERE id = ?').run(json, projectId);
    return true;
  }

  public removeProject(projectId: string): void {
    const db = this.getAppDb();
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
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

  public listAllSecrets(): { key: string; encryptedValue: string }[] {
    const db = this.getAppDb();
    const rows = db.prepare('SELECT key, encrypted_value FROM secrets_store').all() as any[];
    return rows.map((r) => ({ key: r.key, encryptedValue: r.encrypted_value }));
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

  /**
   * Recovers CLI sessions stuck in 'running' status on application restart.
   * Interrupted sessions are marked 'failed' with exitCode 130 and a descriptive system message.
   */
  public recoverCLISessionsOnStartup(): { recoveredSessions: number } {
    const db = this.getAppDb();
    const active = db.prepare(`SELECT id FROM cli_sessions WHERE status = 'running'`).all() as any[];
    for (const sess of active) {
      db.prepare(`
        UPDATE cli_sessions
        SET status = 'failed',
            exit_code = 130,
            duration_ms = CASE WHEN duration_ms IS NULL OR duration_ms = 0 THEN 0 ELSE duration_ms END,
            updated_at = ?
        WHERE id = ?
      `).run(Date.now(), sess.id);

      try {
        this.addCLISessionMessage({
          id: `msg-recovery-${Date.now()}-${sess.id}`,
          sessionId: sess.id,
          role: 'system',
          content: '[Session interrupted by application restart/shutdown]',
          timestamp: Date.now()
        });
      } catch {}
    }

    return { recoveredSessions: active.length };
  }

  // ==========================================
  // Phase 6: Workflow Persistence & Executions
  // ==========================================

  public upsertWorkflow(workflow: WorkflowRecord): void {
    const db = this.getAppDb();
    const stmt = db.prepare(`
      INSERT INTO workflows (
        id, project_id, name, description, nodes_json, edges_json,
        variables_json, trigger_json, status, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        nodes_json = excluded.nodes_json,
        edges_json = excluded.edges_json,
        variables_json = excluded.variables_json,
        trigger_json = excluded.trigger_json,
        status = excluded.status,
        version = excluded.version,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      workflow.id,
      workflow.projectId,
      workflow.name,
      workflow.description,
      JSON.stringify(workflow.nodes),
      JSON.stringify(workflow.edges),
      JSON.stringify(workflow.variables || {}),
      JSON.stringify(workflow.trigger),
      workflow.status,
      workflow.version,
      workflow.createdAt,
      workflow.updatedAt
    );
  }

  public getWorkflow(id: string): WorkflowRecord | null {
    const db = this.getAppDb();
    const row = db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      nodes: JSON.parse(row.nodes_json),
      edges: JSON.parse(row.edges_json),
      variables: JSON.parse(row.variables_json || '{}'),
      trigger: JSON.parse(row.trigger_json),
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public listWorkflows(projectId: string): WorkflowRecord[] {
    const db = this.getAppDb();
    const rows = db.prepare(`SELECT * FROM workflows WHERE project_id = ? OR project_id = 'default' ORDER BY updated_at DESC`).all(projectId) as any[];

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      nodes: JSON.parse(row.nodes_json),
      edges: JSON.parse(row.edges_json),
      variables: JSON.parse(row.variables_json || '{}'),
      trigger: JSON.parse(row.trigger_json),
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  public deleteWorkflow(id: string): boolean {
    const db = this.getAppDb();
    const res = db.prepare(`DELETE FROM workflows WHERE id = ?`).run(id);
    return res.changes > 0;
  }

  public duplicateWorkflow(id: string): WorkflowRecord | null {
    const original = this.getWorkflow(id);
    if (!original) return null;

    const newId = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const duplicated: WorkflowRecord = {
      ...original,
      id: newId,
      name: `${original.name} (Copy)`,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.upsertWorkflow(duplicated);
    return duplicated;
  }

  public createWorkflowExecution(exec: WorkflowExecutionRecord): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO workflow_executions (
        id, workflow_id, project_id, status, trigger_type,
        inputs_json, outputs_json, variables_json, duration_ms,
        error_message, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      exec.id,
      exec.workflowId,
      exec.projectId,
      exec.status,
      exec.triggerType,
      JSON.stringify(exec.inputs || {}),
      JSON.stringify(exec.outputs || {}),
      JSON.stringify(exec.variables || {}),
      exec.durationMs,
      exec.errorMessage || null,
      exec.createdAt,
      exec.completedAt || null
    );
  }

  public updateWorkflowExecution(exec: WorkflowExecutionRecord): void {
    const db = this.getAppDb();
    db.prepare(`
      UPDATE workflow_executions SET
        status = ?,
        outputs_json = ?,
        variables_json = ?,
        duration_ms = ?,
        error_message = ?,
        completed_at = ?
      WHERE id = ?
    `).run(
      exec.status,
      JSON.stringify(exec.outputs || {}),
      JSON.stringify(exec.variables || {}),
      exec.durationMs,
      exec.errorMessage || null,
      exec.completedAt || null,
      exec.id
    );
  }

  public updateWorkflowExecutionStatus(id: string, status: string): void {
    const db = this.getAppDb();
    db.prepare(`UPDATE workflow_executions SET status = ?, completed_at = ? WHERE id = ?`).run(
      status,
      Date.now(),
      id
    );
  }

  public getWorkflowExecution(id: string): WorkflowExecutionRecord | null {
    const db = this.getAppDb();
    const row = db.prepare(`SELECT * FROM workflow_executions WHERE id = ?`).get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      workflowId: row.workflow_id,
      projectId: row.project_id,
      status: row.status,
      triggerType: row.trigger_type,
      inputs: JSON.parse(row.inputs_json || '{}'),
      outputs: JSON.parse(row.outputs_json || '{}'),
      variables: JSON.parse(row.variables_json || '{}'),
      durationMs: row.duration_ms,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      completedAt: row.completed_at
    };
  }

  public listWorkflowExecutions(workflowId: string): WorkflowExecutionRecord[] {
    const db = this.getAppDb();
    const rows = db.prepare(`SELECT * FROM workflow_executions WHERE workflow_id = ? ORDER BY created_at DESC LIMIT 50`).all(workflowId) as any[];

    return rows.map((row) => ({
      id: row.id,
      workflowId: row.workflow_id,
      projectId: row.project_id,
      status: row.status,
      triggerType: row.trigger_type,
      inputs: JSON.parse(row.inputs_json || '{}'),
      outputs: JSON.parse(row.outputs_json || '{}'),
      variables: JSON.parse(row.variables_json || '{}'),
      durationMs: row.duration_ms,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      completedAt: row.completed_at
    }));
  }

  public recordNodeExecution(record: NodeExecutionRecord): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO workflow_node_executions (
        id, execution_id, node_id, node_type, status,
        inputs_json, outputs_json, duration_ms, error_message,
        started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.executionId,
      record.nodeId,
      record.nodeType,
      record.status,
      JSON.stringify(record.inputs || {}),
      JSON.stringify(record.outputs || {}),
      record.durationMs,
      record.errorMessage || null,
      record.startedAt,
      record.completedAt || null
    );
  }

  public updateNodeExecution(
    executionId: string,
    nodeId: string,
    updates: Partial<NodeExecutionRecord>
  ): void {
    const db = this.getAppDb();
    const existing = db.prepare(`SELECT * FROM workflow_node_executions WHERE execution_id = ? AND node_id = ? ORDER BY started_at DESC LIMIT 1`).get(executionId, nodeId) as any;
    if (!existing) return;

    db.prepare(`
      UPDATE workflow_node_executions SET
        status = COALESCE(?, status),
        outputs_json = COALESCE(?, outputs_json),
        duration_ms = COALESCE(?, duration_ms),
        error_message = COALESCE(?, error_message),
        completed_at = COALESCE(?, completed_at)
      WHERE id = ?
    `).run(
      updates.status || null,
      updates.outputs ? JSON.stringify(updates.outputs) : null,
      updates.durationMs ?? null,
      updates.errorMessage || null,
      updates.completedAt || null,
      existing.id
    );
  }

  public recoverWorkflowExecutionsOnStartup(): { recoveredExecutions: number } {
    const db = this.getAppDb();
    const active = db.prepare(`SELECT id FROM workflow_executions WHERE status = 'running'`).all() as any[];
    for (const exec of active) {
      db.prepare(`UPDATE workflow_executions SET status = 'failed', error_message = 'Interrupted by application restart', completed_at = ? WHERE id = ?`).run(
        Date.now(),
        exec.id
      );
    }
    return { recoveredExecutions: active.length };
  }

  // ==========================================
  // Phase 7: Audit Logging (Enterprise Hardening)
  // ==========================================

  public insertAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): AuditLogEntry {
    const db = this.getAppDb();
    const id = entry.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = entry.timestamp || Date.now();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, timestamp, event_type, severity, actor, action, target, details_json, project_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      timestamp,
      entry.eventType,
      entry.severity,
      entry.actor,
      entry.action,
      entry.target || null,
      JSON.stringify(entry.details || {}),
      entry.projectPath || null
    );

    return {
      id,
      timestamp,
      eventType: entry.eventType,
      severity: entry.severity,
      actor: entry.actor,
      action: entry.action,
      target: entry.target,
      details: entry.details || {},
      projectPath: entry.projectPath
    };
  }

  public queryAuditLogs(filter?: AuditLogFilter): AuditLogEntry[] {
    const db = this.getAppDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter?.eventType) {
      conditions.push('event_type = ?');
      params.push(filter.eventType);
    }
    if (filter?.severity) {
      conditions.push('severity = ?');
      params.push(filter.severity);
    }
    if (filter?.actor) {
      conditions.push('actor = ?');
      params.push(filter.actor);
    }
    if (filter?.startDate) {
      conditions.push('timestamp >= ?');
      params.push(filter.startDate);
    }
    if (filter?.endDate) {
      conditions.push('timestamp <= ?');
      params.push(filter.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter?.limit ?? 100;
    const offset = filter?.offset ?? 0;

    const rows = db.prepare(`
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      eventType: r.event_type,
      severity: r.severity,
      actor: r.actor,
      action: r.action,
      target: r.target || undefined,
      details: JSON.parse(r.details_json || '{}'),
      projectPath: r.project_path || undefined
    }));
  }

  public exportAuditLogs(format: 'json' | 'csv'): string {
    const logs = this.queryAuditLogs({ limit: 5000 });
    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    const header = 'id,timestamp,eventType,severity,actor,action,target,projectPath,details';
    const lines = logs.map((l) => {
      const detailsEscaped = `"${JSON.stringify(l.details).replace(/"/g, '""')}"`;
      return `${l.id},${l.timestamp},"${l.eventType}","${l.severity}","${l.actor}","${l.action}","${l.target || ''}","${l.projectPath || ''}",${detailsEscaped}`;
    });
    return [header, ...lines].join('\n');
  }

  public clearAuditLogs(): void {
    const db = this.getAppDb();
    db.prepare('DELETE FROM audit_logs').run();
  }

  // ==========================================
  // Phase 7: Analytics Events & Telemetry
  // ==========================================

  public insertAnalyticsEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): AnalyticsEvent {
    const db = this.getAppDb();
    const id = event.id || `ana_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = event.timestamp || Date.now();

    const stmt = db.prepare(`
      INSERT INTO analytics_events (id, timestamp, provider, model, tokens_in, tokens_out, duration_ms, cost_usd, status, feature, details_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      timestamp,
      event.provider,
      event.model,
      event.tokensIn,
      event.tokensOut,
      event.durationMs,
      event.costUsd || 0.0,
      event.status,
      event.feature,
      JSON.stringify(event.details || {})
    );

    return {
      id,
      timestamp,
      provider: event.provider,
      model: event.model,
      tokensIn: event.tokensIn,
      tokensOut: event.tokensOut,
      durationMs: event.durationMs,
      costUsd: event.costUsd || 0.0,
      status: event.status,
      feature: event.feature,
      details: event.details
    };
  }

  public getAnalyticsSummary(options?: { projectId?: string; timeRangeMs?: number }): AnalyticsSummary {
    const db = this.getAppDb();
    const now = Date.now();
    const startTime = options?.timeRangeMs ? now - options.timeRangeMs : 0;

    const rows = db.prepare(`
      SELECT * FROM analytics_events
      WHERE timestamp >= ?
      ORDER BY timestamp ASC
    `).all(startTime) as any[];

    if (rows.length === 0) {
      return {
        totalCalls: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCostUsd: 0,
        avgDurationMs: 0,
        p50DurationMs: 0,
        p95DurationMs: 0,
        p99DurationMs: 0,
        byProvider: {},
        byFeature: {},
        timeline: []
      };
    }

    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let totalCostUsd = 0;
    let totalDurationMs = 0;
    const durations: number[] = [];

    const byProvider: Record<string, { calls: number; tokensIn: number; tokensOut: number; costUsd: number }> = {};
    const byFeature: Record<string, { calls: number; tokensIn: number; tokensOut: number; costUsd: number }> = {};
    const dailyMap: Record<string, { calls: number; tokensIn: number; tokensOut: number; costUsd: number }> = {};

    for (const r of rows) {
      totalTokensIn += r.tokens_in;
      totalTokensOut += r.tokens_out;
      totalCostUsd += r.cost_usd;
      totalDurationMs += r.duration_ms;
      durations.push(r.duration_ms);

      // By Provider
      if (!byProvider[r.provider]) {
        byProvider[r.provider] = { calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
      }
      byProvider[r.provider].calls += 1;
      byProvider[r.provider].tokensIn += r.tokens_in;
      byProvider[r.provider].tokensOut += r.tokens_out;
      byProvider[r.provider].costUsd += r.cost_usd;

      // By Feature
      if (!byFeature[r.feature]) {
        byFeature[r.feature] = { calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
      }
      byFeature[r.feature].calls += 1;
      byFeature[r.feature].tokensIn += r.tokens_in;
      byFeature[r.feature].tokensOut += r.tokens_out;
      byFeature[r.feature].costUsd += r.cost_usd;

      // Timeline (date YYYY-MM-DD)
      const dateKey = new Date(r.timestamp).toISOString().split('T')[0];
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
      }
      dailyMap[dateKey].calls += 1;
      dailyMap[dateKey].tokensIn += r.tokens_in;
      dailyMap[dateKey].tokensOut += r.tokens_out;
      dailyMap[dateKey].costUsd += r.cost_usd;
    }

    durations.sort((a, b) => a - b);
    const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] || 0;

    const timeline = Object.entries(dailyMap).map(([date, data]) => ({
      date,
      calls: data.calls,
      tokensIn: data.tokensIn,
      tokensOut: data.tokensOut,
      costUsd: Number(data.costUsd.toFixed(4))
    }));

    return {
      totalCalls: rows.length,
      totalTokensIn,
      totalTokensOut,
      totalCostUsd: Number(totalCostUsd.toFixed(4)),
      avgDurationMs: Math.round(totalDurationMs / rows.length),
      p50DurationMs: p50,
      p95DurationMs: p95,
      p99DurationMs: p99,
      byProvider,
      byFeature,
      timeline
    };
  }

  public getProviderCostMetrics(): ProviderCostMetrics[] {
    const db = this.getAppDb();
    const rows = db.prepare(`
      SELECT 
        provider,
        model,
        COUNT(*) as total_calls,
        SUM(tokens_in) as sum_tokens_in,
        SUM(tokens_out) as sum_tokens_out,
        SUM(cost_usd) as sum_cost_usd,
        AVG(duration_ms) as avg_duration,
        SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as failure_count
      FROM analytics_events
      GROUP BY provider, model
      ORDER BY sum_cost_usd DESC
    `).all() as any[];

    return rows.map((r) => ({
      provider: r.provider,
      model: r.model,
      totalCalls: r.total_calls,
      tokensIn: r.sum_tokens_in || 0,
      tokensOut: r.sum_tokens_out || 0,
      totalCostUsd: Number((r.sum_cost_usd || 0).toFixed(4)),
      avgDurationMs: Math.round(r.avg_duration || 0),
      errorRate: r.total_calls > 0 ? Number((r.failure_count / r.total_calls).toFixed(3)) : 0
    }));
  }

  public exportAnalyticsData(format: 'json' | 'csv'): string {
    const db = this.getAppDb();
    const rows = db.prepare(`SELECT * FROM analytics_events ORDER BY timestamp DESC`).all() as any[];
    if (format === 'json') {
      return JSON.stringify(rows, null, 2);
    }

    const header = 'id,timestamp,provider,model,tokens_in,tokens_out,duration_ms,cost_usd,status,feature';
    const lines = rows.map(
      (r) =>
        `${r.id},${r.timestamp},"${r.provider}","${r.model}",${r.tokens_in},${r.tokens_out},${r.duration_ms},${r.cost_usd},"${r.status}","${r.feature}"`
    );
    return [header, ...lines].join('\n');
  }

  public clearAnalytics(): void {
    const db = this.getAppDb();
    db.prepare(`DELETE FROM analytics_events`).run();
  }

  // ==========================================
  // Phase 7: Custom Extensions Storage
  // ==========================================

  public upsertExtension(record: ExtensionRecord): void {
    const db = this.getAppDb();
    const stmt = db.prepare(`
      INSERT INTO extensions (id, name, display_name, version, description, author, enabled, status, install_path, checksum, manifest_json, error_message, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        display_name = excluded.display_name,
        version = excluded.version,
        description = excluded.description,
        author = excluded.author,
        enabled = excluded.enabled,
        status = excluded.status,
        install_path = excluded.install_path,
        checksum = excluded.checksum,
        manifest_json = excluded.manifest_json,
        error_message = excluded.error_message,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      record.id,
      record.name,
      record.displayName,
      record.version,
      record.description,
      record.author,
      record.enabled ? 1 : 0,
      record.status,
      record.installPath,
      record.checksum,
      JSON.stringify(record.manifest),
      record.errorMessage || null,
      record.createdAt,
      record.updatedAt
    );
  }

  public getExtension(id: string): ExtensionRecord | null {
    const db = this.getAppDb();
    const row = db.prepare(`SELECT * FROM extensions WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      version: row.version,
      description: row.description,
      author: row.author,
      enabled: row.enabled === 1,
      status: row.status,
      installPath: row.install_path,
      checksum: row.checksum,
      manifest: JSON.parse(row.manifest_json),
      errorMessage: row.error_message || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public listExtensions(): ExtensionRecord[] {
    const db = this.getAppDb();
    const rows = db.prepare(`SELECT * FROM extensions ORDER BY name ASC`).all() as any[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      version: row.version,
      description: row.description,
      author: row.author,
      enabled: row.enabled === 1,
      status: row.status,
      installPath: row.install_path,
      checksum: row.checksum,
      manifest: JSON.parse(row.manifest_json),
      errorMessage: row.error_message || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  public deleteExtension(id: string): boolean {
    const db = this.getAppDb();
    const res = db.prepare(`DELETE FROM extensions WHERE id = ?`).run(id);
    return res.changes > 0;
  }

  public setExtensionEnabled(id: string, enabled: boolean): boolean {
    const db = this.getAppDb();
    const res = db.prepare(`UPDATE extensions SET enabled = ?, updated_at = ? WHERE id = ?`).run(
      enabled ? 1 : 0,
      Date.now(),
      id
    );
    return res.changes > 0;
  }

  // ==========================================
  // Phase 7: System Settings & Air-Gap Config
  // ==========================================

  public getAirGapConfig(): AirGapConfig {
    if (!this.appDb) {
      return {
        enabled: false,
        allowedHosts: ['127.0.0.1', 'localhost', '::1'],
        blockExternalNetwork: true,
        enforceLocalModels: true,
        defaultLocalModel: 'llama3:latest',
        localOllamaUrl: 'http://127.0.0.1:11434'
      };
    }
    const db = this.getAppDb();
    const row = db.prepare(`SELECT value_json FROM system_config WHERE key = 'airgap_config'`).get() as any;
    if (!row) {
      return {
        enabled: false,
        allowedHosts: ['127.0.0.1', 'localhost', '::1'],
        blockExternalNetwork: true,
        enforceLocalModels: true,
        defaultLocalModel: 'llama3:latest',
        localOllamaUrl: 'http://127.0.0.1:11434'
      };
    }
    try {
      return JSON.parse(row.value_json);
    } catch {
      return {
        enabled: false,
        allowedHosts: ['127.0.0.1', 'localhost', '::1'],
        blockExternalNetwork: true,
        enforceLocalModels: true,
        defaultLocalModel: 'llama3:latest',
        localOllamaUrl: 'http://127.0.0.1:11434'
      };
    }
  }

  public setAirGapConfig(config: AirGapConfig): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO system_config (key, value_json, updated_at)
      VALUES ('airgap_config', ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `).run(JSON.stringify(config), Date.now());
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
        if (this.appDb.open) {
          this.appDb.close();
        }
      } catch (err) {
        console.error('Error closing appDb:', err);
      }
      this.appDb = null;
    }

    if (this.indexDb) {
      try {
        if (this.indexDb.open) {
          this.indexDb.close();
        }
      } catch (err) {
        console.error('Error closing indexDb:', err);
      }
      this.indexDb = null;
    }
  }
}

export const databaseService = new DatabaseService();
