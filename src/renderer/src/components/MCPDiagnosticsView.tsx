import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  RotateCw,
  Search,
  Filter,
  Trash2,
  Cpu,
  Layers,
  Wrench
} from 'lucide-react';
import type {
  MCPObservabilitySummary,
  MCPServerConnectionMetrics,
  MCPAuditLogEntry,
  MCPConnectionEvent
} from '../../../shared/mcp';

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return '—';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export const MCPDiagnosticsView: React.FC = () => {
  const [summary, setSummary] = useState<MCPObservabilitySummary | null>(null);
  const [connectionMetrics, setConnectionMetrics] = useState<MCPServerConnectionMetrics[]>([]);
  const [auditLogs, setAuditLogs] = useState<MCPAuditLogEntry[]>([]);
  const [connectionEvents, setConnectionEvents] = useState<MCPConnectionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'success' | 'error' | 'denied'>('all');
  const [selectedServer, setSelectedServer] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [subTab, setSubTab] = useState<'tools' | 'connections'>('tools');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sum, connMetrics, auditRes, events] = await Promise.all([
        window.api.getMCPObservabilitySummary(),
        window.api.getMCPConnectionMetrics(),
        window.api.queryMCPAuditLogs({ limit: 200 }),
        window.api.getMCPConnectionEvents({ limit: 50 })
      ]);
      setSummary(sum);
      setConnectionMetrics(connMetrics || []);
      setAuditLogs(auditRes?.logs || []);
      setConnectionEvents(events || []);
    } catch (err) {
      console.error('Failed to load MCP diagnostics data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePruneLogs = async () => {
    if (!window.confirm('Prune MCP telemetry and audit logs older than 30 days?')) return;
    try {
      await window.api.pruneMCPLogs({ retentionDays: 30 });
      await loadData();
    } catch (err) {
      console.error('Failed to prune logs:', err);
    }
  };

  // Filtered audit logs
  const filteredLogs = auditLogs.filter((log) => {
    if (selectedStatus !== 'all' && log.status !== selectedStatus) return false;
    if (selectedServer !== 'all' && log.serverName !== selectedServer && log.serverId !== selectedServer) return false;
    if (selectedAgent !== 'all' && log.agentId !== selectedAgent) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.toolName.toLowerCase().includes(q) ||
        log.serverName.toLowerCase().includes(q) ||
        (log.agentId && log.agentId.toLowerCase().includes(q)) ||
        (log.errorMessage && log.errorMessage.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Unique server names & agent IDs for dropdowns
  const serverNames = Array.from(new Set(auditLogs.map((l) => l.serverName).filter(Boolean)));
  const agentIds = Array.from(new Set(auditLogs.map((l) => l.agentId).filter(Boolean)));

  const failureRate =
    summary && summary.totalExecutions > 0
      ? Math.round(((summary.failedExecutions + summary.deniedExecutions) / summary.totalExecutions) * 100)
      : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Controls Strip */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#ECEDEF] tracking-tight">
            MCP Infrastructure Diagnostics
          </h2>
          <p className="text-xs text-foreground-muted mt-0.5">
            Internal telemetry, latency percentiles, tool execution traces, and runtime connection states.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePruneLogs}
            className="p-2 text-foreground-muted hover:text-white bg-white/[0.02] hover:bg-white/[0.05] rounded-lg transition-colors border-0"
            title="Prune logs older than 30 days"
            aria-label="Prune logs older than 30 days"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-foreground-muted hover:text-white bg-white/[0.02] hover:bg-white/[0.05] rounded-lg transition-colors border-0 disabled:opacity-40"
            title="Refresh Diagnostics"
            aria-label="Refresh Diagnostics"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Metric Strip (Clean Typography, No Pill Backgrounds) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 py-2">
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted">Total Tool Calls</div>
          <div className="text-2xl font-bold text-[#ECEDEF] tracking-tight">{summary?.totalExecutions || 0}</div>
          <div className="text-[11px] font-mono text-zinc-500">
            {summary?.successfulExecutions || 0} ok / {summary?.failedExecutions || 0} err
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted">Latency (Avg)</div>
          <div className="text-2xl font-bold text-[#ECEDEF] tracking-tight">{summary?.avgDurationMs || 0} ms</div>
          <div className="text-[11px] font-mono text-zinc-500">
            Median: {summary?.medianDurationMs || 0}ms
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted">P95 Latency</div>
          <div className="text-2xl font-bold text-amber-400 tracking-tight">{summary?.p95DurationMs || 0} ms</div>
          <div className="text-[11px] font-mono text-zinc-500">Tail latency percentile</div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted">Active Servers</div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">{summary?.activeServersCount || 0}</div>
          <div className="text-[11px] font-mono text-zinc-500">
            {connectionMetrics.length} registered
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted">Concurrent Calls</div>
          <div className="text-2xl font-bold text-sky-400 tracking-tight">{summary?.concurrentExecutions || 0}</div>
          <div className="text-[11px] font-mono text-zinc-500">Active non-blocking sessions</div>
        </div>
      </div>

      {/* Breakdowns Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Slowest Tools */}
        <div className="bg-white/[0.02] p-4 rounded-xl space-y-3 border-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Slowest Tools (Avg)
            </span>
          </div>
          {!summary?.slowestTools || summary.slowestTools.length === 0 ? (
            <div className="text-xs text-foreground-muted py-3">No tool executions recorded yet.</div>
          ) : (
            <div className="space-y-2">
              {summary.slowestTools.map((tool, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1">
                  <div className="min-w-0 pr-2">
                    <div className="font-mono font-medium text-white truncate">{tool.toolName}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{tool.serverName} ({tool.callCount} calls)</div>
                  </div>
                  <div className="text-right shrink-0 font-mono text-amber-400 font-semibold">
                    {tool.avgDurationMs}ms
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Executions by Agent */}
        <div className="bg-white/[0.02] p-4 rounded-xl space-y-3 border-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              Activity by Agent
            </span>
          </div>
          {!summary?.executionsByAgent || Object.keys(summary.executionsByAgent).length === 0 ? (
            <div className="text-xs text-foreground-muted py-3">No agent calls recorded yet.</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(summary.executionsByAgent).map(([agentId, count], idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1">
                  <span className="font-mono text-zinc-300 capitalize">{agentId}</span>
                  <span className="font-mono text-white font-semibold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Server Connection Uptime */}
        <div className="bg-white/[0.02] p-4 rounded-xl space-y-3 border-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              Server Health
            </span>
          </div>
          {connectionMetrics.length === 0 ? (
            <div className="text-xs text-foreground-muted py-3">No servers configured.</div>
          ) : (
            <div className="space-y-2">
              {connectionMetrics.slice(0, 5).map((m, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1">
                  <div className="min-w-0 pr-2">
                    <div className="font-mono font-medium text-white truncate">{m.serverName}</div>
                    <div className="text-[10px] text-zinc-500">
                      {m.reconnectCount > 0 ? `${m.reconnectCount} reconnects` : 'Stable'}
                      {m.lastLatencyMs !== undefined && ` · ${m.lastLatencyMs}ms`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-[10px] font-mono uppercase font-semibold ${
                        m.status === 'connected'
                          ? 'text-emerald-400'
                          : m.status === 'error'
                          ? 'text-red-400'
                          : 'text-zinc-500'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-4 border-0">
        <button
          type="button"
          onClick={() => setSubTab('tools')}
          className={`text-xs font-semibold py-1.5 transition-colors ${
            subTab === 'tools' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Tool Execution Traces ({filteredLogs.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('connections')}
          className={`text-xs font-semibold py-1.5 transition-colors ${
            subTab === 'connections' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Connection Lifecycle Events ({connectionEvents.length})
        </button>
      </div>

      {subTab === 'tools' ? (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by tool, server, agent or error..."
                className="w-full bg-white/[0.02] hover:bg-white/[0.04] focus:bg-white/[0.06] text-xs text-white placeholder-zinc-500 pl-8 pr-3 py-1.5 rounded-lg outline-none transition-colors border-0"
              />
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="bg-white/[0.02] hover:bg-white/[0.04] text-xs text-zinc-300 px-3 py-1.5 rounded-lg outline-none transition-colors border-0"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="denied">Denied</option>
            </select>

            {/* Server Filter */}
            {serverNames.length > 0 && (
              <select
                value={selectedServer}
                onChange={(e) => setSelectedServer(e.target.value)}
                className="bg-white/[0.02] hover:bg-white/[0.04] text-xs text-zinc-300 px-3 py-1.5 rounded-lg outline-none transition-colors border-0"
              >
                <option value="all">All Servers</option>
                {serverNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}

            {/* Agent Filter */}
            {agentIds.length > 0 && (
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="bg-white/[0.02] hover:bg-white/[0.04] text-xs text-zinc-300 px-3 py-1.5 rounded-lg outline-none transition-colors border-0"
              >
                <option value="all">All Agents</option>
                {agentIds.map((agent) => (
                  <option key={agent} value={agent}>{agent}</option>
                ))}
              </select>
            )}
          </div>

          {/* Activity Log Table */}
          <div className="bg-white/[0.02] rounded-xl overflow-hidden border-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-zinc-500 text-[10px] uppercase tracking-wider bg-white/[0.01]">
                    <th className="px-4 py-2.5">Time</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Agent</th>
                    <th className="px-4 py-2.5">Server</th>
                    <th className="px-4 py-2.5">Tool</th>
                    <th className="px-4 py-2.5">Duration</th>
                    <th className="px-4 py-2.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y-0 text-zinc-300">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-500 font-sans text-xs">
                        No execution records match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">
                          {formatRelativeTime(log.timestamp)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span
                            className={`text-[10px] uppercase font-semibold ${
                              log.status === 'success'
                                ? 'text-emerald-400'
                                : log.status === 'error'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-white font-medium whitespace-nowrap">
                          {log.agentId || 'system'}
                        </td>
                        <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">
                          {log.serverName}
                        </td>
                        <td className="px-4 py-2 text-white font-semibold whitespace-nowrap">
                          {log.toolName}
                        </td>
                        <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">
                          {log.durationMs}ms
                        </td>
                        <td className="px-4 py-2 text-zinc-500 truncate max-w-xs font-sans text-[11px]">
                          {log.errorMessage || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Connection Lifecycle Events */
        <div className="bg-white/[0.02] rounded-xl overflow-hidden border-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-zinc-500 text-[10px] uppercase tracking-wider bg-white/[0.01]">
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Event</th>
                  <th className="px-4 py-2.5">Server</th>
                  <th className="px-4 py-2.5">Handshake Latency</th>
                  <th className="px-4 py-2.5">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y-0 text-zinc-300">
                {connectionEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 font-sans text-xs">
                      No connection events recorded yet.
                    </td>
                  </tr>
                ) : (
                  connectionEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">
                        {formatRelativeTime(ev.timestamp)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span
                          className={`text-[10px] uppercase font-semibold ${
                            ev.eventType === 'connected'
                              ? 'text-emerald-400'
                              : ev.eventType === 'reconnecting'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {ev.eventType}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-white font-medium whitespace-nowrap">
                        {ev.serverName}
                      </td>
                      <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">
                        {ev.latencyMs !== undefined ? `${ev.latencyMs}ms` : '—'}
                      </td>
                      <td className="px-4 py-2 text-zinc-500 truncate max-w-sm font-sans text-[11px]">
                        {ev.errorMessage || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
