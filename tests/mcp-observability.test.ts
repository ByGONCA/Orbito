import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { databaseService } from '../src/main/db/database.service';
import { mcpMetricsCollector } from '../src/main/mcp/observability/mcp-metrics-collector';
import { mcpRegistry } from '../src/main/mcp/mcp-registry';
import { mcpRuntime } from '../src/main/mcp/mcp-runtime';
import { mcpGateway } from '../src/main/mcp/mcp-gateway';
import type {
  MCPAuditLogEntry,
  MCPConnectionEvent,
  SaveMCPServerInput
} from '../src/shared/mcp';

// Mock electron safeStorage to work in headless node test environment
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (plain: string) => Buffer.from(`encrypted:${plain}`),
    decryptString: (buf: Buffer) => {
      const str = buf.toString();
      return str.startsWith('encrypted:') ? str.replace('encrypted:', '') : str;
    }
  }
}));

describe('Centralized MCP Observability & Diagnostics Suite', () => {
  const testStorageDir = path.join(process.cwd(), '.ai-workspace-data-test-mcp-observability');

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

  it('1. accurately computes execution metrics, percentiles (avg, P50, P95) and slowest tools from real SQLite audit records', () => {
    const serverId = randomUUID();
    const serverName = 'analytics-server';

    // Insert 10 audit logs with deterministic durations: 10, 20, 30, 40, 50, 60, 70, 80, 90, 500
    const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 500];
    durations.forEach((durationMs, i) => {
      const entry: MCPAuditLogEntry = {
        id: randomUUID(),
        serverId,
        serverName,
        toolName: i === 9 ? 'heavy_batch_tool' : 'fast_query_tool',
        agentId: i % 2 === 0 ? 'claude-code' : 'codex',
        status: i === 8 ? 'error' : i === 7 ? 'denied' : 'success',
        durationMs,
        timestamp: Date.now() - (10 - i) * 1000
      };
      databaseService.saveMCPAuditLog(entry);
    });

    const summary = databaseService.computeMCPObservabilityMetrics();

    expect(summary.totalExecutions).toBe(10);
    expect(summary.successfulExecutions).toBe(8);
    expect(summary.failedExecutions).toBe(1);
    expect(summary.deniedExecutions).toBe(1);

    // Sum = 950 / 10 = 95 avg
    expect(summary.avgDurationMs).toBe(95);

    // Sorted: [10, 20, 30, 40, 50, 60, 70, 80, 90, 500]
    // Median (index Math.floor(10 * 0.5) = 5) -> 60
    expect(summary.medianDurationMs).toBe(60);

    // P95 (index Math.floor(10 * 0.95) = 9) -> 500
    expect(summary.p95DurationMs).toBe(500);

    // Slowest tools
    expect(summary.slowestTools.length).toBeGreaterThan(0);
    expect(summary.slowestTools[0].toolName).toBe('heavy_batch_tool');
    expect(summary.slowestTools[0].avgDurationMs).toBe(500);

    // Breakdowns
    expect(summary.executionsByAgent['claude-code']).toBe(5);
    expect(summary.executionsByAgent['codex']).toBe(5);
    expect(summary.executionsByServer[serverName]).toBe(10);
  });

  it('2. records and queries connection lifecycle events (connected, disconnected, reconnecting, failed)', () => {
    const serverId = randomUUID();
    const serverName = 'database-mcp';

    const events: MCPConnectionEvent[] = [
      {
        id: randomUUID(),
        serverId,
        serverName,
        eventType: 'connected',
        latencyMs: 42,
        timestamp: Date.now() - 3000
      },
      {
        id: randomUUID(),
        serverId,
        serverName,
        eventType: 'reconnecting',
        errorMessage: 'Process exited unexpectedly',
        timestamp: Date.now() - 2000
      },
      {
        id: randomUUID(),
        serverId,
        serverName,
        eventType: 'failed',
        errorMessage: 'Connection refused',
        timestamp: Date.now() - 1000
      }
    ];

    events.forEach((ev) => databaseService.saveMCPConnectionEvent(ev));

    const retrieved = databaseService.listMCPConnectionEvents(serverId, 10);
    expect(retrieved.length).toBe(3);
    // Most recent first
    expect(retrieved[0].eventType).toBe('failed');
    expect(retrieved[0].errorMessage).toBe('Connection refused');
    expect(retrieved[2].eventType).toBe('connected');
    expect(retrieved[2].latencyMs).toBe(42);
  });

  it('3. filters audit logs with multi-dimensional criteria (status, toolName, server, agent)', () => {
    const server1 = randomUUID();
    const server2 = randomUUID();

    const sampleLogs: MCPAuditLogEntry[] = [
      {
        id: randomUUID(),
        serverId: server1,
        serverName: 'git-server',
        toolName: 'git_status',
        agentId: 'antigravity',
        status: 'success',
        durationMs: 12,
        timestamp: Date.now() - 5000
      },
      {
        id: randomUUID(),
        serverId: server1,
        serverName: 'git-server',
        toolName: 'git_commit',
        agentId: 'antigravity',
        status: 'error',
        durationMs: 25,
        timestamp: Date.now() - 4000,
        errorMessage: 'Working tree is dirty'
      },
      {
        id: randomUUID(),
        serverId: server2,
        serverName: 'filesystem-server',
        toolName: 'read_file',
        agentId: 'claude-code',
        status: 'success',
        durationMs: 5,
        timestamp: Date.now() - 3000
      }
    ];

    sampleLogs.forEach((l) => databaseService.saveMCPAuditLog(l));

    // Filter by serverId
    const resServer1 = databaseService.queryMCPAuditLogs({ serverId: server1 });
    expect(resServer1.total).toBe(2);
    expect(resServer1.logs.length).toBe(2);

    // Filter by status 'error'
    const resError = databaseService.queryMCPAuditLogs({ status: 'error' });
    expect(resError.total).toBe(1);
    expect(resError.logs[0].toolName).toBe('git_commit');

    // Filter by agentId
    const resAgent = databaseService.queryMCPAuditLogs({ agentId: 'claude-code' });
    expect(resAgent.total).toBe(1);
    expect(resAgent.logs[0].serverName).toBe('filesystem-server');
  });

  it('4. prunes old and excess logs based on retention policy without dropping active configuration', () => {
    const now = Date.now();
    const oldTimestamp = now - 35 * 86400 * 1000; // 35 days ago

    // Insert 5 old logs and 5 recent logs
    for (let i = 0; i < 5; i++) {
      databaseService.saveMCPAuditLog({
        id: randomUUID(),
        serverId: 's1',
        serverName: 'server-1',
        toolName: 'test_tool',
        agentId: 'system',
        status: 'success',
        durationMs: 10,
        timestamp: oldTimestamp + i * 1000
      });
    }

    for (let i = 0; i < 5; i++) {
      databaseService.saveMCPAuditLog({
        id: randomUUID(),
        serverId: 's1',
        serverName: 'server-1',
        toolName: 'test_tool',
        agentId: 'system',
        status: 'success',
        durationMs: 10,
        timestamp: now - i * 1000
      });
    }

    expect(databaseService.queryMCPAuditLogs().total).toBe(10);

    // Prune logs older than 30 days
    const deletedCount = databaseService.pruneMCPAuditLogs(30);
    expect(deletedCount).toBe(5);

    const remaining = databaseService.queryMCPAuditLogs();
    expect(remaining.total).toBe(5);
  });

  it('5. tracks concurrent executions and server activity timestamps in mcpMetricsCollector', () => {
    expect(mcpMetricsCollector.getConcurrentExecutions()).toBe(0);

    mcpMetricsCollector.trackExecutionStart();
    expect(mcpMetricsCollector.getConcurrentExecutions()).toBe(1);

    mcpMetricsCollector.trackExecutionStart();
    expect(mcpMetricsCollector.getConcurrentExecutions()).toBe(2);

    mcpMetricsCollector.trackExecutionEnd();
    expect(mcpMetricsCollector.getConcurrentExecutions()).toBe(1);

    mcpMetricsCollector.trackExecutionEnd();
    expect(mcpMetricsCollector.getConcurrentExecutions()).toBe(0);

    // Server activity tracking
    const serverId = randomUUID();
    mcpMetricsCollector.recordConnectionEvent(serverId, 'test-metric-server', 'connected', 25);
    const metrics = mcpMetricsCollector.getConnectionMetrics(serverId);

    expect(metrics.length).toBe(1);
    expect(metrics[0].lastLatencyMs).toBe(25);
    expect(metrics[0].status).toBe('connected');
  });

  it('6. gateway tool execution tracks metrics, logs audit records, and redacts secrets', async () => {
    // Register test server in registry
    const serverInput: SaveMCPServerInput = {
      name: 'echo-test-server',
      description: 'Echo server for gateway test',
      transport: 'stdio',
      command: 'node',
      args: ['-e', 'process.exit(0)'],
      enabled: true,
      authType: 'none',
      agentPermissions: { all: true, allowedAgents: [] },
      projectScope: null,
      autoReconnect: false
    };
    const server = mcpRegistry.saveServer(serverInput);

    // Mock callTool on runtime
    const callToolSpy = vi.spyOn(mcpRuntime, 'callTool').mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Bearer secret_key_1234567890 output test' }],
      isError: false
    });

    const response = await mcpGateway.executeTool({
      serverId: server.id,
      toolName: 'echo_secret',
      arguments: { val: 'test' },
      agentId: 'claude-code'
    });

    expect(callToolSpy).toHaveBeenCalledWith(server.id, 'echo_secret', { val: 'test' });
    // Secret redactor masked the bearer token
    expect(response.content[0].text).toContain('••••••••');
    expect(response.content[0].text).not.toContain('secret_key_1234567890');

    // Audit log was recorded
    const logs = databaseService.queryMCPAuditLogs({ serverId: server.id });
    expect(logs.total).toBe(1);
    expect(logs.logs[0].status).toBe('success');
    expect(logs.logs[0].agentId).toBe('claude-code');
    expect(logs.logs[0].toolName).toBe('echo_secret');
  });
});
