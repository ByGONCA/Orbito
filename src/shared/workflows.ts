import { z } from 'zod';
import { SkillPermissionsSchema, type SkillPermissions } from './skills';

// --- Node Categories & Types ---
export type NodeCategory = 'ai' | 'context' | 'logic' | 'io' | 'dev';

import type { CLIProvider } from './cli';

export type FlowNodeType =
  // AI Nodes
  | 'ai_agent'
  | 'multi_agent_task'
  | 'ai_prompt'
  | 'ai_review'
  | 'ai_transform'
  | 'ai_classifier'
  // Context Nodes
  | 'search_workspace'
  | 'read_file'
  | 'search_files'
  | 'get_project_info'
  | 'build_context'
  // Logic Nodes
  | 'condition'
  | 'switch'
  | 'merge'
  | 'loop'
  | 'delay'
  | 'parallel'
  // IO Nodes
  | 'manual_trigger'
  | 'text_input'
  | 'file_input'
  | 'variable'
  | 'output'
  | 'notification'
  // Dev Nodes
  | 'run_tests'
  | 'run_typecheck'
  | 'run_build'
  | 'git_status'
  | 'git_diff'
  | 'create_git_commit';

// --- Data Types for Ports & Variables ---
export type FlowDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'file_ref'
  | 'agent_result'
  | 'json'
  | 'any';

export interface NodePortSchema {
  id: string;
  name: string;
  type: FlowDataType;
  description?: string;
  required?: boolean;
  defaultValue?: any;
}

// --- Node Execution Status ---
export type NodeExecutionStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'waiting_input'
  | 'waiting_approval'
  | 'cancelled';

// --- Workflow Execution Status ---
export type WorkflowExecutionStatus =
  | 'draft'
  | 'validating'
  | 'ready'
  | 'running'
  | 'waiting_input'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

// --- Flow Node Model ---
export interface FlowNodeData {
  nodeType: FlowNodeType;
  category: NodeCategory;
  label: string;
  description: string;
  config: Record<string, any>;
  inputs: NodePortSchema[];
  outputs: NodePortSchema[];
  requiredPermissions: SkillPermissions;
  status?: NodeExecutionStatus;
  errorMessage?: string;
  executionDurationMs?: number;
  outputValues?: Record<string, any>;
  version: string;
}

export interface FlowNode {
  id: string;
  type: string; // React Flow node component type e.g. 'customNode'
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
  label?: string;
  animated?: boolean;
}

// --- Workflow Variable ---
export interface WorkflowVariable {
  name: string;
  type: FlowDataType;
  value?: any;
  description?: string;
}

// --- Trigger Configuration ---
export type TriggerType =
  | 'manual'
  | 'app_startup'
  | 'file_change'
  | 'git_event'
  | 'scheduled'
  | 'workflow_completed'
  | 'orchestration_completed';

export interface WorkflowTriggerConfig {
  type: TriggerType;
  enabled: boolean;
  config: {
    cronExpression?: string; // e.g. "0 * * * *" for hourly
    intervalMinutes?: number;
    filePatterns?: string[]; // e.g. ["src/**/*.ts"]
    gitEvents?: ('commit' | 'branch_change' | 'worktree_merge')[];
    targetWorkflowId?: string;
    debounceSeconds?: number;
  };
}

// --- Workflow Record ---
export interface WorkflowRecord {
  id: string;
  projectId: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: Record<string, WorkflowVariable>;
  trigger: WorkflowTriggerConfig;
  status: WorkflowExecutionStatus;
  version: number;
  createdAt: number;
  updatedAt: number;
}

// --- Workflow Execution Record ---
export interface WorkflowExecutionRecord {
  id: string;
  workflowId: string;
  projectId: string;
  status: WorkflowExecutionStatus;
  triggerType: TriggerType;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  variables: Record<string, any>;
  durationMs: number;
  errorMessage?: string;
  createdAt: number;
  completedAt?: number;
}

export interface NodeExecutionRecord {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: FlowNodeType;
  status: NodeExecutionStatus;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  durationMs: number;
  errorMessage?: string;
  startedAt: number;
  completedAt?: number;
}

// --- Live Workflow Event Stream ---
export type WorkflowEventType =
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'workflow_cancelled'
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'node_skipped'
  | 'waiting_input'
  | 'waiting_approval';

export interface WorkflowEvent {
  type: WorkflowEventType;
  executionId: string;
  workflowId: string;
  timestamp: number;
  nodeId?: string;
  nodeType?: FlowNodeType;
  status?: NodeExecutionStatus | WorkflowExecutionStatus;
  output?: any;
  error?: string;
  message?: string;
}

// --- Natural Language Generation ---
export interface NLWorkflowPromptRequest {
  prompt: string;
  projectPath: string;
  preferredProvider?: CLIProvider;
}

export interface NLWorkflowGenerationResult {
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: Record<string, WorkflowVariable>;
  trigger: WorkflowTriggerConfig;
  explanation: string;
  estimatedPermissions: SkillPermissions;
  validationErrors?: string[];
}

// --- Zod Validation Schemas for IPC ---
export const NodePortSchemaValidator = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'file_ref', 'agent_result', 'json', 'any']),
  description: z.string().optional(),
  required: z.boolean().optional(),
  defaultValue: z.any().optional()
});

export const FlowNodeDataSchema = z.object({
  nodeType: z.string() as z.ZodType<FlowNodeType>,
  category: z.enum(['ai', 'context', 'logic', 'io', 'dev']),
  label: z.string(),
  description: z.string(),
  config: z.record(z.any()),
  inputs: z.array(NodePortSchemaValidator),
  outputs: z.array(NodePortSchemaValidator),
  requiredPermissions: SkillPermissionsSchema,
  status: z.enum([
    'pending',
    'ready',
    'running',
    'completed',
    'failed',
    'skipped',
    'waiting_input',
    'waiting_approval',
    'cancelled'
  ]).optional(),
  errorMessage: z.string().optional(),
  executionDurationMs: z.number().optional(),
  outputValues: z.record(z.any()).optional(),
  version: z.string()
});

export const FlowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: FlowNodeDataSchema
});

export const FlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceHandle: z.string().optional(),
  target: z.string(),
  targetHandle: z.string().optional(),
  label: z.string().optional(),
  animated: z.boolean().optional()
});

export const WorkflowVariableSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'file_ref', 'agent_result', 'json', 'any']),
  value: z.any().optional().default(null),
  description: z.string().optional()
});

export const WorkflowTriggerConfigSchema = z.object({
  type: z.enum([
    'manual',
    'app_startup',
    'file_change',
    'git_event',
    'scheduled',
    'workflow_completed',
    'orchestration_completed'
  ]),
  enabled: z.boolean(),
  config: z.object({
    cronExpression: z.string().optional(),
    intervalMinutes: z.number().optional(),
    filePatterns: z.array(z.string()).optional(),
    gitEvents: z.array(z.enum(['commit', 'branch_change', 'worktree_merge'])).optional(),
    targetWorkflowId: z.string().optional(),
    debounceSeconds: z.number().optional()
  })
});

export const WorkflowRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string().min(1),
  description: z.string(),
  nodes: z.array(FlowNodeSchema),
  edges: z.array(FlowEdgeSchema),
  variables: z.record(WorkflowVariableSchema),
  trigger: WorkflowTriggerConfigSchema,
  status: z.enum([
    'draft',
    'validating',
    'ready',
    'running',
    'waiting_input',
    'waiting_approval',
    'completed',
    'failed',
    'cancelled'
  ]),
  version: z.number(),
  createdAt: z.number(),
  updatedAt: z.number()
});
