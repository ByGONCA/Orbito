import { z } from 'zod';
import type {
  ProjectDescriptor,
  WorkspaceConfig,
  AppLayoutConfig,
  ProjectWorkspaceState,
  FileNode,
  MemoryRecord,
  SystemResourceMetrics,
  DetailedResourceMetrics,
  PermissionLevel,
  UIMode,
  ProjectGraphData,
  DiscordStatusResponse,
  GitProviderStatus,
  RemoteGitRepo
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
  GetSessionMessagesSchema,
  TerminalCreateSchema,
  TerminalWriteSchema,
  TerminalResizeSchema,
  TerminalKillSchema
} from './cli';
import type {
  IndexStats,
  SearchResult,
  ContextAssemblyResult
} from './context';
import type {
  ModelRoutingDecision,
  PromptAssemblyResult,
  ComposedSkillInstructions
} from './intelligence';
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
import type {
  ExtensionRecord,
  ExtensionManifest,
  CatalogPluginItem
} from './extensions';
import type {
  AnalyticsEvent,
  AnalyticsSummary,
  ProviderCostMetrics,
  AuditLogEntry,
  AuditLogFilter,
  AirGapConfig
} from './analytics';

// ==========================================
// Zod Schemas for Runtime IPC Validation
// ==========================================

export const OpenDirectorySchema = z.object({
  targetPath: z.string().optional()
});

export const CreateProjectSchema = z.object({
  name: z.string().min(1),
  parentDirectory: z.string().min(1),
  template: z.enum(['empty', 'node', 'react', 'python']),
  initGit: z.boolean().default(true)
});

export const CloneProjectSchema = z.object({
  url: z.string().min(1),
  parentDirectory: z.string().min(1),
  customName: z.string().optional()
});

export const GitProviderSourceIdSchema = z.enum([
  'github',
  'azure-devops',
  'bitbucket',
  'cursor',
  'forgejo',
  'gitcafe',
  'gitlab'
]);

export const SaveGitProviderConfigSchema = z.object({
  provider: GitProviderSourceIdSchema,
  token: z.string().min(1),
  serverUrl: z.string().optional(),
  username: z.string().optional(),
  organization: z.string().optional()
});

export const DisconnectGitProviderSchema = z.object({
  provider: GitProviderSourceIdSchema
});

export const FetchRemoteReposSchema = z.object({
  provider: GitProviderSourceIdSchema,
  search: z.string().optional()
});

export const CloneRemoteRepoSchema = z.object({
  provider: GitProviderSourceIdSchema,
  cloneUrl: z.string().min(1),
  parentDirectory: z.string().min(1),
  customName: z.string().optional()
});

export const ToggleProjectFavoriteSchema = z.object({
  projectId: z.string().min(1),
  isFavorite: z.boolean().optional()
});

export const ListFilesSchema = z.object({
  projectPath: z.string().min(1),
  maxDepth: z.number().int().min(1).max(20).optional().default(8)
});

export const ReadFileSchema = z.object({
  filePath: z.string().min(1),
  projectPath: z.string().min(1)
});

export const SaveFileSchema = z.object({
  filePath: z.string().min(1),
  projectPath: z.string().min(1),
  content: z.string()
});

export const CreateFileSchema = z.object({
  filePath: z.string().min(1),
  projectPath: z.string().min(1),
  content: z.string().optional().default('')
});

export const CreateDirectorySchema = z.object({
  directoryPath: z.string().min(1),
  projectPath: z.string().min(1)
});

export const RenameItemSchema = z.object({
  oldPath: z.string().min(1),
  newName: z.string().min(1),
  projectPath: z.string().min(1)
});

export const DeleteItemSchema = z.object({
  targetPath: z.string().min(1),
  projectPath: z.string().min(1)
});

export const MoveItemSchema = z.object({
  sourcePath: z.string().min(1),
  destinationDir: z.string().min(1),
  projectPath: z.string().min(1)
});

export const RevealInFileManagerSchema = z.object({
  filePath: z.string().min(1)
});

export const GetFileSymbolsSchema = z.object({
  filePath: z.string().min(1),
  projectPath: z.string().min(1)
});

export const GetProjectGraphSchema = z.object({
  projectPath: z.string().min(1)
});

export const UpdateSettingsSchema = z.object({
  currentProjectId: z.string().optional(),
  uiMode: z.enum(['simple', 'advanced']).optional(),
  theme: z.enum(['glass', 'solid', 'dark', 'light', 'system']).optional(),
  autoIndex: z.boolean().optional(),
  fileIconTheme: z.enum(['vscode', 'material', 'minimal', 'symbols']).optional(),
  showGitFileColors: z.boolean().optional(),
  discordRpcEnabled: z.boolean().optional(),
  discordClientId: z.string().optional()
});

export const UpdateDiscordSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  clientId: z.string().optional()
});

export const CreateWorktreeSchema = z.object({
  projectPath: z.string().min(1),
  branchName: z.string().min(1).regex(/^[a-zA-Z0-9_\-\.\/]+$/, 'Invalid branch name characters')
});

export const RemoveWorktreeSchema = z.object({
  projectPath: z.string().min(1),
  worktreePath: z.string().min(1),
  branchName: z.string().optional()
});

export const OpenInExplorerSchema = z.object({
  projectPath: z.string().min(1)
});

export const GetProjectGitRemoteSchema = z.object({
  projectPath: z.string().min(1)
});

export const SaveAppLayoutSchema = z.object({
  layout: z.record(z.any())
});

export const SaveProjectWorkspaceStateSchema = z.object({
  projectId: z.string().min(1),
  state: z.record(z.any())
});

export const GetProjectWorkspaceStateSchema = z.object({
  projectId: z.string().min(1)
});

export const UpdateProjectSchema = z.object({
  projectId: z.string().min(1),
  updates: z.object({
    customName: z.string().optional(),
    customColor: z.string().optional(),
    customIcon: z.string().optional(),
    description: z.string().optional(),
    tag: z.string().optional(),
    isFavorite: z.boolean().optional(),
    settings: z.record(z.any()).optional()
  })
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
  preferredProvider: z.enum(['claude', 'codex', 'gemini', 'ollama']).optional()
});

// Phase 7: Ecosystem & Enterprise Hardening Schemas
export const ListExtensionsSchema = z.object({}).optional();
export const ToggleExtensionSchema = z.object({
  extensionId: z.string().min(1),
  enabled: z.boolean()
});
export const InstallExtensionSchema = z.object({
  directoryPath: z.string().min(1)
});
export const InstallCatalogPluginSchema = z.object({
  pluginId: z.string().min(1)
});
export const UninstallExtensionSchema = z.object({
  extensionId: z.string().min(1)
});

export const GetAnalyticsSummarySchema = z
  .object({
    projectId: z.string().optional(),
    timeRangeMs: z.number().optional()
  })
  .optional();

export const GetProviderCostMetricsSchema = z
  .object({
    projectId: z.string().optional()
  })
  .optional();

export const RecordAnalyticsEventSchema = z.object({
  provider: z.string(),
  model: z.string(),
  tokensIn: z.number().nonnegative(),
  tokensOut: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  costUsd: z.number().nonnegative().optional(),
  status: z.enum(['success', 'failure', 'timeout', 'cancelled']).default('success'),
  feature: z.enum(['cli', 'workflow', 'orchestration', 'skill', 'chat']),
  details: z.record(z.any()).optional()
});

export const ExportAnalyticsSchema = z.object({
  format: z.enum(['json', 'csv'])
});

export const QueryAuditLogsSchema = z
  .object({
    eventType: z.string().optional(),
    severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
    actor: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional()
  })
  .optional();

export const ExportAuditLogsSchema = z.object({
  format: z.enum(['json', 'csv'])
});

export const GetAirGapConfigSchema = z.object({}).optional();

export const UpdateAirGapConfigSchema = z.object({
  enabled: z.boolean(),
  allowedHosts: z.array(z.string()).optional(),
  blockExternalNetwork: z.boolean().optional(),
  enforceLocalModels: z.boolean().optional(),
  defaultLocalModel: z.string().optional(),
  localOllamaUrl: z.string().optional()
});

export const ListLocalModelsSchema = z.object({}).optional();

// ==========================================
// Phase 8: Intelligence & Token Optimization Schemas
// ==========================================

export const RouteIntelligenceTaskSchema = z.object({
  taskDescription: z.string(),
  category: z.enum(['classification', 'summarization', 'code_generation', 'deep_reasoning', 'architecture', 'security_review', 'large_context', 'general']).optional(),
  estimatedInputTokens: z.number().optional(),
  requiresModifications: z.boolean().optional(),
  requiresReasoning: z.boolean().optional(),
  preferredProvider: z.enum(['claude', 'codex', 'gemini', 'ollama']).optional(),
  optimizationMode: z.enum(['balanced', 'cost_efficient', 'max_quality']).optional()
});

export const AssemblePromptSchema = z.object({
  systemPrompt: z.string().optional(),
  securityConstraints: z.array(z.string()).optional(),
  userObjective: z.string(),
  acceptanceCriteria: z.array(z.string()).optional(),
  skillInstructions: z.string().optional(),
  contextMarkdown: z.string().optional(),
  previousResults: z.string().optional(),
  expectedOutputFormat: z.string().optional(),
  maxTokens: z.number().optional(),
  modelTarget: z.string().optional(),
  mode: z.enum(['balanced', 'cost_efficient', 'max_quality']).optional()
});

export const ComposeSkillsSchema = z.object({
  skillIds: z.array(z.string()),
  level: z.enum(['metadata', 'summary', 'full']).optional(),
  maxTokens: z.number().optional()
});

export const GetCacheStatsSchema = z.object({}).optional();
export const ClearCacheSchema = z.object({}).optional();

// ==========================================
// Project Explorer: Changes & Code Review Schemas
// ==========================================

export const ListProjectExecutionsSchema = z.object({
  projectId: z.string().min(1)
});

export const GetExecutionFileChangesSchema = z.object({
  executionId: z.string().min(1)
});

export const SyncManualChangesSchema = z.object({
  projectId: z.string().min(1),
  projectPath: z.string().min(1)
});

export const GetCodeReviewSchema = z.object({
  projectId: z.string().min(1),
  executionId: z.string().optional()
});

export const UpdateReviewDecisionSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(['not_reviewed', 'reviewed', 'issues_found', 'changes_requested', 'approved']),
  reviewer: z.string().optional(),
  summary: z.string().optional()
});

export const MarkFileReviewStatusSchema = z.object({
  reviewId: z.string().min(1),
  filePath: z.string().min(1),
  status: z.enum(['pending', 'reviewed', 'changes_requested'])
});

export const AddReviewCommentSchema = z.object({
  reviewId: z.string().min(1),
  projectId: z.string().min(1),
  filePath: z.string().min(1),
  lineNumber: z.number().int().optional(),
  diffHunk: z.string().optional(),
  content: z.string().min(1),
  author: z.string().min(1),
  parentCommentId: z.string().optional()
});

export const ListReviewCommentsSchema = z.object({
  reviewId: z.string().min(1)
});

export const ResolveReviewCommentSchema = z.object({
  commentId: z.string().min(1),
  resolved: z.boolean()
});

export const RunAICodeReviewSchema = z.object({
  reviewId: z.string().min(1),
  projectPath: z.string().min(1),
  diff: z.string(),
  changedFiles: z.array(z.string())
});

export const GetProjectGitDetailsSchema = z.object({
  projectPath: z.string().min(1)
});

// ==========================================
// Strongly-Typed IPC Interface Contract
// ==========================================

export interface IElectronAPI {
  // Workspace & File Management
  openDirectoryDialog: (params?: z.input<typeof OpenDirectorySchema>) => Promise<ProjectDescriptor | null>;
  createProject: (params: z.input<typeof CreateProjectSchema>) => Promise<ProjectDescriptor>;
  cloneProject: (params: z.input<typeof CloneProjectSchema>) => Promise<ProjectDescriptor>;
  selectDirectory: (title?: string) => Promise<string | null>;
  verifyProjectPath: (projectPath: string) => Promise<boolean>;
  listFiles: (params: z.input<typeof ListFilesSchema>) => Promise<FileNode[]>;
  readFileContent: (params: z.input<typeof ReadFileSchema>) => Promise<string>;
  saveFileContent: (params: z.input<typeof SaveFileSchema>) => Promise<boolean>;
  createFile: (params: z.input<typeof CreateFileSchema>) => Promise<{ success: boolean; path: string }>;
  createDirectory: (params: z.input<typeof CreateDirectorySchema>) => Promise<{ success: boolean; path: string }>;
  renameItem: (params: z.input<typeof RenameItemSchema>) => Promise<{ success: boolean; oldPath: string; newPath: string }>;
  deleteItem: (params: z.input<typeof DeleteItemSchema>) => Promise<{ success: boolean; path: string }>;
  moveItem: (params: z.input<typeof MoveItemSchema>) => Promise<{ success: boolean; oldPath: string; newPath: string }>;
  getFileSymbols: (params: z.input<typeof GetFileSymbolsSchema>) => Promise<any[]>;
  getRecentProjects: () => Promise<ProjectDescriptor[]>;
  removeProject: (projectId: string) => Promise<boolean>;
  updateProject: (params: { projectId: string; updates: Partial<ProjectDescriptor> }) => Promise<ProjectDescriptor>;
  toggleProjectFavorite: (params: { projectId: string; isFavorite?: boolean }) => Promise<boolean>;
  getProjectSettings: (projectId: string) => Promise<any>;
  saveProjectSettings: (params: { projectId: string; settings: any }) => Promise<boolean>;
  openInExplorer: (projectPath: string) => Promise<string>;
  revealInFileManager: (params: z.input<typeof RevealInFileManagerSchema>) => Promise<boolean>;
  createWorktree: (params: { projectPath: string; branchName: string }) => Promise<any>;
  removeWorktree: (params: { projectPath: string; worktreePath: string; branchName?: string }) => Promise<boolean>;
  getGitStatus: (projectPath: string) => Promise<any>;
  getProjectGraph: (params: { projectPath: string }) => Promise<ProjectGraphData>;
  
  // Git Providers & Remote Repositories
  getGitProvidersStatus: () => Promise<GitProviderStatus[]>;
  saveGitProviderConfig: (params: z.input<typeof SaveGitProviderConfigSchema>) => Promise<{ success: boolean; user?: string; error?: string }>;
  disconnectGitProvider: (params: z.input<typeof DisconnectGitProviderSchema>) => Promise<{ success: boolean }>;
  fetchRemoteRepositories: (params: z.input<typeof FetchRemoteReposSchema>) => Promise<{ success: boolean; repos: RemoteGitRepo[]; error?: string }>;
  cloneRemoteRepository: (params: z.input<typeof CloneRemoteRepoSchema>) => Promise<ProjectDescriptor>;
  
  // Settings & App Configuration
  getSettings: () => Promise<WorkspaceConfig>;
  updateSettings: (params: z.input<typeof UpdateSettingsSchema>) => Promise<WorkspaceConfig>;
  getAppLayout: () => Promise<AppLayoutConfig>;
  saveAppLayout: (params: z.input<typeof SaveAppLayoutSchema>) => Promise<boolean>;
  getProjectWorkspaceState: (params: z.input<typeof GetProjectWorkspaceStateSchema>) => Promise<ProjectWorkspaceState | null>;
  saveProjectWorkspaceState: (params: z.input<typeof SaveProjectWorkspaceStateSchema>) => Promise<boolean>;
  
  // Credentials (safeStorage)
  storeSecret: (params: z.input<typeof StoreSecretSchema>) => Promise<{ success: boolean }>;
  getSecret: (params: z.input<typeof GetSecretSchema>) => Promise<string | null>;
  hasSecret: (params: z.input<typeof GetSecretSchema>) => Promise<boolean>;
  
  // Memories (5-tier system)
  listMemories: (tier?: string) => Promise<MemoryRecord[]>;
  saveMemory: (params: z.input<typeof SaveMemorySchema>) => Promise<MemoryRecord>;
  deleteMemory: (params: z.input<typeof DeleteMemorySchema>) => Promise<{ success: boolean }>;
  
  // System Metrics & Diagnostics
  getSystemMetrics: () => Promise<SystemResourceMetrics>;
  getDetailedResources: () => Promise<DetailedResourceMetrics>;
  toggleKeepAwake: (enable?: boolean) => Promise<{ enabled: boolean }>;
  getKeepAwake: () => Promise<{ enabled: boolean }>;
  cleanupWorkspaces: () => Promise<{ success: boolean; freedMb: number }>;
  getActivePorts: () => Promise<Array<{ port: number; service?: string }>>;
  getSystemLogs: () => Promise<Array<{ id: string; timestamp: string; component: string; level: 'info' | 'warn' | 'error' | 'debug'; message: string }>>;
  onSystemLog: (callback: (log: { id: string; timestamp: string; message: string; level: 'info' | 'warn' | 'error' }) => void) => () => void;

  // CLI Engine (Phase 2)
  detectCLIs: (params?: z.input<typeof DetectCLIsSchema>) => Promise<Record<CLIProvider, CLIInstallationStatus>>;
  checkCLIAuth: (params: z.input<typeof CheckCLIAuthSchema>) => Promise<CLIAuthStatus>;
  executeCLIPrompt: (params: z.input<typeof ExecuteCLIPromptSchema>) => Promise<{ sessionId: string }>;
  cancelCLISession: (params: z.input<typeof CancelCLISessionSchema>) => Promise<{ success: boolean }>;
  listCLISessions: (params?: z.input<typeof ListCLISessionsSchema>) => Promise<CLISessionRecord[]>;
  getSessionMessages: (params: z.input<typeof GetSessionMessagesSchema>) => Promise<CLISessionMessage[]>;
  onCLIStreamEvent: (callback: (event: CLIStreamEvent) => void) => () => void;

  // Interactive Terminal Engine (PTY & xterm.js)
  terminalCreate: (params: z.input<typeof TerminalCreateSchema>) => Promise<{
    success: boolean;
    pid?: number;
    error?: string;
    installCommand?: string;
    installGuideUrl?: string;
    isExisting?: boolean;
  }>;
  terminalWrite: (params: z.input<typeof TerminalWriteSchema>) => Promise<void>;
  terminalResize: (params: z.input<typeof TerminalResizeSchema>) => Promise<void>;
  terminalKill: (params: z.input<typeof TerminalKillSchema>) => Promise<{ success: boolean }>;
  onTerminalData: (callback: (event: { terminalId: string; data: string }) => void) => () => void;
  onTerminalExit: (callback: (event: { terminalId: string; exitCode: number; signal?: number }) => void) => () => void;

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

  // Custom Extension SDK & Plugins Ecosystem
  listExtensions: () => Promise<ExtensionRecord[]>;
  getCatalogPlugins: () => Promise<CatalogPluginItem[]>;
  toggleExtension: (params: z.input<typeof ToggleExtensionSchema>) => Promise<{ success: boolean }>;
  installExtension: (params: z.input<typeof InstallExtensionSchema>) => Promise<{ success: boolean; extension?: ExtensionRecord; error?: string }>;
  installCatalogPlugin: (params: z.input<typeof InstallCatalogPluginSchema>) => Promise<{ success: boolean; extension?: ExtensionRecord; error?: string }>;
  uninstallExtension: (params: z.input<typeof UninstallExtensionSchema>) => Promise<{ success: boolean }>;

  // Advanced Analytics & Telemetry (Phase 7)
  getAnalyticsSummary: (params?: z.input<typeof GetAnalyticsSummarySchema>) => Promise<AnalyticsSummary>;
  getProviderCostMetrics: (params?: z.input<typeof GetProviderCostMetricsSchema>) => Promise<ProviderCostMetrics[]>;
  recordAnalyticsEvent: (params: z.input<typeof RecordAnalyticsEventSchema>) => Promise<AnalyticsEvent>;
  exportAnalytics: (params: z.input<typeof ExportAnalyticsSchema>) => Promise<string>;

  // Enterprise Hardening & Audit Logging (Phase 7)
  queryAuditLogs: (params?: z.input<typeof QueryAuditLogsSchema>) => Promise<AuditLogEntry[]>;
  exportAuditLogs: (params: z.input<typeof ExportAuditLogsSchema>) => Promise<string>;

  // Local Model & Air-Gap Support (Phase 7)
  getAirGapConfig: () => Promise<AirGapConfig>;
  updateAirGapConfig: (params: z.input<typeof UpdateAirGapConfigSchema>) => Promise<AirGapConfig>;
  listLocalModels: () => Promise<{ models: string[]; isRunning: boolean }>;

  // Intelligence & Token Optimization (Phase 8)
  routeIntelligenceTask: (params: z.input<typeof RouteIntelligenceTaskSchema>) => Promise<ModelRoutingDecision>;
  assemblePrompt: (params: z.input<typeof AssemblePromptSchema>) => Promise<PromptAssemblyResult>;
  composeSkills: (params: z.input<typeof ComposeSkillsSchema>) => Promise<ComposedSkillInstructions>;
  getIntelligenceCacheStats: () => Promise<any>;
  clearIntelligenceCache: () => Promise<{ success: boolean }>;

  // Discord Rich Presence Integration
  getDiscordStatus: () => Promise<DiscordStatusResponse>;
  updateDiscordSettings: (params: z.input<typeof UpdateDiscordSettingsSchema>) => Promise<DiscordStatusResponse>;
  setDiscordActiveProject: (project: ProjectDescriptor | null) => Promise<void>;
  getProjectGitRemote: (params: z.input<typeof GetProjectGitRemoteSchema>) => Promise<{
    provider: 'github' | 'gitlab' | 'bitbucket' | 'other';
    providerLabel: string;
    browserUrl: string;
    rawUrl: string;
    remoteName: string;
    owner?: string;
    repo?: string;
  } | null>;
  onDiscordStatusChange: (callback: (status: DiscordStatusResponse) => void) => () => void;

  // Window Controls (Frameless Titlebar)
  minimizeWindow?: () => Promise<void>;
  maximizeWindow?: () => Promise<boolean>;
  closeWindow?: () => Promise<void>;
  isWindowMaximized?: () => Promise<boolean>;
  refreshMaterial?: () => Promise<boolean>;
  onWindowStateChange?: (callback: (state: { isMaximized: boolean }) => void) => () => void;
  openDetachedTabWindow?: (params: { tab: any; project?: any; x?: number; y?: number }) => Promise<{ success: boolean }>;

  // Project Explorer: Changes & Code Review
  listProjectExecutions: (params: z.input<typeof ListProjectExecutionsSchema>) => Promise<import('./review').ProjectExecution[]>;
  getExecutionFileChanges: (params: z.input<typeof GetExecutionFileChangesSchema>) => Promise<import('./review').ExecutionFileChange[]>;
  syncManualChanges: (params: z.input<typeof SyncManualChangesSchema>) => Promise<import('./review').ProjectExecution | null>;
  getCodeReview: (params: z.input<typeof GetCodeReviewSchema>) => Promise<import('./review').CodeReview | null>;
  updateReviewDecision: (params: z.input<typeof UpdateReviewDecisionSchema>) => Promise<import('./review').CodeReview | null>;
  markFileReviewStatus: (params: z.input<typeof MarkFileReviewStatusSchema>) => Promise<import('./review').CodeReview | null>;
  addReviewComment: (params: z.input<typeof AddReviewCommentSchema>) => Promise<import('./review').ReviewComment>;
  listReviewComments: (params: z.input<typeof ListReviewCommentsSchema>) => Promise<import('./review').ReviewComment[]>;
  resolveReviewComment: (params: z.input<typeof ResolveReviewCommentSchema>) => Promise<{ success: boolean }>;
  runAICodeReview: (params: z.input<typeof RunAICodeReviewSchema>) => Promise<import('./review').AIFinding[]>;
  getProjectGitDetails: (params: z.input<typeof GetProjectGitDetailsSchema>) => Promise<import('./review').ProjectGitDetails>;
}
