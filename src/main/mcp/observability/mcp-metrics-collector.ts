import { randomUUID } from 'node:crypto';
import type {
  MCPConnectionEvent,
  MCPServerConnectionMetrics,
  MCPObservabilitySummary,
  MCPServerStatus
} from '../../../shared/mcp';
import { databaseService } from '../../db/database.service';
import { mcpRegistry } from '../mcp-registry';

interface ServerRuntimeState {
  serverId: string;
  serverName: string;
  status: MCPServerStatus;
  lastConnectedAt?: number;
  disconnectTime?: number;
  totalUptimeMs: number;
  reconnectCount: number;
  failureCount: number;
  lastLatencyMs?: number;
  lastActivityAt?: number;
}

export class MCPMetricsCollector {
  private concurrentExecutions = 0;
  private serverStates: Map<string, ServerRuntimeState> = new Map();

  private getOrCreateServerState(serverId: string, serverName?: string): ServerRuntimeState {
    let state = this.serverStates.get(serverId);
    if (!state) {
      const server = mcpRegistry.getServer(serverId);
      state = {
        serverId,
        serverName: serverName || server?.name || serverId,
        status: server?.status || 'disconnected',
        totalUptimeMs: 0,
        reconnectCount: 0,
        failureCount: 0,
        lastActivityAt: server?.lastActivityAt,
        lastLatencyMs: server?.lastLatencyMs
      };
      this.serverStates.set(serverId, state);
    }
    return state;
  }

  // -------------------------------------------------------------
  // Concurrency Tracking
  // -------------------------------------------------------------

  public trackExecutionStart(): void {
    this.concurrentExecutions = Math.max(0, this.concurrentExecutions + 1);
  }

  public trackExecutionEnd(): void {
    this.concurrentExecutions = Math.max(0, this.concurrentExecutions - 1);
  }

  public getConcurrentExecutions(): number {
    return this.concurrentExecutions;
  }

  // -------------------------------------------------------------
  // Connection Events & Lifecycle
  // -------------------------------------------------------------

  public recordConnectionEvent(
    serverId: string,
    serverName: string,
    eventType: 'connected' | 'disconnected' | 'reconnecting' | 'failed',
    latencyMs?: number,
    errorMessage?: string
  ): void {
    const now = Date.now();
    const state = this.getOrCreateServerState(serverId, serverName);

    if (eventType === 'connected') {
      state.status = 'connected';
      state.lastConnectedAt = now;
      if (latencyMs !== undefined) {
        state.lastLatencyMs = latencyMs;
      }
      state.lastActivityAt = now;
    } else if (eventType === 'disconnected') {
      if (state.lastConnectedAt) {
        state.totalUptimeMs += now - state.lastConnectedAt;
      }
      state.status = 'disconnected';
      state.disconnectTime = now;
      state.lastActivityAt = now;
    } else if (eventType === 'reconnecting') {
      state.status = 'connecting';
      state.reconnectCount += 1;
      state.lastActivityAt = now;
    } else if (eventType === 'failed') {
      state.status = 'error';
      state.failureCount += 1;
      state.lastActivityAt = now;
    }

    try {
      const event: MCPConnectionEvent = {
        id: randomUUID(),
        serverId,
        serverName,
        eventType,
        latencyMs,
        errorMessage,
        timestamp: now
      };
      databaseService.saveMCPConnectionEvent(event);
      databaseService.updateMCPServerActivity(serverId, latencyMs);
    } catch (err: any) {
      console.warn(`[MCPMetricsCollector] Failed to persist connection event:`, err?.message);
    }
  }

  public recordActivity(serverId: string, latencyMs?: number): void {
    const now = Date.now();
    const state = this.getOrCreateServerState(serverId);
    state.lastActivityAt = now;
    if (latencyMs !== undefined) {
      state.lastLatencyMs = latencyMs;
    }

    try {
      databaseService.updateMCPServerActivity(serverId, latencyMs);
    } catch (err: any) {
      console.warn(`[MCPMetricsCollector] Failed to update server activity:`, err?.message);
    }
  }

  // -------------------------------------------------------------
  // Telemetry Metrics Queries
  // -------------------------------------------------------------

  public getConnectionMetrics(serverId?: string): MCPServerConnectionMetrics[] {
    const now = Date.now();
    const servers = mcpRegistry.listServers();
    const results: MCPServerConnectionMetrics[] = [];
    const seenServerIds = new Set<string>();

    for (const server of servers) {
      if (serverId && server.id !== serverId) continue;
      seenServerIds.add(server.id);

      const state = this.getOrCreateServerState(server.id, server.name);
      state.status = server.status;

      let currentUptime = state.totalUptimeMs;
      if (state.status === 'connected' && state.lastConnectedAt) {
        currentUptime += now - state.lastConnectedAt;
      }

      results.push({
        serverId: server.id,
        serverName: server.name,
        status: server.status,
        uptimeMs: currentUptime,
        lastConnectedAt: state.lastConnectedAt,
        reconnectCount: state.reconnectCount,
        failureCount: state.failureCount,
        lastLatencyMs: state.lastLatencyMs || server.lastLatencyMs,
        lastActivityAt: state.lastActivityAt || server.lastActivityAt
      });
    }

    if (serverId && !seenServerIds.has(serverId)) {
      const state = this.serverStates.get(serverId);
      if (state) {
        let currentUptime = state.totalUptimeMs;
        if (state.status === 'connected' && state.lastConnectedAt) {
          currentUptime += now - state.lastConnectedAt;
        }
        results.push({
          serverId: state.serverId,
          serverName: state.serverName,
          status: state.status,
          uptimeMs: currentUptime,
          lastConnectedAt: state.lastConnectedAt,
          reconnectCount: state.reconnectCount,
          failureCount: state.failureCount,
          lastLatencyMs: state.lastLatencyMs,
          lastActivityAt: state.lastActivityAt
        });
      }
    }

    return results;
  }

  public getObservabilitySummary(fromTimestamp?: number): MCPObservabilitySummary {
    const summary = databaseService.computeMCPObservabilityMetrics(fromTimestamp);
    const servers = mcpRegistry.listServers();

    let activeServers = 0;
    for (const server of servers) {
      if (server.status === 'connected') {
        activeServers += 1;
      }
    }

    summary.activeServersCount = activeServers;
    summary.activeSessionsCount = activeServers;
    summary.concurrentExecutions = this.concurrentExecutions;

    return summary;
  }
}

export const mcpMetricsCollector = new MCPMetricsCollector();
