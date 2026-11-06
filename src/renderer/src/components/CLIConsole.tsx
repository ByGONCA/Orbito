import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Square,
  Terminal,
  Cpu,
  History,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { CLIProvider, CLISessionRecord, CLISessionStatus } from '../../../shared/cli';

export const CLIConsole: React.FC = () => {
  const {
    project,
    activeProvider,
    setActiveProvider,
    cliStatuses,
    cliAuthStatuses,
    setCLIStatuses,
    customPaths,
    activeSessionId,
    setActiveSessionId,
    sessionStatus,
    setSessionStatus,
    streamOutput,
    appendStreamOutput,
    clearStreamOutput,
    sessionsHistory,
    setSessionsHistory,
    addLog
  } = useWorkspaceStore();

  const [prompt, setPrompt] = useState('');
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Auto-detect CLI statuses if null on mount
  useEffect(() => {
    if (!cliStatuses) {
      window.api?.detectCLIs?.({ customPaths }).then((res) => {
        if (res) setCLIStatuses(res);
      }).catch(() => {});
    }
  }, [cliStatuses, customPaths, setCLIStatuses]);

  // Subscribe to real-time IPC stream events
  useEffect(() => {
    const unsubscribe = window.api.onCLIStreamEvent((event) => {
      if (event.type === 'stdout' || event.type === 'stderr') {
        appendStreamOutput(event.content);
      } else if (event.type === 'status') {
        setSessionStatus(event.content as CLISessionStatus);
        addLog(`CLI Session ${event.sessionId} status: ${event.content}`, 'info');
      } else if (event.type === 'exit') {
        setSessionStatus(event.exitCode === 0 ? 'completed' : 'failed');
        setActiveSessionId(null);
        addLog(`CLI Session completed with exit code: ${event.exitCode}`, event.exitCode === 0 ? 'info' : 'warn');
        loadSessionsHistory();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [appendStreamOutput, setSessionStatus, setActiveSessionId, addLog]);

  // Load history on mount or project switch
  useEffect(() => {
    loadSessionsHistory();
  }, [project]);

  // Auto-scroll output console
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamOutput]);

  const loadSessionsHistory = async () => {
    if (!project) return;
    try {
      const history = await window.api.listCLISessions({ projectId: project.id });
      setSessionsHistory(history);
    } catch (err: any) {
      addLog(`Failed to load sessions: ${err.message}`, 'error');
    }
  };

  const handleExecute = async () => {
    if (!prompt.trim() || !project) return;

    clearStreamOutput();
    setSessionStatus('running');
    addLog(`Dispatching prompt to ${activeProvider.toUpperCase()} CLI...`, 'info');

    try {
      const res = await window.api.executeCLIPrompt({
        provider: activeProvider,
        prompt: prompt.trim(),
        workingDirectory: project.path,
        projectId: project.id,
        customPath: customPaths[activeProvider] || undefined,
        timeoutSeconds: 180
      });

      setActiveSessionId(res.sessionId);
      loadSessionsHistory();
    } catch (err: any) {
      setSessionStatus('failed');
      appendStreamOutput(`\n[Execution Error] ${err.message}\n`);
      addLog(`Execution failed: ${err.message}`, 'error');
    }
  };

  const handleCancel = async () => {
    if (!activeSessionId) return;
    try {
      addLog(`Sending cancellation signal to session ${activeSessionId}...`, 'info');
      await window.api.cancelCLISession({ sessionId: activeSessionId });
      setSessionStatus('cancelled');
      setActiveSessionId(null);
    } catch (err: any) {
      addLog(`Cancel error: ${err.message}`, 'error');
    }
  };

  const handleSelectHistorySession = async (session: CLISessionRecord) => {
    try {
      const messages = await window.api.getSessionMessages({ sessionId: session.id });
      clearStreamOutput();
      const output = messages
        .map((m) => `[${m.role.toUpperCase()}] ${m.content}`)
        .join('\n');
      appendStreamOutput(output);
      setSessionStatus(session.status);
      addLog(`Loaded past session: ${session.id}`, 'info');
    } catch (err: any) {
      addLog(`Failed to load session messages: ${err.message}`, 'error');
    }
  };

  return (
    <div className="flex flex-col h-full bg-background select-none overflow-hidden">
      {/* Top Console Bar */}
      <div className="h-10 border-b border-border bg-card/60 px-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">AI Execution Console</span>

          {/* Provider Selector Pill */}
          <div className="flex items-center gap-1 bg-secondary rounded p-0.5 border border-border ml-2">
            {(['claude', 'codex', 'gemini', 'ollama'] as CLIProvider[]).map((p) => (
              <button
                key={p}
                onClick={() => setActiveProvider(p)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  activeProvider === p
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10px] uppercase font-semibold border ${
              sessionStatus === 'running'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse'
                : sessionStatus === 'completed'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                : sessionStatus === 'failed'
                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                : 'bg-secondary text-muted-foreground border-border'
            }`}
          >
            <span>{sessionStatus}</span>
          </span>
        </div>
      </div>

      {/* Main Console Split (Stream Terminal + History Drawer) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Real-time Streaming Output Display */}
        <div className="flex-1 flex flex-col bg-background font-mono text-xs select-text overflow-hidden">
          <div className="flex-1 overflow-auto p-4 space-y-1">
            {streamOutput ? (
              <pre className="whitespace-pre-wrap leading-relaxed text-foreground/90 font-mono text-xs break-all">
                {streamOutput}
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic select-none">
                <Terminal className="w-8 h-8 opacity-20 mb-2" />
                <p>Run a prompt using {activeProvider.toUpperCase()} CLI.</p>
                <p className="text-[11px]">Real-time standard output and errors will stream here.</p>
              </div>
            )}
            <div ref={outputEndRef} />
          </div>

          {/* Active Provider Guidance Alert */}
          {cliStatuses?.[activeProvider] && !cliStatuses[activeProvider]?.isInstalled && (
            <div className="border-t border-amber-500/20 bg-amber-500/5 px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-300">
              <div className="flex items-center gap-1.5 truncate">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="truncate">{activeProvider.toUpperCase()} CLI is not found on PATH. Configure executable path in Providers or install globally.</span>
              </div>
            </div>
          )}
          {cliStatuses?.[activeProvider]?.isInstalled && cliAuthStatuses?.[activeProvider]?.state === 'authentication_required' && (
            <div className="border-t border-amber-500/20 bg-amber-500/5 px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-300">
              <div className="flex items-center gap-1.5 truncate">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="truncate">{activeProvider.toUpperCase()} CLI requires login: {cliAuthStatuses[activeProvider]?.details || 'Set API key in environment'}</span>
              </div>
            </div>
          )}

          {/* Interactive Prompt Input Bar */}
          <div className="border-t border-border p-3 bg-card/40 flex items-center gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && sessionStatus !== 'running') {
                  handleExecute();
                }
              }}
              disabled={sessionStatus === 'running'}
              placeholder={
                project
                  ? `Ask ${activeProvider.toUpperCase()} (e.g. "Explain this codebase structure")...`
                  : 'Open a project to execute CLI prompts...'
              }
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-xs font-sans text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />

            {sessionStatus === 'running' ? (
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-destructive text-destructive-foreground font-medium rounded-lg text-xs hover:bg-destructive/90 transition-colors shadow-xs"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={handleExecute}
                disabled={!prompt.trim() || !project}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground font-medium rounded-lg text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute</span>
              </button>
            )}
          </div>
        </div>

        {/* Sessions History Drawer (220px) */}
        <div className="w-56 border-l border-border bg-card/30 flex flex-col select-none">
          <div className="h-8 border-b border-border flex items-center px-3 gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </div>

          <div className="flex-1 overflow-auto p-2 space-y-1.5">
            {sessionsHistory.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic text-center py-4">
                No past sessions.
              </p>
            ) : (
              sessionsHistory.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleSelectHistorySession(s)}
                  className="p-2 rounded border border-border bg-card hover:bg-secondary/60 cursor-pointer text-left space-y-1 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase font-bold text-primary">
                      {s.provider}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-foreground truncate">{s.prompt}</p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                    <span className="capitalize">{s.status}</span>
                    {s.durationMs && <span>{(s.durationMs / 1000).toFixed(1)}s</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
