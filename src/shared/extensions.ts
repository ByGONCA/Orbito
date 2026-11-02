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
}

export interface ExtensionContext {
  extensionId: string;
  storagePath: string;
  permissions: ExtensionPermissions;
  log: (message: string, level?: 'info' | 'warn' | 'error') => void;
  registerNode: (node: NodeDefinition) => void;
  registerSkill: (skill: SkillManifest) => void;
}

export interface IExtensionModule {
  activate: (context: ExtensionContext) => Promise<void> | void;
  deactivate?: () => Promise<void> | void;
}
