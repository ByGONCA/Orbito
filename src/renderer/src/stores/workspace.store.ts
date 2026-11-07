import { create } from 'zustand';
import type {
  ProjectDescriptor,
  FileNode,
  UIMode,
  SystemResourceMetrics,
  ProjectGraphData,
  CreateProjectOptions,
  ProjectSettings
} from '../../../shared/types';
import type { IndexStats } from '../../../shared/context';
import type { SkillMetadata, SkillExecutionRecord } from '../../../shared/skills';
import type { OrchestrationRecord, ApprovalRequest, OrchestrationTask } from '../../../shared/agents';
import type { WorkflowRecord, WorkflowExecutionRecord } from '../../../shared/workflows';
import type {
  CLIProvider,
  CLIInstallationStatus,
  CLIAuthStatus,
  CLISessionStatus,
  CLISessionRecord
} from '../../../shared/cli';
import type {
  ProjectExecution,
  ExecutionFileChange,
  CodeReview,
  ReviewComment,
  AIFinding,
  ProjectGitDetails,
  ReviewStatus
} from '../../../shared/review';

export type RightPanelTab =
  | 'files'
  | 'changes'
  | 'review'
  | 'outline'
  | 'agents'
  | 'context'
  | 'skills';

export type AppSection =
  | 'projects'
  | 'tasks'
  | 'flows'
  | 'editor'
  | 'terminal'
  | 'agents'
  | 'context'
  | 'skills'
  | 'analytics'
  | 'extensions'
  | 'providers'
  | 'graph';

export type TerminalLayout = '1' | '2-col' | '2-row' | '3-split' | '4-grid';

export interface TerminalSessionItem {
  id: string; // 'term-1', 'term-2'
  title: string;
  projectId: string;
  projectName: string;
  workingDirectory: string;
  branch: string;
  provider: CLIProvider;
  model: string;
  agentRole?: string;
  activeSkills: string[];
  status: CLISessionStatus;
  streamOutput: string;
  cliSessionId?: string;
  executionHistory?: any[];
}

export interface WorkspaceTab {
  id: string; // 'tab:file:...' or 'tab:term:...' or 'tab:flow:...' or 'tab:graph'
  type: 'file' | 'terminal' | 'flow' | 'project' | 'graph' | 'browser' | 'project-settings';
  title: string;
  filePath?: string;
  terminalId?: string;
  projectId?: string;
  content?: string;
  url?: string;
  isDirty?: boolean;
}

export interface FileSymbolItem {
  name: string;
  kind: string;
  line: number;
  end_line?: number;
  container_name?: string;
  signature?: string;
}

export interface GitStatusData {
  isGitRepo: boolean;
  branch: string;
  isClean: boolean;
  changedFiles: Array<{ path: string; status: string }>;
  diff: string;
  worktrees?: Array<{ path: string; head: string; branch: string; isMain: boolean; customName?: string; tag?: string; description?: string; customColor?: string }>;
}

export interface WorkspaceState {
  // Worktree customizations
  worktreeCustomizations: Record<string, { customName?: string; tag?: string; description?: string; customColor?: string }>;
  updateWorktreeCustomization: (projectPath: string, branch: string, data: { customName?: string; tag?: string; description?: string; customColor?: string }) => void;

  // 1. Projects & Left Sidebar
  project: ProjectDescriptor | null;
  recentProjects: ProjectDescriptor[];
  expandedProjectIds: Set<string>;
  files: FileNode[];
  isLeftSidebarOpen: boolean;
  leftSidebarWidth: number;
  activeSidebarSection: 'projects' | 'tasks' | 'flows';
  activeSection: AppSection;

  // 2. Open Tabs (Top Tab Bar)
  openTabs: WorkspaceTab[];
  activeTabId: string | null;

  // Active file in editor (if a file tab is active)
  activeFilePath: string | null;
  activeFileContent: string | null;
  activeFileSymbols: FileSymbolItem[];
  targetEditorLine: number | null;

  // 3. Terminal & Execution Sessions (Session-Aware)
  terminalSessions: TerminalSessionItem[];
  activeTerminalId: string | null;
  activeSessionId: string | null;
  sessionStatus: CLISessionStatus;
  streamOutput: string;
  sessionsHistory: any[];
  terminalLayout: TerminalLayout;
  maximizedTerminalId: string | null;
  detachedTerminalIds: string[];
  isArcLauncherOpen: boolean;
  splitTerminalId: string | null;

  // 4. Right Sidebar (Contextual Operational Control Center)
  isRightPanelOpen: boolean;
  rightPanelWidth: number;
  rightPanelTab: RightPanelTab;
  fileFilter: string;

  // Backward compatibility aliases
  isExplorerOpen: boolean;
  explorerWidth: number;
  explorerTab: string;

  // 5. Git & Changes
  gitStatus: GitStatusData | null;

  // Project Explorer: Files, Changes & Review
  explorerActiveTab: 'files' | 'changes' | 'review';
  executions: ProjectExecution[];
  activeExecutionId: string | null;
  executionFileChanges: Record<string, ExecutionFileChange[]>;
  codeReview: CodeReview | null;
  reviewComments: ReviewComment[];
  aiReviewFindings: AIFinding[];
  projectGitDetails: ProjectGitDetails | null;
  selectedDiffFile: string | null;
  diffViewMode: 'unified' | 'side-by-side';
  changesFilter: 'all' | 'ai' | 'manual' | 'modified' | 'added' | 'deleted';
  isAIEvaluationRunning: boolean;

  // 6. Context & Knowledge Engine
  indexStats: IndexStats | null;
  setIndexStats: (stats: IndexStats | null) => void;

  // 7. Multi-Agent Orchestration
  activeOrchestration: OrchestrationRecord | null;
  setActiveOrchestration: (orch: OrchestrationRecord | null) => void;
  orchestrationsHistory: OrchestrationRecord[];
  setOrchestrationsHistory: (history: OrchestrationRecord[]) => void;
  pendingApprovals: ApprovalRequest[];
  setPendingApprovals: (approvals: ApprovalRequest[]) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;

  // 8. Skills & Models
  skills: SkillMetadata[];
  setSkills: (skills: SkillMetadata[]) => void;
  selectedSkillId: string | null;
  setSelectedSkillId: (id: string | null) => void;
  skillExecutions: SkillExecutionRecord[];
  setSkillExecutions: (execs: SkillExecutionRecord[]) => void;

  cliStatuses: Partial<Record<CLIProvider, CLIInstallationStatus>> | null;
  cliAuthStatuses: Partial<Record<CLIProvider, CLIAuthStatus>> | null;
  activeProvider: CLIProvider;
  customPaths: Partial<Record<CLIProvider, string>>;

  // 9. Workflows & Visual Flows
  workflows: WorkflowRecord[];
  setWorkflows: (workflows: WorkflowRecord[]) => void;
  activeWorkflow: WorkflowRecord | null;
  setActiveWorkflow: (wf: WorkflowRecord | null) => void;
  workflowTemplates: any[];
  setWorkflowTemplates: (templates: any[]) => void;

  // 10. Bottom Panel (Execution, Logs, Problems, Debug)
  isBottomPanelOpen: boolean;
  bottomPanelHeight: number;
  bottomPanelTab: 'terminal' | 'problems' | 'logs' | 'debug' | 'git';
  isLogsDrawerOpen: boolean;
  metrics: SystemResourceMetrics | null;
  logs: Array<{ id: string; timestamp: string; message: string; level: 'info' | 'warn' | 'error' }>;
  isSettingsOpen: boolean;
  isCommandPaletteOpen: boolean;
  expandedDirs: Set<string>;
  uiMode: UIMode;
  theme: 'glass' | 'solid' | 'dark' | 'light' | 'system';
  fileIconTheme: 'material' | 'minimal';
  showGitFileColors: boolean;
  setFileIconTheme: (theme: 'material' | 'minimal') => void;
  setShowGitFileColors: (show: boolean) => void;

  // AI Intelligence Graph State
  projectGraph: ProjectGraphData | null;
  isGraphLoading: boolean;
  selectedGraphNodeId: string | null;
  graphFilterCategory: string | null;
  isOrphanFilterActive: boolean;

  // Actions
  setProject: (project: ProjectDescriptor | null) => void;
  createProject: (options: CreateProjectOptions) => Promise<ProjectDescriptor>;
  toggleProjectFavorite: (projectId: string) => Promise<boolean>;
  saveProjectSettings: (projectId: string, settings: ProjectSettings) => Promise<boolean>;
  removeStaleProject: (projectId: string) => Promise<void>;
  setRecentProjects: (projects: ProjectDescriptor[]) => void;
  closeProject: (projectId: string) => Promise<void>;
  updateProjectCustomization: (projectId: string, updates: Partial<ProjectDescriptor>) => Promise<ProjectDescriptor>;
  createProjectWorktree: (projectPath: string, branchName: string) => Promise<boolean>;
  removeProjectWorktree: (projectPath: string, worktreePath: string, branchName?: string) => Promise<boolean>;
  toggleProjectExpanded: (projectId: string) => void;
  setFiles: (files: FileNode[]) => void;
  setActiveSection: (section: AppSection) => void;
  setActiveSidebarSection: (section: 'projects' | 'tasks' | 'flows') => void;

  // Workspace Persistence & Recovery (Phase 4)
  restoreProjectWorkspace: (project: ProjectDescriptor) => Promise<void>;
  saveCurrentProjectWorkspaceState: () => void;
  flushSaveCurrentWorkspaceState: () => Promise<void>;
  saveAppLayout: () => void;

  // File System Operations
  createFile: (filePath: string, content?: string) => Promise<boolean>;
  createDirectory: (dirPath: string) => Promise<boolean>;
  renameItem: (oldPath: string, newName: string) => Promise<boolean>;
  deleteItem: (targetPath: string) => Promise<boolean>;
  moveItem: (sourcePath: string, destinationDir: string) => Promise<boolean>;

  // Tab & Editor Actions
  setActiveTabId: (tabId: string | null) => void;
  openFileTab: (filePath: string, content: string) => void;
  setActiveFile: (filePath: string, content?: string) => Promise<void>;
  openTerminalTab: (terminalId?: string) => void;
  openProjectTab: (projectId: string, projectName: string) => void;
  openProjectSettingsTab: (projectId: string) => void;
  openFlowTab: (workflow: WorkflowRecord) => void;
  openGraphTab: () => void;
  openBrowserTab: (url?: string) => void;
  closeTab: (tabId: string) => void;
  updateActiveFileContent: (content: string) => void;
  saveActiveFile: () => Promise<boolean>;
  loadFileSymbols: (filePath: string) => Promise<void>;

  // Graph Actions
  loadProjectGraph: (customPath?: string) => Promise<void>;
  setSelectedGraphNodeId: (id: string | null) => void;
  setGraphFilterCategory: (category: string | null) => void;
  setIsOrphanFilterActive: (active: boolean) => void;

  // Terminal Session Actions
  createTerminalSession: (provider?: CLIProvider) => string;
  removeTerminalSession: (id: string) => void;
  setActiveTerminalId: (id: string) => void;
  updateTerminalSession: (id: string, updates: Partial<TerminalSessionItem>) => void;
  appendTerminalOutput: (id: string, text: string) => void;
  clearTerminalOutput: (id: string) => void;
  setActiveSessionId: (id: string | null) => void;
  setSessionStatus: (status: CLISessionStatus) => void;
  appendStreamOutput: (text: string) => void;
  clearStreamOutput: () => void;
  setSessionsHistory: (history: any[]) => void;
  setTerminalLayout: (layout: TerminalLayout) => void;
  setMaximizedTerminalId: (id: string | null) => void;
  toggleDetachTerminal: (id: string) => void;
  reorderTerminalSessions: (startIndex: number, endIndex: number) => void;
  reorderTabs: (sourceId: string, targetId: string) => void;
  handleCLIStreamEvent: (event: any) => void;
  setArcLauncherOpen: (open: boolean) => void;
  setSplitTerminalId: (id: string | null) => void;

  // Right Panel Actions
  setRightPanelTab: (tab: RightPanelTab) => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
  setRightPanelWidth: (w: number) => void;
  setFileFilter: (filter: string) => void;

  // Aliases for compatibility
  toggleExplorer: () => void;
  setExplorerTab: (tab: any) => void;
  setExplorerWidth: (w: number) => void;

  // Left Sidebar Actions
  setLeftSidebarOpen: (open: boolean) => void;
  toggleLeftSidebar: () => void;
  setLeftSidebarWidth: (w: number) => void;

  // Bottom Panel Actions
  setBottomPanelOpen: (open: boolean) => void;
  toggleBottomPanel: () => void;
  setBottomPanelHeight: (h: number) => void;
  setBottomPanelTab: (tab: 'terminal' | 'problems' | 'logs' | 'debug' | 'git') => void;

  // Global Controls
  setLogsDrawerOpen: (open: boolean) => void;
  toggleLogsDrawer: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setTargetEditorLine: (line: number | null) => void;
  toggleSettings: (open?: boolean) => void;
  settingsActiveTab: string;
  setSettingsActiveTab: (tab: string) => void;
  openSettingsToTab: (tab: string) => void;
  agentPermissions: 'full_access' | 'supervised' | 'read_only';
  setAgentPermissions: (p: 'full_access' | 'supervised' | 'read_only') => void;
  agentModes: Record<string, 'chat' | 'cli'>;
  setAgentMode: (agentId: string, mode: 'chat' | 'cli') => void;
  agentEnabled: Record<string, boolean>;
  setAgentEnabled: (agentId: string, enabled: boolean) => void;
  setTheme: (theme: 'glass' | 'solid' | 'dark' | 'light' | 'system') => void;
  setUiMode: (uiMode: UIMode) => void;
  toggleDirExpanded: (dirId: string) => void;
  collapseAllDirs: () => void;
  setMetrics: (metrics: SystemResourceMetrics) => void;
  addLog: (message: string, level?: 'info' | 'warn' | 'error') => void;
  clearLogs: () => void;
  setCustomPath: (provider: CLIProvider, path: string) => void;
  loadGitStatus: (projectPath: string) => Promise<void>;

  // Project Explorer Actions
  setExplorerActiveTab: (tab: 'files' | 'changes' | 'review') => void;
  loadProjectExecutions: () => Promise<void>;
  loadExecutionFileChanges: (executionId: string) => Promise<ExecutionFileChange[]>;
  loadCodeReview: (executionId?: string) => Promise<void>;
  updateReviewDecision: (status: ReviewStatus, summary?: string) => Promise<void>;
  markFileReviewStatus: (filePath: string, status: 'pending' | 'reviewed' | 'changes_requested') => Promise<void>;
  addReviewComment: (filePath: string, content: string, lineNumber?: number, diffHunk?: string, parentCommentId?: string) => Promise<void>;
  resolveReviewComment: (commentId: string, resolved: boolean) => Promise<void>;
  runAICodeReview: () => Promise<void>;
  loadProjectGitDetails: () => Promise<void>;
  setSelectedDiffFile: (filePath: string | null) => void;
  setDiffViewMode: (mode: 'unified' | 'side-by-side') => void;
  setChangesFilter: (filter: 'all' | 'ai' | 'manual' | 'modified' | 'added' | 'deleted') => void;
  syncManualChanges: () => Promise<void>;

  setCLIStatuses: (statuses: Partial<Record<CLIProvider, CLIInstallationStatus>>) => void;
  setCLIAuthStatuses: (auths: Partial<Record<CLIProvider, CLIAuthStatus>>) => void;
  setActiveProvider: (provider: CLIProvider) => void;
}

// ==========================================
// Phase 4: Debounced Persistence Utilities
// ==========================================
let saveWorkspaceDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let saveLayoutDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleSaveWorkspaceState = (get: () => WorkspaceState) => {
  if (typeof window === 'undefined' || !window.api?.saveProjectWorkspaceState) return;
  if (saveWorkspaceDebounceTimer) clearTimeout(saveWorkspaceDebounceTimer);
  saveWorkspaceDebounceTimer = setTimeout(() => {
    saveWorkspaceDebounceTimer = null;
    const state = get();
    const proj = state.project;
    if (!proj?.id || typeof window === 'undefined' || !window.api?.saveProjectWorkspaceState) return;

    const sanitizedTabs = state.openTabs.map((t) => ({
      id: t.id,
      type: t.type,
      title: t.title,
      filePath: t.filePath,
      terminalId: t.terminalId,
      url: t.url
    }));

    const sanitizedTerms = state.terminalSessions.map((ts) => ({
      id: ts.id,
      title: ts.title,
      projectId: ts.projectId || proj.id,
      projectName: ts.projectName || proj.name,
      workingDirectory: ts.workingDirectory || proj.path,
      branch: ts.branch,
      provider: ts.provider,
      model: ts.model,
      status: ts.status,
      streamOutput: ts.streamOutput ? ts.streamOutput.slice(-50000) : ''
    }));

    window.api.saveProjectWorkspaceState({
      projectId: proj.id,
      state: {
        projectId: proj.id,
        openTabs: sanitizedTabs,
        activeTabId: state.activeTabId,
        activeFilePath: state.activeFilePath,
        expandedDirs: Array.from(state.expandedDirs),
        fileFilter: state.fileFilter,
        terminalSessions: sanitizedTerms,
        activeTerminalId: state.activeTerminalId,
        targetEditorLine: state.targetEditorLine
      }
    }).catch(() => {});
  }, 400);
};

const flushSaveWorkspaceState = async (state: WorkspaceState) => {
  if (saveWorkspaceDebounceTimer) {
    clearTimeout(saveWorkspaceDebounceTimer);
    saveWorkspaceDebounceTimer = null;
  }
  const proj = state.project;
  if (!proj?.id || typeof window === 'undefined' || !window.api?.saveProjectWorkspaceState) return;

  const sanitizedTabs = state.openTabs.map((t) => ({
    id: t.id,
    type: t.type,
    title: t.title,
    filePath: t.filePath,
    terminalId: t.terminalId,
    url: t.url
  }));

  const sanitizedTerms = state.terminalSessions.map((ts) => ({
    id: ts.id,
    title: ts.title,
    projectId: ts.projectId || proj.id,
    projectName: ts.projectName || proj.name,
    workingDirectory: ts.workingDirectory || proj.path,
    branch: ts.branch,
    provider: ts.provider,
    model: ts.model,
    status: ts.status,
    streamOutput: ts.streamOutput ? ts.streamOutput.slice(-50000) : ''
  }));

  try {
    await window.api.saveProjectWorkspaceState({
      projectId: proj.id,
      state: {
        projectId: proj.id,
        openTabs: sanitizedTabs,
        activeTabId: state.activeTabId,
        activeFilePath: state.activeFilePath,
        expandedDirs: Array.from(state.expandedDirs),
        fileFilter: state.fileFilter,
        terminalSessions: sanitizedTerms,
        activeTerminalId: state.activeTerminalId,
        targetEditorLine: state.targetEditorLine
      }
    });
  } catch {
    // silent fallback
  }
};

const scheduleSaveLayout = (get: () => WorkspaceState) => {
  if (typeof window === 'undefined' || !window.api?.saveAppLayout) return;
  if (saveLayoutDebounceTimer) clearTimeout(saveLayoutDebounceTimer);
  saveLayoutDebounceTimer = setTimeout(() => {
    saveLayoutDebounceTimer = null;
    const s = get();
    if (typeof window === 'undefined' || !window.api?.saveAppLayout) return;

    window.api.saveAppLayout({
      layout: {
        isLeftSidebarOpen: s.isLeftSidebarOpen,
        leftSidebarWidth: s.leftSidebarWidth,
        isRightPanelOpen: s.isRightPanelOpen,
        rightPanelWidth: s.rightPanelWidth,
        isBottomPanelOpen: s.isBottomPanelOpen,
        bottomPanelHeight: s.bottomPanelHeight,
        activeSection: s.activeSection,
        activeSidebarSection: s.activeSidebarSection,
        rightPanelTab: s.rightPanelTab,
        bottomPanelTab: s.bottomPanelTab,
        terminalLayout: s.terminalLayout
      }
    }).catch(() => {});
  }, 500);
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  worktreeCustomizations: (() => {
    try {
      const saved = localStorage.getItem('orc_worktree_customizations');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  })(),

  updateWorktreeCustomization: (projectPath, branch, data) => {
    const key = `${projectPath}::${branch}`;
    set((state) => {
      const next = { ...state.worktreeCustomizations, [key]: data };
      try {
        localStorage.setItem('orc_worktree_customizations', JSON.stringify(next));
      } catch {}
      return { worktreeCustomizations: next };
    });
  },

  project: null,
  recentProjects: [],
  expandedProjectIds: new Set(),
  files: [],
  isLeftSidebarOpen: true,
  leftSidebarWidth: 240,
  activeSidebarSection: 'projects',
  activeSection: 'terminal',

  openTabs: [],
  activeTabId: null,

  activeFilePath: null,
  activeFileContent: null,
  activeFileSymbols: [],
  targetEditorLine: null,

  terminalSessions: [],
  activeTerminalId: null,
  activeSessionId: null,
  sessionStatus: 'idle',
  streamOutput: '',
  sessionsHistory: [],
  terminalLayout: '1',
  maximizedTerminalId: null,
  detachedTerminalIds: [],
  isArcLauncherOpen: false,
  splitTerminalId: null,

  isRightPanelOpen: true,
  rightPanelWidth: 280,
  rightPanelTab: 'files',
  fileFilter: '',

  isExplorerOpen: true,
  explorerWidth: 280,
  explorerTab: 'files',

  gitStatus: null,

  explorerActiveTab: 'files',
  executions: [],
  activeExecutionId: null,
  executionFileChanges: {},
  codeReview: null,
  reviewComments: [],
  aiReviewFindings: [],
  projectGitDetails: null,
  selectedDiffFile: null,
  diffViewMode: 'unified',
  changesFilter: 'all',
  isAIEvaluationRunning: false,

  indexStats: null,
  setIndexStats: (indexStats) => set({ indexStats }),

  activeOrchestration: null,
  setActiveOrchestration: (activeOrchestration) => set({ activeOrchestration }),
  orchestrationsHistory: [],
  setOrchestrationsHistory: (orchestrationsHistory) => set({ orchestrationsHistory }),
  pendingApprovals: [],
  setPendingApprovals: (pendingApprovals) => set({ pendingApprovals }),
  selectedAgentId: null,
  setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),

  skills: [],
  setSkills: (skills) => set({ skills }),
  selectedSkillId: null,
  setSelectedSkillId: (selectedSkillId) => set({ selectedSkillId }),
  skillExecutions: [],
  setSkillExecutions: (skillExecutions) => set({ skillExecutions }),

  cliStatuses: null,
  cliAuthStatuses: null,
  activeProvider: 'antigravity',
  settingsActiveTab: 'appearance',
  agentPermissions: 'full_access',
  agentModes: {
    codex: 'cli',
    copilot: 'cli',
    opencode: 'cli',
    gemini: 'cli',
    antigravity: 'cli',
    codebuff: 'cli',
    kimi: 'cli',
    qwen: 'cli'
  },
  agentEnabled: {
    codex: true,
    copilot: true,
    opencode: true,
    gemini: true,
    antigravity: true,
    codebuff: true,
    kimi: true,
    qwen: true
  },
  customPaths: {
    powershell: '',
    cmd: '',
    bash: '',
    antigravity: '',
    claude: '',
    codex: '',
    gemini: '',
    ollama: ''
  },

  workflows: [],
  setWorkflows: (workflows) => set({ workflows }),
  activeWorkflow: null,
  setActiveWorkflow: (activeWorkflow) => set({ activeWorkflow }),
  workflowTemplates: [],
  setWorkflowTemplates: (workflowTemplates) => set({ workflowTemplates }),

  isBottomPanelOpen: false,
  bottomPanelHeight: 180,
  bottomPanelTab: 'terminal',
  isLogsDrawerOpen: false,
  metrics: null,
  logs: [
    {
      id: 'log-init',
      timestamp: new Date().toLocaleTimeString(),
      message: 'AI Workspace session initialized. Project-centric architecture active.',
      level: 'info'
    }
  ],
  isSettingsOpen: false,
  isCommandPaletteOpen: false,
  expandedDirs: new Set(),
  uiMode: 'advanced',
  theme: 'glass',
  fileIconTheme: 'material',
  showGitFileColors: true,
  projectGraph: null,
  isGraphLoading: false,
  selectedGraphNodeId: null,
  graphFilterCategory: null,
  isOrphanFilterActive: false,

  // Projects & Navigation
  setProject: (project) => {
    if (typeof window !== 'undefined' && window.api?.setDiscordActiveProject) {
      window.api.setDiscordActiveProject(project).catch(() => {});
    }

    if (!project) {
      set({
        project: null,
        files: [],
        gitStatus: null,

  explorerActiveTab: 'files',
  executions: [],
  activeExecutionId: null,
  executionFileChanges: {},
  codeReview: null,
  reviewComments: [],
  aiReviewFindings: [],
  projectGitDetails: null,
  selectedDiffFile: null,
  diffViewMode: 'unified',
  changesFilter: 'all',
  isAIEvaluationRunning: false,
        activeFilePath: null,
        activeFileContent: null,
        activeFileSymbols: [],
        openTabs: get().openTabs.filter((t) => t.type !== 'file')
      });
      return;
    }

    set((state) => {
      const updatedSessions = state.terminalSessions.map((ts) =>
        ts.id === state.activeTerminalId
          ? {
              ...ts,
              projectId: project.id,
              projectName: project.name,
              workingDirectory: project.path,
              branch: project.activeBranch || 'main',
              provider: (project.settings?.defaultProvider as any) || ts.provider,
              model: project.settings?.defaultModel || ts.model
            }
          : ts
      );
      const nextExpanded = new Set(state.expandedProjectIds);
      nextExpanded.add(project.id);
      return {
        project,
        terminalSessions: updatedSessions,
        expandedProjectIds: nextExpanded,
        activeSection: 'projects'
      };
    });

    if (typeof window !== 'undefined' && window.api?.updateSettings) {
      window.api.updateSettings({ currentProjectId: project.id }).catch(() => {});
    }

    get().loadGitStatus(project.path);
    scheduleSaveWorkspaceState(get);
  },

  restoreProjectWorkspace: async (project) => {
    const currentState = get();
    if (currentState.project?.id && currentState.project.id !== project.id) {
      await flushSaveWorkspaceState(currentState);
    }

    get().setProject(project);

    let savedState: any = null;
    if (typeof window !== 'undefined' && window.api?.getProjectWorkspaceState) {
      try {
        savedState = await window.api.getProjectWorkspaceState({ projectId: project.id });
      } catch {
        savedState = null;
      }
    }

    const nextExpanded = new Set(get().expandedProjectIds);
    nextExpanded.add(project.id);

    if (savedState) {
      const restoredTabs: WorkspaceTab[] = savedState.openTabs || [];
      const restoredActiveTabId: string | null = savedState.activeTabId || (restoredTabs[0]?.id ?? null);
      let restoredActiveFilePath: string | null = savedState.activeFilePath || null;
      let activeContent: string | null = null;

      if (restoredActiveFilePath && typeof window !== 'undefined' && window.api?.readFileContent) {
        try {
          activeContent = await window.api.readFileContent({
            filePath: restoredActiveFilePath,
            projectPath: project.path
          });
        } catch {
          activeContent = null;
          restoredActiveFilePath = null;
        }
      }

      let restoredTerms: TerminalSessionItem[] = [];
      if (Array.isArray(savedState.terminalSessions) && savedState.terminalSessions.length > 0) {
        restoredTerms = savedState.terminalSessions.map((ts: any) => ({
          ...ts,
          activeSkills: ts.activeSkills || [],
          status: ts.status === 'running' ? 'idle' : (ts.status || 'idle'),
          streamOutput: ts.streamOutput || ''
        }));
      } else {
        restoredTerms = get().terminalSessions;
      }

      const activeTermId = savedState.activeTerminalId || restoredTerms[0]?.id || null;

      set((s) => ({
        openTabs: restoredTabs.length > 0 ? restoredTabs : s.openTabs,
        activeTabId: restoredActiveTabId ?? s.activeTabId,
        activeFilePath: restoredActiveFilePath ?? s.activeFilePath,
        activeFileContent: activeContent ?? s.activeFileContent,
        expandedDirs: new Set(savedState.expandedDirs || []),
        fileFilter: savedState.fileFilter || '',
        terminalSessions: restoredTerms.length > 0 ? restoredTerms : s.terminalSessions,
        activeTerminalId: activeTermId,
        targetEditorLine: savedState.targetEditorLine ?? null,
        expandedProjectIds: nextExpanded,
        activeSection: restoredActiveFilePath ? 'editor' : s.activeSection
      }));

      if (restoredActiveFilePath) {
        get().loadFileSymbols(restoredActiveFilePath);
      }
    } else {
      const existingTerms = get().terminalSessions;
      if (existingTerms.length === 0) {
        const defaultTermId = `term-${Date.now()}`;
        const defaultTerm: TerminalSessionItem = {
          id: defaultTermId,
          title: `PowerShell 1`,
          projectId: project.id,
          projectName: project.name,
          workingDirectory: project.path,
          branch: project.activeBranch || 'main',
          provider: (project.settings?.defaultProvider as any) || 'powershell',
          model: project.settings?.defaultModel || 'gpt-4o',
          activeSkills: [],
          status: 'idle',
          streamOutput: ''
        };

        const defaultTab: WorkspaceTab = {
          id: `term:${defaultTermId}`,
          type: 'terminal',
          title: defaultTerm.title,
          terminalId: defaultTermId
        };

        set({
          openTabs: [defaultTab],
          activeTabId: defaultTab.id,
          terminalSessions: [defaultTerm],
          activeTerminalId: defaultTermId
        });
      }
    }

    get().loadGitStatus(project.path);
    if (typeof window !== 'undefined' && window.api?.listFiles) {
      try {
        const fileList = await window.api.listFiles({ projectPath: project.path });
        set({ files: fileList });
        get().loadProjectGraph(project.path);
      } catch {
        set({ files: [] });
      }
    }
  },

  saveCurrentProjectWorkspaceState: () => {
    scheduleSaveWorkspaceState(get);
  },

  flushSaveCurrentWorkspaceState: async () => {
    await flushSaveWorkspaceState(get());
  },

  saveAppLayout: () => {
    scheduleSaveLayout(get);
  },

  createProject: async (options) => {
    try {
      const desc = await window.api.createProject(options);
      get().setProject(desc);
      try {
        const fileList = await window.api.listFiles({ projectPath: desc.path });
        set({ files: fileList });
        get().loadProjectGraph(desc.path);
      } catch {}
      const recents = await window.api.getRecentProjects();
      set({ recentProjects: recents });
      get().addLog(`Created and initialized project: ${desc.name}`, 'info');
      return desc;
    } catch (err: any) {
      get().addLog(`Failed to create project: ${err.message}`, 'error');
      throw err;
    }
  },

  toggleProjectFavorite: async (projectId: string) => {
    try {
      const isFav = await window.api.toggleProjectFavorite({ projectId });
      set((state) => {
        const nextRecents = state.recentProjects.map((p) =>
          p.id === projectId ? { ...p, isFavorite: isFav } : p
        );
        const nextCurrent = state.project?.id === projectId ? { ...state.project, isFavorite: isFav } : state.project;
        return { recentProjects: nextRecents, project: nextCurrent };
      });
      get().addLog(`Project ${isFav ? 'marked as favorite' : 'removed from favorites'}`, 'info');
      return isFav;
    } catch (err: any) {
      get().addLog(`Failed to toggle favorite: ${err.message}`, 'error');
      return false;
    }
  },

  saveProjectSettings: async (projectId: string, settings: ProjectSettings) => {
    try {
      await window.api.saveProjectSettings({ projectId, settings });
      set((state) => {
        const nextRecents = state.recentProjects.map((p) =>
          p.id === projectId ? { ...p, settings } : p
        );
        const nextCurrent = state.project?.id === projectId ? { ...state.project, settings } : state.project;
        return { recentProjects: nextRecents, project: nextCurrent };
      });
      get().addLog(`Saved project settings`, 'info');
      return true;
    } catch (err: any) {
      get().addLog(`Failed to save project settings: ${err.message}`, 'error');
      return false;
    }
  },

  removeStaleProject: async (projectId: string) => {
    await get().closeProject(projectId);
  },

  setRecentProjects: (recentProjects) => set({ recentProjects }),

  closeProject: async (projectId: string) => {
    const state = get();
    try {
      await window.api.removeProject(projectId);
    } catch {
      // ignore
    }

    const remainingRecents = state.recentProjects.filter((p) => p.id !== projectId);
    const nextExpanded = new Set(state.expandedProjectIds);
    nextExpanded.delete(projectId);

    if (state.project?.id === projectId) {
      if (remainingRecents.length > 0) {
        const nextProj = remainingRecents[0];
        set({
          recentProjects: remainingRecents,
          expandedProjectIds: nextExpanded
        });
        state.setProject(nextProj);
        try {
          const files = await window.api.listFiles({ projectPath: nextProj.path });
          set({ files });
        } catch {
          set({ files: [] });
        }
      } else {
        set({
          project: null,
          recentProjects: [],
          expandedProjectIds: nextExpanded,
          files: [],
          gitStatus: null,

  explorerActiveTab: 'files',
  executions: [],
  activeExecutionId: null,
  executionFileChanges: {},
  codeReview: null,
  reviewComments: [],
  aiReviewFindings: [],
  projectGitDetails: null,
  selectedDiffFile: null,
  diffViewMode: 'unified',
  changesFilter: 'all',
  isAIEvaluationRunning: false,
          activeFilePath: null,
          activeFileContent: null,
          activeFileSymbols: [],
          openTabs: state.openTabs.filter((t) => t.type !== 'file')
        });
      }
    } else {
      set({
        recentProjects: remainingRecents,
        expandedProjectIds: nextExpanded
      });
    }
    state.addLog(`Closed project`, 'info');
  },

  updateProjectCustomization: async (projectId: string, updates: Partial<ProjectDescriptor>) => {
    try {
      const updated = await window.api.updateProject({ projectId, updates });
      set((state) => {
        const nextRecents = state.recentProjects.map((p) => (p.id === projectId ? { ...p, ...updated } : p));
        const nextCurrent = state.project?.id === projectId ? { ...state.project, ...updated } : state.project;
        return {
          recentProjects: nextRecents,
          project: nextCurrent
        };
      });
      get().addLog(`Project customized successfully`, 'info');
      return updated;
    } catch (err: any) {
      get().addLog(`Failed to customize project: ${err.message}`, 'error');
      throw err;
    }
  },

  createProjectWorktree: async (projectPath: string, branchName: string) => {
    const state = get();
    try {
      state.addLog(`Creating worktree '${branchName}'...`, 'info');
      const res = await window.api.createWorktree({ projectPath, branchName });
      if (res && res.success !== false) {
        state.addLog(`Worktree created: ${branchName}`, 'info');
        await state.loadGitStatus(projectPath);
        return true;
      } else {
        state.addLog(`Worktree creation failed: ${res?.error || 'Unknown error'}`, 'error');
        return false;
      }
    } catch (err: any) {
      state.addLog(`Failed to create worktree: ${err.message}`, 'error');
      return false;
    }
  },

  removeProjectWorktree: async (projectPath: string, worktreePath: string, branchName?: string) => {
    const state = get();
    try {
      state.addLog(`Removing worktree: ${worktreePath}...`, 'info');
      await window.api.removeWorktree({ projectPath, worktreePath, branchName });
      state.addLog(`Worktree removed`, 'info');
      await state.loadGitStatus(projectPath);
      return true;
    } catch (err: any) {
      state.addLog(`Failed to remove worktree: ${err.message}`, 'error');
      return false;
    }
  },

  toggleProjectExpanded: (projectId) =>
    set((s) => {
      const next = new Set(s.expandedProjectIds);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return { expandedProjectIds: next };
    }),

  setFiles: (files) => set({ files }),
  setActiveSection: (activeSection) => {
    if (activeSection === 'tasks' || activeSection === 'flows' || activeSection === 'graph' || activeSection === 'agents') {
      set({ activeSection, activeTabId: null });
    } else {
      set({ activeSection });
    }
    scheduleSaveLayout(get);
  },
  setActiveSidebarSection: (activeSidebarSection) => {
    set({ activeSidebarSection });
    scheduleSaveLayout(get);
  },

  // Top Tabs & Contextual Switching
  setActiveTabId: (activeTabId) => {
    const state = get();
    const tab = state.openTabs.find((t) => t.id === activeTabId);
    if (!tab) {
      set({ activeTabId: null });
      return;
    }

    if (tab.type === 'file' && tab.filePath) {
      set({
        activeTabId,
        activeFilePath: tab.filePath,
        activeFileContent: tab.content || '',
        activeSection: 'editor'
      });
      state.loadFileSymbols(tab.filePath);
    } else if (tab.type === 'terminal' && tab.terminalId) {
      const term = state.terminalSessions.find((t) => t.id === tab.terminalId);
      set({
        activeTabId,
        activeTerminalId: tab.terminalId,
        activeFilePath: null,
        activeFileContent: null,
        activeSection: 'terminal',
        streamOutput: term ? term.streamOutput : state.streamOutput,
        sessionStatus: term ? term.status : state.sessionStatus
      });
    } else if (tab.type === 'project') {
      set({
        activeTabId,
        activeFilePath: null,
        activeFileContent: null,
        activeSection: 'terminal'
      });
    } else if (tab.type === 'flow') {
      set({
        activeTabId,
        activeFilePath: null,
        activeFileContent: null,
        activeSection: 'flows'
      });
    } else if (tab.type === 'graph') {
      set({
        activeTabId,
        activeFilePath: null,
        activeFileContent: null,
        activeSection: 'graph'
      });
    } else if (tab.type === 'browser') {
      set({
        activeTabId,
        activeFilePath: null,
        activeFileContent: null,
        activeSection: 'terminal'
      });
    }
    scheduleSaveWorkspaceState(get);
    scheduleSaveLayout(get);
  },

  openFileTab: (filePath, content) => {
    const tabId = `file:${filePath}`;
    const fileName = filePath.split(/[/\\]/).pop() || filePath;

    set((state) => {
      const existing = state.openTabs.find((t) => t.id === tabId);
      let updatedTabs = [...state.openTabs];
      if (existing) {
        updatedTabs = updatedTabs.map((t) => (t.id === tabId ? { ...t, content } : t));
      } else {
        updatedTabs.push({
          id: tabId,
          type: 'file',
          title: fileName,
          filePath,
          content,
          isDirty: false
        });
      }

      return {
        openTabs: updatedTabs,
        activeTabId: tabId,
        activeFilePath: filePath,
        activeFileContent: content,
        activeSection: 'editor'
      };
    });

    get().loadFileSymbols(filePath);
    scheduleSaveWorkspaceState(get);
  },

  setActiveFile: async (filePath, content) => {
    let fileContent = content;
    const project = get().project;
    if (fileContent === undefined && project) {
      try {
        fileContent = await window.api.readFileContent({
          filePath,
          projectPath: project.path
        });
      } catch {
        fileContent = '';
      }
    }
    get().openFileTab(filePath, fileContent || '');
  },

  openTerminalTab: (terminalId) => {
    const state = get();
    const targetId = terminalId || state.createTerminalSession();
    const tabId = `term:${targetId}`;
    const term = state.terminalSessions.find((t) => t.id === targetId);

    set((s) => {
      const existing = s.openTabs.find((t) => t.id === tabId);
      let updatedTabs = [...s.openTabs];
      if (!existing) {
        updatedTabs.push({
          id: tabId,
          type: 'terminal',
          title: term?.title || 'Terminal',
          terminalId: targetId
        });
      }
      return {
        openTabs: updatedTabs,
        activeTabId: tabId,
        activeTerminalId: targetId,
        activeFilePath: null,
        activeFileContent: null,
        activeSection: 'terminal',
        streamOutput: term ? term.streamOutput : s.streamOutput,
        sessionStatus: term ? term.status : s.sessionStatus
      };
    });
    scheduleSaveWorkspaceState(get);
  },

  openProjectTab: (projectId, projectName) => {
    const tabId = `proj:${projectId}`;
    set((state) => {
      const existing = state.openTabs.find((t) => t.id === tabId);
      let updatedTabs = [...state.openTabs];
      if (!existing) {
        updatedTabs.push({
          id: tabId,
          type: 'project',
          title: `${projectName} (Overview)`
        });
      }
      return {
        openTabs: updatedTabs,
        activeTabId: tabId,
        activeFilePath: null,
        activeFileContent: null,
        activeSection: 'terminal'
      };
    });
  },

  openProjectSettingsTab: (projectId) => {
    const tabId = `settings:${projectId}`;
    const proj = get().recentProjects.find((p) => p.id === projectId) || get().project;
    const name = proj?.customName || proj?.name || 'Project';

    set((state) => {
      const existing = state.openTabs.find((t) => t.id === tabId);
      let updatedTabs = [...state.openTabs];
      if (!existing) {
        updatedTabs.push({
          id: tabId,
          type: 'project-settings',
          title: `Settings: ${name}`,
          projectId
        });
      }
      return {
        openTabs: updatedTabs,
        activeTabId: tabId,
        activeFilePath: null,
        activeFileContent: null,
        activeSection: 'projects'
      };
    });
  },

  openFlowTab: (workflow) => {
    const tabId = `flow:${workflow.id}`;
    set((state) => {
      const existing = state.openTabs.find((t) => t.id === tabId);
      let updatedTabs = [...state.openTabs];
      if (!existing) {
        updatedTabs.push({
          id: tabId,
          type: 'flow',
          title: workflow.name
        });
      }
      return {
        openTabs: updatedTabs,
        activeTabId: tabId,
        activeWorkflow: workflow,
        activeFilePath: null,
        activeFileContent: null,
        activeSection: 'flows'
      };
    });
  },

  openGraphTab: () => {
    const tabId = 'tab:intelligence-graph';
    set((state) => {
      const existing = state.openTabs.find((t) => t.id === tabId);
      let updatedTabs = [...state.openTabs];
      if (!existing) {
        updatedTabs.push({
          id: tabId,
          type: 'graph',
          title: 'Intelligence Graph'
        });
      }
      return {
        openTabs: updatedTabs,
        activeTabId: tabId,
        activeFilePath: null,
        activeFileContent: null,
        activeSection: 'graph'
      };
    });
    get().loadProjectGraph();
  },

  openBrowserTab: (url = 'https://www.google.com') => {
    const tabId = `browser:${Date.now()}`;
    const domain = url.includes('google') ? 'Google' : (url.replace(/^https?:\/\//, '').split('/')[0] || 'Browser');
    set((state) => {
      const newTab: WorkspaceTab = {
        id: tabId,
        type: 'browser',
        title: domain,
        url
      };
      return {
        openTabs: [...state.openTabs, newTab],
        activeTabId: tabId,
        activeSection: 'terminal',
        activeFilePath: null,
        activeFileContent: null
      };
    });
    scheduleSaveWorkspaceState(get);
  },

  closeTab: (tabId) => {
    set((state) => {
      const remaining = state.openTabs.filter((t) => t.id !== tabId);
      if (state.activeTabId === tabId) {
        if (remaining.length > 0) {
          const nextTab = remaining[remaining.length - 1];
          return {
            openTabs: remaining,
            activeTabId: nextTab.id,
            activeFilePath: nextTab.type === 'file' ? nextTab.filePath || null : null,
            activeFileContent: nextTab.type === 'file' ? nextTab.content || null : null,
            activeTerminalId: nextTab.type === 'terminal' ? nextTab.terminalId || null : state.activeTerminalId,
            activeSection: nextTab.type === 'file' ? 'editor' : 'terminal'
          };
        } else {
          return {
            openTabs: [],
            activeTabId: null,
            activeFilePath: null,
            activeFileContent: null,
            activeSection: 'terminal'
          };
        }
      }
      return { openTabs: remaining };
    });
    scheduleSaveWorkspaceState(get);
  },

  updateActiveFileContent: (content) => {
    set((state) => {
      if (!state.activeFilePath) return state;
      const tabId = `file:${state.activeFilePath}`;
      const updatedTabs = state.openTabs.map((t) =>
        t.id === tabId ? { ...t, content, isDirty: true } : t
      );
      return {
        activeFileContent: content,
        openTabs: updatedTabs
      };
    });
  },

  saveActiveFile: async () => {
    const state = get();
    if (!state.activeFilePath || !state.project || state.activeFileContent === null) {
      return false;
    }
    try {
      await window.api.saveFileContent({
        filePath: state.activeFilePath,
        projectPath: state.project.path,
        content: state.activeFileContent
      });
      const tabId = `file:${state.activeFilePath}`;
      set((s) => ({
        openTabs: s.openTabs.map((t) => (t.id === tabId ? { ...t, isDirty: false } : t))
      }));
      state.addLog(`Saved file: ${state.activeFilePath.split(/[/\\]/).pop()}`, 'info');
      get().loadFileSymbols(state.activeFilePath);
      get().loadGitStatus(state.project.path);
      return true;
    } catch (err: any) {
      state.addLog(`Failed to save: ${err.message}`, 'error');
      return false;
    }
  },

  createFile: async (filePath, content = '') => {
    const project = get().project;
    if (!project) return false;
    try {
      await window.api.createFile({ filePath, projectPath: project.path, content });
      const refreshed = await window.api.listFiles({ projectPath: project.path });
      set({ files: refreshed });
      get().loadGitStatus(project.path);
      get().addLog(`Created file: ${filePath.split(/[/\\]/).pop()}`, 'info');
      await get().setActiveFile(filePath);
      return true;
    } catch (err: any) {
      get().addLog(`Failed to create file: ${err.message}`, 'error');
      throw err;
    }
  },

  createDirectory: async (dirPath) => {
    const project = get().project;
    if (!project) return false;
    try {
      await window.api.createDirectory({ directoryPath: dirPath, projectPath: project.path });
      const refreshed = await window.api.listFiles({ projectPath: project.path });
      set({ files: refreshed });
      get().loadGitStatus(project.path);
      get().addLog(`Created folder: ${dirPath.split(/[/\\]/).pop()}`, 'info');
      return true;
    } catch (err: any) {
      get().addLog(`Failed to create folder: ${err.message}`, 'error');
      throw err;
    }
  },

  renameItem: async (oldPath, newName) => {
    const project = get().project;
    if (!project) return false;
    try {
      const res = await window.api.renameItem({ oldPath, newName, projectPath: project.path });
      const refreshed = await window.api.listFiles({ projectPath: project.path });
      const state = get();
      const nextActivePath = state.activeFilePath === oldPath ? res.newPath : state.activeFilePath;
      const nextTabs = state.openTabs.map((t) => {
        if (t.filePath === oldPath) {
          return { ...t, filePath: res.newPath, title: newName, id: `file:${res.newPath}` };
        }
        return t;
      });
      set({
        files: refreshed,
        activeFilePath: nextActivePath,
        openTabs: nextTabs
      });
      get().loadGitStatus(project.path);
      get().addLog(`Renamed to "${newName}"`, 'info');
      return true;
    } catch (err: any) {
      get().addLog(`Failed to rename: ${err.message}`, 'error');
      throw err;
    }
  },

  deleteItem: async (targetPath) => {
    const project = get().project;
    if (!project) return false;
    try {
      await window.api.deleteItem({ targetPath, projectPath: project.path });
      const refreshed = await window.api.listFiles({ projectPath: project.path });
      const state = get();
      const isActive = state.activeFilePath === targetPath;
      const nextTabs = state.openTabs.filter((t) => t.filePath !== targetPath);
      set({
        files: refreshed,
        openTabs: nextTabs,
        activeFilePath: isActive ? null : state.activeFilePath,
        activeFileContent: isActive ? null : state.activeFileContent,
        activeFileSymbols: isActive ? [] : state.activeFileSymbols
      });
      get().loadGitStatus(project.path);
      get().addLog(`Deleted: ${targetPath.split(/[/\\]/).pop()}`, 'info');
      return true;
    } catch (err: any) {
      get().addLog(`Failed to delete: ${err.message}`, 'error');
      throw err;
    }
  },

  moveItem: async (sourcePath, destinationDir) => {
    const project = get().project;
    if (!project) return false;
    try {
      const res = await window.api.moveItem({ sourcePath, destinationDir, projectPath: project.path });
      const refreshed = await window.api.listFiles({ projectPath: project.path });
      const state = get();
      const nextActivePath = state.activeFilePath === sourcePath ? res.newPath : state.activeFilePath;
      const nextTabs = state.openTabs.map((t) => {
        if (t.filePath === sourcePath) {
          const fileName = res.newPath.split(/[/\\]/).pop() || t.title;
          return { ...t, filePath: res.newPath, title: fileName, id: `file:${res.newPath}` };
        }
        return t;
      });
      set({
        files: refreshed,
        activeFilePath: nextActivePath,
        openTabs: nextTabs
      });
      get().loadGitStatus(project.path);
      get().addLog(`Moved item to ${destinationDir.split(/[/\\]/).pop()}`, 'info');
      return true;
    } catch (err: any) {
      get().addLog(`Failed to move: ${err.message}`, 'error');
      throw err;
    }
  },

  loadFileSymbols: async (filePath) => {
    const project = get().project;
    if (!project) return;
    try {
      const symbols = await window.api.getFileSymbols({
        filePath,
        projectPath: project.path
      });
      set({ activeFileSymbols: symbols || [] });
    } catch {
      set({ activeFileSymbols: [] });
    }
  },

  // Terminal Sessions
  createTerminalSession: (provider = 'powershell') => {
    const state = get();
    const count = state.terminalSessions.length + 1;
    const newId = `term-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const isShell = ['powershell', 'cmd', 'bash'].includes(provider);
    const workDir = state.project?.path || '';

    const agentCommands: Record<string, string> = {
      antigravity: 'agy --dangerously-skip-permissions',
      claude: 'claude --dangerously-skip-permissions',
      codex: 'codex --dangerously-bypass-approvals-and-sandbox',
      gemini: 'gemini --yolo',
      copilot: 'copilot --yolo',
      opencode: 'opencode',
      qwen: 'qwen --approval-mode yolo',
      kimi: 'kimi --yolo',
      codebuff: 'freebuff',
      cursor: 'cursor --agent',
      droid: 'droid exec',
      goose: 'goose run',
      ante: 'ante',
      auggie: 'auggie',
      cline: 'cline',
      continue: 'continue',
      crush: 'crush',
      devin: 'devin',
      hermes: 'hermes',
      kilocode: 'kilocode',
      kiro: 'kiro',
      vibe: 'vibe',
      openhands: 'openhands',
      pi: 'pi',
      roocode: 'roocode',
      rovo: 'rovo',
      trae: 'trae --agent',
      zed: 'zed --agent'
    };

    const cmdStr = agentCommands[provider] || `${provider}`;

    const defaultTitle =
      provider === 'powershell'
        ? `PowerShell ${count}`
        : provider === 'cmd'
        ? `CMD ${count}`
        : provider === 'bash'
        ? `Git Bash ${count}`
        : provider === 'antigravity'
        ? 'Antigravity'
        : provider === 'claude'
        ? 'Claude Code'
        : provider === 'codex'
        ? 'Codex'
        : provider === 'gemini'
        ? 'Gemini'
        : provider === 'copilot'
        ? 'GitHub Copilot'
        : provider === 'qwen'
        ? 'Qwen Code'
        : provider === 'kimi'
        ? 'Kimi'
        : provider.charAt(0).toUpperCase() + provider.slice(1);

    const initialOutput = '';

    const newSession: TerminalSessionItem = {
      id: newId,
      title: defaultTitle,
      projectId: state.project?.id || '',
      projectName: state.project?.name || '',
      workingDirectory: workDir,
      branch: state.gitStatus?.branch || state.project?.activeBranch || '',
      provider,
      model: '',
      agentRole: 'coordinator',
      activeSkills: [],
      status: 'idle',
      streamOutput: initialOutput
    };

    const tabId = `term:${newId}`;
    set((s) => ({
      terminalSessions: [...s.terminalSessions, newSession],
      openTabs: [
        ...s.openTabs,
        {
          id: tabId,
          type: 'terminal',
          title: defaultTitle,
          terminalId: newId
        }
      ],
      activeTabId: tabId,
      activeTerminalId: newId,
      streamOutput: newSession.streamOutput,
      sessionStatus: 'idle',
      activeSection: 'terminal'
    }));

    scheduleSaveWorkspaceState(get);
    return newId;
  },

  setActiveTerminalId: (id) => {
    const session = get().terminalSessions.find((ts) => ts.id === id);
    const tabId = `term:${id}`;
    set((s) => {
      // Ensure tab is in openTabs if not already
      const hasTab = s.openTabs.some((t) => t.id === tabId);
      const openTabs = hasTab
        ? s.openTabs
        : [
            ...s.openTabs,
            {
              id: tabId,
              type: 'terminal' as const,
              title: session?.title || 'Terminal',
              terminalId: id
            }
          ];

      return {
        openTabs,
        activeTabId: tabId,
        activeTerminalId: id,
        streamOutput: session ? session.streamOutput : '',
        sessionStatus: session ? session.status : 'idle'
      };
    });
    scheduleSaveWorkspaceState(get);
  },

  updateTerminalSession: (id, updates) => {
    set((s) => {
      const updated = s.terminalSessions.map((ts) => (ts.id === id ? { ...ts, ...updates } : ts));
      const current = updated.find((ts) => ts.id === s.activeTerminalId);
      const nextTabs = updates.title
        ? s.openTabs.map((t) =>
            t.type === 'terminal' && t.terminalId === id ? { ...t, title: updates.title! } : t
          )
        : s.openTabs;
      return {
        terminalSessions: updated,
        openTabs: nextTabs,
        streamOutput: current ? current.streamOutput : s.streamOutput,
        sessionStatus: current ? current.status : s.sessionStatus
      };
    });
    scheduleSaveWorkspaceState(get);
  },

  appendTerminalOutput: (id, text) => {
    set((s) => {
      const updated = s.terminalSessions.map((ts) =>
        ts.id === id ? { ...ts, streamOutput: (ts.streamOutput + text).slice(-100000) } : ts
      );
      const isCurrent = s.activeTerminalId === id;
      return {
        terminalSessions: updated,
        streamOutput: isCurrent ? (s.streamOutput + text).slice(-100000) : s.streamOutput
      };
    });
    scheduleSaveWorkspaceState(get);
  },

  removeTerminalSession: (id: string) => {
    try {
      window.api?.terminalKill?.({ terminalId: id });
    } catch {}
    set((s) => {
      const remaining = s.terminalSessions.filter((ts) => ts.id !== id);
      const nextActive = s.activeTerminalId === id ? (remaining[0]?.id || null) : s.activeTerminalId;
      const nextTabs = s.openTabs.filter((t) => !(t.type === 'terminal' && t.terminalId === id));
      const nextActiveTabId =
        s.activeTabId === `term:${id}`
          ? (nextTabs[nextTabs.length - 1]?.id || null)
          : s.activeTabId;

      return {
        terminalSessions: remaining,
        activeTerminalId: nextActive,
        activeTabId: nextActiveTabId,
        openTabs: nextTabs,
        maximizedTerminalId: s.maximizedTerminalId === id ? null : s.maximizedTerminalId,
        detachedTerminalIds: s.detachedTerminalIds.filter((dId) => dId !== id)
      };
    });
    scheduleSaveWorkspaceState(get);
  },

  setTerminalLayout: (terminalLayout) => {
    set({ terminalLayout });
    scheduleSaveLayout(get);
  },

  setMaximizedTerminalId: (maximizedTerminalId) => set({ maximizedTerminalId }),

  toggleDetachTerminal: (id) =>
    set((s) => ({
      detachedTerminalIds: s.detachedTerminalIds.includes(id)
        ? s.detachedTerminalIds.filter((item) => item !== id)
        : [...s.detachedTerminalIds, id]
    })),

  reorderTerminalSessions: (startIndex, endIndex) =>
    set((s) => {
      const result = Array.from(s.terminalSessions);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return { terminalSessions: result };
    }),

  reorderTabs: (sourceId, targetId) =>
    set((s) => {
      const fromIdx = s.openTabs.findIndex((t) => t.id === sourceId);
      const toIdx = s.openTabs.findIndex((t) => t.id === targetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return {};
      const result = Array.from(s.openTabs);
      const [removed] = result.splice(fromIdx, 1);
      result.splice(toIdx, 0, removed);
      return { openTabs: result };
    }),

  setArcLauncherOpen: (isArcLauncherOpen) => set({ isArcLauncherOpen }),
  setSplitTerminalId: (splitTerminalId) => set({ splitTerminalId }),

  handleCLIStreamEvent: (event: any) => {
    set((s) => {
      const targetSession =
        s.terminalSessions.find((ts) => ts.cliSessionId === event.sessionId) ||
        (s.activeSessionId === event.sessionId
          ? s.terminalSessions.find((ts) => ts.id === s.activeTerminalId)
          : null) ||
        s.terminalSessions.find((ts) => ts.id === s.activeTerminalId);

      if (!targetSession) {
        if (event.type === 'stdout' || event.type === 'stderr') {
          return { streamOutput: s.streamOutput + event.content };
        }
        return {};
      }

      const targetId = targetSession.id;
      let nextStatus = targetSession.status;
      let nextCliSessionId = targetSession.cliSessionId;
      let appendedText = '';

      if (event.type === 'stdout' || event.type === 'stderr') {
        appendedText = event.content;
      } else if (event.type === 'status') {
        nextStatus = event.content as CLISessionStatus;
      } else if (event.type === 'exit') {
        nextStatus = event.exitCode === 0 ? 'completed' : 'failed';
        nextCliSessionId = undefined;
      }

      const updatedSessions = s.terminalSessions.map((ts) => {
        if (ts.id === targetId) {
          return {
            ...ts,
            status: nextStatus,
            cliSessionId: nextCliSessionId,
            streamOutput: appendedText ? ts.streamOutput + appendedText : ts.streamOutput
          };
        }
        return ts;
      });

      const isCurrent = s.activeTerminalId === targetId;
      return {
        terminalSessions: updatedSessions,
        sessionStatus: isCurrent ? nextStatus : s.sessionStatus,
        streamOutput: isCurrent && appendedText ? s.streamOutput + appendedText : s.streamOutput
      };
    });
  },

  clearTerminalOutput: (id) => {
    try {
      window.api?.terminalKill?.({ terminalId: id });
      window.dispatchEvent(new CustomEvent(`terminal:reset:${id}`));
    } catch {}
    set((s) => {
      const updated = s.terminalSessions.map((ts) =>
        ts.id === id ? { ...ts, streamOutput: '' } : ts
      );
      const isCurrent = s.activeTerminalId === id;
      return {
        terminalSessions: updated,
        streamOutput: isCurrent ? '' : s.streamOutput
      };
    });
    scheduleSaveWorkspaceState(get);
  },

  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setSessionStatus: (sessionStatus) => {
    const state = get();
    if (state.activeTerminalId) {
      state.updateTerminalSession(state.activeTerminalId, { status: sessionStatus });
    }
    set({ sessionStatus });
  },
  appendStreamOutput: (text) => {
    const state = get();
    if (state.activeTerminalId) {
      state.appendTerminalOutput(state.activeTerminalId, text);
    } else {
      set((s) => ({ streamOutput: s.streamOutput + text }));
    }
  },
  clearStreamOutput: () => {
    const state = get();
    if (state.activeTerminalId) {
      state.clearTerminalOutput(state.activeTerminalId);
    } else {
      set({ streamOutput: '' });
    }
  },
  setSessionsHistory: (sessionsHistory) => set({ sessionsHistory }),

  // Right Panel
  setRightPanelTab: (rightPanelTab) => {
    set({ rightPanelTab, explorerTab: rightPanelTab, isRightPanelOpen: true, isExplorerOpen: true });
    scheduleSaveLayout(get);
  },
  setRightPanelOpen: (isRightPanelOpen) => {
    set({ isRightPanelOpen, isExplorerOpen: isRightPanelOpen });
    scheduleSaveLayout(get);
  },
  toggleRightPanel: () => {
    set((s) => ({ isRightPanelOpen: !s.isRightPanelOpen, isExplorerOpen: !s.isRightPanelOpen }));
    scheduleSaveLayout(get);
  },
  setRightPanelWidth: (w) => {
    const clamped = Math.max(220, Math.min(560, w));
    set({ rightPanelWidth: clamped, explorerWidth: clamped });
    scheduleSaveLayout(get);
  },
  setFileFilter: (fileFilter) => {
    set({ fileFilter });
    scheduleSaveWorkspaceState(get);
  },

  toggleExplorer: () => {
    set((s) => ({ isRightPanelOpen: !s.isRightPanelOpen, isExplorerOpen: !s.isRightPanelOpen }));
    scheduleSaveLayout(get);
  },
  setExplorerTab: (tab) => {
    set({ rightPanelTab: tab, explorerTab: tab, isRightPanelOpen: true, isExplorerOpen: true });
    scheduleSaveLayout(get);
  },
  setExplorerWidth: (w) => {
    const clamped = Math.max(220, Math.min(560, w));
    set({ rightPanelWidth: clamped, explorerWidth: clamped });
    scheduleSaveLayout(get);
  },

  // Left Sidebar
  setLeftSidebarOpen: (isLeftSidebarOpen) => {
    set({ isLeftSidebarOpen });
    scheduleSaveLayout(get);
  },
  toggleLeftSidebar: () => {
    set((s) => ({ isLeftSidebarOpen: !s.isLeftSidebarOpen }));
    scheduleSaveLayout(get);
  },
  setLeftSidebarWidth: (w) => {
    set({ leftSidebarWidth: Math.max(180, Math.min(420, w)) });
    scheduleSaveLayout(get);
  },

  // Bottom Panel
  setBottomPanelOpen: (isBottomPanelOpen) => {
    set({ isBottomPanelOpen, isLogsDrawerOpen: isBottomPanelOpen });
    scheduleSaveLayout(get);
  },
  toggleBottomPanel: () => {
    set((s) => ({ isBottomPanelOpen: !s.isBottomPanelOpen, isLogsDrawerOpen: !s.isBottomPanelOpen }));
    scheduleSaveLayout(get);
  },
  setBottomPanelHeight: (h) => {
    set({ bottomPanelHeight: Math.max(120, Math.min(600, h)) });
    scheduleSaveLayout(get);
  },
  setBottomPanelTab: (bottomPanelTab) => {
    set({ bottomPanelTab, isBottomPanelOpen: true });
    scheduleSaveLayout(get);
  },

  // Global & Logs
  setLogsDrawerOpen: (isLogsDrawerOpen) => {
    set({ isLogsDrawerOpen, isBottomPanelOpen: isLogsDrawerOpen });
    scheduleSaveLayout(get);
  },
  toggleLogsDrawer: () => {
    set((s) => ({ isLogsDrawerOpen: !s.isLogsDrawerOpen, isBottomPanelOpen: !s.isBottomPanelOpen }));
    scheduleSaveLayout(get);
  },
  setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
  setTargetEditorLine: (targetEditorLine) => {
    set({ targetEditorLine });
    scheduleSaveWorkspaceState(get);
  },
  toggleSettings: (open) => set((s) => ({ isSettingsOpen: open !== undefined ? open : !s.isSettingsOpen })),
  setTheme: (theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('theme-solid', 'theme-glass');
      document.documentElement.classList.add(theme === 'solid' ? 'theme-solid' : 'theme-glass');
    }
    set({ theme });
  },
  setFileIconTheme: (fileIconTheme) => {
    set({ fileIconTheme });
    if (typeof window !== 'undefined') window.api?.updateSettings?.({ fileIconTheme });
  },
  setShowGitFileColors: (showGitFileColors) => {
    set({ showGitFileColors });
    if (typeof window !== 'undefined') window.api?.updateSettings?.({ showGitFileColors });
  },

  // AI Intelligence Graph Actions
  loadProjectGraph: async (customPath) => {
    const proj = get().project;
    const targetPath = customPath || proj?.path;
    if (!targetPath || typeof window === 'undefined' || !window.api?.getProjectGraph) return;
    set({ isGraphLoading: true });
    try {
      const graphData = await window.api.getProjectGraph({ projectPath: targetPath });
      set({ projectGraph: graphData, isGraphLoading: false });
    } catch (err: any) {
      console.error('[workspaceStore] Failed to load project graph:', err);
      set({ isGraphLoading: false });
    }
  },
  setSelectedGraphNodeId: (selectedGraphNodeId) => set({ selectedGraphNodeId }),
  setGraphFilterCategory: (graphFilterCategory) => set({ graphFilterCategory }),
  setIsOrphanFilterActive: (isOrphanFilterActive) => set({ isOrphanFilterActive }),
  setUiMode: (uiMode) => set({ uiMode }),
  toggleDirExpanded: (dirId) => {
    set((s) => {
      const norm = dirId.replace(/\\/g, '/');
      const next = new Set(s.expandedDirs);
      if (next.has(dirId) || next.has(norm)) {
        next.delete(dirId);
        next.delete(norm);
      } else {
        next.add(dirId);
        next.add(norm);
      }
      return { expandedDirs: next };
    });
    scheduleSaveWorkspaceState(get);
  },
  collapseAllDirs: () => {
    set({ expandedDirs: new Set() });
    scheduleSaveWorkspaceState(get);
  },
  setMetrics: (metrics) => set({ metrics }),
  addLog: (message, level = 'info') =>
    set((s) => {
      const last = s.logs[s.logs.length - 1];
      if (last && last.message === message && last.level === level) {
        return s;
      }
      return {
        logs: [
          ...s.logs.slice(-200),
          {
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            timestamp: new Date().toLocaleTimeString(),
            message,
            level
          }
        ]
      };
    }),
  clearLogs: () => set({ logs: [] }),
  setCustomPath: (provider, path) =>
    set((s) => ({ customPaths: { ...s.customPaths, [provider]: path } })),

  loadGitStatus: async (projectPath) => {
    try {
      const status = await window.api.getGitStatus(projectPath);
      set({ gitStatus: status });
      // Trigger execution & review synchronization alongside git status
      get().loadProjectExecutions().catch(() => {});
      get().loadProjectGitDetails().catch(() => {});
      get().loadCodeReview().catch(() => {});
      get().syncManualChanges().catch(() => {});
    } catch {
      set({ gitStatus: null });
    }
  },

  // Project Explorer Actions
  setExplorerActiveTab: (explorerActiveTab) => set({ explorerActiveTab, rightPanelTab: explorerActiveTab }),

  loadProjectExecutions: async () => {
    const project = get().project;
    if (!project?.id || typeof window === 'undefined' || !window.api?.listProjectExecutions) return;
    try {
      const list = await window.api.listProjectExecutions({ projectId: project.id });
      set({ executions: list });
      if (list.length > 0 && !get().activeExecutionId) {
        set({ activeExecutionId: list[0].id });
      }
    } catch (e) {
      console.warn('Failed to load project executions:', e);
    }
  },

  loadExecutionFileChanges: async (executionId) => {
    if (typeof window === 'undefined' || !window.api?.getExecutionFileChanges) return [];
    try {
      const changes = await window.api.getExecutionFileChanges({ executionId });
      set((s) => ({
        executionFileChanges: { ...s.executionFileChanges, [executionId]: changes }
      }));
      return changes;
    } catch (e) {
      console.warn('Failed to load execution file changes:', e);
      return [];
    }
  },

  loadCodeReview: async (executionId) => {
    const project = get().project;
    if (!project?.id || typeof window === 'undefined' || !window.api?.getCodeReview) return;
    try {
      const review = await window.api.getCodeReview({ projectId: project.id, executionId });
      set({ codeReview: review });
      if (review) {
        const comments = await window.api.listReviewComments({ reviewId: review.id });
        set({ reviewComments: comments });
      }
    } catch (e) {
      console.warn('Failed to load code review:', e);
    }
  },

  updateReviewDecision: async (status, summary) => {
    const review = get().codeReview;
    if (!review || typeof window === 'undefined' || !window.api?.updateReviewDecision) return;
    try {
      const updated = await window.api.updateReviewDecision({
        reviewId: review.id,
        status,
        summary
      });
      if (updated) {
        set({ codeReview: updated });
        get().addLog(`Review marked as: ${status}`, 'info');
      }
    } catch (e: any) {
      get().addLog(`Failed to update review decision: ${e.message}`, 'error');
    }
  },

  markFileReviewStatus: async (filePath, status) => {
    const review = get().codeReview;
    if (!review || typeof window === 'undefined' || !window.api?.markFileReviewStatus) return;
    try {
      const updated = await window.api.markFileReviewStatus({
        reviewId: review.id,
        filePath,
        status
      });
      if (updated) set({ codeReview: updated });
    } catch (e: any) {
      get().addLog(`Failed to mark file status: ${e.message}`, 'error');
    }
  },

  addReviewComment: async (filePath, content, lineNumber, diffHunk, parentCommentId) => {
    let review = get().codeReview;
    const project = get().project;
    if (!project?.id || typeof window === 'undefined') return;
    if (!review) {
      await get().loadCodeReview();
      review = get().codeReview;
    }
    if (!review) return;

    try {
      const newComment = await window.api.addReviewComment({
        reviewId: review.id,
        projectId: project.id,
        filePath,
        lineNumber,
        diffHunk,
        content,
        author: 'User',
        parentCommentId
      });
      set((s) => ({ reviewComments: [...s.reviewComments, newComment] }));
      get().addLog('Review comment added', 'info');
    } catch (e: any) {
      get().addLog(`Failed to add comment: ${e.message}`, 'error');
    }
  },

  resolveReviewComment: async (commentId, resolved) => {
    if (typeof window === 'undefined' || !window.api?.resolveReviewComment) return;
    try {
      await window.api.resolveReviewComment({ commentId, resolved });
      set((s) => ({
        reviewComments: s.reviewComments.map((c) =>
          c.id === commentId ? { ...c, status: resolved ? 'resolved' : 'open', resolvedAt: resolved ? Date.now() : undefined } : c
        )
      }));
    } catch (e: any) {
      get().addLog(`Failed to resolve comment: ${e.message}`, 'error');
    }
  },

  runAICodeReview: async () => {
    const project = get().project;
    const review = get().codeReview;
    const gitStatus = get().gitStatus;
    if (!project?.path || !review || typeof window === 'undefined' || !window.api?.runAICodeReview) return;

    set({ isAIEvaluationRunning: true });
    get().addLog('Running AI-assisted code review...', 'info');
    try {
      const findings = await window.api.runAICodeReview({
        reviewId: review.id,
        projectPath: project.path,
        diff: gitStatus?.diff || '',
        changedFiles: gitStatus?.changedFiles.map((f) => f.path) || []
      });
      set({ aiReviewFindings: findings, isAIEvaluationRunning: false });
      await get().loadCodeReview();
      get().addLog(`AI code review completed: ${findings.length} findings`, 'info');
    } catch (e: any) {
      set({ isAIEvaluationRunning: false });
      get().addLog(`AI code review failed: ${e.message}`, 'error');
    }
  },

  loadProjectGitDetails: async () => {
    const project = get().project;
    if (!project?.path || typeof window === 'undefined' || !window.api?.getProjectGitDetails) return;
    try {
      const details = await window.api.getProjectGitDetails({ projectPath: project.path });
      set({ projectGitDetails: details });
    } catch (e) {
      console.warn('Failed to load project git details:', e);
    }
  },

  setSelectedDiffFile: (selectedDiffFile) => set({ selectedDiffFile }),
  setDiffViewMode: (diffViewMode) => set({ diffViewMode }),
  setChangesFilter: (changesFilter) => set({ changesFilter }),

  syncManualChanges: async () => {
    const project = get().project;
    if (!project?.path || typeof window === 'undefined' || !window.api?.syncManualChanges) return;
    try {
      const manualExec = await window.api.syncManualChanges({
        projectId: project.id,
        projectPath: project.path
      });
      if (manualExec) {
        await get().loadProjectExecutions();
      }
    } catch (e) {
      console.warn('Failed to sync manual changes:', e);
    }
  },

  setCLIStatuses: (cliStatuses) => set({ cliStatuses }),
  setCLIAuthStatuses: (cliAuthStatuses) => set({ cliAuthStatuses }),
  setActiveProvider: (activeProvider) => set({ activeProvider }),
  setSettingsActiveTab: (settingsActiveTab) => set({ settingsActiveTab }),
  openSettingsToTab: (tab) => set({ settingsActiveTab: tab, isSettingsOpen: true }),
  setAgentPermissions: (agentPermissions) => set({ agentPermissions }),
  setAgentMode: (agentId, mode) =>
    set((s) => ({ agentModes: { ...s.agentModes, [agentId]: mode } })),
  setAgentEnabled: (agentId, enabled) =>
    set((s) => ({ agentEnabled: { ...s.agentEnabled, [agentId]: enabled } }))
}));
