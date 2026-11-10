import { z } from 'zod';
import type { SkillManifest } from './skills';
import type { NodeDefinition } from './node-registry';

export const ExtensionPermissionSchema = z.object({
  filesystem: z
    .object({
      read: z.union([z.boolean(), z.array(z.string())]).optional(),
      write: z.union([z.boolean(), z.array(z.string())]).optional()
    })
    .optional(),
  network: z
    .object({
      allowedHosts: z.array(z.string()).optional(),
      allowExternal: z.boolean().default(false)
    })
    .optional(),
  shell: z.boolean().default(false),
  tools: z.array(z.string()).optional()
});

export type ExtensionPermissions = z.infer<typeof ExtensionPermissionSchema>;

export const ExtensionContributionSchema = z.object({
  nodes: z.array(z.custom<NodeDefinition>()).optional(),
  skills: z.array(z.custom<SkillManifest>()).optional(),
  commands: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        handler: z.string()
      })
    )
    .optional()
});

export type ExtensionContributions = z.infer<typeof ExtensionContributionSchema>;

export const ExtensionManifestSchema = z.object({
  id: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-_]+$/, 'ID must be lowercase alphanumeric with hyphens or underscores'),
  name: z.string().min(1),
  displayName: z.string().optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+.*$/, 'Must be a valid semver version'),
  description: z.string().default(''),
  author: z.string().default('anonymous'),
  license: z.string().default('MIT'),
  homepage: z.string().optional(),
  main: z.string().optional(),
  permissions: ExtensionPermissionSchema.default({}),
  contributes: ExtensionContributionSchema.default({})
});

export type ExtensionManifest = z.infer<typeof ExtensionManifestSchema>;

export type ExtensionStatus = 'active' | 'disabled' | 'error' | 'unverified';

export interface ExtensionRecord {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  status: ExtensionStatus;
  installPath: string;
  checksum: string;
  manifest: ExtensionManifest;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
  isBuiltIn?: boolean;
  sandboxMode?: string;
}

export interface WorkspaceCapability {
  readFile: (relativePath: string) => Promise<{ content: string }>;
  listFiles: (relativePath?: string) => Promise<{ files: string[] }>;
  writeFile: (relativePath: string, content: string) => Promise<{ success: boolean; bytesWritten: number }>;
}

export interface StorageCapability {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
  delete: (key: string) => Promise<boolean>;
}

export interface WorkflowCapability {
  registerNode: (node: NodeDefinition) => Promise<void>;
}

export interface SkillsCapability {
  register: (skill: SkillManifest) => Promise<void>;
}

export interface NotificationsCapability {
  show: (message: string, type?: 'info' | 'warning' | 'error') => Promise<void>;
}

export interface ExtensionContext {
  extensionId: string;
  storagePath: string;
  permissions: ExtensionPermissions;
  workspacePath?: string;
  log: (message: string, level?: 'info' | 'warn' | 'error') => void;
  // Capability-based API namespaces
  workspace: WorkspaceCapability;
  storage: StorageCapability;
  workflow: WorkflowCapability;
  skills: SkillsCapability;
  notifications: NotificationsCapability;
  // Legacy / convenience shorthands
  registerNode: (node: NodeDefinition) => void;
  registerSkill: (skill: SkillManifest) => void;
}

export interface IExtensionModule {
  activate: (context: ExtensionContext) => Promise<void> | void;
  deactivate?: () => Promise<void> | void;
  executeNode?: (nodeType: string, inputs: Record<string, any>, config?: Record<string, any>) => Promise<Record<string, any>>;
}

export type ExtensionHostRpcType =
  | 'ACTIVATE'
  | 'ACTIVATE_RESULT'
  | 'DEACTIVATE'
  | 'DEACTIVATE_RESULT'
  | 'EXECUTE_NODE'
  | 'EXECUTE_NODE_RESULT'
  | 'PING'
  | 'PONG'
  | 'CAPABILITY_REQUEST'
  | 'CAPABILITY_RESPONSE'
  | 'LOG'
  | 'ERROR';

export interface ExtensionHostRpcMessage {
  id: string;
  type: ExtensionHostRpcType;
  extensionId: string;
  payload?: any;
  error?: string;
}

export interface CatalogPluginItem {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  category: 'editor' | 'git' | 'developer' | 'ai-tools' | 'themes' | 'general';
  isOfficial: boolean;
  downloads: number;
  rating: number;
  permissions: ExtensionPermissions;
  manifest: ExtensionManifest;
}
