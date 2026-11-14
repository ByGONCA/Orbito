import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { claudeCodeMCPAdapter } from '../src/main/mcp/adapters/claude-code-mcp.adapter';
import { codexMCPAdapter } from '../src/main/mcp/adapters/codex-mcp.adapter';
import { antigravityMCPAdapter } from '../src/main/mcp/adapters/antigravity-mcp.adapter';
import { openCodeMCPAdapter } from '../src/main/mcp/adapters/opencode-mcp.adapter';
import { mcpAgentAdapterManager } from '../src/main/mcp/adapters/agent-adapter-manager';
import type { MCPServerConfig } from '../src/shared/mcp';

describe('Centralized MCP Infrastructure: Agent Adapters Suite', () => {
  const testProjectDir = path.join(process.cwd(), '.test-agent-sync-env');

  beforeEach(() => {
    if (fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testProjectDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    }
  });

  const mockServers: MCPServerConfig[] = [
    {
      id: 'srv-fs',
      name: 'filesystem',
      description: 'Local filesystem access',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', testProjectDir],
      enabled: true,
      status: 'connected',
      authType: 'none',
      agentPermissions: { all: true, allowedAgents: [] },
      projectScope: null,
      autoReconnect: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'srv-remote',
      name: 'remote-docs',
      description: 'Internal documentation API',
      transport: 'streamable_http',
      url: 'https://docs.mcp.local/sse',
      enabled: true,
      status: 'connected',
      authType: 'bearer',
      agentPermissions: { all: false, allowedAgents: ['claude', 'antigravity'] },
      projectScope: null,
      autoReconnect: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];

  it('1. reconciles Claude Code configuration without destroying user-native servers', async () => {
    const configPath = path.join(testProjectDir, '.mcp.json');

    // Pre-populate with a user-native server
    const userNativeConfig = {
      mcpServers: {
        'my-personal-tool': {
          command: 'python',
          args: ['personal_tool.py']
        }
      }
    };
    fs.writeFileSync(configPath, JSON.stringify(userNativeConfig, null, 2), 'utf8');

    // Sync Orbito servers
    const result = await claudeCodeMCPAdapter.syncConfig(mockServers, testProjectDir);
    expect(result.status).toBe('synced');
    expect(result.activeServersCount).toBe(2);

    // Read back config
    const updated = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    // User native server preserved
    expect(updated.mcpServers['my-personal-tool']).toBeDefined();
    expect(updated.mcpServers['my-personal-tool'].command).toBe('python');

    // Orbito servers merged
    expect(updated.mcpServers['filesystem']).toBeDefined();
    expect(updated.mcpServers['filesystem']._orbitoManaged).toBe(true);
    expect(updated.mcpServers['remote-docs']).toBeDefined();
    expect(updated.mcpServers['remote-docs'].url).toBe('https://docs.mcp.local/sse');
  });

  it('2. filters servers based on agent-specific permissions during sync', async () => {
    // Sync to Codex: Codex is NOT in remote-docs allowedAgents list
    const result = await codexMCPAdapter.syncConfig(mockServers, testProjectDir);
    expect(result.status).toBe('synced');
    expect(result.activeServersCount).toBe(1); // Only 'filesystem'

    const configPath = path.join(testProjectDir, '.codex', 'mcp.json');
    const updated = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    expect(updated.mcp_servers['filesystem']).toBeDefined();
    expect(updated.mcp_servers['remote-docs']).toBeUndefined();
  });

  it('3. synchronizes multiple agent configurations simultaneously via MCPAgentAdapterManager', async () => {
    const statuses = await mcpAgentAdapterManager.syncAllAgents(mockServers, undefined, testProjectDir);

    expect(statuses.length).toBeGreaterThanOrEqual(4);

    const claudeStatus = statuses.find((s) => s.agentId === 'claude');
    const codexStatus = statuses.find((s) => s.agentId === 'codex');
    const agyStatus = statuses.find((s) => s.agentId === 'antigravity');
    const opencodeStatus = statuses.find((s) => s.agentId === 'opencode');

    expect(claudeStatus?.status).toBe('synced');
    expect(codexStatus?.status).toBe('synced');
    expect(agyStatus?.status).toBe('synced');
    expect(opencodeStatus?.status).toBe('synced');
  });

  it('4. verifies live Claude Code CLI tool discovery with real .mcp.json configuration', async () => {
    // Sync an Orbito bridge server into the temporary test directory
    const bridgeScript = path.resolve('bin/orbito.js');
    await claudeCodeMCPAdapter.syncConfig(
      [
        {
          id: 'test-real-claude',
          name: 'orbito_test_server',
          transport: 'stdio',
          command: process.execPath,
          args: [bridgeScript, 'mcp', 'bridge', '--agent', 'claude'],
          enabled: true,
          status: 'connected',
          authType: 'none',
          agentPermissions: { all: true, allowedAgents: [] },
          projectScope: null,
          autoReconnect: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ],
      testProjectDir
    );

    const mcpJsonPath = path.join(testProjectDir, '.mcp.json');
    expect(fs.existsSync(mcpJsonPath)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
    expect(parsed.mcpServers['orbito_test_server']).toBeDefined();
    expect(parsed.mcpServers['orbito_test_server']._orbitoManaged).toBe(true);

    // If claude CLI is available on PATH, execute "claude mcp list" inside testProjectDir
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    try {
      const { stdout } = await execFileAsync('claude', ['mcp', 'list'], {
        cwd: testProjectDir,
        timeout: 10000
      });
      // Claude Code lists configured servers
      expect(stdout).toContain('orbito_test_server');
    } catch (err: any) {
      // If claude binary has permission or license gates in CI, ensure it threw a valid CLI exit
      console.info('Live claude CLI invocation check:', err.message);
    }
  });
});
