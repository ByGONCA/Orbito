import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../src/main/db/database.service';
import { SecretRedactor } from '../src/main/mcp/security/secret-redactor';
import { mcpCredentialsVault } from '../src/main/mcp/security/mcp-credentials-vault';
import { mcpPermissionManager } from '../src/main/mcp/security/mcp-permission-manager';
import { mcpGateway } from '../src/main/mcp/mcp-gateway';
import { mcpRegistry } from '../src/main/mcp/mcp-registry';
import type { MCPServerConfig, MCPToolDefinition } from '../src/shared/mcp';

describe('Centralized MCP Infrastructure: Security & Credential Vault Suite', () => {
  const testStorageDir = path.join(process.cwd(), '.ai-workspace-data-test-mcp-sec');

  beforeEach(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    databaseService.initialize(testStorageDir);
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  it('1. scrubs secrets via SecretRedactor across text and structured JSON payloads', () => {
    // Scrub known patterns
    const rawApiKey = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyz';
    const rawBearer = 'Bearer ya29.a0AfH6SMDI983274928374923';
    const text = `Executing tool with ${rawApiKey} and ${rawBearer}`;

    const redacted = SecretRedactor.redactText(text);
    expect(redacted).not.toContain(rawApiKey);
    expect(redacted).not.toContain('ya29.a0AfH6SMDI983274928374923');
    expect(redacted).toContain('••••••••');

    // Register a custom secret
    const customSecret = 'my-super-secret-postgres-password-999';
    SecretRedactor.registerSecret(customSecret);

    const textWithCustom = `Connected to db with password ${customSecret} on port 5432`;
    expect(SecretRedactor.redactText(textWithCustom)).toBe(
      'Connected to db with password •••••••• on port 5432'
    );

    // Redact object
    const payload = {
      user: 'alice',
      authToken: 'secret-token-123',
      nested: {
        apiKey: 'secret-key-456',
        normalField: 'hello world'
      }
    };
    const redactedObj = SecretRedactor.redactObject(payload);
    expect(redactedObj.authToken).toBe('••••••••');
    expect(redactedObj.nested.apiKey).toBe('••••••••');
    expect(redactedObj.nested.normalField).toBe('hello world');
  });

  it('2. enforces strict agent-level authorization policies in MCPPermissionManager', () => {
    const server: MCPServerConfig = {
      id: 'restricted-server',
      name: 'Restricted Server',
      transport: 'stdio',
      enabled: true,
      status: 'connected',
      authType: 'none',
      agentPermissions: {
        all: false,
        allowedAgents: ['claude', 'antigravity']
      },
      projectScope: null,
      autoReconnect: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const tool: MCPToolDefinition = {
      name: 'deploy_cluster',
      serverId: 'restricted-server',
      inputSchema: {},
      requiresApproval: false
    };

    // Allowed agents
    const claudeCheck = mcpPermissionManager.evaluateToolCallPermission(server, tool, 'claude');
    expect(claudeCheck.allowed).toBe(true);

    const agyCheck = mcpPermissionManager.evaluateToolCallPermission(server, tool, 'antigravity');
    expect(agyCheck.allowed).toBe(true);

    // Disallowed agent
    const codexCheck = mcpPermissionManager.evaluateToolCallPermission(server, tool, 'codex');
    expect(codexCheck.allowed).toBe(false);
    expect(codexCheck.reason).toContain('not authorized');

    // Disabled server check
    const disabledServer = { ...server, enabled: false };
    const disabledCheck = mcpPermissionManager.evaluateToolCallPermission(disabledServer, tool, 'claude');
    expect(disabledCheck.allowed).toBe(false);
    expect(disabledCheck.reason).toContain('disabled');
  });

  it('3. enforces project-level scope boundaries', () => {
    const server: MCPServerConfig = {
      id: 'scoped-server',
      name: 'Project A Scoped Server',
      transport: 'stdio',
      enabled: true,
      status: 'connected',
      authType: 'none',
      agentPermissions: { all: true, allowedAgents: [] },
      projectScope: 'proj-alpha',
      autoReconnect: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const tool: MCPToolDefinition = {
      name: 'run_tests',
      serverId: 'scoped-server',
      inputSchema: {},
      requiresApproval: false
    };

    // Same project: allowed
    const sameProj = mcpPermissionManager.evaluateToolCallPermission(server, tool, 'claude', 'proj-alpha');
    expect(sameProj.allowed).toBe(true);

    // Different project: denied
    const diffProj = mcpPermissionManager.evaluateToolCallPermission(server, tool, 'claude', 'proj-beta');
    expect(diffProj.allowed).toBe(false);
    expect(diffProj.reason).toContain('scoped to project "proj-alpha"');
  });

  it('4. logs audit events when unauthorized execution is attempted through Gateway', async () => {
    // Register a server with agent restrictions
    const server = mcpRegistry.saveServer({
      name: 'prod-secrets-mcp',
      transport: 'stdio',
      command: 'node',
      enabled: true,
      authType: 'none',
      agentPermissions: {
        all: false,
        allowedAgents: ['claude']
      }
    });

    // Attempt call by unauthorized agent 'opencode'
    await expect(
      mcpGateway.executeTool({
        serverId: server.id,
        toolName: 'read_secret',
        arguments: {},
        agentId: 'opencode'
      })
    ).rejects.toThrow(/Permission Denied/);

    // Verify audit log was recorded in SQLite
    const logs = databaseService.listMCPAuditLogs(server.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].status).toBe('denied');
    expect(logs[0].agentId).toBe('opencode');
    expect(logs[0].toolName).toBe('read_secret');
  });
});
