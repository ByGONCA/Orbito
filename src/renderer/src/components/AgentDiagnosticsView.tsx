import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  Search,
  Wrench,
  Server,
  Zap,
  Activity
} from 'lucide-react';
import type { AgentCapability } from '../../../shared/agents';

export const AgentDiagnosticsView: React.FC = () => {
  const [agents, setAgents] = useState<AgentCapability[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  const loadAgents = async () => {
    setIsLoading(true);
    try {
      const caps = await window.api.getAgentCapabilities();
      setAgents(caps || []);
    } catch (err) {
      console.error('Failed to load agent capabilities:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const filtered = agents.filter((ag) => {
    if (filterRole !== 'all' && ag.role !== filterRole) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        ag.name.toLowerCase().includes(q) ||
        ag.role.toLowerCase().includes(q) ||
        ag.provider.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const idleCount = agents.filter((a) => a.status === 'idle').length;
  const busyCount = agents.filter((a) => a.status === 'busy').length;
  const installedCount = agents.filter((a) => a.isInstalled).length;

  return (
    <div className="space-y-6 text-foreground">
      {/* Metrics Row - borderless, clean typographic hierarchy */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white/[0.03]">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Users className="w-4 h-4 text-primary" />
            <span>Registered Personas</span>
          </div>
          <div className="text-2xl font-semibold tracking-tight">{agents.length}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Specialist subagent team</div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03]">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Ready for Dispatch</span>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-emerald-400">{idleCount}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Idle and receptive</div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03]">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Active Workload</span>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-amber-400">{busyCount}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Processing tasks in worktrees</div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03]">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>CLI Integrations</span>
          </div>
          <div className="text-2xl font-semibold tracking-tight">{installedCount} <span className="text-sm font-normal text-muted-foreground">/ {agents.length}</span></div>
          <div className="text-[11px] text-muted-foreground mt-1">Installed & authenticated</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter agents by name, role, or CLI provider..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.03] rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:bg-white/[0.06] text-foreground placeholder:text-muted-foreground border-0"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="bg-white/[0.03] text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none border-0"
          >
            <option value="all">All Roles</option>
            {Array.from(new Set(agents.map((a) => a.role))).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button
            onClick={loadAgents}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-colors border-0"
            title="Refresh agents"
            aria-label="Refresh agents"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((agent) => (
          <div
            key={agent.agentId}
            className="p-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{agent.name}</span>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                      {agent.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {agent.provider} ({agent.version || 'detected'})
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  {agent.status === 'idle' ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Available
                    </span>
                  ) : agent.status === 'busy' ? (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Clock className="w-3.5 h-3.5" />
                      Busy ({agent.activeTasksCount} active)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <XCircle className="w-3.5 h-3.5" />
                      Offline
                    </span>
                  )}
                </div>
              </div>

              {/* Technical Attributes */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                <div>
                  <span className="text-foreground/70">CLI Provider:</span>{' '}
                  <span className="text-foreground font-medium">{agent.provider}</span>
                  {agent.isInstalled ? (
                    <span className="ml-1 text-emerald-400">✓ installed</span>
                  ) : (
                    <span className="ml-1 text-rose-400">✗ missing</span>
                  )}
                </div>
                <div>
                  <span className="text-foreground/70">Auth:</span>{' '}
                  <span className={agent.authStatus === 'authenticated' ? 'text-emerald-400' : 'text-muted-foreground'}>
                    {agent.authStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* MCP Capabilities */}
            <div className="space-y-1.5 pt-2 border-t-0">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-primary" />
                  Authorized MCP Servers ({agent.authorizedMCPServers.length})
                </span>
                <span className="flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  {agent.discoveredToolsCount} Tools
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {agent.authorizedMCPServers.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground italic">
                    No MCP servers assigned to this persona
                  </span>
                ) : (
                  agent.authorizedMCPServers.map((srv) => (
                    <span
                      key={srv}
                      className="text-[11px] text-foreground/80 bg-white/[0.04] px-2 py-0.5 rounded-md"
                    >
                      {srv}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
