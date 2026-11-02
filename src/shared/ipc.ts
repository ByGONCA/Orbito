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
import type {
  CLIInstallationStatus,
  CLIAuthStatus,
  CLISessionRecord,
  CLISessionMessage,
  CLIStreamEvent,
  CLIProvider
} from './cli';
import {
  DetectCLIsSchema,
  CheckCLIAuthSchema,
  ExecuteCLIPromptSchema,
  CancelCLISessionSchema,
  ListCLISessionsSchema,
  GetSessionMessagesSchema
} from './cli';
import type {
  IndexStats,
  SearchResult,
  ContextAssemblyResult
} from './context';
import {
  StartIndexingSchema,
  CancelIndexingSchema,
  GetIndexStatsSchema,
  SearchContextSchema,
  AssembleContextSchema
} from './context';
import type {
  SkillMetadata,
  SkillDetails,
  SkillResolutionResult,
  SkillExecutionRecord
} from './skills';
import {
  ToggleSkillSchema,
  ResolveSkillSchema,
  ExecuteSkillSchema,
  ImportCustomSkillSchema,
  DeleteCustomSkillSchema
} from './skills';
import type {
  OrchestrationRecord,
  OrchestrationTask,
  ApprovalRequest,
  OrchestrationEvent
} from './agents';
import {
  StartOrchestrationSchema,
  CancelOrchestrationSchema,
  ResolveApprovalSchema,
  GetOrchestrationSchema,
  ListOrchestrationsSchema,
  RetryTaskSchema,
  GetWorktreeDiffSchema
} from './agents';
import type {
  WorkflowRecord,
  WorkflowExecutionRecord,
  WorkflowEvent,
  NLWorkflowGenerationResult
} from './workflows';
import { WorkflowRecordSchema } from './workflows';

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
// Phase 6: Visual Automation & Workflows Schemas
// ==========================================

export const ListWorkflowsSchema = z.object({
  projectId: z.string().optional()
});

export const GetWorkflowSchema = z.object({
  id: z.string().min(1)
});

export const SaveWorkflowSchema = z.object({
  workflow: WorkflowRecordSchema
});

export const DeleteWorkflowSchema = z.object({
  id: z.string().min(1)
});

export const DuplicateWorkflowSchema = z.object({
  id: z.string().min(1)
});

export const ExecuteWorkflowSchema = z.object({
  workflowId: z.string().min(1),
  initialInputs: z.record(z.any()).optional(),
  projectPath: z.string().min(1)
});

export const CancelWorkflowSchema = z.object({
  executionId: z.string().min(1)
});

export const GetWorkflowExecutionSchema = z.object({
  id: z.string().min(1)
});

export const ListWorkflowExecutionsSchema = z.object({
  workflowId: z.string().min(1)
});

export const GenerateWorkflowFromPromptSchema = z.object({
  prompt: z.string().min(3),
  projectPath: z.string().min(1),
  preferredProvider: z.enum(['claude', 'codex', 'gemini']).optional()
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

  // CLI Engine (Phase 2)
  detectCLIs: (params?: z.input<typeof DetectCLIsSchema>) => Promise<Record<CLIProvider, CLIInstallationStatus>>;
  checkCLIAuth: (params: z.input<typeof CheckCLIAuthSchema>) => Promise<CLIAuthStatus>;
  executeCLIPrompt: (params: z.input<typeof ExecuteCLIPromptSchema>) => Promise<{ sessionId: string }>;
  cancelCLISession: (params: z.input<typeof CancelCLISessionSchema>) => Promise<{ success: boolean }>;
  listCLISessions: (params?: z.input<typeof ListCLISessionsSchema>) => Promise<CLISessionRecord[]>;
  getSessionMessages: (params: z.input<typeof GetSessionMessagesSchema>) => Promise<CLISessionMessage[]>;
  onCLIStreamEvent: (callback: (event: CLIStreamEvent) => void) => () => void;

  // Context Engine (Phase 3)
  startIndexing: (params: z.input<typeof StartIndexingSchema>) => Promise<IndexStats>;
  cancelIndexing: (params: z.input<typeof CancelIndexingSchema>) => Promise<{ success: boolean }>;
  getIndexStats: (params: z.input<typeof GetIndexStatsSchema>) => Promise<IndexStats>;
  searchContext: (params: z.input<typeof SearchContextSchema>) => Promise<SearchResult[]>;
  assembleContext: (params: z.input<typeof AssembleContextSchema>) => Promise<ContextAssemblyResult>;
  onIndexingProgress: (callback: (progress: { current: number; total: number; currentFile: string }) => void) => () => void;
  onIndexingStatus: (callback: (status: { isIndexing: boolean; isWatching: boolean }) => void) => () => void;

  // Skills Engine (Phase 4)
  listSkills: () => Promise<SkillMetadata[]>;
  getSkillDetails: (skillId: string) => Promise<SkillDetails | null>;
  toggleSkill: (params: z.input<typeof ToggleSkillSchema>) => Promise<{ success: boolean }>;
  resolveSkillForPrompt: (params: z.input<typeof ResolveSkillSchema>) => Promise<SkillResolutionResult[]>;
  executeSkill: (params: z.input<typeof ExecuteSkillSchema>) => Promise<{ executionId: string; sessionId?: string; success: boolean }>;
  importCustomSkill: (params: z.input<typeof ImportCustomSkillSchema>) => Promise<{ success: boolean; skill?: SkillMetadata; error?: string; securityNotice?: string }>;
  deleteCustomSkill: (params: z.input<typeof DeleteCustomSkillSchema>) => Promise<{ success: boolean }>;
  listSkillExecutions: (projectId?: string) => Promise<SkillExecutionRecord[]>;

  // Multi-Agent Orchestration (Phase 5)
  startOrchestration: (params: z.input<typeof StartOrchestrationSchema>) => Promise<OrchestrationRecord>;
  cancelOrchestration: (params: z.input<typeof CancelOrchestrationSchema>) => Promise<{ success: boolean }>;
  resolveApproval: (params: z.input<typeof ResolveApprovalSchema>) => Promise<{ success: boolean }>;
  getOrchestration: (params: z.input<typeof GetOrchestrationSchema>) => Promise<OrchestrationRecord | null>;
  listOrchestrations: (params?: z.input<typeof ListOrchestrationsSchema>) => Promise<OrchestrationRecord[]>;
  retryOrchestrationTask: (params: z.input<typeof RetryTaskSchema>) => Promise<{ success: boolean }>;
  getWorktreeDiff: (params: z.input<typeof GetWorktreeDiffSchema>) => Promise<string>;
  getPendingApprovals: (orchestrationId?: string) => Promise<ApprovalRequest[]>;
  onOrchestrationEvent: (callback: (event: OrchestrationEvent) => void) => () => void;

  // Visual Automation & Workflows (Phase 6)
  listWorkflows: (params?: z.input<typeof ListWorkflowsSchema>) => Promise<WorkflowRecord[]>;
  getWorkflow: (params: z.input<typeof GetWorkflowSchema>) => Promise<WorkflowRecord | null>;
  saveWorkflow: (params: z.input<typeof SaveWorkflowSchema>) => Promise<{ success: boolean }>;
  deleteWorkflow: (params: z.input<typeof DeleteWorkflowSchema>) => Promise<{ success: boolean }>;
  duplicateWorkflow: (params: z.input<typeof DuplicateWorkflowSchema>) => Promise<WorkflowRecord | null>;
  getWorkflowTemplates: () => Promise<WorkflowRecord[]>;
  executeWorkflow: (params: z.input<typeof ExecuteWorkflowSchema>) => Promise<WorkflowExecutionRecord>;
  cancelWorkflow: (params: z.input<typeof CancelWorkflowSchema>) => Promise<{ success: boolean }>;
  getWorkflowExecution: (params: z.input<typeof GetWorkflowExecutionSchema>) => Promise<WorkflowExecutionRecord | null>;
  listWorkflowExecutions: (params: z.input<typeof ListWorkflowExecutionsSchema>) => Promise<WorkflowExecutionRecord[]>;
  generateWorkflowFromPrompt: (params: z.input<typeof GenerateWorkflowFromPromptSchema>) => Promise<NLWorkflowGenerationResult>;
  onWorkflowEvent: (callback: (event: WorkflowEvent) => void) => () => void;
}
