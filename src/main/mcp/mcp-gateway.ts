import { randomUUID } from 'node:crypto';
import type {
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPAuditLogEntry
} from '../../shared/mcp';
import { mcpRegistry } from './mcp-registry';
import { mcpRuntime } from './mcp-runtime';
import { mcpPermissionManager } from './security/mcp-permission-manager';
import { SecretRedactor } from './security/secret-redactor';
import { databaseService } from '../db/database.service';
import { mcpMetricsCollector } from './observability/mcp-metrics-collector';
import { traceService } from '../services/trace-service';

export class MCPGateway {
  /**
   * Executes a tool through the centralized gateway with full security boundary enforcement.
   */
  public async executeTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    const startTime = Date.now();
    mcpMetricsCollector.trackExecutionStart();

    try {
      const server = mcpRegistry.getServer(request.serverId);

      if (!server) {
        throw new Error(`MCP Server with id "${request.serverId}" not found.`);
      }

      // 1. Locate tool definition
      const tools = mcpRuntime.listTools(server.id);
      const tool = tools.find((t) => t.name === request.toolName) || {
        name: request.toolName,
        serverId: server.id,
        inputSchema: {},
        requiresApproval: false
      };

      // 2. Evaluate permissions
      const permResult = mcpPermissionManager.evaluateToolCallPermission(
        server,
        tool,
        request.agentId,
        request.projectId
      );

      if (!permResult.allowed) {
        const durationMs = Date.now() - startTime;
        const auditEntry: MCPAuditLogEntry = {
          id: randomUUID(),
          serverId: server.id,
          serverName: server.name,
          toolName: request.toolName,
          agentId: request.agentId || 'system',
          status: 'denied',
          durationMs,
          timestamp: startTime,
          errorMessage: permResult.reason,
          taskId: request.taskId,
          orchestrationId: request.orchestrationId,
          traceId: request.traceId
        };
        try {
          databaseService.saveMCPAuditLog(auditEntry);
        } catch {}

        if (request.taskId || request.traceId) {
          traceService.recordSpan(request.taskId || request.traceId!, {
            name: `MCP Tool: ${request.toolName} (Denied)`,
            layer: 'mcp_gateway',
            status: 'denied',
            startedAt: startTime,
            completedAt: Date.now(),
            durationMs,
            errorMessage: permResult.reason,
            metadata: { serverId: server.id, serverName: server.name, toolName: request.toolName }
          });
        }

        throw new Error(`[MCP Gateway Permission Denied] ${permResult.reason}`);
      }

      // 3. Execute tool via runtime
      try {
        const response = await mcpRuntime.callTool(
          server.id,
          request.toolName,
          request.arguments
        );

        const durationMs = Date.now() - startTime;
        mcpMetricsCollector.recordActivity(server.id, durationMs);

        // 4. Log successful execution
        const auditEntry: MCPAuditLogEntry = {
          id: randomUUID(),
          serverId: server.id,
          serverName: server.name,
          toolName: request.toolName,
          agentId: request.agentId || 'system',
          status: response.isError ? 'error' : 'success',
          durationMs,
          timestamp: startTime,
          taskId: request.taskId,
          orchestrationId: request.orchestrationId,
          traceId: request.traceId
        };
        try {
          databaseService.saveMCPAuditLog(auditEntry);
        } catch {}

        if (request.taskId || request.traceId) {
          traceService.recordSpan(request.taskId || request.traceId!, {
            name: `MCP Tool: ${request.toolName}`,
            layer: 'mcp_tool',
            status: response.isError ? 'failed' : 'completed',
            startedAt: startTime,
            completedAt: Date.now(),
            durationMs,
            metadata: { serverId: server.id, serverName: server.name, toolName: request.toolName }
          });
        }

        // Redact any secrets that may have slipped into tool output
        return SecretRedactor.redactObject(response);
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        const errMsg = SecretRedactor.redactText(err.message || 'Execution error');
        mcpMetricsCollector.recordActivity(server.id, durationMs);

        const auditEntry: MCPAuditLogEntry = {
          id: randomUUID(),
          serverId: server.id,
          serverName: server.name,
          toolName: request.toolName,
          agentId: request.agentId || 'system',
          status: 'error',
          durationMs,
          timestamp: startTime,
          errorMessage: errMsg,
          taskId: request.taskId,
          orchestrationId: request.orchestrationId,
          traceId: request.traceId
        };
        try {
          databaseService.saveMCPAuditLog(auditEntry);
        } catch {}

        if (request.taskId || request.traceId) {
          traceService.recordSpan(request.taskId || request.traceId!, {
            name: `MCP Tool: ${request.toolName} (Error)`,
            layer: 'mcp_tool',
            status: 'failed',
            startedAt: startTime,
            completedAt: Date.now(),
            durationMs,
            errorMessage: errMsg,
            metadata: { serverId: server.id, serverName: server.name, toolName: request.toolName }
          });
        }

        throw new Error(`[MCP Tool Execution Failed] ${errMsg}`);
      }
    } finally {
      mcpMetricsCollector.trackExecutionEnd();
    }
  }
}

export const mcpGateway = new MCPGateway();
