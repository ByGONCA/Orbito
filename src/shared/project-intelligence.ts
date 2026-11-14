import { z } from 'zod';

export interface LanguageStat {
  name: string;
  fileCount: number;
  percentage: number;
}

export interface TechStackInfo {
  languages: LanguageStat[];
  frameworks: string[];
  libraries: string[];
  packageManagers: string[];
  buildSystems: string[];
  testFrameworks: string[];
  databaseEngines: string[];
  apiStyles: string[];
  styling: string[];
  dockerSupport: boolean;
  ciWorkflows: string[];
  rawManifestsFound: string[];
}

export interface MonorepoPackage {
  name: string;
  path: string;
  relativePath: string;
  type: string;
  entryPoint?: string;
}

export interface MonorepoInfo {
  isMonorepo: boolean;
  type: 'pnpm' | 'lerna' | 'turborepo' | 'nx' | 'cargo' | 'go' | 'nested' | 'none';
  packages: MonorepoPackage[];
}

export interface ProjectModule {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  type:
    | 'entrypoint'
    | 'service'
    | 'ui'
    | 'data-access'
    | 'utility'
    | 'types'
    | 'ipc'
    | 'tests'
    | 'config'
    | 'general';
  responsibility: string;
  fileCount: number;
  dependencies: string[];
  dependedOnBy: string[];
}

export interface ArchitecturalOverview {
  style:
    | 'monolithic'
    | 'modular-monolith'
    | 'monorepo'
    | 'layered'
    | 'microservices'
    | 'client-server';
  entryPoints: Array<{ path: string; type: string; description: string }>;
  modules: ProjectModule[];
  circularDependencies: Array<{ cycle: string[] }>;
  criticalPaths: string[];
  summary: string;
}

export type KnowledgeSource = 'observed' | 'inferred' | 'agent_summary' | 'user_decision';

export type KnowledgeCategory =
  | 'architecture'
  | 'tech_stack'
  | 'convention'
  | 'decision'
  | 'constraint'
  | 'terminology'
  | 'git_context'
  | 'file_importance';

export interface ProjectKnowledgeEntry {
  id: string;
  projectId: string;
  category: KnowledgeCategory;
  key: string;
  title: string;
  content: string;
  confidence: number;
  source: KnowledgeSource;
  sourcePath?: string;
  isConfirmed: boolean;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface GitIntelligence {
  branch: string;
  headCommit: string;
  commitMessage: string;
  isDirty: boolean;
  modifiedFiles: string[];
  stagedFiles: string[];
  untrackedFiles: string[];
  activeWorktrees: Array<{ path: string; branch: string; isCurrent: boolean }>;
  hotspotFiles: Array<{ path: string; changesCount: number }>;
}

export type HealthSeverity = 'critical' | 'warning' | 'info';

export interface HealthFinding {
  id: string;
  category: 'architecture' | 'dependencies' | 'testing' | 'documentation' | 'security' | 'build';
  severity: HealthSeverity;
  title: string;
  message: string;
  filePath?: string;
  remediation?: string;
  evidence?: string;
}

export interface ProjectHealthReport {
  overallScore: number;
  categoryScores: {
    architecture: number;
    dependencies: number;
    testing: number;
    documentation: number;
    security: number;
    build: number;
  };
  findings: HealthFinding[];
  evaluatedAt: number;
}

export type AgentRoleType =
  | 'architect'
  | 'frontend'
  | 'backend'
  | 'security'
  | 'reviewer'
  | 'tester'
  | 'general';

export interface RoleContextPackage {
  role: AgentRoleType;
  relevantModules: string[];
  relevantFiles: string[];
  keyConventions: string[];
  architecturalNotes: string;
  systemConstraints: string[];
  suggestedSkills: string[];
}

export interface ProjectIntelligenceData {
  projectId: string;
  projectPath: string;
  techStack: TechStackInfo;
  monorepo: MonorepoInfo;
  architecture: ArchitecturalOverview;
  git: GitIntelligence;
  health: ProjectHealthReport;
  knowledgeEntries: ProjectKnowledgeEntry[];
  lastAnalyzedAt: number;
}

// ==========================================
// Zod Schemas for IPC & Validation
// ==========================================

export const InspectProjectSchema = z.object({
  projectId: z.string().optional(),
  projectPath: z.string().min(1)
});

export const AnalyzeProjectSchema = z.object({
  projectId: z.string().optional(),
  projectPath: z.string().min(1),
  forceRefresh: z.boolean().optional().default(false)
});

export const GetProjectArchitectureSchema = z.object({
  projectPath: z.string().min(1)
});

export const GetProjectHealthSchema = z.object({
  projectPath: z.string().min(1)
});

export const GetProjectKnowledgeSchema = z.object({
  projectPath: z.string().min(1),
  category: z
    .enum([
      'architecture',
      'tech_stack',
      'convention',
      'decision',
      'constraint',
      'terminology',
      'git_context',
      'file_importance'
    ])
    .optional()
});

export const UpsertKnowledgeEntrySchema = z.object({
  projectId: z.string().min(1),
  category: z.enum([
    'architecture',
    'tech_stack',
    'convention',
    'decision',
    'constraint',
    'terminology',
    'git_context',
    'file_importance'
  ]),
  key: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  source: z.enum(['observed', 'inferred', 'agent_summary', 'user_decision']).default('user_decision'),
  sourcePath: z.string().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  isConfirmed: z.boolean().default(true),
  metadata: z.record(z.any()).optional()
});

export const AssembleRoleContextSchema = z.object({
  projectPath: z.string().min(1),
  role: z.enum(['architect', 'frontend', 'backend', 'security', 'reviewer', 'tester', 'general']),
  taskDescription: z.string().min(1),
  maxTokens: z.number().optional().default(4000)
});
