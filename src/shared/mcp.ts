import { z } from 'zod';

export type MCPServerTransport = 'stdio' | 'streamable_http' | 'sse';

export const MCPServerTransportEnum = z.enum(['stdio', 'streamable_http', 'sse']);

export type MCPServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'auth_required';

export const MCPServerStatusEnum = z.enum([
  'disconnected',
  'connecting',
  'connected',
  'error',
  'auth_required'
]);

export type MCPAuthType = 'none' | 'api_key' | 'bearer' | 'oauth2';

export const MCPAuthTypeEnum = z.enum(['none', 'api_key', 'bearer', 'oauth2']);

// -------------------------------------------------------------
// MCP Tool Definition & Schemas
// -------------------------------------------------------------

export const MCPToolInputSchema = z.object({
  type: z.literal('object').default('object'),
  properties: z.record(z.any()).optional().default({}),
  required: z.array(z.string()).optional()
});

export const MCPToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(z.any()).default({}),
  serverId: z.string().min(1),
  requiresApproval: z.boolean().default(false)
});

export type MCPToolDefinition = z.infer<typeof MCPToolDefinitionSchema>;

// -------------------------------------------------------------
// Server Configuration & Metadata
// -------------------------------------------------------------

export const MCPAgentPermissionsSchema = z.object({
  all: z.boolean().default(true),
  allowedAgents: z.array(z.string()).default([])
});

export type MCPAgentPermissions = z.infer<typeof MCPAgentPermissionsSchema>;

export const MCPAuthConfigSchema = z.object({
  headerKey: z.string().optional(),
  tokenEndpoint: z.string().optional(),
  clientId: z.string().optional(),
  scopes: z.array(z.string()).optional()
});

export type MCPAuthConfig = z.infer<typeof MCPAuthConfigSchema>;

export const MCPServerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  transport: MCPServerTransportEnum,
  command: z.string().optional(),
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string()).optional(),
  url: z.string().url().optional(),
  enabled: z.boolean().default(true),
  status: MCPServerStatusEnum.default('disconnected'),
  errorMessage: z.string().optional(),
  authType: MCPAuthTypeEnum.default('none'),
  authConfig: MCPAuthConfigSchema.optional(),
  agentPermissions: MCPAgentPermissionsSchema.default({ all: true, allowedAgents: [] }),
  projectScope: z.string().nullable().optional().default(null),
  autoReconnect: z.boolean().default(true),
  tools: z.array(MCPToolDefinitionSchema).optional().default([]),
  lastActivityAt: z.number().optional(),
  lastLatencyMs: z.number().optional(),
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now())
});

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

export const SaveMCPServerInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  transport: MCPServerTransportEnum,
  command: z.string().optional(),
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string()).optional(),
  url: z.string().url().optional(),
  enabled: z.boolean().default(true),
  authType: MCPAuthTypeEnum.default('none'),
  authConfig: MCPAuthConfigSchema.optional(),
  authToken: z.string().optional(), // Provided during creation/update, saved directly into safe storage
  agentPermissions: MCPAgentPermissionsSchema.default({ all: true, allowedAgents: [] }),
  projectScope: z.string().nullable().optional().default(null),
  autoReconnect: z.boolean().default(true)
});

export type SaveMCPServerInput = z.infer<typeof SaveMCPServerInputSchema>;

// -------------------------------------------------------------
// Tool Execution & Results
// -------------------------------------------------------------

export const MCPToolCallContentItemSchema = z.object({
  type: z.enum(['text', 'image', 'resource']),
  text: z.string().optional(),
  data: z.string().optional(),
  mimeType: z.string().optional()
});

export const MCPToolCallRequestSchema = z.object({
  serverId: z.string().min(1),
  toolName: z.string().min(1),
  arguments: z.record(z.any()).default({}),
  agentId: z.string().optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  orchestrationId: z.string().optional(),
  traceId: z.string().optional()
});

export type MCPToolCallRequest = z.infer<typeof MCPToolCallRequestSchema>;

export const MCPToolCallResponseSchema = z.object({
  content: z.array(MCPToolCallContentItemSchema),
  isError: z.boolean().optional().default(false)
});

export type MCPToolCallResponse = z.infer<typeof MCPToolCallResponseSchema>;

export interface MCPServerTestResult {
  success: boolean;
  status: MCPServerStatus;
  toolsCount: number;
  tools: MCPToolDefinition[];
  latencyMs: number;
  errorMessage?: string;
}

export interface MCPAgentIntegrationStatus {
  agentId: string;
  agentName: string;
  mechanism: 'native_config' | 'stdio_bridge' | 'http_gateway';
  status: 'configured' | 'synced' | 'unsupported';
  configFilePath?: string;
  activeServersCount: number;
  error?: string;
}

export interface MCPAuditLogEntry {
  id: string;
  serverId: string;
  serverName: string;
  toolName: string;
  agentId: string;
  status: 'success' | 'denied' | 'error';
  durationMs: number;
  timestamp: number;
  errorMessage?: string;
  taskId?: string;
  orchestrationId?: string;
  traceId?: string;
}

// -------------------------------------------------------------
// Observability & Diagnostics Contracts
// -------------------------------------------------------------

export interface MCPConnectionEvent {
  id: string;
  serverId: string;
  serverName: string;
  eventType: 'connected' | 'disconnected' | 'reconnecting' | 'failed';
  latencyMs?: number;
  errorMessage?: string;
  timestamp: number;
}

export interface MCPServerConnectionMetrics {
  serverId: string;
  serverName: string;
  status: MCPServerStatus;
  uptimeMs: number;
  lastConnectedAt?: number;
  reconnectCount: number;
  failureCount: number;
  lastLatencyMs?: number;
  lastActivityAt?: number;
}

export interface MCPSlowToolMetric {
  toolName: string;
  serverName: string;
  avgDurationMs: number;
  callCount: number;
}

export interface MCPObservabilitySummary {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  deniedExecutions: number;
  avgDurationMs: number;
  medianDurationMs: number;
  p95DurationMs: number;
  activeServersCount: number;
  activeSessionsCount: number;
  concurrentExecutions: number;
  slowestTools: MCPSlowToolMetric[];
  executionsByAgent: Record<string, number>;
  executionsByServer: Record<string, number>;
}

export const MCPAuditLogFilterSchema = z.object({
  serverId: z.string().optional(),
  agentId: z.string().optional(),
  toolName: z.string().optional(),
  status: z.enum(['all', 'success', 'error', 'denied']).optional().default('all'),
  fromTimestamp: z.number().optional(),
  toTimestamp: z.number().optional(),
  limit: z.number().int().optional().default(50),
  offset: z.number().int().optional().default(0)
});

export type MCPAuditLogFilter = z.infer<typeof MCPAuditLogFilterSchema>;
