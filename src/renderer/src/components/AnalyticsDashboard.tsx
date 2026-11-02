import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  DollarSign,
  Cpu,
  Clock,
  ShieldAlert,
  Download,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText
} from 'lucide-react';
import type {
  AnalyticsSummary,
  ProviderCostMetrics,
  AuditLogEntry,
  AuditSeverity
} from '../../../shared/analytics';

export const AnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'audit'>('overview');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [providerMetrics, setProviderMetrics] = useState<ProviderCostMetrics[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<AuditSeverity | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sum, metrics, logs] = await Promise.all([
        window.api.getAnalyticsSummary(),
        window.api.getProviderCostMetrics(),
        window.api.queryAuditLogs({ limit: 200 })
      ]);
      setSummary(sum);
      setProviderMetrics(metrics);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportAnalytics = async (format: 'json' | 'csv') => {
    const raw = await window.api.exportAnalytics({ format });
    const blob = new Blob([raw], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_export_${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAudit = async (format: 'json' | 'csv') => {
    const raw = await window.api.exportAuditLogs({ format });
    const blob = new Blob([raw], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (selectedSeverity !== 'all' && log.severity !== selectedSeverity) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.eventType.toLowerCase().includes(q) ||
        log.actor.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        (log.target && log.target.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <span>Advanced Analytics & Enterprise Telemetry</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Local token usage, model cost attribution, latency percentiles, and immutable enterprise audit logging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View switch */}
          <div className="flex bg-secondary p-0.5 rounded-md border border-border text-xs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1 font-medium rounded ${
                activeTab === 'overview' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Overview & Costs
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1 font-medium rounded ${
                activeTab === 'audit' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Security Audit Logs
            </button>
          </div>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-1.5 rounded border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Key Metric KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>Total Invocations</span>
                <Cpu className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold mt-2">{summary?.totalCalls || 0}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Across CLI, Workflows, Agents</div>
            </div>

            <div className="p-4 rounded-lg border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>Total Tokens (In / Out)</span>
                <FileText className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold mt-2">
                {((summary?.totalTokensIn || 0) + (summary?.totalTokensOut || 0)).toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {(summary?.totalTokensIn || 0).toLocaleString()} In / {(summary?.totalTokensOut || 0).toLocaleString()} Out
              </div>
            </div>

            <div className="p-4 rounded-lg border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>Total Estimated Cost</span>
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold mt-2">${(summary?.totalCostUsd || 0).toFixed(4)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Local models (Ollama) = $0.00</div>
            </div>

            <div className="p-4 rounded-lg border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>Latency (Avg / p95)</span>
                <Clock className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold mt-2">
                {summary?.avgDurationMs || 0} ms
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                p50: {summary?.p50DurationMs || 0}ms | p95: {summary?.p95DurationMs || 0}ms
              </div>
            </div>
          </div>

          {/* Provider & Model Comparison Table */}
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-secondary/30">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                <span>Model & Provider Breakdown</span>
              </h2>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportAnalytics('csv')}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-border rounded hover:bg-secondary"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => handleExportAnalytics('json')}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-border rounded hover:bg-secondary"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>JSON</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/50 text-muted-foreground uppercase font-mono text-[10px] border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5">Provider</th>
                    <th className="px-4 py-2.5">Model</th>
                    <th className="px-4 py-2.5 text-right">Invocations</th>
                    <th className="px-4 py-2.5 text-right">Tokens In</th>
                    <th className="px-4 py-2.5 text-right">Tokens Out</th>
                    <th className="px-4 py-2.5 text-right">Avg Latency</th>
                    <th className="px-4 py-2.5 text-right">Error Rate</th>
                    <th className="px-4 py-2.5 text-right">Estimated Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {providerMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground font-sans">
                        No telemetry events recorded yet. Run a CLI session, skill, or workflow to capture data.
                      </td>
                    </tr>
                  ) : (
                    providerMetrics.map((m, idx) => (
                      <tr key={idx} className="hover:bg-secondary/20">
                        <td className="px-4 py-2.5 font-semibold text-foreground uppercase">{m.provider}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{m.model}</td>
                        <td className="px-4 py-2.5 text-right">{m.totalCalls}</td>
                        <td className="px-4 py-2.5 text-right">{m.tokensIn.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right">{m.tokensOut.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right">{m.avgDurationMs}ms</td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={
                              m.errorRate > 0.05
                                ? 'text-destructive font-bold'
                                : 'text-emerald-500'
                            }
                          >
                            {(m.errorRate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-foreground">
                          ${m.totalCostUsd.toFixed(4)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Security Audit Log View */
        <div className="border border-border rounded-lg bg-card overflow-hidden space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter logs by event, actor, or action..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded w-72 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-1 text-xs">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                {(['all', 'info', 'warning', 'error', 'critical'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSelectedSeverity(sev)}
                    className={`px-2 py-1 rounded capitalize text-[11px] ${
                      selectedSeverity === sev
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'border border-border hover:bg-secondary'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportAudit('csv')}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-border rounded hover:bg-secondary"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => handleExportAudit('json')}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-border rounded hover:bg-secondary"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-border rounded">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/50 text-muted-foreground uppercase font-mono text-[10px] border-b border-border">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-[11px]">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground font-sans">
                      No audit events match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-secondary/20">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                            log.severity === 'critical'
                              ? 'bg-destructive/20 text-destructive border border-destructive/40'
                              : log.severity === 'error'
                              ? 'bg-rose-500/20 text-rose-500'
                              : log.severity === 'warning'
                              ? 'bg-amber-500/20 text-amber-500'
                              : 'bg-emerald-500/10 text-emerald-500'
                          }`}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-foreground">{log.eventType}</td>
                      <td className="px-3 py-2 text-muted-foreground">{log.actor}</td>
                      <td className="px-3 py-2 text-foreground">{log.action}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[150px]">
                        {log.target || '—'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground font-sans text-[11px] truncate max-w-[250px]">
                        {JSON.stringify(log.details)}
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
