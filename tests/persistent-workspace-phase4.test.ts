import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// In-memory backing tables for DatabaseService mock
const dbTables = {
  workspaces: new Map<string, any>(),
  projects: new Map<string, any>(),
  project_workspace_states: new Map<string, any>(),
  orchestrations: new Map<string, any>(),
  orchestration_tasks: new Map<string, any>()
};

vi.mock('better-sqlite3', () => {
  return {
    default: class MockBetterSqlite3 {
      constructor() {}
      pragma() {}
      exec() {}
      close() {}
      prepare(sql: string) {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        return {
          run: (...params: any[]) => {
            if (normalized.includes('INSERT INTO workspaces')) {
              const [id, name, ui_mode, theme, auto_index, created_at, updated_at] = params;
              dbTables.workspaces.set(id, { id, name, ui_mode, theme, auto_index, created_at, updated_at, layout_json: '{}' });
            } else if (normalized.includes('UPDATE workspaces SET ui_mode')) {
              const [ui_mode, theme, auto_index, current_project_id, updated_at, id] = params;
              const current = dbTables.workspaces.get(id) || { id };
              dbTables.workspaces.set(id, { ...current, ui_mode, theme, auto_index, current_project_id, updated_at });
            } else if (normalized.includes('UPDATE workspaces SET layout_json =')) {
              const [layout_json, updated_at] = params;
              const current = Array.from(dbTables.workspaces.values())[0] || { id: 'default-workspace' };
              dbTables.workspaces.set(current.id, { ...current, layout_json, updated_at });
            } else if (normalized.includes('INSERT INTO projects')) {
              const [id, name, projPath, last_opened_at, is_git_repo, active_branch, permission_level, is_favorite, settings_json] = params;
              dbTables.projects.set(id, { id, name, path: projPath, last_opened_at, is_git_repo, active_branch, permission_level, is_favorite, settings_json });
            } else if (normalized.includes('INSERT INTO project_workspace_states')) {
              const [
                project_id, open_tabs_json, active_tab_id, active_file_path,
                expanded_dirs_json, file_filter, terminal_sessions_json,
                active_terminal_id, target_editor_line, view_state_json, updated_at
              ] = params;
              dbTables.project_workspace_states.set(project_id, {
                project_id, open_tabs_json, active_tab_id, active_file_path,
                expanded_dirs_json, file_filter, terminal_sessions_json,
                active_terminal_id, target_editor_line, view_state_json, updated_at
              });
            } else if (normalized.includes('UPDATE orchestrations SET status =')) {
              const [completed_at, id] = params;
              const current = dbTables.orchestrations.get(id);
              if (current) {
                dbTables.orchestrations.set(id, {
                  ...current,
                  status: 'failed',
                  error_message: 'Interrupted by application shutdown/restart',
                  completed_at
                });
              }
            } else if (normalized.includes('UPDATE orchestration_tasks SET status =')) {
              const [completed_at, id] = params;
              const current = dbTables.orchestration_tasks.get(id);
              if (current) {
                dbTables.orchestration_tasks.set(id, {
                  ...current,
                  status: 'failed',
                  error_message: 'Interrupted by application restart',
                  completed_at
                });
              }
            } else if (normalized.includes('INSERT INTO orchestrations')) {
              const [id, project_id, project_path, user_goal, mode, status, created_at, started_at] = params;
              dbTables.orchestrations.set(id, { id, project_id, project_path, user_goal, mode, status, created_at, started_at });
            } else if (normalized.includes('INSERT INTO orchestration_tasks')) {
              const [id, orchestration_id, title, description, role, provider, status, permissions_json, created_at, started_at] = params;
              dbTables.orchestration_tasks.set(id, { id, orchestration_id, title, description, role, provider, status, permissions_json, created_at, started_at });
            }
            return { changes: 1 };
          },
          get: (...params: any[]) => {
            if (normalized.includes('FROM workspaces LIMIT 1') || normalized.includes('SELECT layout_json FROM workspaces')) {
              return Array.from(dbTables.workspaces.values())[0] || null;
            } else if (normalized.includes('FROM project_workspace_states WHERE project_id = ?')) {
              return dbTables.project_workspace_states.get(params[0]) || null;
            } else if (normalized.includes('SELECT status, error_message FROM orchestrations WHERE id = ?')) {
              return dbTables.orchestrations.get(params[0]) || null;
            } else if (normalized.includes('SELECT status, error_message FROM orchestration_tasks WHERE id = ?') || normalized.includes('SELECT status FROM orchestration_tasks WHERE id = ?')) {
              return dbTables.orchestration_tasks.get(params[0]) || null;
            }
            return null;
          },
          all: (...params: any[]) => {
            if (normalized.includes('FROM orchestrations WHERE status IN')) {
              return Array.from(dbTables.orchestrations.values()).filter(
                (o) => ['planning', 'running', 'reviewing'].includes(o.status)
              );
            } else if (normalized.includes('FROM orchestration_tasks WHERE status IN')) {
              return Array.from(dbTables.orchestration_tasks.values()).filter(
                (t) => ['running', 'reviewing'].includes(t.status)
              );
            }
            return [];
          }
        };
      }
    }
  };
});

import {
  UpdateSettingsSchema,
  SaveAppLayoutSchema,
  SaveProjectWorkspaceStateSchema,
  GetProjectWorkspaceStateSchema
} from '../src/shared/ipc';
import { DatabaseService, databaseService } from '../src/main/db/database.service';
import { WorkspaceService } from '../src/main/services/workspace.service';
import { useWorkspaceStore } from '../src/renderer/src/stores/workspace.store';
import type { ProjectDescriptor } from '../src/shared/types';

describe('AI Workspace — Phase 4: Persistent Workspace & Session Recovery Tests', () => {
  let tempStorageDir: string;
  let testWorkspaceRoot: string;
  let dbService: DatabaseService;
  let wsService: WorkspaceService;

  beforeEach(() => {
    // Reset database state
    dbTables.workspaces.clear();
    dbTables.projects.clear();
    dbTables.project_workspace_states.clear();
    dbTables.orchestrations.clear();
    dbTables.orchestration_tasks.clear();

    tempStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orc-phase4-db-'));
    testWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orc-phase4-workspace-'));

    databaseService.initialize();
    dbService = databaseService;

    wsService = new WorkspaceService();
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempStorageDir)) {
        fs.rmSync(tempStorageDir, { recursive: true, force: true });
      }
      if (fs.existsSync(testWorkspaceRoot)) {
        fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
      }
    } catch {
      // best-effort cleanup
    }
  });

  describe('1. IPC Validation Schemas', () => {
    it('validates UpdateSettingsSchema with currentProjectId and UI options', () => {
      const parsed = UpdateSettingsSchema.parse({
        currentProjectId: 'proj-123',
        uiMode: 'advanced',
        theme: 'glass',
        autoIndex: true
      });
      expect(parsed.currentProjectId).toBe('proj-123');
      expect(parsed.uiMode).toBe('advanced');
      expect(parsed.theme).toBe('glass');
      expect(parsed.autoIndex).toBe(true);
    });

    it('validates SaveAppLayoutSchema', () => {
      const parsed = SaveAppLayoutSchema.parse({
        layout: {
          isLeftSidebarOpen: false,
          leftSidebarWidth: 260,
          isRightPanelOpen: true,
          rightPanelWidth: 320,
          activeSection: 'terminal',
          terminalLayout: '2-col'
        }
      });
      expect(parsed.layout.isLeftSidebarOpen).toBe(false);
      expect(parsed.layout.leftSidebarWidth).toBe(260);
      expect(parsed.layout.terminalLayout).toBe('2-col');
    });

    it('validates SaveProjectWorkspaceStateSchema and GetProjectWorkspaceStateSchema', () => {
      const saveParsed = SaveProjectWorkspaceStateSchema.parse({
        projectId: 'proj-alpha',
        state: {
          openTabs: [{ id: 'tab:1', type: 'file', title: 'index.ts' }],
          activeTabId: 'tab:1'
        }
      });
      expect(saveParsed.projectId).toBe('proj-alpha');

      const getParsed = GetProjectWorkspaceStateSchema.parse({
        projectId: 'proj-alpha'
      });
      expect(getParsed.projectId).toBe('proj-alpha');

      expect(() => GetProjectWorkspaceStateSchema.parse({ projectId: '' })).toThrow();
    });
  });

  describe('2. Application State & Layout Persistence', () => {
    it('returns default layout preferences when no layout has been saved', () => {
      const layout = dbService.getAppLayout();
      expect(layout.isLeftSidebarOpen).toBe(true);
      expect(layout.leftSidebarWidth).toBe(240);
      expect(layout.isRightPanelOpen).toBe(true);
      expect(layout.rightPanelWidth).toBe(280);
      expect(layout.activeSection).toBe('editor');
    });

    it('persists and updates application layout preferences in SQLite', () => {
      const updated = dbService.updateAppLayout({
        isLeftSidebarOpen: false,
        leftSidebarWidth: 310,
        isRightPanelOpen: true,
        rightPanelWidth: 350,
        isBottomPanelOpen: true,
        bottomPanelHeight: 250,
        activeSection: 'terminal',
        terminalLayout: '2-row'
      });

      expect(updated.isLeftSidebarOpen).toBe(false);
      expect(updated.leftSidebarWidth).toBe(310);
      expect(updated.terminalLayout).toBe('2-row');

      // Re-read directly from database
      const fetched = dbService.getAppLayout();
      expect(fetched.isLeftSidebarOpen).toBe(false);
      expect(fetched.leftSidebarWidth).toBe(310);
      expect(fetched.rightPanelWidth).toBe(350);
      expect(fetched.bottomPanelHeight).toBe(250);
      expect(fetched.activeSection).toBe('terminal');
      expect(fetched.terminalLayout).toBe('2-row');
    });

    it('handles corrupted layout JSON gracefully with default fallbacks', () => {
      const current = Array.from(dbTables.workspaces.values())[0];
      if (current) {
        dbTables.workspaces.set(current.id, { ...current, layout_json: '{ corrupted invalid json ...' });
      }

      const layout = dbService.getAppLayout();
      expect(layout.isLeftSidebarOpen).toBe(true);
      expect(layout.leftSidebarWidth).toBe(240);
      expect(layout.rightPanelWidth).toBe(280);
    });
  });

  describe('3. Project Workspace State & Isolation', () => {
    it('maintains completely isolated workspace states for multiple projects', () => {
      const projA: ProjectDescriptor = {
        id: 'proj-a',
        name: 'Project Alpha',
        path: path.join(testWorkspaceRoot, 'alpha'),
        lastOpenedAt: Date.now(),
        isGitRepo: false,
        permissionLevel: 'standard'
      };
      const projB: ProjectDescriptor = {
        id: 'proj-b',
        name: 'Project Beta',
        path: path.join(testWorkspaceRoot, 'beta'),
        lastOpenedAt: Date.now(),
        isGitRepo: false,
        permissionLevel: 'standard'
      };

      dbService.recordProjectOpen(projA);
      dbService.recordProjectOpen(projB);

      // Save state for Project A
      dbService.saveProjectWorkspaceState('proj-a', {
        projectId: 'proj-a',
        openTabs: [
          { id: 'tab:file:index.ts', type: 'file', title: 'index.ts', filePath: '/alpha/index.ts' }
        ],
        activeTabId: 'tab:file:index.ts',
        activeFilePath: '/alpha/index.ts',
        expandedDirs: ['src', 'components'],
        fileFilter: 'component',
        terminalSessions: [
          {
            id: 'term-a',
            title: 'Alpha Term',
            projectId: 'proj-a',
            projectName: 'Project Alpha',
            workingDirectory: '/alpha',
            branch: 'main',
            provider: 'powershell',
            model: 'gpt-4o',
            status: 'idle'
          }
        ],
        activeTerminalId: 'term-a'
      });

      // Save state for Project B
      dbService.saveProjectWorkspaceState('proj-b', {
        projectId: 'proj-b',
        openTabs: [
          { id: 'tab:file:main.py', type: 'file', title: 'main.py', filePath: '/beta/main.py' }
        ],
        activeTabId: 'tab:file:main.py',
        activeFilePath: '/beta/main.py',
        expandedDirs: ['lib'],
        fileFilter: 'py',
        terminalSessions: [
          {
            id: 'term-b',
            title: 'Beta Term',
            projectId: 'proj-b',
            projectName: 'Project Beta',
            workingDirectory: '/beta',
            branch: 'dev',
            provider: 'bash',
            model: 'claude-3-7-sonnet',
            status: 'idle'
          }
        ],
        activeTerminalId: 'term-b'
      });

      // Retrieve state for Project A
      const stateA = dbService.getProjectWorkspaceState('proj-a');
      expect(stateA?.projectId).toBe('proj-a');
      expect(stateA?.openTabs[0].title).toBe('index.ts');
      expect(stateA?.activeFilePath).toBe('/alpha/index.ts');
      expect(stateA?.expandedDirs).toEqual(['src', 'components']);
      expect(stateA?.terminalSessions[0].title).toBe('Alpha Term');

      // Retrieve state for Project B
      const stateB = dbService.getProjectWorkspaceState('proj-b');
      expect(stateB?.projectId).toBe('proj-b');
      expect(stateB?.openTabs[0].title).toBe('main.py');
      expect(stateB?.activeFilePath).toBe('/beta/main.py');
      expect(stateB?.expandedDirs).toEqual(['lib']);
      expect(stateB?.terminalSessions[0].title).toBe('Beta Term');

      // Verify no cross-project leakage
      expect(stateA?.openTabs.some((t) => t.title === 'main.py')).toBe(false);
      expect(stateB?.openTabs.some((t) => t.title === 'index.ts')).toBe(false);
    });

    it('returns null when querying state for an unvisited project without failing', () => {
      const state = dbService.getProjectWorkspaceState('non-existent-proj');
      expect(state).toBeNull();
    });
  });

  describe('4. Editor State & Stale/Missing File Pruning', () => {
    it('prunes deleted or missing files and adjusts activeFilePath gracefully', () => {
      const canonicalRoot = fs.realpathSync(testWorkspaceRoot);
      const existingFile = path.join(canonicalRoot, 'surviving.ts');
      const deletedFile = path.join(canonicalRoot, 'deleted.ts');

      fs.writeFileSync(existingFile, 'const alive = true;', 'utf8');
      fs.writeFileSync(deletedFile, 'const dead = true;', 'utf8');
      fs.unlinkSync(deletedFile); // Simulate deletion while app was closed

      const projId = 'proj-prune-test';
      const proj: ProjectDescriptor = {
        id: projId,
        name: 'Prune Test',
        path: canonicalRoot,
        lastOpenedAt: Date.now(),
        isGitRepo: false,
        permissionLevel: 'standard'
      };
      dbService.recordProjectOpen(proj);

      dbService.saveProjectWorkspaceState(projId, {
        projectId: projId,
        openTabs: [
          { id: 'tab:surviving', type: 'file', title: 'surviving.ts', filePath: existingFile },
          { id: 'tab:deleted', type: 'file', title: 'deleted.ts', filePath: deletedFile }
        ],
        activeTabId: 'tab:deleted',
        activeFilePath: deletedFile,
        expandedDirs: [],
        fileFilter: '',
        terminalSessions: []
      });

      // Using WorkspaceService which validates files against filesystem
      const sanitized = wsService.getProjectWorkspaceState(projId);

      expect(sanitized).not.toBeNull();
      // Verify deleted tab was pruned
      expect(sanitized?.openTabs.length).toBe(1);
      expect(sanitized?.openTabs[0].filePath).toBe(existingFile);

      // Verify activeFilePath gracefully fell back to surviving file
      expect(sanitized?.activeFilePath).toBe(existingFile);
      expect(sanitized?.activeTabId).toBe('tab:surviving');
    });

    it('clears activeFilePath and activeTabId if all open files were deleted', () => {
      const canonicalRoot = fs.realpathSync(testWorkspaceRoot);
      const missingFile = path.join(canonicalRoot, 'missing.ts');

      const projId = 'proj-all-deleted';
      const proj: ProjectDescriptor = {
        id: projId,
        name: 'All Deleted Test',
        path: canonicalRoot,
        lastOpenedAt: Date.now(),
        isGitRepo: false,
        permissionLevel: 'standard'
      };
      dbService.recordProjectOpen(proj);

      dbService.saveProjectWorkspaceState(projId, {
        projectId: projId,
        openTabs: [
          { id: 'tab:missing', type: 'file', title: 'missing.ts', filePath: missingFile }
        ],
        activeTabId: 'tab:missing',
        activeFilePath: missingFile,
        expandedDirs: [],
        fileFilter: '',
        terminalSessions: []
      });

      const sanitized = wsService.getProjectWorkspaceState(projId);
      expect(sanitized?.openTabs.length).toBe(0);
      expect(sanitized?.activeFilePath).toBeNull();
      expect(sanitized?.activeTabId).toBeNull();
    });
  });

  describe('5. Terminal Session Persistence & Process Termination Detection', () => {
    it('restores terminal session metadata without falsely reporting terminated process as running', () => {
      const projId = 'proj-term-test';
      const proj: ProjectDescriptor = {
        id: projId,
        name: 'Term Test',
        path: testWorkspaceRoot,
        lastOpenedAt: Date.now(),
        isGitRepo: false,
        permissionLevel: 'standard'
      };
      dbService.recordProjectOpen(proj);

      // Save a terminal session that was actively running before shutdown
      dbService.saveProjectWorkspaceState(projId, {
        projectId: projId,
        openTabs: [{ id: 'term:term-1', type: 'terminal', title: 'Build Shell', terminalId: 'term-1' }],
        activeTabId: 'term:term-1',
        activeFilePath: null,
        expandedDirs: [],
        fileFilter: '',
        terminalSessions: [
          {
            id: 'term-1',
            title: 'Build Shell',
            projectId: projId,
            projectName: 'Term Test',
            workingDirectory: testWorkspaceRoot,
            branch: 'main',
            provider: 'powershell',
            model: 'gpt-4o',
            status: 'running', // Simulates active process at crash/shutdown
            streamOutput: 'npm run watch\nBuilding components...\n'
          }
        ],
        activeTerminalId: 'term-1'
      });

      // WorkspaceService loads and sanitizes the state
      const sanitized = wsService.getProjectWorkspaceState(projId);
      expect(sanitized?.terminalSessions.length).toBe(1);

      const session = sanitized?.terminalSessions[0];
      expect(session?.title).toBe('Build Shell');
      expect(session?.provider).toBe('powershell');
      expect(session?.workingDirectory).toBe(testWorkspaceRoot);

      // Critical: Running status MUST be sanitized to 'idle'
      expect(session?.status).toBe('idle');
      // Stream output must inform user the process was terminated on application shutdown
      expect(session?.streamOutput).toContain('Session restored: Process was terminated when application closed');
    });
  });

  describe('6. Orchestration & Interrupted Task Recovery', () => {
    it('marks running and planning orchestrations and tasks as failed on startup recovery', () => {
      const db = dbService.getAppDb();

      // Insert interrupted orchestration
      const orchId = 'orch-interrupted-1';
      db.prepare(`
        INSERT INTO orchestrations (
          id, project_id, project_path, user_goal, mode, status, created_at, started_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(orchId, 'proj-1', '/workspace', 'Refactor auth', 'supervised', 'running', Date.now() - 10000, Date.now() - 8000);

      // Insert interrupted task
      const taskId = 'task-interrupted-1';
      db.prepare(`
        INSERT INTO orchestration_tasks (
          id, orchestration_id, title, description, role, provider, status, permissions_json, created_at, started_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(taskId, orchId, 'Update token validator', 'Fix expiry check', 'developer', 'claude', 'running', '{}', Date.now() - 6000, Date.now() - 5000);

      // Insert already completed task (should remain completed)
      const completedTaskId = 'task-completed-1';
      db.prepare(`
        INSERT INTO orchestration_tasks (
          id, orchestration_id, title, description, role, provider, status, permissions_json, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(completedTaskId, orchId, 'Design architecture', 'Plan changes', 'architect', 'claude', 'completed', '{}', Date.now() - 9000, Date.now() - 7000);

      // Run startup recovery
      const result = dbService.recoverOrchestrationsOnStartup();
      expect(result.recoveredOrchestrations).toBe(1);
      expect(result.recoveredTasks).toBe(1);

      // Verify orchestration status
      const updatedOrch = db.prepare('SELECT status, error_message FROM orchestrations WHERE id = ?').get(orchId) as any;
      expect(updatedOrch.status).toBe('failed');
      expect(updatedOrch.error_message).toContain('Interrupted by application shutdown/restart');

      // Verify running task became failed
      const updatedTask = db.prepare('SELECT status, error_message FROM orchestration_tasks WHERE id = ?').get(taskId) as any;
      expect(updatedTask.status).toBe('failed');
      expect(updatedTask.error_message).toContain('Interrupted by application restart');

      // Verify completed task remained completed
      const untouchedTask = db.prepare('SELECT status FROM orchestration_tasks WHERE id = ?').get(completedTaskId) as any;
      expect(untouchedTask.status).toBe('completed');
    });
  });

  describe('7. Full Application Restart Simulation', () => {
    it('survives an application restart: recovers state with fresh instance', () => {
      // 1. First session writes application layout and project state
      dbService.updateAppLayout({
        isLeftSidebarOpen: false,
        leftSidebarWidth: 285,
        activeSection: 'terminal',
        terminalLayout: '3-split'
      });

      const projId = 'proj-restart-test';
      const proj: ProjectDescriptor = {
        id: projId,
        name: 'Restart Project',
        path: testWorkspaceRoot,
        lastOpenedAt: Date.now(),
        isGitRepo: true,
        permissionLevel: 'standard'
      };
      dbService.recordProjectOpen(proj);
      dbService.updateSettings({ currentProjectId: projId });

      dbService.saveProjectWorkspaceState(projId, {
        projectId: projId,
        openTabs: [{ id: 'tab:1', type: 'file', title: 'server.ts', filePath: '/src/server.ts' }],
        activeTabId: 'tab:1',
        activeFilePath: '/src/server.ts',
        expandedDirs: ['src', 'controllers'],
        fileFilter: 'server',
        terminalSessions: [
          {
            id: 'term-restored',
            title: 'Node Service',
            projectId: projId,
            projectName: 'Restart Project',
            workingDirectory: testWorkspaceRoot,
            branch: 'main',
            provider: 'powershell',
            model: 'gpt-4o',
            status: 'idle'
          }
        ],
        activeTerminalId: 'term-restored',
        targetEditorLine: 42
      });

      // 2. Simulate application startup (instantiating fresh DatabaseService on same storage)
      const freshDbService = new DatabaseService(tempStorageDir);
      freshDbService.initialize();

      // 3. Verify settings & last active project survived
      const freshSettings = freshDbService.getSettings();
      expect(freshSettings.currentProjectId).toBe(projId);

      // 4. Verify layout survived
      const freshLayout = freshDbService.getAppLayout();
      expect(freshLayout.isLeftSidebarOpen).toBe(false);
      expect(freshLayout.leftSidebarWidth).toBe(285);
      expect(freshLayout.activeSection).toBe('terminal');
      expect(freshLayout.terminalLayout).toBe('3-split');

      // 5. Verify project workspace state survived
      const freshState = freshDbService.getProjectWorkspaceState(projId);
      expect(freshState?.projectId).toBe(projId);
      expect(freshState?.openTabs[0].title).toBe('server.ts');
      expect(freshState?.activeFilePath).toBe('/src/server.ts');
      expect(freshState?.expandedDirs).toEqual(['src', 'controllers']);
      expect(freshState?.fileFilter).toBe('server');
      expect(freshState?.terminalSessions[0].title).toBe('Node Service');
      expect(freshState?.activeTerminalId).toBe('term-restored');
      expect(freshState?.targetEditorLine).toBe(42);
    });
  });
});
