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
  MemoryTier,
  ProjectExecution,
  ExecutionFileChange,
  CodeReview,
  ReviewComment
} from '../../shared/types';
import type { CLISessionRecord, CLISessionMessage, CLISessionStatus, CLIProvider } from '../../shared/cli';
import type { FileSymbol, CodeChunk, SearchResult, IndexStats } from '../../shared/context';
import type { SkillMetadata, SkillExecutionRecord, SkillManifest } from '../../shared/skills';
import type { OrchestrationRecord, OrchestrationTask, ApprovalRequest, TaskExecutionTrace, AutonomousPlan } from '../../shared/agents';
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
import type {
  MCPServerConfig,
  MCPServerStatus,
  MCPToolDefinition,
  MCPAuditLogEntry,
  MCPConnectionEvent,
  MCPObservabilitySummary,
  MCPAuditLogFilter
} from '../../shared/mcp';
import type {
  ProjectIntelligenceData,
  ProjectKnowledgeEntry,
  ProjectHealthReport,
  KnowledgeCategory
} from '../../shared/project-intelligence';
import type {
  EngineeringFinding,
  FindingLifecycleEvent,
  EngineeringRecommendation,
  RecommendationFeedback,
  AnalysisRunRecord,
  EngineeringMetricSnapshot,
  ContinuousIntelligenceConfig,
  FindingCategory,
  FindingSeverity,
  FindingStatus,
  RecommendationPriority
} from '../../shared/continuous-intelligence';

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
    if (this.appDb) {
      try { this.appDb.close(); } catch {}
    }
    this.appDb = new Database(appDbPath, { timeout: 5000 });
    this.configurePragmas(this.appDb);
    this.migrateAppSchema(this.appDb);

    // 2. Initialize index.sqlite
    if (this.indexDb) {
      try { this.indexDb.close(); } catch {}
    }
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
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        current_project_id TEXT,
        ui_mode TEXT NOT NULL DEFAULT 'simple',
        theme TEXT NOT NULL DEFAULT 'glass',
        auto_index INTEGER NOT NULL DEFAULT 1,
        file_icon_theme TEXT NOT NULL DEFAULT 'material',
        show_git_file_colors INTEGER NOT NULL DEFAULT 1,
        discord_rpc_enabled INTEGER NOT NULL DEFAULT 1,
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

      -- Project Explorer: Prompt-Based Changes & Attributions
      CREATE TABLE IF NOT EXISTS project_executions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        prompt_id TEXT,
        prompt_text TEXT NOT NULL,
        provider TEXT,
        model TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        branch TEXT,
        base_commit TEXT,
        resulting_commit TEXT,
        files_changed_count INTEGER NOT NULL DEFAULT 0,
        additions INTEGER NOT NULL DEFAULT 0,
        deletions INTEGER NOT NULL DEFAULT 0,
        is_manual INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_proj_exec_proj ON project_executions(project_id);
      CREATE INDEX IF NOT EXISTS idx_proj_exec_started ON project_executions(started_at DESC);

      CREATE TABLE IF NOT EXISTS execution_file_changes (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        change_type TEXT NOT NULL,
        previous_content TEXT,
        current_content TEXT,
        diff TEXT NOT NULL,
        additions INTEGER NOT NULL DEFAULT 0,
        deletions INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(execution_id) REFERENCES project_executions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_exec_fc_exec ON execution_file_changes(execution_id);
      CREATE INDEX IF NOT EXISTS idx_exec_fc_proj ON execution_file_changes(project_id);

      -- Project Explorer: Code Reviews & Comments
      CREATE TABLE IF NOT EXISTS code_reviews (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        execution_id TEXT,
        status TEXT NOT NULL DEFAULT 'not_reviewed',
        summary TEXT,
        ai_analysis_json TEXT,
        reviewer TEXT,
        file_statuses_json TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        reviewed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_code_rev_proj ON code_reviews(project_id);
      CREATE INDEX IF NOT EXISTS idx_code_rev_exec ON code_reviews(execution_id);

      CREATE TABLE IF NOT EXISTS review_comments (
        id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        line_number INTEGER,
        diff_hunk TEXT,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        parent_comment_id TEXT,
        created_at INTEGER NOT NULL,
        resolved_at INTEGER,
        FOREIGN KEY(review_id) REFERENCES code_reviews(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_rev_comm_rev ON review_comments(review_id);
      CREATE INDEX IF NOT EXISTS idx_rev_comm_proj ON review_comments(project_id);

      -- Centralized MCP Infrastructure (Phase 1)
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT DEFAULT '',
        transport TEXT NOT NULL,
        command TEXT,
        args_json TEXT DEFAULT '[]',
        env_keys_json TEXT DEFAULT '[]',
        url TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'disconnected',
        error_message TEXT,
        tools_cache_json TEXT DEFAULT '[]',
        auth_type TEXT NOT NULL DEFAULT 'none',
        auth_config_json TEXT DEFAULT '{}',
        agent_permissions_json TEXT DEFAULT '{"all":true,"allowedAgents":[]}',
        project_scope TEXT,
        auto_reconnect INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled);
      CREATE INDEX IF NOT EXISTS idx_mcp_servers_project ON mcp_servers(project_scope);

      CREATE TABLE IF NOT EXISTS mcp_audit_logs (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        server_name TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        agent_id TEXT DEFAULT 'system',
        status TEXT NOT NULL,
        duration_ms INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL,
        error_message TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_mcp_audit_server ON mcp_audit_logs(server_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_audit_timestamp ON mcp_audit_logs(timestamp);

      CREATE TABLE IF NOT EXISTS mcp_connection_events (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        server_name TEXT NOT NULL,
        event_type TEXT NOT NULL,
        latency_ms INTEGER,
        error_message TEXT,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_mcp_conn_server ON mcp_connection_events(server_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_conn_timestamp ON mcp_connection_events(timestamp);

      -- Ecosystem Multi-Agent Task Tracing & Correlation
      CREATE TABLE IF NOT EXISTS task_traces (
        trace_id TEXT PRIMARY KEY,
        orchestration_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        task_title TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        role TEXT NOT NULL,
        worktree_path TEXT,
        spans_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'running',
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration_ms INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_traces_task ON task_traces(task_id);
      CREATE INDEX IF NOT EXISTS idx_traces_orch ON task_traces(orchestration_id);
    `);

    try {
      db.exec(`ALTER TABLE orchestration_tasks ADD COLUMN trace_id TEXT`);
    } catch {}

    try {
      db.exec(`ALTER TABLE orchestrations ADD COLUMN trace_id TEXT`);
    } catch {}

    try {
      db.exec(`ALTER TABLE mcp_audit_logs ADD COLUMN task_id TEXT`);
    } catch {}

    try {
      db.exec(`ALTER TABLE mcp_audit_logs ADD COLUMN orchestration_id TEXT`);
    } catch {}

    try {
      db.exec(`ALTER TABLE mcp_audit_logs ADD COLUMN trace_id TEXT`);
    } catch {}

    try {
      db.exec(`ALTER TABLE mcp_servers ADD COLUMN last_activity_at INTEGER`);
    } catch {}

    try {
      db.exec(`ALTER TABLE mcp_servers ADD COLUMN last_latency_ms INTEGER`);
    } catch {}

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

      -- Pre-production performance composite indices
      CREATE INDEX IF NOT EXISTS idx_orch_tasks_status ON orchestration_tasks(status, orchestration_id);
      CREATE INDEX IF NOT EXISTS idx_cli_sess_status ON cli_sessions(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_traces_status ON task_traces(status, started_at);

      -- Project Intelligence Engine (Phase 9)
      CREATE TABLE IF NOT EXISTS project_intelligence (
        project_id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        architecture_style TEXT NOT NULL DEFAULT 'modular-monolith',
        architecture_summary TEXT,
        tech_stack_json TEXT NOT NULL DEFAULT '{}',
        monorepo_info_json TEXT NOT NULL DEFAULT '{}',
        conventions_json TEXT NOT NULL DEFAULT '[]',
        health_score INTEGER NOT NULL DEFAULT 100,
        health_findings_json TEXT NOT NULL DEFAULT '[]',
        modules_json TEXT NOT NULL DEFAULT '[]',
        entry_points_json TEXT NOT NULL DEFAULT '[]',
        last_analyzed_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_proj_intel_analyzed ON project_intelligence(last_analyzed_at);

      CREATE TABLE IF NOT EXISTS project_knowledge_entries (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('architecture', 'tech_stack', 'convention', 'decision', 'constraint', 'terminology', 'git_context', 'file_importance')),
        key TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 1.0,
        source TEXT NOT NULL CHECK(source IN ('observed', 'inferred', 'agent_summary', 'user_decision')),
        source_path TEXT,
        is_confirmed INTEGER NOT NULL DEFAULT 1,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_proj_know_proj_cat ON project_knowledge_entries(project_id, category);
      CREATE INDEX IF NOT EXISTS idx_proj_know_key ON project_knowledge_entries(project_id, key);

      -- Migration 008: Autonomous Engineering Intelligence Plans
      CREATE TABLE IF NOT EXISTS autonomous_plans (
        id TEXT PRIMARY KEY,
        orchestration_id TEXT NOT NULL UNIQUE,
        project_id TEXT,
        user_goal TEXT NOT NULL,
        intent TEXT NOT NULL,
        category TEXT NOT NULL,
        complexity TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        plan_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_plan_orch ON autonomous_plans(orchestration_id);

      -- Migration 009: Continuous Engineering Intelligence
      CREATE TABLE IF NOT EXISTS engineering_analysis_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        project_path TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'incremental',
        status TEXT NOT NULL DEFAULT 'running',
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        categories_json TEXT NOT NULL DEFAULT '[]',
        findings_generated_count INTEGER NOT NULL DEFAULT 0,
        new_findings_count INTEGER NOT NULL DEFAULT 0,
        resolved_findings_count INTEGER NOT NULL DEFAULT 0,
        skip_reason TEXT,
        error_message TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_eng_runs_proj ON engineering_analysis_runs(project_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_eng_runs_status ON engineering_analysis_runs(status);

      CREATE TABLE IF NOT EXISTS engineering_findings (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        project_path TEXT NOT NULL,
        detection_timestamp INTEGER NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 1.0,
        affected_files_json TEXT NOT NULL DEFAULT '[]',
        evidence TEXT NOT NULL,
        explanation TEXT NOT NULL,
        baseline_comparison_json TEXT,
        suggested_remediation TEXT NOT NULL,
        related_historical_ids_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'new',
        effort_category TEXT,
        technical_debt_score REAL,
        user_dismissed INTEGER NOT NULL DEFAULT 0,
        user_dismissal_reason TEXT,
        resolved_at INTEGER,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_eng_find_proj_cat ON engineering_findings(project_id, category);
      CREATE INDEX IF NOT EXISTS idx_eng_find_status ON engineering_findings(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_eng_find_sev ON engineering_findings(project_id, severity);

      CREATE TABLE IF NOT EXISTS engineering_finding_events (
        id TEXT PRIMARY KEY,
        finding_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        comment TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY(finding_id) REFERENCES engineering_findings(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_eng_find_events_find ON engineering_finding_events(finding_id);

      CREATE TABLE IF NOT EXISTS engineering_metric_snapshots (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        methodology_version TEXT NOT NULL DEFAULT '1.0.0',
        overall_health_score INTEGER NOT NULL,
        architecture_score INTEGER NOT NULL,
        technical_debt_score INTEGER NOT NULL,
        performance_score INTEGER NOT NULL,
        security_score INTEGER NOT NULL,
        testing_score INTEGER NOT NULL,
        agent_pass_rate REAL NOT NULL,
        active_findings_json TEXT NOT NULL,
        total_open_debt_items INTEGER NOT NULL,
        total_recommendations_active INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_eng_snapshots_proj ON engineering_metric_snapshots(project_id, timestamp DESC);

      CREATE TABLE IF NOT EXISTS engineering_recommendations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        project_path TEXT NOT NULL,
        title TEXT NOT NULL,
        problem TEXT NOT NULL,
        supporting_evidence TEXT NOT NULL,
        expected_impact TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 1.0,
        estimated_effort TEXT NOT NULL DEFAULT 'medium',
        priority TEXT NOT NULL DEFAULT 'medium',
        category TEXT NOT NULL,
        related_finding_ids_json TEXT NOT NULL DEFAULT '[]',
        suggested_next_action TEXT NOT NULL,
        task_goal_prompt TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_eng_rec_proj ON engineering_recommendations(project_id, status);

      CREATE TABLE IF NOT EXISTS engineering_recommendation_feedback (
        id TEXT PRIMARY KEY,
        recommendation_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        feedback TEXT NOT NULL,
        comment TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY(recommendation_id) REFERENCES engineering_recommendations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_eng_rec_feedback ON engineering_recommendation_feedback(recommendation_id);

      CREATE TABLE IF NOT EXISTS engineering_baselines (
        project_id TEXT PRIMARY KEY,
        baseline_hash TEXT NOT NULL,
        methodology_version TEXT NOT NULL DEFAULT '1.0.0',
        baseline_data_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS engineering_config (
        project_id TEXT PRIMARY KEY,
        config_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Record tracked migrations in the migration ledger
    this.recordMigration(db, 1, '001_core_baseline');
    this.recordMigration(db, 2, '002_enterprise_and_analytics');
    this.recordMigration(db, 3, '003_project_explorer_and_reviews');
    this.recordMigration(db, 4, '004_mcp_and_task_tracing');
    this.recordMigration(db, 5, '005_project_customizations_and_states');
    this.recordMigration(db, 6, '006_pre_production_hardening');
    this.recordMigration(db, 7, '007_project_intelligence_engine');
    this.recordMigration(db, 8, '008_autonomous_engineering_intelligence');
    this.recordMigration(db, 9, '009_continuous_engineering_intelligence');
  }

  private recordMigration(db: Database.Database, version: number, name: string): void {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
        VALUES (?, ?, ?)
      `).run(version, name, Date.now());
    } catch {}
  }

  public getAppliedMigrations(): Array<{ version: number; name: string; appliedAt: number }> {
    const db = this.getAppDb();
    try {
      const rows = db.prepare(`SELECT version, name, applied_at as appliedAt FROM schema_migrations ORDER BY version ASC`).all() as any[];
      return rows;
    } catch {
      return [];
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

  public isInitialized(): boolean {
    return this.appDb !== null;
  }

  public getAppDb(): Database.Database {
    if (!this.appDb) {
      this.initialize();
    }
    return this.appDb!;
  }

  public getIndexDb(): Database.Database {
    if (!this.indexDb) {
      this.initialize();
    }
    return this.indexDb!;
  }

  public getSettings(): WorkspaceConfig {
    const db = this.getAppDb();
    const row = db.prepare('SELECT * FROM workspaces LIMIT 1').get() as any;

    if (!row) {
      const defaultSettings: WorkspaceConfig = {
        id: 'default-workspace',
        name: 'Default Workspace',
        uiMode: 'simple',
        theme: 'glass',
        autoIndex: true,
        fileIconTheme: 'material',
        discordRpcEnabled: true
      };
      db.prepare(`
        INSERT INTO workspaces (id, name, ui_mode, theme, auto_index, file_icon_theme, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        defaultSettings.id,
        defaultSettings.name,
        defaultSettings.uiMode,
        defaultSettings.theme,
        defaultSettings.autoIndex ? 1 : 0,
        defaultSettings.fileIconTheme,
        Date.now(),
        Date.now()
      );
      return defaultSettings;
    }

    // Safe migration: preserve existing selections ('material', 'minimal'); fallback to 'material' for unconfigured or deprecated rows
    const storedIconTheme = row.file_icon_theme;
    const resolvedIconTheme = ['material', 'minimal'].includes(storedIconTheme)
      ? storedIconTheme
      : 'material';

    // Safe theme migration: preserve 'glass', 'solid', 'light'; fallback invalid to 'glass'
    const storedTheme = row.theme;
    const resolvedTheme = ['glass', 'solid', 'light'].includes(storedTheme)
      ? storedTheme
      : (storedTheme === 'solid' ? 'solid' : 'glass');

    return {
      id: row.id,
      name: row.name,
      currentProjectId: row.current_project_id || undefined,
      uiMode: row.ui_mode as any,
      theme: resolvedTheme as any,
      autoIndex: Boolean(row.auto_index),
      fileIconTheme: resolvedIconTheme,
      showGitFileColors: row.show_git_file_colors !== undefined ? Boolean(row.show_git_file_colors) : true,
      discordRpcEnabled: row.discord_rpc_enabled !== null && row.discord_rpc_enabled !== undefined ? Boolean(row.discord_rpc_enabled) : true,
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
    if (project.id && project.id.startsWith('wt-')) {
      return;
    }
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
    try {
      db.prepare("DELETE FROM projects WHERE id LIKE 'wt-%'").run();
    } catch {
      // Ignore if table locked
    }
    const rows = db.prepare("SELECT * FROM projects WHERE id NOT LIKE 'wt-%' ORDER BY last_opened_at DESC LIMIT 20").all() as any[];
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

  public deleteSecret(key: string): boolean {
    const db = this.getAppDb();
    const res = db.prepare('DELETE FROM secrets_store WHERE key = ?').run(key);
    return res.changes > 0;
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

  public saveAutonomousPlan(plan: AutonomousPlan, projectId?: string): void {
    const db = this.getAppDb();
    const id = `plan-${plan.orchestrationId}`;
    db.prepare(`
      INSERT INTO autonomous_plans (
        id, orchestration_id, project_id, user_goal, intent,
        category, complexity, risk_level, plan_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(orchestration_id) DO UPDATE SET
        user_goal = excluded.user_goal,
        intent = excluded.intent,
        category = excluded.category,
        complexity = excluded.complexity,
        risk_level = excluded.risk_level,
        plan_json = excluded.plan_json
    `).run(
      id,
      plan.orchestrationId,
      projectId || null,
      plan.userGoal,
      plan.intent,
      plan.category,
      plan.complexity,
      plan.riskLevel,
      JSON.stringify(plan),
      plan.createdAt || Date.now()
    );
  }

  public getAutonomousPlan(orchestrationId: string): AutonomousPlan | null {
    const db = this.getAppDb();
    const row = db.prepare(`SELECT plan_json FROM autonomous_plans WHERE orchestration_id = ?`).get(orchestrationId) as any;
    if (!row || !row.plan_json) return null;
    try {
      return JSON.parse(row.plan_json) as AutonomousPlan;
    } catch {
      return null;
    }
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
        review_feedback, review_status, error_message, created_at, started_at, completed_at, trace_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        completed_at = excluded.completed_at,
        trace_id = COALESCE(excluded.trace_id, orchestration_tasks.trace_id)
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
      task.completedAt || null,
      task.traceId || null
    );
  }

  public getOrchestrationTasks(orchestrationId: string): OrchestrationTask[] {
    const db = this.getAppDb();
    const rows = db.prepare(`SELECT * FROM orchestration_tasks WHERE orchestration_id = ? ORDER BY created_at ASC`).all(orchestrationId) as any[];
    return rows.map((r) => ({
      id: r.id,
      orchestrationId: r.orchestration_id,
      traceId: r.trace_id || undefined,
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
      traceId: r.trace_id || undefined,
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

    if (updates.traceId !== undefined) {
      sets.push('trace_id = ?');
      params.push(updates.traceId);
    }
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
    const now = Date.now();
    // 1. Mark active orchestrations as 'interrupted' rather than blind failure
    const activeOrchs = db.prepare(`SELECT id FROM orchestrations WHERE status IN ('planning', 'running', 'reviewing')`).all() as any[];
    for (const o of activeOrchs) {
      db.prepare(`UPDATE orchestrations SET status = 'failed', error_message = 'Interrupted by application shutdown/restart', completed_at = ? WHERE id = ?`).run(
        now,
        o.id
      );
    }

    // 2. Mark active tasks: if worktree exists, mark requires_intervention so uncommitted work is inspected
    const activeTasks = db.prepare(`SELECT id, title, worktree_path FROM orchestration_tasks WHERE status IN ('running', 'ready', 'reviewing', 'waiting_approval')`).all() as any[];
    for (const t of activeTasks) {
      let status = 'interrupted';
      let msg = 'Interrupted by application restart';
      if (t.worktree_path && fs.existsSync(t.worktree_path)) {
        status = 'requires_intervention';
        msg = 'Interrupted with active worktree. Verify status before re-queueing.';
      }
      db.prepare(`UPDATE orchestration_tasks SET status = ?, error_message = ?, completed_at = ? WHERE id = ?`).run(
        status,
        msg,
        now,
        t.id
      );
    }

    // 3. Mark active task traces as interrupted
    try {
      db.prepare(`UPDATE task_traces SET status = 'interrupted', completed_at = ? WHERE status = 'running'`).run(now);
    } catch {}

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
  // Project Explorer: Executions & Changes
  // ==========================================

  public upsertProjectExecution(execution: ProjectExecution): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO project_executions (
        id, project_id, prompt_id, prompt_text, provider, model, status,
        started_at, completed_at, branch, base_commit, resulting_commit,
        files_changed_count, additions, deletions, is_manual
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        completed_at = excluded.completed_at,
        branch = excluded.branch,
        resulting_commit = excluded.resulting_commit,
        files_changed_count = excluded.files_changed_count,
        additions = excluded.additions,
        deletions = excluded.deletions,
        is_manual = excluded.is_manual
    `).run(
      execution.id,
      execution.projectId,
      execution.promptId || null,
      execution.promptText,
      execution.provider || null,
      execution.model || null,
      execution.status,
      execution.startedAt,
      execution.completedAt || null,
      execution.branch || null,
      execution.baseCommit || null,
      execution.resultingCommit || null,
      execution.filesChangedCount || 0,
      execution.additions || 0,
      execution.deletions || 0,
      execution.isManual ? 1 : 0
    );
  }

  public updateProjectExecution(id: string, updates: Partial<ProjectExecution>): void {
    const db = this.getAppDb();
    const sets: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      sets.push('status = ?');
      values.push(updates.status);
    }
    if (updates.completedAt !== undefined) {
      sets.push('completed_at = ?');
      values.push(updates.completedAt);
    }
    if (updates.filesChangedCount !== undefined) {
      sets.push('files_changed_count = ?');
      values.push(updates.filesChangedCount);
    }
    if (updates.additions !== undefined) {
      sets.push('additions = ?');
      values.push(updates.additions);
    }
    if (updates.deletions !== undefined) {
      sets.push('deletions = ?');
      values.push(updates.deletions);
    }
    if (updates.branch !== undefined) {
      sets.push('branch = ?');
      values.push(updates.branch);
    }
    if (updates.resultingCommit !== undefined) {
      sets.push('resulting_commit = ?');
      values.push(updates.resultingCommit);
    }
    if (updates.isManual !== undefined) {
      sets.push('is_manual = ?');
      values.push(updates.isManual ? 1 : 0);
    }

    if (sets.length === 0) return;
    values.push(id);
    db.prepare(`UPDATE project_executions SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  public getProjectExecution(id: string): ProjectExecution | null {
    const db = this.getAppDb();
    const row = db.prepare(`SELECT * FROM project_executions WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      promptId: row.prompt_id || undefined,
      promptText: row.prompt_text,
      provider: row.provider || undefined,
      model: row.model || undefined,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      branch: row.branch || undefined,
      baseCommit: row.base_commit || undefined,
      resultingCommit: row.resulting_commit || undefined,
      filesChangedCount: row.files_changed_count || 0,
      additions: row.additions || 0,
      deletions: row.deletions || 0,
      isManual: Boolean(row.is_manual)
    };
  }

  public listProjectExecutions(projectId: string): ProjectExecution[] {
    const db = this.getAppDb();
    const rows = db.prepare(`
      SELECT * FROM project_executions
      WHERE project_id = ?
      ORDER BY started_at DESC
      LIMIT 100
    `).all(projectId) as any[];

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      promptId: row.prompt_id || undefined,
      promptText: row.prompt_text,
      provider: row.provider || undefined,
      model: row.model || undefined,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      branch: row.branch || undefined,
      baseCommit: row.base_commit || undefined,
      resultingCommit: row.resulting_commit || undefined,
      filesChangedCount: row.files_changed_count || 0,
      additions: row.additions || 0,
      deletions: row.deletions || 0,
      isManual: Boolean(row.is_manual)
    }));
  }

  public deleteProjectExecution(id: string): boolean {
    const db = this.getAppDb();
    const res = db.prepare(`DELETE FROM project_executions WHERE id = ?`).run(id);
    return res.changes > 0;
  }

  public insertExecutionFileChanges(changes: ExecutionFileChange[]): void {
    if (changes.length === 0) return;
    const db = this.getAppDb();
    const stmt = db.prepare(`
      INSERT INTO execution_file_changes (
        id, execution_id, project_id, file_path, change_type,
        previous_content, current_content, diff, additions, deletions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        change_type = excluded.change_type,
        previous_content = excluded.previous_content,
        current_content = excluded.current_content,
        diff = excluded.diff,
        additions = excluded.additions,
        deletions = excluded.deletions
    `);

    const insertMany = db.transaction((items: ExecutionFileChange[]) => {
      for (const item of items) {
        stmt.run(
          item.id,
          item.executionId,
          item.projectId,
          item.filePath,
          item.changeType,
          item.previousContent || null,
          item.currentContent || null,
          item.diff,
          item.additions || 0,
          item.deletions || 0
        );
      }
    });

    insertMany(changes);
  }

  public getExecutionFileChanges(executionId: string): ExecutionFileChange[] {
    const db = this.getAppDb();
    const rows = db.prepare(`
      SELECT * FROM execution_file_changes
      WHERE execution_id = ?
      ORDER BY file_path ASC
    `).all(executionId) as any[];

    return rows.map((row) => ({
      id: row.id,
      executionId: row.execution_id,
      projectId: row.project_id,
      filePath: row.file_path,
      changeType: row.change_type,
      previousContent: row.previous_content || undefined,
      currentContent: row.current_content || undefined,
      diff: row.diff,
      additions: row.additions || 0,
      deletions: row.deletions || 0
    }));
  }

  // ==========================================
  // Project Explorer: Code Reviews & Comments
  // ==========================================

  public upsertCodeReview(review: CodeReview): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO code_reviews (
        id, project_id, execution_id, status, summary,
        ai_analysis_json, reviewer, file_statuses_json, created_at, updated_at, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        summary = excluded.summary,
        ai_analysis_json = excluded.ai_analysis_json,
        reviewer = excluded.reviewer,
        file_statuses_json = excluded.file_statuses_json,
        updated_at = excluded.updated_at,
        reviewed_at = excluded.reviewed_at
    `).run(
      review.id,
      review.projectId,
      review.executionId || null,
      review.status,
      review.summary || null,
      review.aiAnalysis ? JSON.stringify(review.aiAnalysis) : null,
      review.reviewer || null,
      review.fileStatuses ? JSON.stringify(review.fileStatuses) : '{}',
      review.createdAt,
      review.updatedAt,
      review.reviewedAt || null
    );
  }

  public getCodeReview(id: string): CodeReview | null {
    const db = this.getAppDb();
    const row = db.prepare(`SELECT * FROM code_reviews WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      executionId: row.execution_id || undefined,
      status: row.status,
      summary: row.summary || undefined,
      aiAnalysis: row.ai_analysis_json ? JSON.parse(row.ai_analysis_json) : undefined,
      reviewer: row.reviewer || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      reviewedAt: row.reviewed_at || undefined,
      fileStatuses: row.file_statuses_json ? JSON.parse(row.file_statuses_json) : undefined
    };
  }

  public getCodeReviewByProject(projectId: string): CodeReview | null {
    const db = this.getAppDb();
    const row = db.prepare(`
      SELECT * FROM code_reviews
      WHERE project_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(projectId) as any;

    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      executionId: row.execution_id || undefined,
      status: row.status,
      summary: row.summary || undefined,
      aiAnalysis: row.ai_analysis_json ? JSON.parse(row.ai_analysis_json) : undefined,
      reviewer: row.reviewer || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      reviewedAt: row.reviewed_at || undefined,
      fileStatuses: row.file_statuses_json ? JSON.parse(row.file_statuses_json) : undefined
    };
  }

  public createReviewComment(comment: ReviewComment): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO review_comments (
        id, review_id, project_id, file_path, line_number,
        diff_hunk, content, author, status, parent_comment_id, created_at, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      comment.id,
      comment.reviewId,
      comment.projectId,
      comment.filePath,
      comment.lineNumber || null,
      comment.diffHunk || null,
      comment.content,
      comment.author,
      comment.status || 'open',
      comment.parentCommentId || null,
      comment.createdAt,
      comment.resolvedAt || null
    );
  }

  public listReviewComments(reviewId: string): ReviewComment[] {
    const db = this.getAppDb();
    const rows = db.prepare(`
      SELECT * FROM review_comments
      WHERE review_id = ?
      ORDER BY created_at ASC
    `).all(reviewId) as any[];

    return rows.map((row) => ({
      id: row.id,
      reviewId: row.review_id,
      projectId: row.project_id,
      filePath: row.file_path,
      lineNumber: row.line_number || undefined,
      diffHunk: row.diff_hunk || undefined,
      content: row.content,
      author: row.author,
      status: row.status,
      parentCommentId: row.parent_comment_id || undefined,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at || undefined
    }));
  }

  public resolveReviewComment(commentId: string, resolved: boolean): boolean {
    const db = this.getAppDb();
    const res = db.prepare(`
      UPDATE review_comments
      SET status = ?, resolved_at = ?
      WHERE id = ?
    `).run(resolved ? 'resolved' : 'open', resolved ? Date.now() : null, commentId);
    return res.changes > 0;
  }

  public deleteReviewComment(commentId: string): boolean {
    const db = this.getAppDb();
    const res = db.prepare(`DELETE FROM review_comments WHERE id = ?`).run(commentId);
    return res.changes > 0;
  }

  // ==========================================
  // Centralized MCP Infrastructure Methods
  // ==========================================

  public saveMCPServer(server: MCPServerConfig, envKeys: string[] = []): void {
    const db = this.getAppDb();
    const stmt = db.prepare(`
      INSERT INTO mcp_servers (
        id, name, description, transport, command, args_json, env_keys_json, url,
        enabled, status, error_message, tools_cache_json, auth_type, auth_config_json,
        agent_permissions_json, project_scope, auto_reconnect, created_at, updated_at
      ) VALUES (
        @id, @name, @description, @transport, @command, @args_json, @env_keys_json, @url,
        @enabled, @status, @error_message, @tools_cache_json, @auth_type, @auth_config_json,
        @agent_permissions_json, @project_scope, @auto_reconnect, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        transport = excluded.transport,
        command = excluded.command,
        args_json = excluded.args_json,
        env_keys_json = excluded.env_keys_json,
        url = excluded.url,
        enabled = excluded.enabled,
        status = excluded.status,
        error_message = excluded.error_message,
        tools_cache_json = excluded.tools_cache_json,
        auth_type = excluded.auth_type,
        auth_config_json = excluded.auth_config_json,
        agent_permissions_json = excluded.agent_permissions_json,
        project_scope = excluded.project_scope,
        auto_reconnect = excluded.auto_reconnect,
        updated_at = excluded.updated_at
    `);

    stmt.run({
      id: server.id,
      name: server.name,
      description: server.description || '',
      transport: server.transport,
      command: server.command || null,
      args_json: JSON.stringify(server.args || []),
      env_keys_json: JSON.stringify(envKeys),
      url: server.url || null,
      enabled: server.enabled ? 1 : 0,
      status: server.status,
      error_message: server.errorMessage || null,
      tools_cache_json: JSON.stringify(server.tools || []),
      auth_type: server.authType || 'none',
      auth_config_json: JSON.stringify(server.authConfig || {}),
      agent_permissions_json: JSON.stringify(server.agentPermissions || { all: true, allowedAgents: [] }),
      project_scope: server.projectScope || null,
      auto_reconnect: server.autoReconnect ? 1 : 0,
      created_at: server.createdAt || Date.now(),
      updated_at: Date.now()
    });
  }

  public getMCPServer(id: string): MCPServerConfig | null {
    const db = this.getAppDb();
    const row = db.prepare(`SELECT * FROM mcp_servers WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return this.mapMCPServerRow(row);
  }

  public getMCPServerByName(name: string): MCPServerConfig | null {
    const db = this.getAppDb();
    const row = db.prepare(`SELECT * FROM mcp_servers WHERE name = ?`).get(name) as any;
    if (!row) return null;
    return this.mapMCPServerRow(row);
  }

  public listMCPServers(projectScope?: string): MCPServerConfig[] {
    const db = this.getAppDb();
    let rows: any[] = [];
    if (projectScope) {
      rows = db.prepare(`
        SELECT * FROM mcp_servers
        WHERE project_scope IS NULL OR project_scope = '' OR project_scope = ?
        ORDER BY name ASC
      `).all(projectScope);
    } else {
      rows = db.prepare(`SELECT * FROM mcp_servers ORDER BY name ASC`).all();
    }
    return rows.map((r) => this.mapMCPServerRow(r));
  }

  public deleteMCPServer(id: string): boolean {
    const db = this.getAppDb();
    const res = db.prepare(`DELETE FROM mcp_servers WHERE id = ?`).run(id);
    return res.changes > 0;
  }

  public updateMCPServerStatus(
    id: string,
    status: MCPServerStatus,
    tools?: MCPToolDefinition[],
    errorMessage?: string
  ): void {
    const db = this.getAppDb();
    if (tools !== undefined) {
      db.prepare(`
        UPDATE mcp_servers
        SET status = ?, tools_cache_json = ?, error_message = ?, updated_at = ?
        WHERE id = ?
      `).run(status, JSON.stringify(tools), errorMessage || null, Date.now(), id);
    } else {
      db.prepare(`
        UPDATE mcp_servers
        SET status = ?, error_message = ?, updated_at = ?
        WHERE id = ?
      `).run(status, errorMessage || null, Date.now(), id);
    }
  }

  public getMCPServerEnvKeys(id: string): string[] {
    const db = this.getAppDb();
    const row = db.prepare(`SELECT env_keys_json FROM mcp_servers WHERE id = ?`).get(id) as any;
    if (!row || !row.env_keys_json) return [];
    try {
      return JSON.parse(row.env_keys_json);
    } catch {
      return [];
    }
  }

  public saveMCPAuditLog(entry: MCPAuditLogEntry): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO mcp_audit_logs (
        id, server_id, server_name, tool_name, agent_id, status, duration_ms, timestamp, error_message,
        task_id, orchestration_id, trace_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.serverId,
      entry.serverName,
      entry.toolName,
      entry.agentId || 'system',
      entry.status,
      entry.durationMs || 0,
      entry.timestamp || Date.now(),
      entry.errorMessage || null,
      entry.taskId || null,
      entry.orchestrationId || null,
      entry.traceId || null
    );
  }

  public listMCPAuditLogs(serverId?: string, limit: number = 50): MCPAuditLogEntry[] {
    const db = this.getAppDb();
    let rows: any[] = [];
    if (serverId) {
      rows = db.prepare(`
        SELECT * FROM mcp_audit_logs
        WHERE server_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(serverId, limit);
    } else {
      rows = db.prepare(`
        SELECT * FROM mcp_audit_logs
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(limit);
    }
    return rows.map((r) => ({
      id: r.id,
      serverId: r.server_id,
      serverName: r.server_name,
      toolName: r.tool_name,
      agentId: r.agent_id,
      status: r.status,
      durationMs: r.duration_ms,
      timestamp: r.timestamp,
      errorMessage: r.error_message || undefined,
      taskId: r.task_id || undefined,
      orchestrationId: r.orchestration_id || undefined,
      traceId: r.trace_id || undefined
    }));
  }

  public saveMCPConnectionEvent(event: MCPConnectionEvent): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO mcp_connection_events (
        id, server_id, server_name, event_type, latency_ms, error_message, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.serverId,
      event.serverName,
      event.eventType,
      event.latencyMs ?? null,
      event.errorMessage ?? null,
      event.timestamp || Date.now()
    );
  }

  public listMCPConnectionEvents(serverId?: string, limit: number = 50): MCPConnectionEvent[] {
    const db = this.getAppDb();
    let rows: any[] = [];
    if (serverId) {
      rows = db.prepare(`
        SELECT * FROM mcp_connection_events
        WHERE server_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(serverId, limit);
    } else {
      rows = db.prepare(`
        SELECT * FROM mcp_connection_events
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(limit);
    }
    return rows.map((r: any) => ({
      id: r.id,
      serverId: r.server_id,
      serverName: r.server_name,
      eventType: r.event_type,
      latencyMs: r.latency_ms ?? undefined,
      errorMessage: r.error_message || undefined,
      timestamp: r.timestamp
    }));
  }

  public queryMCPAuditLogs(filter?: MCPAuditLogFilter): { logs: MCPAuditLogEntry[]; total: number } {
    const db = this.getAppDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter?.serverId) {
      conditions.push('server_id = ?');
      params.push(filter.serverId);
    }
    if (filter?.agentId) {
      conditions.push('agent_id = ?');
      params.push(filter.agentId);
    }
    if (filter?.toolName) {
      conditions.push('tool_name = ?');
      params.push(filter.toolName);
    }
    if (filter?.status && filter.status !== 'all') {
      conditions.push('status = ?');
      params.push(filter.status);
    }
    if (filter?.fromTimestamp) {
      conditions.push('timestamp >= ?');
      params.push(filter.fromTimestamp);
    }
    if (filter?.toTimestamp) {
      conditions.push('timestamp <= ?');
      params.push(filter.toTimestamp);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM mcp_audit_logs ${whereClause}`).get(...params) as { count: number };
    const total = countRow?.count ?? 0;

    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const queryParams = [...params, limit, offset];

    const rows = db.prepare(`
      SELECT * FROM mcp_audit_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `).all(...queryParams) as any[];

    const logs: MCPAuditLogEntry[] = rows.map((r) => ({
      id: r.id,
      serverId: r.server_id,
      serverName: r.server_name,
      toolName: r.tool_name,
      agentId: r.agent_id,
      status: r.status,
      durationMs: r.duration_ms,
      timestamp: r.timestamp,
      errorMessage: r.error_message || undefined,
      taskId: r.task_id || undefined,
      orchestrationId: r.orchestration_id || undefined,
      traceId: r.trace_id || undefined
    }));

    return { logs, total };
  }

  public computeMCPObservabilityMetrics(fromTimestamp?: number): MCPObservabilitySummary {
    const db = this.getAppDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (fromTimestamp) {
      conditions.push('timestamp >= ?');
      params.push(fromTimestamp);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total counts by status
    const counts = db.prepare(`
      SELECT status, COUNT(*) as cnt
      FROM mcp_audit_logs
      ${whereClause}
      GROUP BY status
    `).all(...params) as { status: string; cnt: number }[];

    let totalExecutions = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    let deniedExecutions = 0;

    for (const c of counts) {
      totalExecutions += c.cnt;
      if (c.status === 'success') successfulExecutions = c.cnt;
      else if (c.status === 'error') failedExecutions = c.cnt;
      else if (c.status === 'denied') deniedExecutions = c.cnt;
    }

    // Durations for percentiles
    const durations = db.prepare(`
      SELECT duration_ms FROM mcp_audit_logs
      ${whereClause}
      ORDER BY duration_ms ASC
    `).all(...params).map((r: any) => Number(r.duration_ms) || 0);

    const medianDurationMs = durations.length === 0 ? 0 : durations[Math.floor(durations.length * 0.5)];
    const p95DurationMs = durations.length === 0 ? 0 : durations[Math.floor(durations.length * 0.95)];
    const sumDuration = durations.reduce((acc, val) => acc + val, 0);
    const avgDurationMs = durations.length === 0 ? 0 : Math.round(sumDuration / durations.length);

    // Slowest tools
    const slowestRows = db.prepare(`
      SELECT tool_name, server_name, AVG(duration_ms) as avg_duration, COUNT(*) as call_count
      FROM mcp_audit_logs
      ${whereClause}
      GROUP BY tool_name, server_name
      ORDER BY avg_duration DESC
      LIMIT 5
    `).all(...params) as any[];

    const slowestTools = slowestRows.map((r) => ({
      toolName: r.tool_name,
      serverName: r.server_name,
      avgDurationMs: Math.round(Number(r.avg_duration) || 0),
      callCount: Number(r.call_count) || 0
    }));

    // Executions by Agent
    const agentRows = db.prepare(`
      SELECT agent_id, COUNT(*) as cnt
      FROM mcp_audit_logs
      ${whereClause}
      GROUP BY agent_id
    `).all(...params) as any[];
    const executionsByAgent: Record<string, number> = {};
    for (const r of agentRows) {
      executionsByAgent[r.agent_id || 'system'] = Number(r.cnt) || 0;
    }

    // Executions by Server
    const serverRows = db.prepare(`
      SELECT server_name, COUNT(*) as cnt
      FROM mcp_audit_logs
      ${whereClause}
      GROUP BY server_name
    `).all(...params) as any[];
    const executionsByServer: Record<string, number> = {};
    for (const r of serverRows) {
      executionsByServer[r.server_name] = Number(r.cnt) || 0;
    }

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      deniedExecutions,
      avgDurationMs,
      medianDurationMs,
      p95DurationMs,
      activeServersCount: 0,
      activeSessionsCount: 0,
      concurrentExecutions: 0,
      slowestTools,
      executionsByAgent,
      executionsByServer
    };
  }

  public pruneMCPAuditLogs(retentionDays: number = 30, maxRows: number = 10000): number {
    const db = this.getAppDb();
    const cutoffTime = Date.now() - retentionDays * 86400 * 1000;

    let deleted = 0;
    const deleteOldResult = db.prepare(`
      DELETE FROM mcp_audit_logs WHERE timestamp < ?
    `).run(cutoffTime);
    deleted += deleteOldResult.changes;

    db.prepare(`
      DELETE FROM mcp_connection_events WHERE timestamp < ?
    `).run(cutoffTime);

    // Limit table to maxRows if it exceeds
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM mcp_audit_logs`).get() as { count: number };
    if (countRow && countRow.count > maxRows) {
      const excess = countRow.count - maxRows;
      const deleteExcessResult = db.prepare(`
        DELETE FROM mcp_audit_logs
        WHERE id IN (
          SELECT id FROM mcp_audit_logs
          ORDER BY timestamp ASC
          LIMIT ?
        )
      `).run(excess);
      deleted += deleteExcessResult.changes;
    }

    return deleted;
  }

  public updateMCPServerActivity(id: string, latencyMs?: number): void {
    const db = this.getAppDb();
    const now = Date.now();
    if (latencyMs !== undefined) {
      db.prepare(`
        UPDATE mcp_servers
        SET last_activity_at = ?, last_latency_ms = ?, updated_at = ?
        WHERE id = ?
      `).run(now, latencyMs, now, id);
    } else {
      db.prepare(`
        UPDATE mcp_servers
        SET last_activity_at = ?, updated_at = ?
        WHERE id = ?
      `).run(now, now, id);
    }
  }

  private mapMCPServerRow(row: any): MCPServerConfig {
    let args: string[] = [];
    let tools: MCPToolDefinition[] = [];
    let authConfig: any = {};
    let agentPermissions: any = { all: true, allowedAgents: [] };

    try {
      args = row.args_json ? JSON.parse(row.args_json) : [];
    } catch {}

    try {
      tools = row.tools_cache_json ? JSON.parse(row.tools_cache_json) : [];
    } catch {}

    try {
      authConfig = row.auth_config_json ? JSON.parse(row.auth_config_json) : {};
    } catch {}

    try {
      agentPermissions = row.agent_permissions_json ? JSON.parse(row.agent_permissions_json) : { all: true, allowedAgents: [] };
    } catch {}

    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      transport: row.transport,
      command: row.command || undefined,
      args,
      url: row.url || undefined,
      enabled: Boolean(row.enabled),
      status: row.status,
      errorMessage: row.error_message || undefined,
      tools,
      authType: row.auth_type,
      authConfig,
      agentPermissions,
      projectScope: row.project_scope || null,
      autoReconnect: Boolean(row.auto_reconnect),
      lastActivityAt: row.last_activity_at || undefined,
      lastLatencyMs: row.last_latency_ms != null ? Number(row.last_latency_ms) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public saveTaskTrace(trace: TaskExecutionTrace): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO task_traces (
        trace_id, orchestration_id, task_id, task_title, agent_id, role,
        worktree_path, spans_json, status, started_at, completed_at, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(trace_id) DO UPDATE SET
        spans_json = excluded.spans_json,
        status = excluded.status,
        completed_at = excluded.completed_at,
        duration_ms = excluded.duration_ms
    `).run(
      trace.traceId,
      trace.orchestrationId,
      trace.taskId,
      trace.taskTitle,
      trace.agentId,
      trace.role,
      trace.worktreePath || null,
      JSON.stringify(trace.spans || []),
      trace.status,
      trace.startedAt,
      trace.completedAt || null,
      trace.durationMs || 0
    );
  }

  public getTaskTrace(taskId: string): TaskExecutionTrace | null {
    const db = this.getAppDb();
    const row = db.prepare(`SELECT * FROM task_traces WHERE task_id = ? OR trace_id = ?`).get(taskId, taskId) as any;
    if (!row) return null;
    return {
      traceId: row.trace_id,
      orchestrationId: row.orchestration_id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      agentId: row.agent_id,
      role: row.role,
      worktreePath: row.worktree_path || undefined,
      spans: JSON.parse(row.spans_json || '[]'),
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      durationMs: row.duration_ms
    };
  }

  public listTaskTraces(orchestrationId?: string, limit: number = 50): TaskExecutionTrace[] {
    const db = this.getAppDb();
    let rows: any[] = [];
    if (orchestrationId) {
      rows = db.prepare(`SELECT * FROM task_traces WHERE orchestration_id = ? ORDER BY started_at DESC LIMIT ?`).all(orchestrationId, limit);
    } else {
      rows = db.prepare(`SELECT * FROM task_traces ORDER BY started_at DESC LIMIT ?`).all(limit);
    }
    return rows.map((row) => ({
      traceId: row.trace_id,
      orchestrationId: row.orchestration_id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      agentId: row.agent_id,
      role: row.role,
      worktreePath: row.worktree_path || undefined,
      spans: JSON.parse(row.spans_json || '[]'),
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      durationMs: row.duration_ms
    }));
  }

  // ==========================================
  // Project Intelligence & Knowledge Persistence (Phase 9)
  // ==========================================

  public upsertProjectIntelligence(data: ProjectIntelligenceData): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO project_intelligence (
        project_id, project_path, architecture_style, architecture_summary,
        tech_stack_json, monorepo_info_json, conventions_json,
        health_score, health_findings_json, modules_json, entry_points_json,
        last_analyzed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        project_path = excluded.project_path,
        architecture_style = excluded.architecture_style,
        architecture_summary = excluded.architecture_summary,
        tech_stack_json = excluded.tech_stack_json,
        monorepo_info_json = excluded.monorepo_info_json,
        conventions_json = excluded.conventions_json,
        health_score = excluded.health_score,
        health_findings_json = excluded.health_findings_json,
        modules_json = excluded.modules_json,
        entry_points_json = excluded.entry_points_json,
        last_analyzed_at = excluded.last_analyzed_at,
        updated_at = excluded.updated_at
    `).run(
      data.projectId,
      data.projectPath,
      data.architecture?.style || 'modular-monolith',
      data.architecture?.summary || '',
      JSON.stringify(data.techStack || {}),
      JSON.stringify(data.monorepo || {}),
      JSON.stringify(data.knowledgeEntries?.filter((k) => k.category === 'convention') || []),
      data.health?.overallScore ?? 100,
      JSON.stringify(data.health?.findings || []),
      JSON.stringify(data.architecture?.modules || []),
      JSON.stringify(data.architecture?.entryPoints || []),
      data.lastAnalyzedAt || Date.now(),
      Date.now()
    );
  }

  public getProjectIntelligence(projectIdOrPath: string): ProjectIntelligenceData | null {
    const db = this.getAppDb();
    const row = db.prepare(`
      SELECT * FROM project_intelligence
      WHERE project_id = ? OR project_path = ?
    `).get(projectIdOrPath, projectIdOrPath) as any;

    if (!row) return null;

    const knowledge = this.listKnowledgeEntries(row.project_id);
    const techStack = JSON.parse(row.tech_stack_json || '{}');
    const monorepo = JSON.parse(row.monorepo_info_json || '{}');
    const modules = JSON.parse(row.modules_json || '[]');
    const entryPoints = JSON.parse(row.entry_points_json || '[]');
    const healthFindings = JSON.parse(row.health_findings_json || '[]');

    return {
      projectId: row.project_id,
      projectPath: row.project_path,
      techStack,
      monorepo,
      architecture: {
        style: row.architecture_style || (monorepo.isMonorepo ? 'monorepo' : 'modular-monolith'),
        entryPoints,
        modules,
        circularDependencies: [],
        criticalPaths: [],
        summary: row.architecture_summary || ''
      },
      git: {
        branch: 'main',
        headCommit: '',
        commitMessage: '',
        isDirty: false,
        modifiedFiles: [],
        stagedFiles: [],
        untrackedFiles: [],
        activeWorktrees: [],
        hotspotFiles: []
      },
      health: {
        overallScore: row.health_score,
        categoryScores: {
          architecture: row.health_score,
          dependencies: row.health_score,
          testing: row.health_score,
          documentation: row.health_score,
          security: row.health_score,
          build: row.health_score
        },
        findings: healthFindings,
        evaluatedAt: row.last_analyzed_at
      },
      knowledgeEntries: knowledge,
      lastAnalyzedAt: row.last_analyzed_at
    };
  }

  public upsertKnowledgeEntry(entry: ProjectKnowledgeEntry): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO project_knowledge_entries (
        id, project_id, category, key, title, content,
        confidence, source, source_path, is_confirmed, metadata_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        confidence = excluded.confidence,
        source = excluded.source,
        source_path = excluded.source_path,
        is_confirmed = excluded.is_confirmed,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `).run(
      entry.id,
      entry.projectId,
      entry.category,
      entry.key,
      entry.title,
      entry.content,
      entry.confidence ?? 1.0,
      entry.source,
      entry.sourcePath || null,
      entry.isConfirmed ? 1 : 0,
      JSON.stringify(entry.metadata || {}),
      entry.createdAt || Date.now(),
      entry.updatedAt || Date.now()
    );
  }

  public listKnowledgeEntries(projectId: string, category?: KnowledgeCategory): ProjectKnowledgeEntry[] {
    const db = this.getAppDb();
    let query = `SELECT * FROM project_knowledge_entries WHERE project_id = ?`;
    const params: any[] = [projectId];
    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }
    query += ` ORDER BY updated_at DESC`;

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      category: r.category,
      key: r.key,
      title: r.title,
      content: r.content,
      confidence: r.confidence,
      source: r.source,
      sourcePath: r.source_path || undefined,
      isConfirmed: Boolean(r.is_confirmed),
      metadata: JSON.parse(r.metadata_json || '{}'),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public deleteKnowledgeEntry(id: string): boolean {
    const db = this.getAppDb();
    const result = db.prepare(`DELETE FROM project_knowledge_entries WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  // ==========================================
  // Continuous Engineering Intelligence (Phase 10)
  // ==========================================

  public saveEngineeringAnalysisRun(run: AnalysisRunRecord): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO engineering_analysis_runs (
        id, project_id, project_path, trigger_type, scope, status,
        started_at, completed_at, duration_ms, categories_json,
        findings_generated_count, new_findings_count, resolved_findings_count,
        skip_reason, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        completed_at = excluded.completed_at,
        duration_ms = excluded.duration_ms,
        findings_generated_count = excluded.findings_generated_count,
        new_findings_count = excluded.new_findings_count,
        resolved_findings_count = excluded.resolved_findings_count,
        skip_reason = excluded.skip_reason,
        error_message = excluded.error_message
    `).run(
      run.id,
      run.projectId,
      run.projectPath,
      run.triggerType,
      run.scope,
      run.status,
      run.startedAt,
      run.completedAt || null,
      run.durationMs || 0,
      JSON.stringify(run.categoriesAnalyzed || []),
      run.findingsGeneratedCount || 0,
      run.newFindingsCount || 0,
      run.resolvedFindingsCount || 0,
      run.skipReason || null,
      run.errorMessage || null
    );
  }

  public updateEngineeringAnalysisRun(id: string, updates: Partial<AnalysisRunRecord>): void {
    const db = this.getAppDb();
    const existing = db.prepare(`SELECT * FROM engineering_analysis_runs WHERE id = ?`).get(id) as any;
    if (!existing) return;

    db.prepare(`
      UPDATE engineering_analysis_runs SET
        status = ?,
        completed_at = ?,
        duration_ms = ?,
        findings_generated_count = ?,
        new_findings_count = ?,
        resolved_findings_count = ?,
        skip_reason = ?,
        error_message = ?
      WHERE id = ?
    `).run(
      updates.status || existing.status,
      updates.completedAt ?? existing.completed_at,
      updates.durationMs ?? existing.duration_ms,
      updates.findingsGeneratedCount ?? existing.findings_generated_count,
      updates.newFindingsCount ?? existing.new_findings_count,
      updates.resolvedFindingsCount ?? existing.resolved_findings_count,
      updates.skipReason ?? existing.skip_reason,
      updates.errorMessage ?? existing.error_message,
      id
    );
  }

  public getEngineeringAnalysisRun(id: string): AnalysisRunRecord | null {
    const db = this.getAppDb();
    const row = db.prepare(`SELECT * FROM engineering_analysis_runs WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      projectPath: row.project_path,
      triggerType: row.trigger_type,
      scope: row.scope,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      durationMs: row.duration_ms,
      categoriesAnalyzed: JSON.parse(row.categories_json || '[]'),
      findingsGeneratedCount: row.findings_generated_count,
      newFindingsCount: row.new_findings_count,
      resolvedFindingsCount: row.resolved_findings_count,
      skipReason: row.skip_reason || undefined,
      errorMessage: row.error_message || undefined
    };
  }

  public listEngineeringAnalysisRuns(projectId: string, limit = 50): AnalysisRunRecord[] {
    const db = this.getAppDb();
    const rows = db.prepare(`
      SELECT * FROM engineering_analysis_runs
      WHERE project_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `).all(projectId, limit) as any[];

    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      projectPath: r.project_path,
      triggerType: r.trigger_type,
      scope: r.scope,
      status: r.status,
      startedAt: r.started_at,
      completedAt: r.completed_at || undefined,
      durationMs: r.duration_ms,
      categoriesAnalyzed: JSON.parse(r.categories_json || '[]'),
      findingsGeneratedCount: r.findings_generated_count,
      newFindingsCount: r.new_findings_count,
      resolvedFindingsCount: r.resolved_findings_count,
      skipReason: r.skip_reason || undefined,
      errorMessage: r.error_message || undefined
    }));
  }

  public saveEngineeringFinding(finding: EngineeringFinding): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO engineering_findings (
        id, project_id, project_path, detection_timestamp, category, severity,
        confidence, affected_files_json, evidence, explanation,
        baseline_comparison_json, suggested_remediation, related_historical_ids_json,
        status, effort_category, technical_debt_score, user_dismissed,
        user_dismissal_reason, resolved_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        severity = excluded.severity,
        confidence = excluded.confidence,
        affected_files_json = excluded.affected_files_json,
        evidence = excluded.evidence,
        explanation = excluded.explanation,
        baseline_comparison_json = excluded.baseline_comparison_json,
        suggested_remediation = excluded.suggested_remediation,
        status = excluded.status,
        effort_category = excluded.effort_category,
        technical_debt_score = excluded.technical_debt_score,
        user_dismissed = excluded.user_dismissed,
        user_dismissal_reason = excluded.user_dismissal_reason,
        resolved_at = excluded.resolved_at,
        updated_at = excluded.updated_at
    `).run(
      finding.id,
      finding.projectId,
      finding.projectPath,
      finding.detectionTimestamp,
      finding.category,
      finding.severity,
      finding.confidence,
      JSON.stringify(finding.affectedFiles || []),
      finding.evidence,
      finding.explanation,
      finding.baselineComparison ? JSON.stringify(finding.baselineComparison) : null,
      finding.suggestedRemediation,
      JSON.stringify(finding.relatedHistoricalFindingIds || []),
      finding.status,
      finding.effortCategory || null,
      finding.technicalDebtScore ?? null,
      finding.userDismissed ? 1 : 0,
      finding.userDismissalReason || null,
      finding.resolvedAt || null,
      finding.updatedAt || Date.now()
    );
  }

  public updateFindingStatus(
    id: string,
    projectId: string,
    status: FindingStatus,
    comment?: string,
    dismissalReason?: string
  ): boolean {
    const db = this.getAppDb();
    const existing = db.prepare(`SELECT * FROM engineering_findings WHERE id = ?`).get(id) as any;
    if (!existing) return false;

    const now = Date.now();
    const resolvedAt = status === 'resolved' ? now : (status === 'reopened' ? null : existing.resolved_at);
    const userDismissed = (status === 'accepted' || status === 'false_positive' || dismissalReason) ? 1 : existing.user_dismissed;

    db.prepare(`
      UPDATE engineering_findings SET
        status = ?,
        user_dismissed = ?,
        user_dismissal_reason = COALESCE(?, user_dismissal_reason),
        resolved_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(status, userDismissed, dismissalReason || null, resolvedAt, now, id);

    // Record lifecycle event
    this.saveFindingLifecycleEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      findingId: id,
      projectId,
      eventType: status === 'resolved' ? 'resolved' : (status === 'reopened' ? 'reopened' : 'status_changed'),
      previousStatus: existing.status,
      newStatus: status,
      comment: comment || dismissalReason,
      timestamp: now
    });

    return true;
  }

  public getEngineeringFinding(id: string): EngineeringFinding | null {
    const db = this.getAppDb();
    const r = db.prepare(`SELECT * FROM engineering_findings WHERE id = ?`).get(id) as any;
    if (!r) return null;
    return this.mapFindingRow(r);
  }

  public listEngineeringFindings(params: {
    projectId?: string;
    category?: FindingCategory;
    severity?: FindingSeverity;
    status?: FindingStatus;
    limit?: number;
  } = {}): EngineeringFinding[] {
    const db = this.getAppDb();
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.projectId) {
      conditions.push('project_id = ?');
      values.push(params.projectId);
    }
    if (params.category) {
      conditions.push('category = ?');
      values.push(params.category);
    }
    if (params.severity) {
      conditions.push('severity = ?');
      values.push(params.severity);
    }
    if (params.status) {
      conditions.push('status = ?');
      values.push(params.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit || 200;
    values.push(limit);

    const rows = db.prepare(`
      SELECT * FROM engineering_findings
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(...values) as any[];

    return rows.map((r) => this.mapFindingRow(r));
  }

  private mapFindingRow(r: any): EngineeringFinding {
    return {
      id: r.id,
      projectId: r.project_id,
      projectPath: r.project_path,
      detectionTimestamp: r.detection_timestamp,
      category: r.category,
      severity: r.severity,
      confidence: r.confidence,
      affectedFiles: JSON.parse(r.affected_files_json || '[]'),
      evidence: r.evidence,
      explanation: r.explanation,
      baselineComparison: r.baseline_comparison_json ? JSON.parse(r.baseline_comparison_json) : undefined,
      suggestedRemediation: r.suggested_remediation,
      relatedHistoricalFindingIds: JSON.parse(r.related_historical_ids_json || '[]'),
      status: r.status,
      effortCategory: r.effort_category || undefined,
      technicalDebtScore: r.technical_debt_score ?? undefined,
      userDismissed: Boolean(r.user_dismissed),
      userDismissalReason: r.user_dismissal_reason || undefined,
      resolvedAt: r.resolved_at || undefined,
      updatedAt: r.updated_at
    };
  }

  public saveFindingLifecycleEvent(event: FindingLifecycleEvent): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO engineering_finding_events (
        id, finding_id, project_id, event_type, previous_status,
        new_status, comment, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.findingId,
      event.projectId,
      event.eventType,
      event.previousStatus || null,
      event.newStatus,
      event.comment || null,
      event.timestamp
    );
  }

  public listFindingLifecycleEvents(findingId: string): FindingLifecycleEvent[] {
    const db = this.getAppDb();
    const rows = db.prepare(`
      SELECT * FROM engineering_finding_events
      WHERE finding_id = ?
      ORDER BY timestamp ASC
    `).all(findingId) as any[];

    return rows.map((r) => ({
      id: r.id,
      findingId: r.finding_id,
      projectId: r.project_id,
      eventType: r.event_type,
      previousStatus: r.previous_status || undefined,
      newStatus: r.new_status,
      comment: r.comment || undefined,
      timestamp: r.timestamp
    }));
  }

  public saveMetricSnapshot(snapshot: EngineeringMetricSnapshot): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO engineering_metric_snapshots (
        id, project_id, timestamp, methodology_version, overall_health_score,
        architecture_score, technical_debt_score, performance_score,
        security_score, testing_score, agent_pass_rate, active_findings_json,
        total_open_debt_items, total_recommendations_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        overall_health_score = excluded.overall_health_score,
        architecture_score = excluded.architecture_score,
        technical_debt_score = excluded.technical_debt_score,
        performance_score = excluded.performance_score,
        security_score = excluded.security_score,
        testing_score = excluded.testing_score,
        agent_pass_rate = excluded.agent_pass_rate,
        active_findings_json = excluded.active_findings_json,
        total_open_debt_items = excluded.total_open_debt_items,
        total_recommendations_active = excluded.total_recommendations_active
    `).run(
      snapshot.id,
      snapshot.projectId,
      snapshot.timestamp,
      snapshot.methodologyVersion || '1.0.0',
      snapshot.overallHealthScore,
      snapshot.architectureScore,
      snapshot.technicalDebtScore,
      snapshot.performanceScore,
      snapshot.securityScore,
      snapshot.testingScore,
      snapshot.agentPassRate,
      JSON.stringify(snapshot.activeFindingsCount || {}),
      snapshot.totalOpenDebtItems,
      snapshot.totalRecommendationsActive
    );
  }

  public listMetricSnapshots(projectId: string, limit = 50): EngineeringMetricSnapshot[] {
    const db = this.getAppDb();
    const rows = db.prepare(`
      SELECT * FROM engineering_metric_snapshots
      WHERE project_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(projectId, limit) as any[];

    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      timestamp: r.timestamp,
      methodologyVersion: r.methodology_version,
      overallHealthScore: r.overall_health_score,
      architectureScore: r.architecture_score,
      technicalDebtScore: r.technical_debt_score,
      performanceScore: r.performance_score,
      securityScore: r.security_score,
      testingScore: r.testing_score,
      agentPassRate: r.agent_pass_rate,
      activeFindingsCount: JSON.parse(r.active_findings_json || '{}'),
      totalOpenDebtItems: r.total_open_debt_items,
      totalRecommendationsActive: r.total_recommendations_active
    }));
  }

  public saveEngineeringRecommendation(rec: EngineeringRecommendation): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO engineering_recommendations (
        id, project_id, project_path, title, problem, supporting_evidence,
        expected_impact, confidence, estimated_effort, priority, category,
        related_finding_ids_json, suggested_next_action, task_goal_prompt,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        problem = excluded.problem,
        supporting_evidence = excluded.supporting_evidence,
        expected_impact = excluded.expected_impact,
        confidence = excluded.confidence,
        estimated_effort = excluded.estimated_effort,
        priority = excluded.priority,
        category = excluded.category,
        related_finding_ids_json = excluded.related_finding_ids_json,
        suggested_next_action = excluded.suggested_next_action,
        task_goal_prompt = excluded.task_goal_prompt,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(
      rec.id,
      rec.projectId,
      rec.projectPath,
      rec.title,
      rec.problem,
      rec.supportingEvidence,
      rec.expectedImpact,
      rec.confidence,
      rec.estimatedEffort,
      rec.priority,
      rec.category,
      JSON.stringify(rec.relatedFindingIds || []),
      rec.suggestedNextAction,
      rec.taskGoalPrompt || null,
      rec.status,
      rec.createdAt,
      rec.updatedAt || Date.now()
    );
  }

  public updateRecommendationStatus(
    id: string,
    status: 'active' | 'accepted' | 'deferred' | 'dismissed' | 'executed'
  ): boolean {
    const db = this.getAppDb();
    const result = db.prepare(`
      UPDATE engineering_recommendations
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(status, Date.now(), id);
    return result.changes > 0;
  }

  public listEngineeringRecommendations(params: {
    projectId?: string;
    category?: FindingCategory;
    status?: string;
    limit?: number;
  } = {}): EngineeringRecommendation[] {
    const db = this.getAppDb();
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.projectId) {
      conditions.push('project_id = ?');
      values.push(params.projectId);
    }
    if (params.category) {
      conditions.push('category = ?');
      values.push(params.category);
    }
    if (params.status) {
      conditions.push('status = ?');
      values.push(params.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit || 50;
    values.push(limit);

    const rows = db.prepare(`
      SELECT * FROM engineering_recommendations
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(...values) as any[];

    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      projectPath: r.project_path,
      title: r.title,
      problem: r.problem,
      supportingEvidence: r.supporting_evidence,
      expectedImpact: r.expected_impact,
      confidence: r.confidence,
      estimatedEffort: r.estimated_effort as any,
      priority: r.priority as any,
      category: r.category as any,
      relatedFindingIds: JSON.parse(r.related_finding_ids_json || '[]'),
      suggestedNextAction: r.suggested_next_action,
      taskGoalPrompt: r.task_goal_prompt || undefined,
      status: r.status as any,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public saveRecommendationFeedback(feedback: RecommendationFeedback): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO engineering_recommendation_feedback (
        id, recommendation_id, project_id, feedback, comment, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      feedback.id,
      feedback.recommendationId,
      feedback.projectId,
      feedback.feedback,
      feedback.comment || null,
      feedback.timestamp
    );

    // Update recommendation status accordingly
    if (feedback.feedback === 'accept') {
      this.updateRecommendationStatus(feedback.recommendationId, 'accepted');
    } else if (feedback.feedback === 'defer') {
      this.updateRecommendationStatus(feedback.recommendationId, 'deferred');
    } else if (feedback.feedback === 'not_useful' || feedback.feedback === 'incorrect') {
      this.updateRecommendationStatus(feedback.recommendationId, 'dismissed');
    }
  }

  public listRecommendationFeedback(recommendationId: string): RecommendationFeedback[] {
    const db = this.getAppDb();
    const rows = db.prepare(`
      SELECT * FROM engineering_recommendation_feedback
      WHERE recommendation_id = ?
      ORDER BY timestamp DESC
    `).all(recommendationId) as any[];

    return rows.map((r) => ({
      id: r.id,
      recommendationId: r.recommendation_id,
      projectId: r.project_id,
      feedback: r.feedback as any,
      comment: r.comment || undefined,
      timestamp: r.timestamp
    }));
  }

  public saveEngineeringBaseline(
    projectId: string,
    baselineHash: string,
    data: any,
    methodologyVersion = '1.0.0'
  ): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO engineering_baselines (
        project_id, baseline_hash, methodology_version, baseline_data_json, updated_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        baseline_hash = excluded.baseline_hash,
        methodology_version = excluded.methodology_version,
        baseline_data_json = excluded.baseline_data_json,
        updated_at = excluded.updated_at
    `).run(projectId, baselineHash, methodologyVersion, JSON.stringify(data), Date.now());
  }

  public getEngineeringBaseline(projectId: string): {
    baselineHash: string;
    methodologyVersion: string;
    data: any;
    updatedAt: number;
  } | null {
    const db = this.getAppDb();
    const row = db.prepare(`SELECT * FROM engineering_baselines WHERE project_id = ?`).get(projectId) as any;
    if (!row) return null;
    return {
      baselineHash: row.baseline_hash,
      methodologyVersion: row.methodology_version,
      data: JSON.parse(row.baseline_data_json || '{}'),
      updatedAt: row.updated_at
    };
  }

  public saveEngineeringConfig(projectId: string, config: ContinuousIntelligenceConfig): void {
    const db = this.getAppDb();
    db.prepare(`
      INSERT INTO engineering_config (project_id, config_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        config_json = excluded.config_json,
        updated_at = excluded.updated_at
    `).run(projectId, JSON.stringify(config), Date.now());
  }

  public getEngineeringConfig(projectId: string): ContinuousIntelligenceConfig | null {
    const db = this.getAppDb();
    const row = db.prepare(`SELECT config_json FROM engineering_config WHERE project_id = ?`).get(projectId) as any;
    if (!row || !row.config_json) return null;
    try {
      return JSON.parse(row.config_json);
    } catch {
      return null;
    }
  }

  public pruneEngineeringData(
    projectId: string,
    retentionDays: number
  ): { prunedFindings: number; prunedRuns: number; prunedSnapshots: number } {
    const db = this.getAppDb();
    const cutoff = Date.now() - retentionDays * 86400000;

    const runsRes = db.prepare(`
      DELETE FROM engineering_analysis_runs
      WHERE project_id = ? AND started_at < ?
    `).run(projectId, cutoff);

    const snapshotsRes = db.prepare(`
      DELETE FROM engineering_metric_snapshots
      WHERE project_id = ? AND timestamp < ?
    `).run(projectId, cutoff);

    // Keep active/deferred findings, only prune resolved findings older than cutoff
    const findingsRes = db.prepare(`
      DELETE FROM engineering_findings
      WHERE project_id = ? AND status = 'resolved' AND updated_at < ?
    `).run(projectId, cutoff);

    return {
      prunedRuns: runsRes.changes,
      prunedSnapshots: snapshotsRes.changes,
      prunedFindings: findingsRes.changes
    };
  }

  // ==========================================
  // Production Hardening: Integrity, Backup & Disaster Recovery
  // ==========================================

  public checkDatabaseIntegrity(): {
    ok: boolean;
    integrity: string;
    foreignKeysOk: boolean;
    corrupted: boolean;
    tableCount: number;
    appDbIntegrity: string;
    indexDbIntegrity: string;
    foreignKeyViolations: any[];
    appliedMigrationsCount: number;
    errors: string[];
  } {
    const errors: string[] = [];
    let appDbIntegrity = 'unknown';
    let indexDbIntegrity = 'unknown';
    let foreignKeyViolations: any[] = [];
    let appliedMigrationsCount = 0;

    try {
      if (this.appDb) {
        const appRes = this.appDb.prepare('PRAGMA integrity_check').get() as any;
        appDbIntegrity = appRes ? Object.values(appRes)[0] as string : 'failed';
        if (appDbIntegrity !== 'ok') {
          errors.push(`app.sqlite integrity check failed: ${appDbIntegrity}`);
        }

        foreignKeyViolations = this.appDb.prepare('PRAGMA foreign_key_check').all();
        if (foreignKeyViolations.length > 0) {
          errors.push(`app.sqlite has ${foreignKeyViolations.length} foreign key violation(s)`);
        }

        const migrations = this.appDb.prepare('SELECT COUNT(*) as count FROM schema_migrations').get() as any;
        appliedMigrationsCount = migrations ? migrations.count : 0;
      } else {
        errors.push('app.sqlite handle is not initialized');
      }

      if (this.indexDb) {
        const indexRes = this.indexDb.prepare('PRAGMA integrity_check').get() as any;
        indexDbIntegrity = indexRes ? Object.values(indexRes)[0] as string : 'failed';
        if (indexDbIntegrity !== 'ok') {
          errors.push(`index.sqlite integrity check failed: ${indexDbIntegrity}`);
        }
      }
    } catch (err: any) {
      errors.push(`Database integrity inspection threw an error: ${err.message}`);
    }

    const isOk = errors.length === 0 && appDbIntegrity === 'ok' && foreignKeyViolations.length === 0;
    return {
      ok: isOk,
      integrity: appDbIntegrity,
      foreignKeysOk: foreignKeyViolations.length === 0,
      corrupted: !isOk,
      tableCount: appliedMigrationsCount,
      appDbIntegrity,
      indexDbIntegrity,
      foreignKeyViolations,
      appliedMigrationsCount,
      errors
    };
  }

  public async createOnlineBackup(targetDir?: string): Promise<{
    success: boolean;
    backupPath: string;
    sizeBytes: number;
    timestamp: number;
  }> {
    if (!this.appDb) {
      throw new Error('Cannot create backup: Database is not initialized');
    }

    const backupsDir = targetDir || path.join(this.storageDir, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const backupPath = path.join(backupsDir, `app-backup-${timestamp}.sqlite`);

    // Use native SQLite online backup API to safely snapshot active WAL database
    await this.appDb.backup(backupPath);

    // Verify written backup immediately
    const verify = this.verifyBackup(backupPath);
    if (!verify.valid) {
      try { fs.unlinkSync(backupPath); } catch {}
      throw new Error(`Backup verification failed: ${verify.error || verify.integrity}`);
    }

    const sizeBytes = fs.statSync(backupPath).size;
    return {
      success: true,
      backupPath,
      sizeBytes,
      timestamp
    };
  }

  public verifyBackup(backupFilePath: string): {
    valid: boolean;
    integrity: string;
    tableCount: number;
    error?: string;
  } {
    if (!fs.existsSync(backupFilePath)) {
      return { valid: false, integrity: 'file_not_found', tableCount: 0, error: 'Backup file does not exist' };
    }

    let candidateDb: Database.Database | null = null;
    try {
      candidateDb = new Database(backupFilePath, { readonly: true, timeout: 3000 });
      const res = candidateDb.prepare('PRAGMA integrity_check').get() as any;
      const integrity = res ? Object.values(res)[0] as string : 'unknown';

      const tables = candidateDb.prepare(`
        SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).get() as any;

      const tableCount = tables ? tables.count : 0;
      candidateDb.close();
      candidateDb = null;

      return {
        valid: integrity === 'ok' && tableCount > 0,
        integrity,
        tableCount
      };
    } catch (err: any) {
      if (candidateDb) {
        try { candidateDb.close(); } catch {}
      }
      return {
        valid: false,
        integrity: 'error',
        tableCount: 0,
        error: err.message
      };
    }
  }

  public listBackups(): Array<{
    fileName: string;
    filePath: string;
    sizeBytes: number;
    timestamp: number;
    valid: boolean;
  }> {
    const backupsDir = path.join(this.storageDir, 'backups');
    if (!fs.existsSync(backupsDir)) return [];

    const files = fs.readdirSync(backupsDir);
    const result: Array<{
      fileName: string;
      filePath: string;
      sizeBytes: number;
      timestamp: number;
      valid: boolean;
    }> = [];

    for (const f of files) {
      if (f.endsWith('.sqlite')) {
        const fullPath = path.join(backupsDir, f);
        try {
          const stats = fs.statSync(fullPath);
          const verify = this.verifyBackup(fullPath);
          result.push({
            fileName: f,
            filePath: fullPath,
            sizeBytes: stats.size,
            timestamp: stats.mtimeMs,
            valid: verify.valid
          });
        } catch {}
      }
    }

    return result.sort((a, b) => b.timestamp - a.timestamp);
  }

  private logRecoveryEvent(event: Record<string, any>): void {
    try {
      const logsDir = path.join(this.storageDir, 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const logPath = path.join(logsDir, 'recovery.log');
      const entry = {
        timestamp: Date.now(),
        isoTime: new Date().toISOString(),
        ...event
      };
      fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');
    } catch (err) {
      console.error('[DatabaseService] Failed to write recovery log:', err);
    }
  }

  public restoreFromBackup(backupFilePath: string, explicitConfirm = false): {
    success: boolean;
    preRestoreBackupPath: string;
    restoredPath: string;
    candidateValidated: boolean;
  } {
    if (!explicitConfirm) {
      throw new Error('Restore rejected: Explicit confirmation (explicitConfirm: true) is required to restore database backups.');
    }

    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file does not exist: ${backupFilePath}`);
    }

    const verification = this.verifyBackup(backupFilePath);
    if (!verification.valid) {
      throw new Error(`Cannot restore invalid backup: ${verification.error || verification.integrity}`);
    }

    const timestamp = Date.now();
    const appDbPath = path.join(this.storageDir, 'app.sqlite');
    const candidatePath = path.join(this.storageDir, `app.sqlite.restore-candidate-${timestamp}`);
    const preRestoreBackupPath = path.join(this.storageDir, `app.sqlite.pre-restore-${timestamp}`);

    // Step 1: Copy backup to isolated candidate file for verification before touching live DB
    try {
      fs.copyFileSync(backupFilePath, candidatePath);
    } catch (err: any) {
      throw new Error(`Failed to stage candidate restore database: ${err.message}`);
    }

    // Step 2: Thoroughly validate candidate database in isolation
    let candidateDb: Database.Database | null = null;
    try {
      candidateDb = new Database(candidatePath, { readonly: true, fileMustExist: true });
      const integrityRes = candidateDb.prepare('PRAGMA integrity_check').get() as any;
      const integrity = integrityRes ? (Object.values(integrityRes)[0] as string) : 'unknown';
      if (integrity !== 'ok') {
        throw new Error(`Candidate database failed PRAGMA integrity_check: ${integrity}`);
      }

      const fkViolations = candidateDb.prepare('PRAGMA foreign_key_check').all();
      if (fkViolations.length > 0) {
        throw new Error(`Candidate database has ${fkViolations.length} foreign key violation(s)`);
      }

      const migrationsCheck = candidateDb.prepare(`SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='schema_migrations'`).get() as any;
      if (!migrationsCheck || migrationsCheck.count === 0) {
        throw new Error('Candidate database is missing schema_migrations table');
      }

      candidateDb.close();
      candidateDb = null;
    } catch (err: any) {
      if (candidateDb) {
        try { candidateDb.close(); } catch {}
      }
      if (fs.existsSync(candidatePath)) {
        try { fs.unlinkSync(candidatePath); } catch {}
      }
      this.logRecoveryEvent({
        action: 'restore_rejected',
        backupFilePath,
        reason: err.message,
        candidateValidated: false
      });
      throw new Error(`Restore aborted: Candidate database validation failed: ${err.message}`);
    }

    // Step 3: Candidate passed validation. Safely snapshot live database before replacement.
    this.close();
    if (fs.existsSync(appDbPath)) {
      try {
        fs.copyFileSync(appDbPath, preRestoreBackupPath);
      } catch (err: any) {
        if (fs.existsSync(candidatePath)) {
          try { fs.unlinkSync(candidatePath); } catch {}
        }
        this.initialize();
        throw new Error(`Failed to create pre-restore snapshot: ${err.message}`);
      }
    }

    // Step 4: Atomic swap — move candidate database to active app.sqlite
    try {
      if (fs.existsSync(appDbPath)) {
        try { fs.unlinkSync(appDbPath); } catch {}
      }
      fs.renameSync(candidatePath, appDbPath);
    } catch (err: any) {
      // Emergency rollback to pre-restore snapshot
      if (fs.existsSync(preRestoreBackupPath)) {
        try { fs.copyFileSync(preRestoreBackupPath, appDbPath); } catch {}
      }
      this.initialize();
      throw new Error(`Atomic swap of restored database failed: ${err.message}`);
    }

    // Clean up any stale live WAL/SHM from previous database state
    try {
      const wal = path.join(this.storageDir, 'app.sqlite-wal');
      const shm = path.join(this.storageDir, 'app.sqlite-shm');
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch {}

    // Step 5: Re-initialize connections with new validated database
    this.initialize();

    this.logRecoveryEvent({
      action: 'restore_completed',
      backupFilePath,
      preRestoreBackupPath,
      restoredPath: appDbPath,
      candidateValidated: true,
      timestamp
    });

    return {
      success: true,
      preRestoreBackupPath,
      restoredPath: appDbPath,
      candidateValidated: true
    };
  }

  public recoverCorruptedDatabase(): {
    quarantinedCorruptPath: string;
    newDbPath: string;
    timestamp: number;
    dataSalvaged: boolean;
    salvageOutcome: 'SALVAGE_FULL_SUCCESS' | 'SALVAGE_PARTIAL_SUCCESS' | 'SALVAGE_FAILED_EMPTY_SCHEMA_REBUILT';
    salvagedTables: string[];
    salvagedRecordsCount: number;
    totalRecordsFound: number;
    unrecoverableTables: string[];
    conflictingRecordsCount: number;
    rejectedRecordsCount: number;
    foreignKeyViolationsCount: number;
    tableAccounting: Record<string, {
      found: number;
      salvaged: number;
      conflicts: number;
      rejected: number;
      unrecoverable: number;
      reason?: string;
    }>;
  } {
    const timestamp = Date.now();
    const appDbPath = path.join(this.storageDir, 'app.sqlite');
    const walPath = path.join(this.storageDir, 'app.sqlite-wal');
    const shmPath = path.join(this.storageDir, 'app.sqlite-shm');

    const quarantinedCorruptPath = path.join(this.storageDir, `app.sqlite.corrupt-${timestamp}`);
    const quarantinedWalPath = path.join(this.storageDir, `app.sqlite-wal.corrupt-${timestamp}`);
    const quarantinedShmPath = path.join(this.storageDir, `app.sqlite-shm.corrupt-${timestamp}`);

    this.close();

    // Safely quarantine database file
    if (fs.existsSync(appDbPath)) {
      try {
        fs.renameSync(appDbPath, quarantinedCorruptPath);
      } catch {
        fs.copyFileSync(appDbPath, quarantinedCorruptPath);
        try { fs.unlinkSync(appDbPath); } catch {}
      }
    }

    // Safely quarantine WAL and SHM files (do NOT delete blindly — may hold uncheckpointed data)
    if (fs.existsSync(walPath)) {
      try {
        fs.renameSync(walPath, quarantinedWalPath);
      } catch {
        try { fs.copyFileSync(walPath, quarantinedWalPath); fs.unlinkSync(walPath); } catch {}
      }
    }
    if (fs.existsSync(shmPath)) {
      try {
        fs.renameSync(shmPath, quarantinedShmPath);
      } catch {
        try { fs.copyFileSync(shmPath, quarantinedShmPath); fs.unlinkSync(shmPath); } catch {}
      }
    }

    // Step 1: Dynamic table and schema extraction from quarantined database
    const salvagedData = new Map<string, any[]>();
    const salvagedTables: string[] = [];
    const unrecoverableTables: string[] = [];
    const tableAccounting: Record<string, {
      found: number;
      salvaged: number;
      conflicts: number;
      rejected: number;
      unrecoverable: number;
      reason?: string;
    }> = {};

    let totalRecordsFound = 0;
    let salvagedRecordsCount = 0;
    let conflictingRecordsCount = 0;
    let rejectedRecordsCount = 0;

    let corruptDb: Database.Database | null = null;
    try {
      corruptDb = new Database(quarantinedCorruptPath, { readonly: true, fileMustExist: true });
      const tablesRes = corruptDb.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations'
      `).all() as Array<{ name: string }>;

      for (const t of tablesRes) {
        tableAccounting[t.name] = { found: 0, salvaged: 0, conflicts: 0, rejected: 0, unrecoverable: 0 };
        try {
          const rows = corruptDb.prepare(`SELECT * FROM "${t.name}"`).all();
          if (rows && rows.length > 0) {
            tableAccounting[t.name].found = rows.length;
            totalRecordsFound += rows.length;
            salvagedData.set(t.name, rows);
            salvagedTables.push(t.name);
          }
        } catch (err: any) {
          unrecoverableTables.push(t.name);
          tableAccounting[t.name].unrecoverable = 1;
          tableAccounting[t.name].reason = err.message;
        }
      }
      corruptDb.close();
      corruptDb = null;
    } catch {
      if (corruptDb) {
        try { corruptDb.close(); } catch {}
      }
    }

    // Step 2: Initialize clean database schema with all migrations
    const { appDbPath: newDbPath } = this.initialize();

    // Step 3: Re-insert salvaged records with foreign keys disabled during bulk insert
    let foreignKeyViolationsCount = 0;
    if (this.appDb && salvagedData.size > 0) {
      try {
        this.appDb.pragma('foreign_keys = OFF');
        const insertTx = this.appDb.transaction(() => {
          for (const [table, rows] of salvagedData.entries()) {
            if (rows.length === 0) continue;
            const columns = Object.keys(rows[0]);
            const placeholders = columns.map(() => '?').join(', ');
            const colNames = columns.map((c) => `"${c}"`).join(', ');
            const stmt = this.appDb!.prepare(`INSERT OR IGNORE INTO "${table}" (${colNames}) VALUES (${placeholders})`);

            let tableSalvaged = 0;
            let tableConflicts = 0;

            for (const row of rows) {
              const vals = columns.map((c) => row[c]);
              try {
                const info = stmt.run(...vals);
                if (info.changes > 0) {
                  tableSalvaged++;
                  salvagedRecordsCount++;
                } else {
                  tableConflicts++;
                  conflictingRecordsCount++;
                }
              } catch {
                rejectedRecordsCount++;
                tableAccounting[table].rejected++;
              }
            }

            tableAccounting[table].salvaged = tableSalvaged;
            tableAccounting[table].conflicts = tableConflicts;
          }
        });
        insertTx();
        this.appDb.pragma('foreign_keys = ON');

        // Check foreign key consistency post-salvage
        try {
          const fkViolations = this.appDb.prepare('PRAGMA foreign_key_check').all();
          foreignKeyViolationsCount = fkViolations.length;
        } catch {}
      } catch (err: any) {
        console.error('[DatabaseService] Failed to insert salvaged records:', err.message);
      }
    }

    const wasNonEmpty = fs.existsSync(quarantinedCorruptPath) && fs.statSync(quarantinedCorruptPath).size > 4096;
    let salvageOutcome: 'SALVAGE_FULL_SUCCESS' | 'SALVAGE_PARTIAL_SUCCESS' | 'SALVAGE_FAILED_EMPTY_SCHEMA_REBUILT';

    if (salvagedRecordsCount > 0 && salvagedRecordsCount === totalRecordsFound) {
      salvageOutcome = 'SALVAGE_FULL_SUCCESS';
    } else if (salvagedRecordsCount > 0) {
      salvageOutcome = 'SALVAGE_PARTIAL_SUCCESS';
    } else {
      salvageOutcome = 'SALVAGE_FAILED_EMPTY_SCHEMA_REBUILT';
    }

    this.logRecoveryEvent({
      action: 'database_corrupt_recovery',
      quarantinedCorruptPath,
      newDbPath,
      dataSalvaged: salvagedRecordsCount > 0,
      salvageOutcome,
      salvagedTables,
      salvagedRecordsCount,
      totalRecordsFound,
      conflictingRecordsCount,
      rejectedRecordsCount,
      foreignKeyViolationsCount,
      unrecoverableTables,
      timestamp
    });

    return {
      quarantinedCorruptPath,
      newDbPath,
      timestamp,
      dataSalvaged: salvagedRecordsCount > 0,
      salvageOutcome,
      salvagedTables,
      salvagedRecordsCount,
      totalRecordsFound,
      unrecoverableTables,
      conflictingRecordsCount,
      rejectedRecordsCount,
      foreignKeyViolationsCount,
      tableAccounting
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
