import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../src/main/db/database.service';
import { mcpRegistry } from '../src/main/mcp/mcp-registry';
import { mcpRuntime } from '../src/main/mcp/mcp-runtime';
import { mcpGateway } from '../src/main/mcp/mcp-gateway';

describe('Centralized MCP Infrastructure: Real End-to-End Runtime Suite', () => {
  const testStorageDir = path.join(process.cwd(), '.ai-workspace-data-test-mcp-e2e');
  const serverScriptPath = path.join(testStorageDir, 'real-mcp-server.js');
  const secondaryScriptPath = path.join(testStorageDir, 'secondary-mcp-server.js');

  beforeEach(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testStorageDir, { recursive: true });
    databaseService.initialize(testStorageDir);

    // Create a real stdio MCP server handling full JSON-RPC 2.0 protocol
    const primaryScript = `
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

      rl.on('line', (line) => {
        try {
          const req = JSON.parse(line);
          if (req.method === 'initialize') {
            process.stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                protocolVersion: '2024-11-05',
                serverInfo: { name: 'primary-real-mcp', version: '2.0.0' },
                capabilities: { tools: { listChanged: true } }
              }
            }) + '\\n');
          } else if (req.method === 'tools/list') {
            process.stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                tools: [
                  {
                    name: 'compute_hash',
                    description: 'Calculates SHA256 of text',
                    inputSchema: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'] }
                  },
                  {
                    name: 'get_system_time',
                    description: 'Returns ISO timestamp',
                    inputSchema: { type: 'object', properties: {} }
                  }
                ]
              }
            }) + '\\n');
          } else if (req.method === 'tools/call') {
            if (req.params?.name === 'compute_hash') {
              const crypto = require('crypto');
              const h = crypto.createHash('sha256').update(req.params?.arguments?.input || '').digest('hex');
              process.stdout.write(JSON.stringify({
                jsonrpc: '2.0',
                id: req.id,
                result: {
                  content: [{ type: 'text', text: h }],
                  isError: false
                }
              }) + '\\n');
            } else if (req.params?.name === 'get_system_time') {
              process.stdout.write(JSON.stringify({
                jsonrpc: '2.0',
                id: req.id,
                result: {
                  content: [{ type: 'text', text: new Date().toISOString() }],
                  isError: false
                }
              }) + '\\n');
            } else {
              process.stdout.write(JSON.stringify({
                jsonrpc: '2.0',
                id: req.id,
                error: { code: -32601, message: 'Tool not found' }
              }) + '\\n');
            }
          }
        } catch {}
      });
    `;
    fs.writeFileSync(serverScriptPath, primaryScript, 'utf8');

    // Create a secondary MCP server for concurrency & multi-server testing
    const secondaryScript = `
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

      rl.on('line', (line) => {
        try {
          const req = JSON.parse(line);
          if (req.method === 'initialize') {
            process.stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                protocolVersion: '2024-11-05',
                serverInfo: { name: 'secondary-real-mcp', version: '1.5.0' },
                capabilities: { tools: {} }
              }
            }) + '\\n');
          } else if (req.method === 'tools/list') {
            process.stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                tools: [
                  {
                    name: 'lookup_metric',
                    description: 'Returns metric score',
                    inputSchema: { type: 'object', properties: { metric: { type: 'string' } } }
                  }
                ]
              }
            }) + '\\n');
          } else if (req.method === 'tools/call') {
            process.stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                content: [{ type: 'text', text: 'score: 99.8' }],
                isError: false
              }
            }) + '\\n');
          }
        } catch {}
      });
    `;
    fs.writeFileSync(secondaryScriptPath, secondaryScript, 'utf8');
  });

  afterEach(async () => {
    await mcpRuntime.shutdownAll();
    databaseService.close();
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  it('1. performs complete lifecycle: registration, handshake, discovery, execution, and disconnection', async () => {
    // 1. Register server
    const server = mcpRegistry.saveServer({
      name: 'primary-calc-server',
      description: 'Calculates cryptographic hashes',
      transport: 'stdio',
      command: process.execPath,
      args: [serverScriptPath],
      enabled: true,
      authType: 'none',
      agentPermissions: { all: true, allowedAgents: [] }
    });

    expect(server.id).toBeDefined();

    // 2. Connect and discover tools
    const tools = await mcpRuntime.connectServer(server);
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toContain('compute_hash');
    expect(tools.map((t) => t.name)).toContain('get_system_time');

    // 3. Verify status in registry
    const fetched = mcpRegistry.getServer(server.id);
    expect(fetched?.status).toBe('connected');
    expect(fetched?.tools).toHaveLength(2);

    // 4. Execute tool via Gateway
    const response = await mcpGateway.executeTool({
      serverId: server.id,
      toolName: 'compute_hash',
      arguments: { input: 'Orbito-Production' },
      agentId: 'claude'
    });

    expect(response.isError).toBe(false);
    expect(response.content[0].type).toBe('text');
    // SHA256 of 'Orbito-Production'
    const crypto = await import('crypto');
    const expectedHash = crypto.createHash('sha256').update('Orbito-Production').digest('hex');
    expect(response.content[0].text).toBe(expectedHash);

    // 5. Verify audit log entry
    const auditLogs = databaseService.listMCPAuditLogs(server.id);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].status).toBe('success');
    expect(auditLogs[0].toolName).toBe('compute_hash');
    expect(auditLogs[0].agentId).toBe('claude');

    // 6. Disconnect
    await mcpRuntime.disconnectServer(server.id);
    const postDisconnect = mcpRegistry.getServer(server.id);
    expect(postDisconnect?.status).toBe('disconnected');
  });

  it('2. operates multiple simultaneous MCP servers concurrently without tool collision', async () => {
    const s1 = mcpRegistry.saveServer({
      name: 'srv-primary',
      transport: 'stdio',
      command: process.execPath,
      args: [serverScriptPath],
      enabled: true
    });

    const s2 = mcpRegistry.saveServer({
      name: 'srv-secondary',
      transport: 'stdio',
      command: process.execPath,
      args: [secondaryScriptPath],
      enabled: true
    });

    // Connect both servers
    const [t1, t2] = await Promise.all([
      mcpRuntime.connectServer(s1),
      mcpRuntime.connectServer(s2)
    ]);

    expect(t1).toHaveLength(2);
    expect(t2).toHaveLength(1);

    // Query aggregated tools list
    const allTools = mcpRuntime.listTools();
    expect(allTools).toHaveLength(3);
    expect(allTools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['compute_hash', 'get_system_time', 'lookup_metric'])
    );

    // Concurrently execute tools across both servers
    const [res1, res2] = await Promise.all([
      mcpGateway.executeTool({
        serverId: s1.id,
        toolName: 'get_system_time',
        arguments: {},
        agentId: 'claude'
      }),
      mcpGateway.executeTool({
        serverId: s2.id,
        toolName: 'lookup_metric',
        arguments: { metric: 'speed' },
        agentId: 'codex'
      })
    ]);

    expect(res1.isError).toBe(false);
    expect(res1.content[0].text).toBeDefined();

    expect(res2.isError).toBe(false);
    expect(res2.content[0].text).toBe('score: 99.8');
  });

  it('3. gracefully fails on invalid executable commands with clear error reporting', async () => {
    const invalidServer = mcpRegistry.saveServer({
      name: 'non-existent-executable-server',
      transport: 'stdio',
      command: 'non_existent_binary_xyz_998877',
      args: [],
      enabled: true
    });

    await expect(mcpRuntime.connectServer(invalidServer)).rejects.toThrow();

    const postAttempt = mcpRegistry.getServer(invalidServer.id);
    expect(postAttempt?.status).toBe('error');
    expect(postAttempt?.errorMessage).toBeDefined();
  });
});
