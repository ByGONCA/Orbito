import { create } from 'zustand';
import type { ProjectDescriptor, FileNode, UIMode, SystemResourceMetrics } from '../../../shared/types';
import type { IndexStats } from '../../../shared/context';
import type { SkillMetadata, SkillExecutionRecord } from '../../../shared/skills';
import type { OrchestrationRecord, ApprovalRequest } from '../../../shared/agents';
import type { WorkflowRecord, WorkflowExecutionRecord } from '../../../shared/workflows';
import type {
  CLIProvider,
  CLIInstallationStatus,
  CLIAuthStatus,
  CLISessionStatus,
  CLISessionRecord
} from '../../../shared/cli';

interface WorkspaceState {
  project: ProjectDescriptor | null;
  files: FileNode[];
  activeFilePath: string | null;
  activeFileContent: string | null;
  uiMode: UIMode;
  theme: 'dark' | 'light' | 'system';
  isSettingsOpen: boolean;
  expandedDirs: Set<string>;
  metrics: SystemResourceMetrics | null;
  logs: Array<{ id: string; timestamp: string; message: string; level: 'info' | 'warn' | 'error' }>;

  // Context Engine State (Phase 3)
  indexStats: IndexStats | null;
  setIndexStats: (stats: IndexStats | null) => void;

  // CLI Engine State (Phase 2)
  cliStatuses: Record<CLIProvider, CLIInstallationStatus> | null;
  cliAuthStatuses: Record<CLIProvider, CLIAuthStatus> | null;
  activeProvider: CLIProvider;
  activeSessionId: string | null;
  sessionStatus: CLISessionStatus;
  streamOutput: string;
  customPaths: Record<CLIProvider, string>;
  sessionsHistory: CLISessionRecord[];

  // Skills Engine State (Phase 4)
  skills: SkillMetadata[];
  setSkills: (skills: SkillMetadata[]) => void;
  selectedSkillId: string | null;
  setSelectedSkillId: (id: string | null) => void;
  skillExecutions: SkillExecutionRecord[];
  setSkillExecutions: (execs: SkillExecutionRecord[]) => void;

  // Multi-Agent Orchestration State (Phase 5)
  activeOrchestration: OrchestrationRecord | null;
  setActiveOrchestration: (orch: OrchestrationRecord | null) => void;
  orchestrationsHistory: OrchestrationRecord[];
  setOrchestrationsHistory: (history: OrchestrationRecord[]) => void;
  pendingApprovals: ApprovalRequest[];
  setPendingApprovals: (approvals: ApprovalRequest[]) => void;

  // Visual Automation & Workflows State (Phase 6)
  workflows: WorkflowRecord[];
  setWorkflows: (workflows: WorkflowRecord[]) => void;
  activeWorkflow: WorkflowRecord | null;
  setActiveWorkflow: (wf: WorkflowRecord | null) => void;
  workflowTemplates: WorkflowRecord[];
  setWorkflowTemplates: (templates: WorkflowRecord[]) => void;
  workflowExecutions: WorkflowExecutionRecord[];
  setWorkflowExecutions: (execs: WorkflowExecutionRecord[]) => void;

  // UI View Tabs
  activeCenterTab: 'code' | 'providers' | 'console' | 'context' | 'skills' | 'agents' | 'flows';
  setActiveCenterTab: (tab: 'code' | 'providers' | 'console' | 'context' | 'skills' | 'agents' | 'flows') => void;

  setProject: (project: ProjectDescriptor | null) => void;
  setFiles: (files: FileNode[]) => void;
  setActiveFile: (path: string, content: string) => void;
  closeActiveFile: () => void;
  setUiMode: (mode: UIMode) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  toggleSettings: (open?: boolean) => void;
  toggleDirExpanded: (dirId: string) => void;
  setMetrics: (metrics: SystemResourceMetrics) => void;
  addLog: (message: string, level?: 'info' | 'warn' | 'error') => void;
  clearLogs: () => void;

  // CLI Actions
  setCLIStatuses: (statuses: Record<CLIProvider, CLIInstallationStatus>) => void;
  setCLIAuthStatuses: (auths: Record<CLIProvider, CLIAuthStatus>) => void;
  setActiveProvider: (provider: CLIProvider) => void;
  setActiveSessionId: (sessionId: string | null) => void;
  setSessionStatus: (status: CLISessionStatus) => void;
  appendStreamOutput: (text: string) => void;
  clearStreamOutput: () => void;
  setCustomPath: (provider: CLIProvider, path: string) => void;
  setSessionsHistory: (sessions: CLISessionRecord[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  project: null,
  files: [],
  activeFilePath: null,
  activeFileContent: null,
  uiMode: 'simple',
  theme: 'dark',
  isSettingsOpen: false,
  expandedDirs: new Set(),
  metrics: null,
  logs: [
    {
      id: 'log-1',
      timestamp: new Date().toLocaleTimeString(),
      message: 'AI Workspace Initialized. Local-First Engine Ready.',
      level: 'info'
    }
  ],

  // Context Engine Initial State
  indexStats: null,
  setIndexStats: (indexStats) => set({ indexStats }),

  // CLI Initial State
  cliStatuses: null,
  cliAuthStatuses: null,
  activeProvider: 'claude',
  activeSessionId: null,
  sessionStatus: 'idle',
  streamOutput: '',
  customPaths: { claude: '', codex: '', gemini: '' },
  sessionsHistory: [],

  // Skills Initial State
  skills: [],
  setSkills: (skills) => set({ skills }),
  selectedSkillId: null,
  setSelectedSkillId: (selectedSkillId) => set({ selectedSkillId }),
  skillExecutions: [],
  setSkillExecutions: (skillExecutions) => set({ skillExecutions }),

  // Multi-Agent Initial State
  activeOrchestration: null,
  setActiveOrchestration: (activeOrchestration) => set({ activeOrchestration }),
  orchestrationsHistory: [],
  setOrchestrationsHistory: (orchestrationsHistory) => set({ orchestrationsHistory }),
  pendingApprovals: [],
  setPendingApprovals: (pendingApprovals) => set({ pendingApprovals }),

  // Visual Automation & Workflows Initial State (Phase 6)
  workflows: [],
  setWorkflows: (workflows) => set({ workflows }),
  activeWorkflow: null,
  setActiveWorkflow: (activeWorkflow) => set({ activeWorkflow }),
  workflowTemplates: [],
  setWorkflowTemplates: (workflowTemplates) => set({ workflowTemplates }),
  workflowExecutions: [],
  setWorkflowExecutions: (workflowExecutions) => set({ workflowExecutions }),

  activeCenterTab: 'code',
  setActiveCenterTab: (activeCenterTab) => set({ activeCenterTab }),

  setProject: (project) => set({ project }),
  setFiles: (files) => set({ files }),
  setActiveFile: (activeFilePath, activeFileContent) =>
    set({ activeFilePath, activeFileContent, activeCenterTab: 'code' }),
  closeActiveFile: () => set({ activeFilePath: null, activeFileContent: null }),
  setUiMode: (uiMode) => set({ uiMode }),
  setTheme: (theme) => set({ theme }),
  toggleSettings: (open) => set((s) => ({ isSettingsOpen: open !== undefined ? open : !s.isSettingsOpen })),
  toggleDirExpanded: (dirId) =>
    set((s) => {
      const next = new Set(s.expandedDirs);
      if (next.has(dirId)) {
        next.delete(dirId);
      } else {
        next.add(dirId);
      }
      return { expandedDirs: next };
    }),
  setMetrics: (metrics) => set({ metrics }),
  addLog: (message, level = 'info') =>
    set((s) => ({
      logs: [
        ...s.logs.slice(-200),
        {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          timestamp: new Date().toLocaleTimeString(),
          message,
          level
        }
      ]
    })),
  clearLogs: () => set({ logs: [] }),

  // CLI Action Implementations
  setCLIStatuses: (cliStatuses) => set({ cliStatuses }),
  setCLIAuthStatuses: (cliAuthStatuses) => set({ cliAuthStatuses }),
  setActiveProvider: (activeProvider) => set({ activeProvider }),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setSessionStatus: (sessionStatus) => set({ sessionStatus }),
  appendStreamOutput: (text) => set((s) => ({ streamOutput: s.streamOutput + text })),
  clearStreamOutput: () => set({ streamOutput: '' }),
  setCustomPath: (provider, p) =>
    set((s) => ({
      customPaths: { ...s.customPaths, [provider]: p }
    })),
  setSessionsHistory: (sessionsHistory) => set({ sessionsHistory })
}));
