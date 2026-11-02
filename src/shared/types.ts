/**
 * AI Workspace — Shared Domain Types
 * Used strictly across Renderer, Preload, and Main processes.
 */

export type PermissionLevel = 'restricted' | 'standard' | 'full';

export type UIMode = 'simple' | 'advanced';

export type MemoryTier = 'global' | 'workspace' | 'project' | 'task' | 'session';

export interface ProjectDescriptor {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: number;
  isGitRepo: boolean;
  activeBranch?: string;
  permissionLevel: PermissionLevel;
}

export interface WorkspaceConfig {
  id: string;
  name: string;
  currentProjectId?: string;
  uiMode: UIMode;
  theme: 'dark' | 'light' | 'system';
  autoIndex: boolean;
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
}
