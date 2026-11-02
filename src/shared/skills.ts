import { z } from 'zod';

export type SkillCategory =
  | 'analysis'
  | 'quality'
  | 'debugging'
  | 'refactoring'
  | 'documentation'
  | 'testing'
  | 'security'
  | 'architecture';

export const SkillPermissionsSchema = z.object({
  filesystem: z.object({
    read: z.boolean().default(true),
    write: z.boolean().default(false),
    allowedPaths: z.array(z.string()).optional()
  }),
  terminal: z.object({
    execute: z.boolean().default(false),
    allowedCommands: z.array(z.string()).optional()
  }),
  network: z.object({
    allowed: z.boolean().default(false),
    domains: z.array(z.string()).optional()
  })
});

export type SkillPermissions = z.infer<typeof SkillPermissionsSchema>;

export const SkillContextRequirementsSchema = z.object({
  indexingNeeded: z.boolean().default(true),
  fileSearchPattern: z.string().optional(),
  maxContextTokens: z.number().optional().default(16000)
});

export type SkillContextRequirements = z.infer<typeof SkillContextRequirementsSchema>;

export const SkillManifestSchema = z.object({
  id: z.string().min(2).regex(/^[a-z0-9-_]+$/, 'ID must be lowercase alphanumeric with hyphens or underscores'),
  name: z.string().min(2).max(100),
  description: z.string().min(10).max(500),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver (e.g. 1.0.0)'),
  author: z.string().min(2),
  category: z.enum([
    'analysis',
    'quality',
    'debugging',
    'refactoring',
    'documentation',
    'testing',
    'security',
    'architecture'
  ]),
  tags: z.array(z.string()).default([]),
  supportedProviders: z.array(z.enum(['claude', 'codex', 'gemini'])).min(1),
  requiredCapabilities: z.array(z.string()).default([]),
  requiredPermissions: SkillPermissionsSchema,
  contextRequirements: SkillContextRequirementsSchema.default({}),
  executionConstraints: z
    .object({
      timeoutMs: z.number().optional().default(120000),
      maxRetries: z.number().optional().default(0)
    })
    .default({})
});

export type SkillManifest = z.infer<typeof SkillManifestSchema>;

export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: SkillCategory;
  tags: string[];
  supportedProviders: ('claude' | 'codex' | 'gemini')[];
  isBuiltIn: boolean;
  enabled: boolean;
  checksum: string;
  manifestPath: string;
  instructionsPath: string;
  permissions: SkillPermissions;
  contextRequirements: SkillContextRequirements;
}

export interface SkillDetails extends SkillMetadata {
  manifest: SkillManifest;
  instructions: string;
}

export interface SkillResolutionResult {
  skill: SkillMetadata;
  confidence: number; // 0.0 to 1.0
  matchedKeywords: string[];
  reason: string;
}

export interface SkillExecutionRecord {
  id: string;
  skillId: string;
  projectId: string;
  provider: string;
  model?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  inputSummary: string;
  durationMs: number;
  tokensUsed: number;
  createdAt: number;
  errorMessage?: string;
}

// IPC Payload Schemas
export const ToggleSkillSchema = z.object({
  skillId: z.string().min(1),
  enabled: z.boolean()
});

export const ResolveSkillSchema = z.object({
  prompt: z.string().min(1),
  provider: z.enum(['claude', 'codex', 'gemini']).optional()
});

export const ExecuteSkillSchema = z.object({
  skillId: z.string().min(1),
  prompt: z.string().min(1),
  projectId: z.string().min(1),
  projectPath: z.string().min(1),
  provider: z.enum(['claude', 'codex', 'gemini']),
  model: z.string().optional()
});

export const ImportCustomSkillSchema = z.object({
  sourceDirectory: z.string().min(1)
});

export const DeleteCustomSkillSchema = z.object({
  skillId: z.string().min(1)
});
