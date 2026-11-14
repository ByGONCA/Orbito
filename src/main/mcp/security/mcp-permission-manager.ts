import type { MCPServerConfig, MCPToolDefinition } from '../../../shared/mcp';
import { auditService } from '../../services/audit.service';

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

export class MCPPermissionManager {
  /**
   * Evaluates if a given agent and project context is permitted to invoke a tool on an MCP server.
   */
  public evaluateToolCallPermission(
    server: MCPServerConfig,
    tool: MCPToolDefinition,
    agentId?: string,
    projectId?: string
  ): PermissionCheckResult {
    // 1. Is server enabled?
    if (!server.enabled) {
      const reason = `MCP server "${server.name}" is currently disabled.`;
      auditService.logSecurityViolation('mcp_permission_engine', 'server_disabled', reason, server.id);
      return { allowed: false, reason };
    }

    // 2. Project scope boundary check
    if (server.projectScope && projectId && server.projectScope !== projectId) {
      const reason = `MCP server "${server.name}" is scoped to project "${server.projectScope}" and cannot be accessed from project "${projectId}".`;
      auditService.logSecurityViolation('mcp_permission_engine', 'project_scope_violation', reason, server.id);
      return { allowed: false, reason };
    }

    // 3. Agent permissions check
    if (agentId && !server.agentPermissions.all) {
      const allowed = server.agentPermissions.allowedAgents.includes(agentId);
      if (!allowed) {
        const reason = `Agent "${agentId}" is not authorized to access MCP server "${server.name}".`;
        auditService.logSecurityViolation('mcp_permission_engine', 'agent_not_authorized', reason, server.id);
        return { allowed: false, reason };
      }
    }

    // 4. Human Approval requirement
    if (tool.requiresApproval) {
      return {
        allowed: true,
        requiresApproval: true
      };
    }

    return { allowed: true };
  }

  /**
   * Evaluates server access for an agent without requiring a specific tool.
   */
  public evaluateServerAccess(
    server: MCPServerConfig,
    agentId?: string,
    projectId?: string
  ): { allowed: boolean; reason?: string } {
    if (!server.enabled) {
      return { allowed: false, reason: `Server "${server.name}" is disabled.` };
    }
    if (server.projectScope && projectId && server.projectScope !== projectId) {
      return { allowed: false, reason: `Server "${server.name}" is scoped to project "${server.projectScope}".` };
    }
    if (agentId && !server.agentPermissions.all) {
      const allowed = server.agentPermissions.allowedAgents.includes(agentId);
      if (!allowed) {
        return { allowed: false, reason: `Agent "${agentId}" is not authorized.` };
      }
    }
    return { allowed: true };
  }

  /**
   * Helper to check whether an agent persona is allowed for a given server.
   */
  public isAgentAllowed(server: MCPServerConfig, agentId: string): boolean {
    if (!server.enabled) return false;
    if (server.agentPermissions.all) return true;
    return server.agentPermissions.allowedAgents.includes(agentId);
  }
}

export const mcpPermissionManager = new MCPPermissionManager();
