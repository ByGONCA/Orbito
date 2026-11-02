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
  | 'ready'
  | 'running'
  | 'waiting_approval'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked';

export type OrchestrationStatus =
  | 'planning'
  | 'running'
  | 'waiting_approval'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ExecutionMode = 'manual' | 'supervised' | 'autonomous';

export interface OrchestrationTask {
  id: string;
  orchestrationId: string;
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
  projectId: string;
  projectPath: string;
  userGoal: string;
  mode: ExecutionMode;
  status: OrchestrationStatus;
  tasks: OrchestrationTask[];
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
  | 'task_review'
  | 'task_approval_needed'
  | 'task_completed'
  | 'task_failed'
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
  userGoal: z.string().min(5),
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
