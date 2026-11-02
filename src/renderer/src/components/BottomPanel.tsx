import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Trash2, Activity } from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';

export const BottomPanel: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { logs, clearLogs, metrics, setMetrics } = useWorkspaceStore();

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const m = await window.api.getSystemMetrics();
        setMetrics(m);
      } catch (err) {
        // Silently skip
      }
    };

    fetchMetrics();
    const timer = setInterval(fetchMetrics, 3000);
    return () => clearInterval(timer);
  }, [setMetrics]);

  return (
    <div
      className={`border-t border-border bg-card/90 flex flex-col transition-all duration-200 ${
        isExpanded ? 'h-36' : 'h-7'
      }`}
    >
      {/* Drawer Header */}
      <div className="h-7 px-3 flex items-center justify-between border-b border-border text-[11px] text-muted-foreground select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            <span>System Logs & Telemetry</span>
          </button>
          <span className="text-[10px] bg-secondary px-1.5 py-0.2 rounded font-mono">
            {logs.length} entries
          </span>
        </div>

        <div className="flex items-center gap-4">
          {metrics && (
            <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-primary" />
                <span>RSS: {metrics.mainProcessMemoryMb} MB</span>
              </span>
              <span>Heap: {metrics.totalAppMemoryMb} MB</span>
              <span>Uptime: {metrics.uptimeSeconds}s</span>
            </div>
          )}

          {isExpanded && (
            <button
              onClick={clearLogs}
              className="p-1 hover:text-foreground text-muted-foreground transition-colors"
              title="Clear logs"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Log Output Stream */}
      {isExpanded && (
        <div className="flex-1 overflow-auto p-2 font-mono text-[11px] space-y-1 select-text bg-background/50">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 leading-relaxed">
              <span className="text-muted-foreground/60 select-none text-[10px] flex-shrink-0">
                [{log.timestamp}]
              </span>
              <span
                className={`flex-1 break-all ${
                  log.level === 'error'
                    ? 'text-destructive font-medium'
                    : log.level === 'warn'
                    ? 'text-amber-500'
                    : 'text-foreground/90'
                }`}
              >
                {log.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
