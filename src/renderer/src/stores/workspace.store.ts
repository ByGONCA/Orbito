import { create } from 'zustand';
import type { ProjectDescriptor, FileNode, UIMode, SystemResourceMetrics } from '../../../shared/types';

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

  setProject: (project) => set({ project }),
  setFiles: (files) => set({ files }),
  setActiveFile: (activeFilePath, activeFileContent) => set({ activeFilePath, activeFileContent }),
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
  clearLogs: () => set({ logs: [] })
}));
