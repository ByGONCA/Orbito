import type { IMCPAgentAdapter } from './agent-adapter.interface';
import type { MCPServerConfig, MCPAgentIntegrationStatus } from '../../../shared/mcp';
import { claudeCodeMCPAdapter } from './claude-code-mcp.adapter';
import { codexMCPAdapter } from './codex-mcp.adapter';
import { antigravityMCPAdapter } from './antigravity-mcp.adapter';
import { opencodeMCPAdapter } from './opencode-mcp.adapter';

export class MCPAgentAdapterManager {
  private adapters: Map<string, IMCPAgentAdapter> = new Map();

  constructor() {
    this.registerAdapter(claudeCodeMCPAdapter);
    this.registerAdapter(codexMCPAdapter);
    this.registerAdapter(antigravityMCPAdapter);
    this.registerAdapter(opencodeMCPAdapter);
  }

  public registerAdapter(adapter: IMCPAgentAdapter): void {
    this.adapters.set(adapter.agentId, adapter);
  }

  public getAdapter(agentId: string): IMCPAgentAdapter | undefined {
    return this.adapters.get(agentId);
  }

  public listAdapters(): IMCPAgentAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Synchronizes MCP configurations across all supported agents.
   */
  public async syncAllAgents(
    servers: MCPServerConfig[],
    targetAgentIds?: string[],
    projectPath?: string
  ): Promise<MCPAgentIntegrationStatus[]> {
    const results: MCPAgentIntegrationStatus[] = [];

    for (const [id, adapter] of this.adapters.entries()) {
      if (targetAgentIds && !targetAgentIds.includes(id)) {
        continue;
      }

      try {
        const res = await adapter.syncConfig(servers, projectPath);
        results.push(res);
      } catch (err: any) {
        results.push({
          agentId: id,
          agentName: adapter.agentName,
          mechanism: adapter.mechanism,
          status: 'unsupported',
          activeServersCount: 0,
          error: err.message
        });
      }
    }

    return results;
  }

  /**
   * Retrieves the current integration status for each supported agent.
   */
  public async getAllAgentStatuses(projectPath?: string): Promise<MCPAgentIntegrationStatus[]> {
    const results: MCPAgentIntegrationStatus[] = [];

    for (const adapter of this.adapters.values()) {
      try {
        const res = await adapter.getStatus(projectPath);
        results.push(res);
      } catch (err: any) {
        results.push({
          agentId: adapter.agentId,
          agentName: adapter.agentName,
          mechanism: adapter.mechanism,
          status: 'unsupported',
          activeServersCount: 0,
          error: err.message
        });
      }
    }

    return results;
  }
}

export const mcpAgentAdapterManager = new MCPAgentAdapterManager();
