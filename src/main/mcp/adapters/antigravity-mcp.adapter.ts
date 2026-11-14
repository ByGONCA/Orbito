import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { IMCPAgentAdapter } from './agent-adapter.interface';
import type { MCPServerConfig, MCPAgentIntegrationStatus } from '../../../shared/mcp';

export class AntigravityMCPAdapter implements IMCPAgentAdapter {
  public readonly agentId = 'antigravity';
  public readonly agentName = 'Antigravity';
  public readonly mechanism = 'native_config' as const;

  private getConfigPath(projectPath?: string): string {
    if (projectPath && fs.existsSync(projectPath)) {
      return path.join(projectPath, '.gemini', 'antigravity-mcp.json');
    }
    return path.join(os.homedir(), '.gemini', 'antigravity-mcp.json');
  }

  public async getStatus(projectPath?: string): Promise<MCPAgentIntegrationStatus> {
    const configPath = this.getConfigPath(projectPath);
    const exists = fs.existsSync(configPath);

    return {
      agentId: this.agentId,
      agentName: this.agentName,
      mechanism: this.mechanism,
      status: exists ? 'configured' : 'synced',
      configFilePath: configPath,
      activeServersCount: 0
    };
  }

  public async syncConfig(servers: MCPServerConfig[], projectPath?: string): Promise<MCPAgentIntegrationStatus> {
    const configPath = this.getConfigPath(projectPath);

    try {
      let existingConfig: any = {};
      if (fs.existsSync(configPath)) {
        try {
          existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch {
          existingConfig = {};
        }
      }

      if (!existingConfig.mcpServers) {
        existingConfig.mcpServers = {};
      }

      const authorizedServers = servers.filter(
        (s) => s.enabled && (s.agentPermissions.all || s.agentPermissions.allowedAgents.includes(this.agentId))
      );

      for (const server of authorizedServers) {
        if (server.transport === 'stdio' && server.command) {
          existingConfig.mcpServers[server.name] = {
            command: server.command,
            args: server.args || [],
            _orbitoManaged: true
          };
        } else if (server.url) {
          existingConfig.mcpServers[server.name] = {
            url: server.url,
            _orbitoManaged: true
          };
        }
      }

      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2), 'utf8');

      return {
        agentId: this.agentId,
        agentName: this.agentName,
        mechanism: this.mechanism,
        status: 'synced',
        configFilePath: configPath,
        activeServersCount: authorizedServers.length
      };
    } catch (err: any) {
      return {
        agentId: this.agentId,
        agentName: this.agentName,
        mechanism: this.mechanism,
        status: 'unsupported',
        configFilePath: configPath,
        activeServersCount: 0,
        error: err.message
      };
    }
  }
}

export const antigravityMCPAdapter = new AntigravityMCPAdapter();
