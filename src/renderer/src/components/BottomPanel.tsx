import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  AlertCircle,
  ListFilter,
  Activity,
  GitBranch,
  Trash2,
  X,
  Cpu,
  Copy,
  Check,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { Badge } from './ui/Badge';
import { IconButton } from './ui/IconButton';

export const BottomPanel: React.FC = () => {
  const {
    isBottomPanelOpen,
    setBottomPanelOpen,
    bottomPanelHeight,
    setBottomPanelHeight,
    bottomPanelTab,
    setBottomPanelTab,
    logs,
    clearLogs,
    metrics,
    terminalSessions,
    activeTerminalId,
    streamOutput,
    clearStreamOutput,
    gitStatus
  } = useWorkspaceStore();

  const [isResizing, setIsResizing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const prevHeightRef = useRef<number>(bottomPanelHeight);
  const [logLevelFilter, setLogLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [isCopied, setIsCopied] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  const activeTerminal = terminalSessions.find((t) => t.id === activeTerminalId);

  // Auto-scroll terminal output to bottom
  useEffect(() => {
    if (bottomPanelTab === 'terminal') {
      terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamOutput, bottomPanelTab]);

  if (!isBottomPanelOpen) return null;

  const toggleMaximize = () => {
    if (isMaximized) {
      setBottomPanelHeight(prevHeightRef.current || 240);
      setIsMaximized(false);
    } else {
      prevHeightRef.current = bottomPanelHeight;
      const targetHeight = Math.min(600, Math.max(450, window.innerHeight - 100));
      setBottomPanelHeight(targetHeight);
      setIsMaximized(true);
    }
  };

  // Resize drag handle
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newHeight = window.innerHeight - moveEvent.clientY;
      setIsMaximized(false);
      setBottomPanelHeight(newHeight);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const filteredLogs = logs.filter((l) => {
    if (logLevelFilter === 'all') return true;
    return l.level === logLevelFilter;
  });

  const problemLogs = logs.filter((l) => l.level === 'error' || l.level === 'warn');

  const handleCopyOutput = () => {
    navigator.clipboard.writeText(streamOutput);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  return (
    <div
      style={{ height: `${bottomPanelHeight}px` }}
      className="border-t border-white/[0.07] bg-[#121418]/95 backdrop-blur-xl flex flex-col font-mono text-xs select-none relative z-20 flex-shrink-0"
    >
      {/* Invisible global overlay during resize to capture mouse movements smoothly */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-row-resize select-none pointer-events-auto" />
      )}

      {/* 1. Resize Drag Handle */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={toggleMaximize}
        title="Arrastar para aumentar/diminuir janela do terminal &bull; Duplo clique para maximizar"
        className="w-full h-1 cursor-row-resize hover:bg-white/20 active:bg-accent/40 transition-colors z-30 select-none flex-shrink-0"
      />

      {/* 2. Top Header with Panel Tabs */}
      <div className="h-8 border-b border-white/[0.06] bg-transparent px-2.5 flex items-center justify-between text-[11px] flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setBottomPanelTab('terminal')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer ${
              bottomPanelTab === 'terminal'
                ? 'bg-white/[0.08] text-white font-medium'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-accent" />
            <span>Terminal Output</span>
            {activeTerminal && (
              <span className="text-[9px] text-neutral-500">({activeTerminal.title})</span>
            )}
          </button>

          <button
            onClick={() => setBottomPanelTab('problems')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer ${
              bottomPanelTab === 'problems'
                ? 'bg-white/[0.08] text-white font-medium'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Problems</span>
            {problemLogs.length > 0 && (
              <span className="text-[10px] font-mono text-rose-400 font-semibold">
                {problemLogs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setBottomPanelTab('logs')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer ${
              bottomPanelTab === 'logs'
                ? 'bg-white/[0.08] text-white font-medium'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5 text-accent" />
            <span>System Logs</span>
            <span className="text-[9px] text-neutral-500">({logs.length})</span>
          </button>

          <button
            onClick={() => setBottomPanelTab('debug')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer ${
              bottomPanelTab === 'debug'
                ? 'bg-white/[0.08] text-white font-medium'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-accent" />
            <span>Debug Console</span>
          </button>

          <button
            onClick={() => setBottomPanelTab('git')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer ${
              bottomPanelTab === 'git'
                ? 'bg-white/[0.08] text-white font-medium'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 text-accent" />
            <span>Git Activity</span>
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5">
          {bottomPanelTab === 'terminal' && (
            <>
              <IconButton
                icon={isCopied ? Check : Copy}
                onClick={handleCopyOutput}
                tooltip={isCopied ? 'Copied!' : 'Copy Terminal Output'}
                size="sm"
                className={isCopied ? 'text-accent' : 'text-foreground-muted hover:text-foreground'}
              />
              <IconButton
                icon={Trash2}
                onClick={clearStreamOutput}
                tooltip="Clear Terminal Output"
                size="sm"
                className="text-foreground-muted hover:text-foreground"
              />
            </>
          )}

          {(bottomPanelTab === 'problems' || bottomPanelTab === 'logs') && (
            <>
              {bottomPanelTab === 'logs' && (
                <div className="flex items-center gap-1 mr-1">
                  {(['all', 'info', 'warn', 'error'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setLogLevelFilter(lvl)}
                      className={`px-2 py-0.5 rounded-[4px] text-[10px] capitalize transition-colors cursor-pointer ${
                        logLevelFilter === lvl
                          ? 'bg-white/[0.08] text-white font-medium'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              )}
              <IconButton
                icon={Trash2}
                onClick={clearLogs}
                tooltip="Clear Problems & Logs"
                size="sm"
                className="text-foreground-muted hover:text-foreground"
              />
            </>
          )}

          <IconButton
            icon={isMaximized ? Minimize2 : Maximize2}
            onClick={toggleMaximize}
            tooltip={isMaximized ? 'Restaurar Altura da Janela' : 'Maximizar Janela do Terminal'}
            size="sm"
            className="text-foreground-muted hover:text-foreground"
          />

          <IconButton
            icon={X}
            onClick={() => setBottomPanelOpen(false)}
            tooltip="Close Bottom Panel"
            size="sm"
            className="text-foreground-muted hover:text-foreground"
          />
        </div>
      </div>

      {/* 3. Panel Body */}
      <div className="flex-1 overflow-auto bg-background p-2.5 text-[11px] select-text">
        {/* Terminal Output */}
        {bottomPanelTab === 'terminal' && (
          <div className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
            {streamOutput ? (
              streamOutput
            ) : (
              <span className="italic text-foreground-muted">
                Terminal output is empty. Run a command in the terminal tab to view stdout/stderr stream.
              </span>
            )}
            <div ref={terminalBottomRef} />
          </div>
        )}

        {/* Problems & Errors */}
        {bottomPanelTab === 'problems' && (
          <div className="space-y-1">
            {problemLogs.length === 0 ? (
              <div className="p-4 text-center text-foreground-muted italic">
                No problems or warnings detected. Workspace is healthy.
              </div>
            ) : (
              problemLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded-[4px] flex items-start gap-2 text-xs font-mono select-text transition-colors ${
                    log.level === 'error'
                      ? 'bg-rose-500/10 text-rose-300'
                      : 'bg-amber-500/10 text-amber-300'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[10px] text-neutral-500 mr-2">[{log.timestamp}]</span>
                    <span>{log.message}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* System Logs */}
        {bottomPanelTab === 'logs' && (
          <div className="space-y-1">
            {filteredLogs.length === 0 ? (
              <div className="p-4 text-center text-foreground-muted italic">
                No system logs match current filter.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-foreground-muted/60 text-[10px] flex-shrink-0 select-none">
                    [{log.timestamp}]
                  </span>
                  <span
                    className={`flex-1 break-all ${
                      log.level === 'error'
                        ? 'text-rose-400 font-medium'
                        : log.level === 'warn'
                        ? 'text-amber-400'
                        : 'text-foreground-secondary'
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Debug Console */}
        {bottomPanelTab === 'debug' && (
          <div className="space-y-3 font-mono text-[11px]">
            <div className="p-3 bg-surface-elevated/70 border border-border rounded-xl space-y-2.5 shadow-subtle">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-accent" />
                <span>Process Runtime Telemetry</span>
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                <div className="p-2.5 bg-surface rounded-lg border border-border/80">
                  <div className="text-foreground-muted">Main Process RSS</div>
                  <div className="text-foreground font-semibold text-xs mt-0.5">
                    {metrics?.mainProcessMemoryMb || 128} MB
                  </div>
                </div>
                <div className="p-2.5 bg-surface rounded-lg border border-border/80">
                  <div className="text-foreground-muted">Renderer Heap</div>
                  <div className="text-foreground font-semibold text-xs mt-0.5">
                    {metrics?.totalAppMemoryMb || 256} MB
                  </div>
                </div>
                <div className="p-2.5 bg-surface rounded-lg border border-border/80">
                  <div className="text-foreground-muted">CPU Utilization</div>
                  <div className="text-foreground font-semibold text-xs mt-0.5">
                    {metrics?.cpuPercent || 0}%
                  </div>
                </div>
                <div className="p-2.5 bg-surface rounded-lg border border-border/80">
                  <div className="text-foreground-muted">Process Uptime</div>
                  <div className="text-foreground font-semibold text-xs mt-0.5">
                    {metrics?.uptimeSeconds || 0}s
                  </div>
                </div>
              </div>
            </div>

            <div className="text-foreground-muted text-[10px]">
              Tip: Press `Ctrl+Shift+I` to open Chromium DevTools for deep profiling and network inspection.
            </div>
          </div>
        )}

        {/* Git Activity */}
        {bottomPanelTab === 'git' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-border text-[11px]">
              <span className="text-foreground font-medium flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-accent" />
                <span>Active Branch: <span className="text-accent font-semibold">{gitStatus?.branch || 'master'}</span></span>
              </span>
              <Badge variant="neutral" size="sm">
                {gitStatus?.changedFiles.length || 0} modified
              </Badge>
            </div>
            {gitStatus?.diff ? (
              <div className="p-3 bg-surface border border-border rounded-xl font-mono text-[10px] select-text whitespace-pre leading-relaxed shadow-subtle">
                {gitStatus.diff}
              </div>
            ) : (
              <div className="p-6 text-center text-foreground-muted italic">
                No recent uncommitted Git activity in active workspace.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BottomPanel;
