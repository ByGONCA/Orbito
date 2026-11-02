import { z } from 'zod';
import type {
  ProjectDescriptor,
  WorkspaceConfig,
  FileNode,
  MemoryRecord,
  SystemResourceMetrics,
  PermissionLevel,
  UIMode
} from './types';

// ==========================================
// Zod Schemas for Runtime IPC Validation
// ==========================================

export const OpenDirectorySchema = z.object({
  targetPath: z.string().optional()
});

export const ListFilesSchema = z.object({
  projectPath: z.string().min(1),
  maxDepth: z.number().int().min(1).max(20).optional().default(8)
});

export const ReadFileSchema = z.object({
  filePath: z.string().min(1),
  projectPath: z.string().min(1)
});

export const UpdateSettingsSchema = z.object({
  uiMode: z.enum(['simple', 'advanced']).optional(),
  theme: z.enum(['dark', 'light', 'system']).optional(),
  autoIndex: z.boolean().optional()
});

export const StoreSecretSchema = z.object({
  key: z.string().min(1).max(128),
  value: z.string()
});

export const GetSecretSchema = z.object({
  key: z.string().min(1).max(128)
});

export const SaveMemorySchema = z.object({
  tier: z.enum(['global', 'workspace', 'project', 'task', 'session']),
  entityKey: z.string().min(1),
  content: z.string().min(1)
});

export const DeleteMemorySchema = z.object({
  id: z.string().min(1)
});

// ==========================================
// Strongly-Typed IPC Interface Contract
// ==========================================

export interface IElectronAPI {
  // Workspace & File Management
  openDirectoryDialog: (params?: z.input<typeof OpenDirectorySchema>) => Promise<ProjectDescriptor | null>;
  listFiles: (params: z.input<typeof ListFilesSchema>) => Promise<FileNode[]>;
  readFileContent: (params: z.input<typeof ReadFileSchema>) => Promise<string>;
  getRecentProjects: () => Promise<ProjectDescriptor[]>;
  
  // Settings & App Configuration
  getSettings: () => Promise<WorkspaceConfig>;
  updateSettings: (params: z.input<typeof UpdateSettingsSchema>) => Promise<WorkspaceConfig>;
  
  // Credentials (safeStorage)
  storeSecret: (params: z.input<typeof StoreSecretSchema>) => Promise<{ success: boolean }>;
  getSecret: (params: z.input<typeof GetSecretSchema>) => Promise<string | null>;
  
  // Memories (5-tier system)
  listMemories: (tier?: string) => Promise<MemoryRecord[]>;
  saveMemory: (params: z.input<typeof SaveMemorySchema>) => Promise<MemoryRecord>;
  deleteMemory: (params: z.input<typeof DeleteMemorySchema>) => Promise<{ success: boolean }>;
  
  // System Metrics
  getSystemMetrics: () => Promise<SystemResourceMetrics>;
}
