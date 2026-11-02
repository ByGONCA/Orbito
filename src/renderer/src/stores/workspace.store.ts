import { create } from 'zustand';
import type { ProjectDescriptor, FileNode, UIMode, SystemResourceMetrics } from '../../../shared/types';
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

  // CLI Engine State (Phase 2)
  cliStatuses: Record<CLIProvider, CLIInstallationStatus> | null;
  cliAuthStatuses: Record<CLIProvider, CLIAuthStatus> | null;
  activeProvider: CLIProvider;
  activeSessionId: string | null;
  sessionStatus: CLISessionStatus;
  streamOutput: string;
  customPaths: Record<CLIProvider, string>;
  sessionsHistory: CLISessionRecord[];

  // UI View Tabs
  activeCenterTab: 'code' | 'providers' | 'console';
  setActiveCenterTab: (tab: 'code' | 'providers' | 'console') => void;

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

  // CLI Initial State
  cliStatuses: null,
  cliAuthStatuses: null,
  activeProvider: 'claude',
  activeSessionId: null,
  sessionStatus: 'idle',
  streamOutput: '',
  customPaths: { claude: '', codex: '', gemini: '' },
  sessionsHistory: [],

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
