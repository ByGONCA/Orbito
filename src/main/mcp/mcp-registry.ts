import { randomUUID } from 'node:crypto';
import type {
  MCPServerConfig,
  SaveMCPServerInput,
  MCPServerStatus,
  MCPToolDefinition
} from '../../shared/mcp';
import { databaseService } from '../db/database.service';
import { mcpCredentialsVault } from './security/mcp-credentials-vault';

export class MCPRegistry {
  /**
   * Retrieves all registered MCP servers.
   */
  public listServers(projectScope?: string): MCPServerConfig[] {
    return databaseService.listMCPServers(projectScope);
  }

  /**
   * Retrieves a single MCP server by ID.
   */
  public getServer(id: string): MCPServerConfig | null {
    return databaseService.getMCPServer(id);
  }

  /**
   * Saves or updates an MCP server configuration.
   * Securely moves any raw secrets (env vars and auth tokens) into OS-level safe storage.
   */
  public saveServer(input: SaveMCPServerInput): MCPServerConfig {
    const id = input.id || randomUUID();
    const existing = databaseService.getMCPServer(id);

    // 1. Process environment variables
    const envKeys = input.env ? Object.keys(input.env) : (existing ? databaseService.getMCPServerEnvKeys(id) : []);
    if (input.env && Object.keys(input.env).length > 0) {
      mcpCredentialsVault.storeServerEnv(id, input.env);
    }

    // 2. Process auth token
    if (input.authToken) {
      mcpCredentialsVault.storeAuthToken(id, input.authToken);
    }

    // 3. Assemble server config
    const serverConfig: MCPServerConfig = {
      id,
      name: input.name.trim(),
      description: input.description || '',
      transport: input.transport,
      command: input.command?.trim(),
      args: input.args || [],
      url: input.url?.trim(),
      enabled: input.enabled !== undefined ? input.enabled : true,
      status: existing ? existing.status : 'disconnected',
      errorMessage: existing?.errorMessage,
      tools: existing?.tools || [],
      authType: input.authType || 'none',
      authConfig: input.authConfig,
      agentPermissions: input.agentPermissions || { all: true, allowedAgents: [] },
      projectScope: input.projectScope || null,
      autoReconnect: input.autoReconnect !== undefined ? input.autoReconnect : true,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    databaseService.saveMCPServer(serverConfig, envKeys);
    return serverConfig;
  }

  /**
   * Deletes an MCP server and removes its credentials from the vault.
   */
  public deleteServer(id: string): boolean {
    mcpCredentialsVault.deleteServerCredentials(id);
    return databaseService.deleteMCPServer(id);
  }

  /**
   * Toggles the enabled state of an MCP server.
   */
  public toggleServer(id: string, enabled: boolean): MCPServerConfig {
    const server = databaseService.getMCPServer(id);
    if (!server) {
      throw new Error(`MCP Server with id "${id}" not found.`);
    }

    const updated: MCPServerConfig = {
      ...server,
      enabled,
      status: enabled ? server.status : 'disconnected',
      updatedAt: Date.now()
    };

    const envKeys = databaseService.getMCPServerEnvKeys(id);
    databaseService.saveMCPServer(updated, envKeys);
    return updated;
  }

  /**
   * Updates runtime status and tool cache for an active server.
   */
  public updateStatus(
    id: string,
    status: MCPServerStatus,
    tools?: MCPToolDefinition[],
    errorMessage?: string
  ): void {
    databaseService.updateMCPServerStatus(id, status, tools, errorMessage);
  }
}

export const mcpRegistry = new MCPRegistry();
