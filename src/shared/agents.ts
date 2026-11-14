import { z } from 'zod';
import { SkillPermissionsSchema, type SkillPermissions } from './skills';
import type { CLIProvider } from './cli';

export type SpecialistRole =
  | 'coordinator'
  | 'architect'
  | 'backend'
  | 'frontend'
  | 'testing'
  | 'security'
  | 'documentation'
  | 'reviewer';

export type TaskStatus =
  | 'pending'
  | 'understanding'
  | 'planning'
  | 'ready'
  | 'running'
  | 'executing'
  | 'waiting_approval'
  | 'awaiting_approval'
  | 'verifying'
  | 'reviewing'
  | 'integrating'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked';

export type OrchestrationStatus =
  | 'understanding'
  | 'planning'
  | 'ready'
  | 'running'
  | 'executing'
  | 'waiting_approval'
  | 'awaiting_approval'
  | 'reviewing'
  | 'verifying'
  | 'integrating'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ExecutionMode = 'manual' | 'supervised' | 'autonomous';

export interface PlanObjective {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
}

export interface PlanRisk {
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

export interface VerificationStrategy {
  typecheckRequired: boolean;
  testsRequired: boolean;
  securityAuditRequired: boolean;
  diffInspectionRequired: boolean;
  testCommands?: string[];
}

export interface IntegrationStrategy {
  mergeStrategy: 'worktree_squash' | 'direct_branch' | 'sequential_merge';
  preMergeSimulation: boolean;
  requireApproval: boolean;
}

export interface AutonomousPlan {
  orchestrationId: string;
  userGoal: string;
  intent: string;
  category: string;
  complexity: 'simple' | 'routine' | 'intermediate' | 'complex' | 'critical';
  riskLevel: 'low' | 'medium' | 'high';
  objectives: PlanObjective[];
  affectedModules: string[];
  risks: PlanRisk[];
  verificationStrategy: VerificationStrategy;
  integrationStrategy: IntegrationStrategy;
  tasks: OrchestrationTask[];
  parallelExecutionFeasible: boolean;
  createdAt: number;
}

export interface OrchestrationTask {
  id: string;
  orchestrationId: string;
  traceId?: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  role: SpecialistRole;
  assignedProvider: CLIProvider;
  assignedModel?: string;
  dependencies: string[]; // Task IDs that must finish before this task
  requiredSkills: string[]; // Skill IDs from Skills Engine
  requiredPermissions: SkillPermissions;
  isModifying: boolean; // True if task makes code modifications needing a worktree
  plannedFiles?: string[]; // Files expected to be touched for conflict avoidance
  worktreePath?: string;
  branchName?: string;
  status: TaskStatus;
  retryCount: number;
  maxRetries: number;
  timeoutSeconds: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  changedFiles: string[];
  diff?: string;
  resultSummary?: string;
  reviewFeedback?: string;
  reviewStatus?: 'passed' | 'remediation_needed' | 'failed';
  errorMessage?: string;
}

export interface OrchestrationRecord {
  id: string;
  traceId?: string;
  projectId: string;
  projectPath: string;
  userGoal: string;
  mode: ExecutionMode;
  status: OrchestrationStatus;
  tasks: OrchestrationTask[];
  plan?: AutonomousPlan;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  durationMs: number;
  totalTokensUsed: number;
  summary?: string;
  errorMessage?: string;
}

export type ApprovalType = 'task_start' | 'file_write' | 'terminal_exec' | 'merge_worktree';

export interface ApprovalRequest {
  id: string;
  orchestrationId: string;
  taskId: string;
  type: ApprovalType;
  title: string;
  description: string;
  diff?: string;
  changedFiles?: string[];
  command?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: number;
  resolvedAt?: number;
}

export type OrchestrationEventType =
  | 'orchestration_started'
  | 'orchestration_progress'
  | 'task_scheduled'
  | 'task_started'
  | 'task_output'
  | 'task_verifying'
  | 'task_review'
  | 'task_integrating'
  | 'task_approval_needed'
  | 'task_completed'
  | 'task_failed'
  | 'task_retry_scheduled'
  | 'task_blocked'
  | 'worktree_created'
  | 'worktree_merged'
  | 'worktree_cleaned'
  | 'orchestration_completed'
  | 'orchestration_failed'
  | 'orchestration_cancelled';

export interface OrchestrationEvent {
  orchestrationId: string;
  taskId?: string;
  type: OrchestrationEventType;
  data: any;
  timestamp: number;
}

// ==========================================
// Zod Schemas for IPC Validation
// ==========================================

export const StartOrchestrationSchema = z.object({
  projectId: z.string().min(1),
  projectPath: z.string().min(1),
  userGoal: z.string().min(3),
  mode: z.enum(['manual', 'supervised', 'autonomous']).default('supervised'),
  provider: z.enum(['claude', 'codex', 'gemini', 'ollama']).default('claude'),
  model: z.string().optional()
});

export const PlanAutonomousTaskSchema = z.object({
  projectId: z.string().optional(),
  projectPath: z.string().min(1),
  userGoal: z.string().min(3),
  mode: z.enum(['manual', 'supervised', 'autonomous']).default('supervised'),
  provider: z.enum(['claude', 'codex', 'gemini', 'ollama']).default('claude'),
  model: z.string().optional()
});

export const CancelOrchestrationSchema = z.object({
  orchestrationId: z.string().min(1)
});

export const ResolveApprovalSchema = z.object({
  approvalId: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().optional()
});

export const GetOrchestrationSchema = z.object({
  orchestrationId: z.string().min(1)
});

export const ListOrchestrationsSchema = z.object({
  projectId: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20)
});

export const RetryTaskSchema = z.object({
  orchestrationId: z.string().min(1),
  taskId: z.string().min(1)
});

export const GetWorktreeDiffSchema = z.object({
  taskId: z.string().min(1)
});

// ==========================================
// Ecosystem Integration & Traceability Contracts
// ==========================================

export interface AgentCapability {
  agentId: string;
  name: string;
  role: SpecialistRole | 'general';
  provider: CLIProvider;
  isInstalled: boolean;
  version?: string;
  authStatus: 'authenticated' | 'configured' | 'missing' | 'unsupported';
  supportedModels: string[];
  maxTokens: number;
  boundSkills: string[];
  authorizedMCPServers: string[];
  discoveredToolsCount: number;
  discoveredTools: string[];
  status: 'idle' | 'busy' | 'offline';
  activeTasksCount: number;
}

export interface TraceSpan {
  id: string;
  name: string;
  layer:
    | 'user'
    | 'orchestrator'
    | 'scheduler'
    | 'worker'
    | 'worktree'
    | 'cli'
    | 'mcp_gateway'
    | 'mcp_tool'
    | 'reviewer'
    | 'verification'
    | 'integration'
    | 'approval';
  status: 'running' | 'completed' | 'failed' | 'denied';
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  metadata?: Record<string, any>;
  errorMessage?: string;
}

export interface TaskExecutionTrace {
  traceId: string;
  orchestrationId: string;
  taskId: string;
  taskTitle: string;
  agentId: string;
  role: string;
  worktreePath?: string;
  spans: TraceSpan[];
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface WorktreeConflictCheck {
  taskId: string;
  plannedFiles: string[];
  conflictingTaskIds: string[];
  conflictingFiles: string[];
  canRunParallel: boolean;
}

export const GetAgentCapabilitiesSchema = z.object({
  projectPath: z.string().optional()
});

export const GetTaskTraceSchema = z.object({
  taskId: z.string().min(1)
});

export const ListTaskTracesSchema = z.object({
  orchestrationId: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50)
});

export const GetActiveWorktreesSchema = z.object({
  projectPath: z.string().optional()
});

export const ExplainTaskSchema = z.object({
  taskId: z.string().min(1)
});

export const ExecuteAutonomousPlanSchema = z.object({
  plan: z.any()
});
