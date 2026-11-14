import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../src/main/db/database.service';
import { mcpRegistry } from '../src/main/mcp/mcp-registry';
import { mcpRuntime } from '../src/main/mcp/mcp-runtime';
import { mcpGateway } from '../src/main/mcp/mcp-gateway';

describe('Centralized MCP Infrastructure: Multi-Agent Concurrency & Session Isolation', () => {
  const testStorageDir = path.join(process.cwd(), '.ai-workspace-data-test-mcp-concurrency');
  const serverScriptPath = path.join(testStorageDir, 'concurrency-mcp-server.js');

  beforeEach(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testStorageDir, { recursive: true });
    databaseService.initialize(testStorageDir);

    // Create a real stdio MCP server that logs caller context and performs stateful checks
    const script = `
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

      let callCounter = 0;

      rl.on('line', (line) => {
        try {
          const req = JSON.parse(line);
          if (req.method === 'initialize') {
            process.stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                protocolVersion: '2024-11-05',
                serverInfo: { name: 'concurrency-mcp', version: '1.0.0' },
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
                    name: 'session_action',
                    description: 'Executes an action within a session',
                    inputSchema: { type: 'object', properties: { taskId: { type: 'string' } } }
                  }
                ]
              }
            }) + '\\n');
          } else if (req.method === 'tools/call') {
            callCounter++;
            process.stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    callIndex: callCounter,
                    taskId: req.params?.arguments?.taskId || 'unknown'
                  })
                }],
                isError: false
              }
            }) + '\\n');
          }
        } catch {}
      });
    `;
    fs.writeFileSync(serverScriptPath, script, 'utf8');
  });

  afterEach(async () => {
    await mcpRuntime.shutdownAll();
    databaseService.close();
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  it('1. dispatches concurrent tool executions from multiple agents without collision', async () => {
    const server = mcpRegistry.saveServer({
      name: 'shared-concurrency-server',
      transport: 'stdio',
      command: process.execPath,
      args: [serverScriptPath],
      enabled: true,
      agentPermissions: { all: true, allowedAgents: [] }
    });

    await mcpRuntime.connectServer(server);

    // Concurrently dispatch 5 requests from 3 distinct agents (Claude, Codex, Antigravity)
    const requests = [
      { agentId: 'claude', taskId: 'task-c1' },
      { agentId: 'codex', taskId: 'task-o1' },
      { agentId: 'antigravity', taskId: 'task-a1' },
      { agentId: 'claude', taskId: 'task-c2' },
      { agentId: 'codex', taskId: 'task-o2' }
    ];

    const results = await Promise.all(
      requests.map((r) =>
        mcpGateway.executeTool({
          serverId: server.id,
          toolName: 'session_action',
          arguments: { taskId: r.taskId },
          agentId: r.agentId
        })
      )
    );

    expect(results).toHaveLength(5);
    for (let i = 0; i < results.length; i++) {
      expect(results[i].isError).toBe(false);
      const parsed = JSON.parse(results[i].content[0].text || '{}');
      expect(parsed.taskId).toBe(requests[i].taskId);
    }

    // Verify all 5 calls were uniquely recorded in audit logs with correct agent attributions
    const auditLogs = databaseService.listMCPAuditLogs(server.id, 20);
    expect(auditLogs).toHaveLength(5);
    const loggedAgents = auditLogs.map((l) => l.agentId);
    expect(loggedAgents).toContain('claude');
    expect(loggedAgents).toContain('codex');
    expect(loggedAgents).toContain('antigravity');
  });

  it('2. isolates permissions when one agent is authorized and another is blocked', async () => {
    const server = mcpRegistry.saveServer({
      name: 'claude-only-server',
      transport: 'stdio',
      command: process.execPath,
      args: [serverScriptPath],
      enabled: true,
      agentPermissions: {
        all: false,
        allowedAgents: ['claude']
      }
    });

    await mcpRuntime.connectServer(server);

    // Concurrently dispatch from allowed agent (claude) and blocked agent (opencode)
    const [claudePromise, opencodePromise] = [
      mcpGateway.executeTool({
        serverId: server.id,
        toolName: 'session_action',
        arguments: { taskId: 'task-claude-authorized' },
        agentId: 'claude'
      }),
      mcpGateway.executeTool({
        serverId: server.id,
        toolName: 'session_action',
        arguments: { taskId: 'task-opencode-unauthorized' },
        agentId: 'opencode'
      }).then(() => 'should_fail', (err) => err)
    ];

    const [claudeRes, opencodeErr] = await Promise.all([claudePromise, opencodePromise]);

    expect(claudeRes.isError).toBe(false);
    expect(opencodeErr).toBeInstanceOf(Error);
    expect((opencodeErr as Error).message).toContain('Permission Denied');
  });
});
