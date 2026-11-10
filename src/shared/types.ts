/**
 * AI Workspace — Shared Domain Types
 * Used strictly across Renderer, Preload, and Main processes.
 */

export * from './review';

export type PermissionLevel = 'restricted' | 'standard' | 'full';

export type UIMode = 'simple' | 'advanced';

export type MemoryTier = 'global' | 'workspace' | 'project' | 'task' | 'session';

export type ProjectTemplateId = 'empty' | 'node' | 'react' | 'python';

export interface ProjectTemplateInfo {
  id: ProjectTemplateId;
  name: string;
  description: string;
  icon: string;
}

export interface CreateProjectOptions {
  name: string;
  parentDirectory: string;
  template: ProjectTemplateId;
  initGit: boolean;
}

export interface ProjectSettings {
  defaultProvider?: string;
  defaultModel?: string;
  defaultWorkingDir?: string;
  instructions?: string;
  gitAutoFetch?: boolean;
  envVars?: Record<string, string>;
  discordRpcEnabled?: boolean;
  customFileIcons?: Record<string, string>;
}

export interface ProjectDescriptor {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: number;
  isGitRepo: boolean;
  activeBranch?: string;
  permissionLevel: PermissionLevel;
  customName?: string;
  customColor?: string;
  customIcon?: string;
  description?: string;
  tag?: string;
  isFavorite?: boolean;
  settings?: ProjectSettings;
}

export type SettingsSectionId =
  | 'agents'
  | 'providers'
  | 'orchestration'
  | 'memory'
  | 'security'
  | 'git'
  | 'plugins'
  | 'integrations'
  | 'appearance'
  | 'shortcuts'
  | 'general'
  | 'about';

export type WorkspaceTheme = 'glass' | 'solid' | 'light' | 'dark' | 'system';

export interface WorkspaceConfig {
  id: string;
  name: string;
  currentProjectId?: string;
  uiMode: UIMode;
  theme: WorkspaceTheme;
  autoIndex: boolean;
  fileIconTheme?: 'vscode' | 'material' | 'minimal';
  showGitFileColors?: boolean;
  discordRpcEnabled?: boolean;
  discordClientId?: string;
}

export type DiscordConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface DiscordActivitySnapshot {
  details: string;
  state: string;
  buttons?: Array<{ label: string; url: string }>;
  startTimestamp?: number;
  largeImageKey?: string;
  largeImageText?: string;
  smallImageKey?: string;
  smallImageText?: string;
}

export interface DiscordStatusResponse {
  enabled: boolean;
  connected: boolean;
  status: DiscordConnectionState;
  currentPresence: DiscordActivitySnapshot | null;
  error: string | null;
  clientId: string;
  isProjectOptedIn: boolean;
  activeProjectName: string | null;
}

export interface AppLayoutConfig {
  isLeftSidebarOpen?: boolean;
  leftSidebarWidth?: number;
  isRightPanelOpen?: boolean;
  rightPanelWidth?: number;
  isBottomPanelOpen?: boolean;
  bottomPanelHeight?: number;
  activeSection?: string;
  activeSidebarSection?: 'projects' | 'tasks' | 'flows';
  rightPanelTab?: string;
  bottomPanelTab?: 'terminal' | 'problems' | 'logs' | 'debug' | 'git';
  terminalLayout?: '1' | '2-col' | '2-row' | '3-split' | '4-grid';
}

export interface PersistedWorkspaceTab {
  id: string;
  type: 'file' | 'terminal' | 'flow' | 'project' | 'graph' | 'browser';
  title: string;
  filePath?: string;
  terminalId?: string;
  url?: string;
}

export interface PersistedTerminalSession {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  workingDirectory: string;
  branch: string;
  provider: string;
  model: string;
  status: string;
  streamOutput?: string;
}

export interface ProjectWorkspaceState {
  projectId: string;
  openTabs: PersistedWorkspaceTab[];
  activeTabId: string | null;
  activeFilePath: string | null;
  expandedDirs: string[];
  fileFilter: string;
  terminalSessions: PersistedTerminalSession[];
  activeTerminalId: string | null;
  targetEditorLine?: number | null;
  updatedAt?: number;
}

export type GraphNodeCategory = 'file' | 'agent' | 'task' | 'context' | 'skill';

export interface ProjectGraphNode {
  id: string;
  label: string;
  category: GraphNodeCategory;
  subType?: string;
  path?: string;
  size?: number;
  degree: number;
  inDegree: number;
  outDegree: number;
  isOrphan?: boolean;
  orphanReason?: string;
  status?: string;
  metadata?: Record<string, any>;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface ProjectGraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  isActive?: boolean;
}

export interface ProjectGraphData {
  nodes: ProjectGraphNode[];
  edges: ProjectGraphEdge[];
  stats: {
    totalFiles: number;
    connectedFiles: number;
    orphanedFiles: number;
    totalAgents: number;
    totalTasks: number;
    totalSkills: number;
    totalEdges: number;
  };
}

export interface FileNode {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: number;
  children?: FileNode[];
  isIgnored?: boolean;
}

export interface MemoryRecord {
  id: string;
  tier: MemoryTier;
  entityKey: string;
  content: string;
  tokens: number;
  createdAt: number;
  updatedAt: number;
}

export interface SystemResourceMetrics {
  mainProcessMemoryMb: number;
  totalAppMemoryMb: number;
  cpuPercent: number;
  uptimeSeconds: number;
  workingSetMemoryMb?: number;
  privateMemoryMb?: number;
}

export interface DetailedResourceMetrics {
  cpuPercent: number;
  workingSetMemoryMb: number;
  privateMemoryMb: number;
  uptimeSeconds: number;
  keepAwakeActive: boolean;
  processes: Array<{
    pid: number;
    type: string;
    cpuPercent: number;
    memoryMb: number;
  }>;
  activePorts: Array<{
    port: number;
    service?: string;
  }>;
}
