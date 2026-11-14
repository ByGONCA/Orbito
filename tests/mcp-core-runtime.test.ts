import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../src/main/db/database.service';
import { mcpRegistry } from '../src/main/mcp/mcp-registry';
import { StdioTransport } from '../src/main/mcp/stdio-transport';
import { mcpRuntime } from '../src/main/mcp/mcp-runtime';
import type { SaveMCPServerInput } from '../src/shared/mcp';

describe('Centralized MCP Infrastructure: Core & Runtime Suite', () => {
  const testStorageDir = path.join(process.cwd(), '.ai-workspace-data-test-mcp-core');

  beforeEach(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    databaseService.initialize(testStorageDir);
  });

  afterEach(async () => {
    await mcpRuntime.shutdownAll();
    databaseService.close();
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  it('1. registers, updates, and deletes an MCP server configuration in SQLite', () => {
    const input: SaveMCPServerInput = {
      name: 'test-fs-server',
      description: 'Filesystem MCP Server for unit testing',
      transport: 'stdio',
      command: 'node',
      args: ['-e', 'console.log("running")'],
      enabled: true,
      authType: 'none',
      agentPermissions: { all: true, allowedAgents: [] },
      projectScope: null,
      autoReconnect: true
    };

    const saved = mcpRegistry.saveServer(input);
    expect(saved.id).toBeDefined();
    expect(saved.name).toBe('test-fs-server');
    expect(saved.enabled).toBe(true);
    expect(saved.status).toBe('disconnected');

    // Retrieve from registry
    const fetched = mcpRegistry.getServer(saved.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('test-fs-server');
    expect(fetched?.command).toBe('node');

    // Toggle enabled
    const toggled = mcpRegistry.toggleServer(saved.id, false);
    expect(toggled.enabled).toBe(false);

    // Delete
    const deleted = mcpRegistry.deleteServer(saved.id);
    expect(deleted).toBe(true);
    expect(mcpRegistry.getServer(saved.id)).toBeNull();
  });

  it('2. executes stdio transport JSON-RPC 2.0 handshake and receives responses', async () => {
    // Write mock server to a physical file to avoid cmd.exe multiline quoting issues on Windows
    const mockScriptPath = path.join(testStorageDir, 'mock-server.js');
    const mockServerScript = `
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
                serverInfo: { name: 'mock-node-mcp', version: '1.0.0' },
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
                    name: 'echo_test',
                    description: 'Echoes back test arguments',
                    inputSchema: { type: 'object', properties: { text: { type: 'string' } } }
                  }
                ]
              }
            }) + '\\n');
          } else if (req.method === 'tools/call') {
            process.stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                content: [{ type: 'text', text: 'echo: ' + (req.params?.arguments?.text || '') }],
                isError: false
              }
            }) + '\\n');
          }
        } catch {}
      });
    `;
    fs.writeFileSync(mockScriptPath, mockServerScript, 'utf8');

    const transport = new StdioTransport({
      command: process.execPath,
      args: [mockScriptPath]
    });

    await transport.start();
    expect(transport.isRunning()).toBe(true);

    // Send initialize
    const initRes = await transport.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'TestRunner', version: '1.0.0' },
      capabilities: { tools: {} }
    });
    expect(initRes.serverInfo.name).toBe('mock-node-mcp');

    // Send tools/list
    const toolsRes = await transport.sendRequest('tools/list', {});
    expect(toolsRes.tools).toHaveLength(1);
    expect(toolsRes.tools[0].name).toBe('echo_test');

    // Send tools/call
    const callRes = await transport.sendRequest('tools/call', {
      name: 'echo_test',
      arguments: { text: 'Orbito MCP' }
    });
    expect(callRes.content[0].text).toBe('echo: Orbito MCP');

    await transport.stop();
    expect(transport.isRunning()).toBe(false);
  });

  it('3. verifies MCPRuntime connection lifecycle and ephemeral test connection', async () => {
    const mockScriptPath = path.join(testStorageDir, 'mock-server-2.js');
    const mockServerScript = `
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
                serverInfo: { name: 'mock-runtime-mcp', version: '1.0.0' },
                capabilities: { tools: {} }
              }
            }) + '\\n');
          } else if (req.method === 'tools/list') {
            process.stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                tools: [
                  { name: 'mock_ping', description: 'Replies with pong' }
                ]
              }
            }) + '\\n');
          }
        } catch {}
      });
    `;
    fs.writeFileSync(mockScriptPath, mockServerScript, 'utf8');

    const testResult = await mcpRuntime.testServer({
      id: 'mock-test-id',
      name: 'Mock Server',
      description: 'Temporary test server',
      transport: 'stdio',
      command: process.execPath,
      args: [mockScriptPath],
      enabled: true,
      status: 'disconnected',
      authType: 'none',
      agentPermissions: { all: true, allowedAgents: [] },
      autoReconnect: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    expect(testResult.success).toBe(true);
    expect(testResult.status).toBe('connected');
    expect(testResult.toolsCount).toBe(1);
    expect(testResult.tools[0].name).toBe('mock_ping');
    expect(testResult.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
