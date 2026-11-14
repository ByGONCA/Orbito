import type { MCPServerConfig, MCPAgentIntegrationStatus } from '../../../shared/mcp';

export interface IMCPAgentAdapter {
  readonly agentId: string;
  readonly agentName: string;
  readonly mechanism: 'native_config' | 'stdio_bridge' | 'http_gateway';

  syncConfig(servers: MCPServerConfig[], projectPath?: string): Promise<MCPAgentIntegrationStatus>;
  getStatus(projectPath?: string): Promise<MCPAgentIntegrationStatus>;
}
