import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';

vi.mock('electron', () => {
  return {
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((str: string) => Buffer.from(`mock_enc_${str}`)),
      decryptString: vi.fn((buf: Buffer) => buf.toString('utf8').replace('mock_enc_', ''))
    }
  };
});

import { databaseService } from '../src/main/db/database.service';
import { mcpRegistry } from '../src/main/mcp/mcp-registry';
import { mcpRuntime } from '../src/main/mcp/mcp-runtime';
import { mcpCredentialsVault } from '../src/main/mcp/security/mcp-credentials-vault';

describe('Centralized MCP Infrastructure: Persistence & Runtime Recovery Suite', () => {
  const testStorageDir = path.join(process.cwd(), '.ai-workspace-data-test-mcp-persist');
  const serverScriptPath = path.join(testStorageDir, 'persistent-mcp-server.js');

  beforeEach(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testStorageDir, { recursive: true });
    databaseService.initialize(testStorageDir);

    const script = `
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
                serverInfo: { name: 'persistent-mcp', version: '1.0.0' },
                capabilities: { tools: {} }
              }
            }) + '\\n');
          } else if (req.method === 'tools/list') {
            process.stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                tools: [
                  { name: 'persisted_tool_alpha', description: 'Alpha test tool' }
                ]
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

  it('1. persists server configurations and securely restores them across application restart', async () => {
    // 1. Create server with credentials
    const server = mcpRegistry.saveServer({
      name: 'resilient-db-server',
      description: 'Survives application restart',
      transport: 'stdio',
      command: process.execPath,
      args: [serverScriptPath],
      enabled: true,
      env: {
        DATABASE_PORT: '5432',
        API_TOKEN: 'secret-token-xyz-123'
      }
    });

    // Verify initial credentials in vault
    const initialEnv = mcpCredentialsVault.getServerEnv(server.id);
    expect(initialEnv['DATABASE_PORT']).toBe('5432');
    expect(initialEnv['API_TOKEN']).toBe('secret-token-xyz-123');

    // Connect and cache tools
    const tools = await mcpRuntime.connectServer(server);
    expect(tools).toHaveLength(1);

    // 2. Simulate complete application shutdown
    await mcpRuntime.shutdownAll();
    databaseService.close();

    // 3. Simulate application restart
    databaseService.initialize(testStorageDir);

    // Verify server record survived in SQLite
    const restoredServer = mcpRegistry.getServer(server.id);
    expect(restoredServer).not.toBeNull();
    expect(restoredServer?.name).toBe('resilient-db-server');
    expect(restoredServer?.enabled).toBe(true);

    // Verify credentials survived in OS vault
    const restoredEnv = mcpCredentialsVault.getServerEnv(server.id);
    expect(restoredEnv['DATABASE_PORT']).toBe('5432');
    expect(restoredEnv['API_TOKEN']).toBe('secret-token-xyz-123');

    // 4. Verify runtime re-initialization restores session
    await mcpRuntime.initializeAllServers();
    const reloadedServer = mcpRegistry.getServer(server.id);
    expect(reloadedServer?.status).toBe('connected');

    const discoveredTools = mcpRuntime.listTools(server.id);
    expect(discoveredTools).toHaveLength(1);
    expect(discoveredTools[0].name).toBe('persisted_tool_alpha');
  });
});
