import type {
  MCPServerConfig,
  MCPServerStatus,
  MCPToolDefinition,
  MCPServerTestResult,
  MCPToolCallResponse
} from '../../shared/mcp';
import { StdioTransport } from './stdio-transport';
import { HttpTransport } from './http-transport';
import { mcpCredentialsVault } from './security/mcp-credentials-vault';
import { mcpRegistry } from './mcp-registry';
import { SecretRedactor } from './security/secret-redactor';
import { mcpMetricsCollector } from './observability/mcp-metrics-collector';

export interface ActiveSession {
  serverId: string;
  transport: StdioTransport | HttpTransport;
  tools: MCPToolDefinition[];
  status: MCPServerStatus;
  reconnectAttempts: number;
}

export class MCPRuntime {
  private sessions: Map<string, ActiveSession> = new Map();
  private statusListeners: Set<(data: { serverId: string; status: MCPServerStatus; errorMessage?: string }) => void> = new Set();

  public onStatusChange(listener: (data: { serverId: string; status: MCPServerStatus; errorMessage?: string }) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private emitStatus(serverId: string, status: MCPServerStatus, errorMessage?: string): void {
    for (const listener of this.statusListeners) {
      try {
        listener({ serverId, status, errorMessage });
      } catch {}
    }
  }

  /**
   * Initializes and connects all enabled servers on startup or project open.
   */
  public async initializeAllServers(projectScope?: string): Promise<void> {
    const servers = mcpRegistry.listServers(projectScope);
    await Promise.all(
      servers
        .filter((server) => server.enabled)
        .map((server) =>
          this.connectServer(server).catch((err) => {
            console.warn(`[MCPRuntime] Failed to auto-connect server "${server.name}":`, err.message);
          })
        )
    );
  }

  /**
   * Connects to an MCP server, performs the initialize handshake, and discovers available tools.
   */
  public async connectServer(server: MCPServerConfig): Promise<MCPToolDefinition[]> {
    const connectStartTime = Date.now();

    // If already connected, disconnect existing session first
    if (this.sessions.has(server.id)) {
      await this.disconnectServer(server.id);
    }

    mcpRegistry.updateStatus(server.id, 'connecting');
    this.emitStatus(server.id, 'connecting');

    try {
      let transport: StdioTransport | HttpTransport;

      if (server.transport === 'stdio') {
        if (!server.command) {
          throw new Error(`MCP stdio server "${server.name}" requires a command.`);
        }

        const env = mcpCredentialsVault.getServerEnv(server.id);

        transport = new StdioTransport({
          command: server.command,
          args: server.args || [],
          env,
          onLog: (line, isError) => {
            if (isError) {
              console.warn(`[MCP:${server.name}:stderr]`, line);
            }
          },
          onExit: (code) => {
            console.info(`[MCP:${server.name}] Exited with code ${code}`);
            this.handleUnexpectedExit(server.id);
          }
        });

        await (transport as StdioTransport).start();
      } else {
        if (!server.url) {
          throw new Error(`MCP HTTP server "${server.name}" requires a URL.`);
        }

        const authToken = mcpCredentialsVault.getAuthToken(server.id) || undefined;
        transport = new HttpTransport({
          url: server.url,
          authToken,
          headerKey: server.authConfig?.headerKey,
          onLog: (line) => console.warn(`[MCP:${server.name}:http]`, line)
        });
      }

      // Perform MCP protocol initialize handshake
      const initResult = await transport.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        clientInfo: {
          name: 'Orbito',
          version: '0.1.0'
        },
        capabilities: {
          tools: { listChanged: true }
        }
      });

      // Send notifications/initialized
      transport.sendNotification('notifications/initialized');

      // Discover tools
      const tools = await this.discoverTools(server.id, transport);

      const session: ActiveSession = {
        serverId: server.id,
        transport,
        tools,
        status: 'connected',
        reconnectAttempts: 0
      };

      this.sessions.set(server.id, session);
      mcpRegistry.updateStatus(server.id, 'connected', tools);
      this.emitStatus(server.id, 'connected');

      const latencyMs = Date.now() - connectStartTime;
      mcpMetricsCollector.recordConnectionEvent(server.id, server.name, 'connected', latencyMs);

      return tools;
    } catch (err: any) {
      const errMsg = SecretRedactor.redactText(err.message || 'Connection failed');
      mcpRegistry.updateStatus(server.id, 'error', undefined, errMsg);
      this.emitStatus(server.id, 'error', errMsg);
      mcpMetricsCollector.recordConnectionEvent(server.id, server.name, 'failed', undefined, errMsg);
      throw new Error(errMsg);
    }
  }

  /**
   * Disconnects an active server session.
   */
  public async disconnectServer(serverId: string): Promise<void> {
    const session = this.sessions.get(serverId);
    if (!session) return;

    const server = mcpRegistry.getServer(serverId);
    this.sessions.delete(serverId);

    if (session.transport instanceof StdioTransport) {
      await session.transport.stop();
    }

    mcpRegistry.updateStatus(serverId, 'disconnected');
    this.emitStatus(serverId, 'disconnected');
    mcpMetricsCollector.recordConnectionEvent(serverId, server?.name || serverId, 'disconnected');
  }

  /**
   * Discovers tools from an active transport.
   */
  private async discoverTools(serverId: string, transport: StdioTransport | HttpTransport): Promise<MCPToolDefinition[]> {
    try {
      const res = await transport.sendRequest('tools/list', {});
      const rawTools = (res && Array.isArray(res.tools)) ? res.tools : [];

      return rawTools.map((t: any) => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema || {},
        serverId,
        requiresApproval: false
      }));
    } catch (err: any) {
      console.warn(`[MCPRuntime] Failed to discover tools for server ${serverId}:`, err.message);
      return [];
    }
  }

  /**
   * Executes a tool via the active session.
   */
  public async callTool(
    serverId: string,
    toolName: string,
    toolArgs: Record<string, any>
  ): Promise<MCPToolCallResponse> {
    let session = this.sessions.get(serverId);

    // If server not connected, try connecting on-demand if enabled
    if (!session || session.status !== 'connected') {
      const server = mcpRegistry.getServer(serverId);
      if (!server || !server.enabled) {
        throw new Error(`MCP Server "${serverId}" is not running or is disabled.`);
      }
      await this.connectServer(server);
      session = this.sessions.get(serverId);
    }

    if (!session) {
      throw new Error(`Could not establish active session with MCP Server "${serverId}".`);
    }

    const result = await session.transport.sendRequest('tools/call', {
      name: toolName,
      arguments: toolArgs
    });

    const content = Array.isArray(result?.content)
      ? result.content.map((item: any) => ({
          type: item.type || 'text',
          text: item.text ? SecretRedactor.redactText(item.text) : undefined,
          data: item.data,
          mimeType: item.mimeType
        }))
      : [{ type: 'text', text: SecretRedactor.redactText(JSON.stringify(result || {})) }];

    return {
      content,
      isError: Boolean(result?.isError)
    };
  }

  /**
   * Tests an MCP server configuration ephemerally and reports connection status, discovered tools, and latency.
   */
  public async testServer(
    config: MCPServerConfig,
    customAuthToken?: string,
    customEnv?: Record<string, string>
  ): Promise<MCPServerTestResult> {
    const startTime = Date.now();

    try {
      let transport: StdioTransport | HttpTransport;

      if (config.transport === 'stdio') {
        if (!config.command) {
          throw new Error('Command is required for stdio transport.');
        }

        const env = {
          ...(config.id ? mcpCredentialsVault.getServerEnv(config.id) : {}),
          ...(customEnv || {})
        };

        transport = new StdioTransport({
          command: config.command,
          args: config.args || [],
          env
        });

        await (transport as StdioTransport).start();
      } else {
        if (!config.url) {
          throw new Error('URL is required for Streamable HTTP transport.');
        }

        const authToken = customAuthToken || (config.id ? mcpCredentialsVault.getAuthToken(config.id) : undefined);

        transport = new HttpTransport({
          url: config.url,
          authToken: authToken || undefined,
          headerKey: config.authConfig?.headerKey
        });
      }

      // Initialize handshake
      await transport.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        clientInfo: { name: 'Orbito-TestClient', version: '0.1.0' },
        capabilities: { tools: {} }
      }, 10000);

      transport.sendNotification('notifications/initialized');

      // Discover tools
      const tools = await this.discoverTools(config.id || 'test-server', transport);

      const latencyMs = Date.now() - startTime;

      // Clean up test transport
      if (transport instanceof StdioTransport) {
        await transport.stop();
      }

      return {
        success: true,
        status: 'connected',
        toolsCount: tools.length,
        tools,
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const errMsg = SecretRedactor.redactText(err.message || 'Connection test failed');
      return {
        success: false,
        status: 'error',
        toolsCount: 0,
        tools: [],
        latencyMs,
        errorMessage: errMsg
      };
    }
  }

  /**
   * Returns all discovered tools across all active or cached servers.
   */
  public listTools(serverId?: string, projectScope?: string): MCPToolDefinition[] {
    const servers = mcpRegistry.listServers(projectScope);
    const result: MCPToolDefinition[] = [];

    for (const server of servers) {
      if (serverId && server.id !== serverId) continue;
      if (!server.enabled) continue;

      const session = this.sessions.get(server.id);
      const tools = session ? session.tools : (server.tools || []);
      result.push(...tools);
    }

    return result;
  }

  /**
   * Handles unexpected process exit with auto-reconnect backoff.
   */
  private handleUnexpectedExit(serverId: string): void {
    const session = this.sessions.get(serverId);
    if (!session) return;

    const server = mcpRegistry.getServer(serverId);
    this.sessions.delete(serverId);
    mcpRegistry.updateStatus(serverId, 'error', undefined, 'Process exited unexpectedly');
    this.emitStatus(serverId, 'error', 'Process exited unexpectedly');
    mcpMetricsCollector.recordConnectionEvent(serverId, server?.name || serverId, 'reconnecting', undefined, 'Process exited unexpectedly');

    if (!server || !server.enabled || !server.autoReconnect) return;

    if (session.reconnectAttempts < 3) {
      const delayMs = Math.pow(2, session.reconnectAttempts) * 1000;
      session.reconnectAttempts++;

      setTimeout(() => {
        console.info(`[MCPRuntime] Auto-reconnecting "${server.name}" (attempt ${session.reconnectAttempts})...`);
        this.connectServer(server).catch(() => {});
      }, delayMs);
    }
  }

  /**
   * Shuts down all active MCP sessions.
   */
  public async shutdownAll(): Promise<void> {
    for (const [id] of this.sessions.entries()) {
      await this.disconnectServer(id);
    }
  }
}

export const mcpRuntime = new MCPRuntime();
