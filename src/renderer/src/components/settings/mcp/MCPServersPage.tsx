import React, { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  Play,
  RotateCw,
  Edit2,
  Trash2,
  Power,
  ChevronDown,
  ChevronRight,
  Shield,
  Terminal,
  Globe,
  CheckCircle,
  AlertCircle,
  Clock,
  Wrench
} from 'lucide-react';
import type { MCPServerConfig, MCPAgentIntegrationStatus, MCPToolDefinition } from '../../../../../shared/mcp';
import { AddEditMCPServerModal } from './AddEditMCPServerModal';

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return 'Never';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export const MCPServersPage: React.FC = () => {
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<MCPAgentIntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedServerIds, setExpandedServerIds] = useState<Set<string>>(new Set());
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [serverList, agents] = await Promise.all([
        window.api.listMCPServers(),
        window.api.getMCPAgentStatuses()
      ]);
      setServers(serverList || []);
      setAgentStatuses(agents || []);
    } catch (err) {
      console.error('Failed to load MCP servers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsub = window.api.onMCPServerStatusChange?.((data) => {
      setServers((prev) =>
        prev.map((s) =>
          s.id === data.serverId ? { ...s, status: data.status, errorMessage: data.errorMessage } : s
        )
      );
    });

    return () => unsub?.();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedServerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleServer = async (server: MCPServerConfig) => {
    setActionInProgressId(server.id);
    try {
      const updated = await window.api.toggleMCPServer({
        serverId: server.id,
        enabled: !server.enabled
      });
      setServers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err: any) {
      console.error('Failed to toggle MCP server:', err);
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleReconnect = async (server: MCPServerConfig) => {
    setActionInProgressId(server.id);
    try {
      await window.api.testMCPConnection({ serverId: server.id });
      await loadData();
    } catch (err: any) {
      console.error('Failed to reconnect server:', err);
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleDelete = async (server: MCPServerConfig) => {
    if (!window.confirm(`Delete MCP server "${server.name}"? This will remove its credentials from the vault.`)) {
      return;
    }
    setActionInProgressId(server.id);
    try {
      await window.api.deleteMCPServer({ serverId: server.id });
      setServers((prev) => prev.filter((s) => s.id !== server.id));
    } catch (err: any) {
      console.error('Failed to delete MCP server:', err);
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleSyncAllAgents = async () => {
    try {
      const res = await window.api.syncMCPAgentConfigs();
      setAgentStatuses(res);
    } catch (err) {
      console.error('Failed to sync agent configs:', err);
    }
  };

  // Metrics
  const totalServers = servers.length;
  const connectedServers = servers.filter((s) => s.status === 'connected').length;
  const totalTools = servers.reduce((acc, s) => acc + (s.tools?.length || 0), 0);
  const syncedAgentsCount = agentStatuses.filter((a) => a.status === 'synced' || a.status === 'configured').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header and Add Action */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
            MCP Servers
          </h2>
          <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
            Centrally manage Model Context Protocol servers, credentials, and tool discovery across all AI coding agents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncAllAgents}
            className="p-2 text-foreground-muted hover:text-white bg-white/[0.02] hover:bg-white/[0.05] rounded-lg transition-colors border-0"
            title="Sync all agent configurations"
            aria-label="Sync all agent configurations"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-black bg-[#ECEDEF] hover:bg-white rounded-lg transition-colors border-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Server
          </button>
        </div>
      </div>

      {/* Metrics Row (Clean Typography, No Pill Backgrounds on Numbers) */}
      <div className="grid grid-cols-4 gap-4 py-2">
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted">Configured Servers</div>
          <div className="text-2xl font-bold text-[#ECEDEF] tracking-tight">{totalServers}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted">Connected</div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">{connectedServers}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted">Discovered Tools</div>
          <div className="text-2xl font-bold text-[#ECEDEF] tracking-tight">{totalTools}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted">Compatible Agents</div>
          <div className="text-2xl font-bold text-[#ECEDEF] tracking-tight">{syncedAgentsCount} / {agentStatuses.length || 4}</div>
        </div>
      </div>

      {/* Servers List */}
      <div className="space-y-2">
        {loading ? (
          <div className="py-12 text-center text-xs text-foreground-muted">
            Loading MCP infrastructure...
          </div>
        ) : servers.length === 0 ? (
          <div className="py-12 text-center space-y-3 bg-white/[0.01] rounded-xl">
            <Server className="w-8 h-8 mx-auto text-foreground-muted opacity-40" />
            <div className="text-xs text-foreground-muted">
              No MCP servers configured yet. Add a server once to make its tools securely available to Claude, Codex, Antigravity, and OpenCode.
            </div>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors border-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Configure First MCP Server
            </button>
          </div>
        ) : (
          servers.map((server) => {
            const isExpanded = expandedServerIds.has(server.id);
            const statusDotColor =
              server.status === 'connected'
                ? 'bg-emerald-400'
                : server.status === 'connecting'
                ? 'bg-amber-400 animate-pulse'
                : server.status === 'error'
                ? 'bg-red-400'
                : 'bg-zinc-600';

            return (
              <div
                key={server.id}
                className="rounded-xl bg-white/[0.02] hover:bg-white/[0.035] transition-colors border-0 overflow-hidden"
              >
                {/* Main Row */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleExpand(server.id)}
                      className="p-1 text-foreground-muted hover:text-white transition-colors"
                      title={isExpanded ? 'Collapse tools' : 'Expand tools'}
                      aria-label="Toggle server expansion"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {/* Status Dot */}
                    <div className={`w-2 h-2 rounded-full shrink-0 ${statusDotColor}`} title={`Status: ${server.status}`} />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#ECEDEF] truncate">
                          {server.name}
                        </span>
                        <span className="text-[10px] font-mono text-foreground-muted uppercase">
                          {server.transport === 'stdio' ? 'stdio' : 'streamable-http'}
                        </span>
                        {server.lastLatencyMs !== undefined && (
                          <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-zinc-500" />
                            {server.lastLatencyMs}ms
                          </span>
                        )}
                        {!server.enabled && (
                          <span className="text-[10px] text-zinc-500 font-mono uppercase">
                            (Disabled)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-0.5">
                        {server.description && (
                          <p className="text-xs text-foreground-muted truncate max-w-sm">
                            {server.description}
                          </p>
                        )}
                        {server.lastActivityAt && (
                          <span className="text-[11px] text-zinc-500 font-mono">
                            Active {formatRelativeTime(server.lastActivityAt)}
                          </span>
                        )}
                      </div>

                      {server.errorMessage && (
                        <p className="text-xs text-red-400 mt-0.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{server.errorMessage}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Tool Count */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-mono text-[#ECEDEF]">
                        {server.tools?.length || 0} tools
                      </div>
                      <div className="text-[10px] text-foreground-muted">
                        {server.agentPermissions.all
                          ? 'All Agents'
                          : `${server.agentPermissions.allowedAgents.length} Agents`}
                      </div>
                    </div>

                    {/* Icon-only controls with tooltips */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleReconnect(server)}
                        disabled={actionInProgressId === server.id}
                        className="p-1.5 rounded text-foreground-muted hover:text-white hover:bg-white/[0.04] transition-colors border-0 disabled:opacity-40"
                        title="Test & Reconnect Server"
                        aria-label="Test & Reconnect Server"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingServer(server)}
                        disabled={actionInProgressId === server.id}
                        className="p-1.5 rounded text-foreground-muted hover:text-white hover:bg-white/[0.04] transition-colors border-0 disabled:opacity-40"
                        title="Edit Configuration"
                        aria-label="Edit Server Configuration"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleServer(server)}
                        disabled={actionInProgressId === server.id}
                        className={`p-1.5 rounded transition-colors border-0 disabled:opacity-40 ${
                          server.enabled
                            ? 'text-emerald-400 hover:text-emerald-300 hover:bg-white/[0.04]'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                        }`}
                        title={server.enabled ? 'Disable Server' : 'Enable Server'}
                        aria-label={server.enabled ? 'Disable Server' : 'Enable Server'}
                      >
                        <Power className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(server)}
                        disabled={actionInProgressId === server.id}
                        className="p-1.5 rounded text-foreground-muted hover:text-red-400 hover:bg-white/[0.04] transition-colors border-0 disabled:opacity-40"
                        title="Delete Server"
                        aria-label="Delete MCP Server"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable Discovered Tools Panel */}
                {isExpanded && (
                  <div className="px-6 py-4 bg-black/20 space-y-3">
                    <div className="flex flex-wrap items-center gap-6 py-1 text-xs text-foreground-muted font-mono">
                      <span>Status: <strong className="text-white font-medium capitalize">{server.status}</strong></span>
                      {server.lastLatencyMs !== undefined && (
                        <span>Latency: <strong className="text-white font-medium">{server.lastLatencyMs}ms</strong></span>
                      )}
                      <span>Last Active: <strong className="text-white font-medium">{formatRelativeTime(server.lastActivityAt)}</strong></span>
                      <span>Auto-Reconnect: <strong className="text-white font-medium">{server.autoReconnect ? 'Enabled' : 'Disabled'}</strong></span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5" />
                        Discovered Tools ({server.tools?.length || 0})
                      </span>
                    </div>

                    {!server.tools || server.tools.length === 0 ? (
                      <div className="text-xs text-foreground-muted py-2">
                        No tools reported by this server yet. Connect or test the server to fetch active tools.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {server.tools.map((t, idx) => (
                          <div key={idx} className="p-3 bg-white/[0.02] rounded-lg space-y-1">
                            <div className="font-mono text-xs font-semibold text-white">
                              {t.name}
                            </div>
                            {t.description && (
                              <p className="text-[11px] text-foreground-muted leading-relaxed line-clamp-2">
                                {t.description}
                              </p>
                            )}
                            {t.inputSchema?.properties && (
                              <div className="text-[10px] font-mono text-zinc-500 pt-1">
                                Args: {Object.keys(t.inputSchema.properties).join(', ') || 'none'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Modal */}
      {(isAddModalOpen || editingServer) && (
        <AddEditMCPServerModal
          server={editingServer}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingServer(null);
          }}
          onSaved={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
};
