import React, { useState, useEffect } from 'react';
import {
  GitCommit,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCw,
  Search,
  Layers,
  Terminal,
  Server,
  ShieldCheck,
  FolderGit2
} from 'lucide-react';
import type { TaskExecutionTrace } from '../../../shared/agents';

const LAYER_ICONS: Record<string, React.ReactNode> = {
  worktree: <FolderGit2 className="w-3.5 h-3.5 text-blue-400" />,
  cli: <Terminal className="w-3.5 h-3.5 text-emerald-400" />,
  mcp_gateway: <Server className="w-3.5 h-3.5 text-purple-400" />,
  mcp_tool: <Server className="w-3.5 h-3.5 text-amber-400" />,
  reviewer: <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />,
  approval: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
};

export const TaskTracingView: React.FC = () => {
  const [traces, setTraces] = useState<TaskExecutionTrace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TaskExecutionTrace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadTraces = async () => {
    setIsLoading(true);
    try {
      const list = await window.api.listTaskTraces();
      setTraces(list || []);
      if (list && list.length > 0 && !selectedTrace) {
        setSelectedTrace(list[0]);
      }
    } catch (err) {
      console.error('Failed to load task traces:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTraces();

    // Listen to live trace updates
    let unsubscribe: (() => void) | undefined;
    if (window.api.onTaskTraceUpdate) {
      unsubscribe = window.api.onTaskTraceUpdate((updatedTrace) => {
        setTraces((prev) => {
          const idx = prev.findIndex((t) => t.taskId === updatedTrace.taskId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = updatedTrace;
            return next;
          }
          return [updatedTrace, ...prev];
        });

        setSelectedTrace((curr) => {
          if (!curr || curr.taskId === updatedTrace.taskId) {
            return updatedTrace;
          }
          return curr;
        });
      });
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  const filtered = traces.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.taskId.toLowerCase().includes(q) ||
        t.traceId.toLowerCase().includes(q) ||
        t.orchestrationId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 text-foreground">
      {/* Top Search & Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search traces by task ID or trace ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.03] rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:bg-white/[0.06] text-foreground placeholder:text-muted-foreground border-0"
          />
        </div>

        <button
          onClick={loadTraces}
          disabled={isLoading}
          className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-colors border-0"
          title="Refresh traces"
          aria-label="Refresh traces"
        >
          <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Split Layout: Left list of traces, Right visual trace tree */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Trace List */}
        <div className="lg:col-span-5 space-y-2">
          <div className="text-xs text-muted-foreground font-medium px-1 flex items-center justify-between">
            <span>Execution Traces ({filtered.length})</span>
            <span className="text-[11px] text-muted-foreground">Most recent</span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                No task execution traces found yet.
              </div>
            ) : (
              filtered.map((trace) => {
                const isSelected = selectedTrace?.taskId === trace.taskId;
                return (
                  <button
                    key={trace.taskId}
                    onClick={() => setSelectedTrace(trace)}
                    className={`w-full text-left p-3.5 rounded-xl transition-all border-0 ${
                      isSelected
                        ? 'bg-white/[0.08] text-foreground shadow-xs'
                        : 'bg-white/[0.02] hover:bg-white/[0.05] text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GitCommit className="w-3.5 h-3.5 text-primary" />
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {trace.taskId}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        {trace.status === 'completed' ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Completed
                          </span>
                        ) : trace.status === 'running' ? (
                          <span className="text-amber-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 animate-spin" />
                            Running
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            {trace.status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                      <span className="font-mono">{trace.spans?.length || 0} spans</span>
                      <span>{trace.durationMs ? `${trace.durationMs}ms` : '—'}</span>
                      <span>{new Date(trace.startedAt).toLocaleTimeString()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Trace Details & Visual Timeline */}
        <div className="lg:col-span-7 space-y-4">
          {selectedTrace ? (
            <div className="p-6 rounded-2xl bg-white/[0.03] space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      Task: {selectedTrace.taskId}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      (trace: {selectedTrace.traceId.slice(0, 16)}...)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Orchestration: {selectedTrace.orchestrationId}
                  </p>
                </div>

                <div className="text-right sm:text-right">
                  <div className="text-xs font-medium text-foreground">
                    Duration: {selectedTrace.durationMs ? `${selectedTrace.durationMs}ms` : 'In progress'}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Started: {new Date(selectedTrace.startedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {/* Visual Span Flow */}
              <div className="space-y-3">
                <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-primary" />
                  <span>Distributed Execution Spans</span>
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/[0.06]">
                  {selectedTrace.spans.map((span) => (
                    <div key={span.id} className="relative space-y-1">
                      {/* Node bullet */}
                      <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-background flex items-center justify-center">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            span.status === 'completed'
                              ? 'bg-emerald-400'
                              : span.status === 'running'
                              ? 'bg-amber-400 animate-pulse'
                              : 'bg-rose-400'
                          }`}
                        />
                      </div>

                      {/* Content */}
                      <div className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {LAYER_ICONS[span.layer] || <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                            <span className="text-xs font-medium text-foreground">
                              {span.name}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {span.layer}
                            </span>
                          </div>

                          <div className="text-[11px] text-muted-foreground font-mono">
                            {span.durationMs ? `${span.durationMs}ms` : 'active'}
                          </div>
                        </div>

                        {/* Metadata attributes if present */}
                        {span.metadata && Object.keys(span.metadata).length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-muted-foreground">
                            {Object.entries(span.metadata).map(([k, v]) => (
                              <span key={k} className="bg-white/[0.03] px-2 py-0.5 rounded font-mono">
                                <span className="text-foreground/70">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                              </span>
                            ))}
                          </div>
                        )}

                        {span.errorMessage && (
                          <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-md font-mono">
                            {span.errorMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground text-xs rounded-2xl bg-white/[0.02]">
              Select a task trace on the left to inspect detailed span breakdown.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
