import React, { useState, useEffect, useRef } from 'react';
import { Columns, X } from 'lucide-react';
import { useWorkspaceStore, TerminalSessionItem } from '../stores/workspace.store';

// Single Terminal Surface (Exact Photo 3 replica: pure prompt & stream, no extra headers)
interface TerminalSurfaceProps {
  session: TerminalSessionItem;
  isActive: boolean;
  onFocus: () => void;
  onCloseSplit?: () => void;
  isSplit?: boolean;
}

const TerminalSurface: React.FC<TerminalSurfaceProps> = ({
  session,
  isActive,
  onFocus,
  onCloseSplit,
  isSplit
}) => {
  const {
    project,
    customPaths,
    updateTerminalSession,
    clearTerminalOutput,
    addLog
  } = useWorkspaceStore();

  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom whenever output or input updates
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.streamOutput, session.status]);

  // Focus input when clicking anywhere in this terminal surface
  const handlePaneClick = () => {
    onFocus();
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      inputRef.current?.focus();
    }
  };

  // Compute prompt prefix (PowerShell: PS C:\...\Orc> )
  const getPromptPrefix = () => {
    const dir = session.workingDirectory || project?.path || 'C:\\Users\\gonca\\Documents\\coding\\Projects\\Orc';
    if (session.provider === 'cmd') {
      return `${dir}>`;
    }
    if (session.provider === 'bash') {
      const folder = dir.split(/[/\\]/).pop() || '~';
      return `${folder}$ `;
    }
    return `PS ${dir}>`;
  };

  const handleExecute = async () => {
    const cmd = currentInput.trim();
    if (!cmd || session.status === 'running') return;

    // Handle clear / cls
    if (cmd.toLowerCase() === 'clear' || cmd.toLowerCase() === 'cls') {
      clearTerminalOutput(session.id);
      setCurrentInput('');
      setCommandHistory((prev) => [...prev, cmd]);
      setHistoryIndex(-1);
      return;
    }

    const prefix = getPromptPrefix();
    const commandLine = `${prefix} ${currentInput}\n`;

    // Save to history & clear input
    setCommandHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setCurrentInput('');

    try {
      updateTerminalSession(session.id, {
        status: 'running',
        streamOutput: (session.streamOutput || '') + commandLine
      });

      const res = await window.api.executeCLIPrompt({
        provider: session.provider,
        prompt: cmd,
        workingDirectory: session.workingDirectory || project?.path || '',
        customPath: customPaths[session.provider] || undefined
      });

      updateTerminalSession(session.id, {
        cliSessionId: res.sessionId
      });
    } catch (err: any) {
      updateTerminalSession(session.id, {
        status: 'failed',
        streamOutput:
          (session.streamOutput || '') +
          `\n[Error] ${err.message}\n`
      });
      addLog(`Execution error: ${err.message}`, 'error');
    }
  };

  const handleCancel = async () => {
    if (!session.cliSessionId && session.status !== 'running') return;
    try {
      if (session.cliSessionId) {
        await window.api.cancelCLISession({ sessionId: session.cliSessionId });
      }
      updateTerminalSession(session.id, {
        status: 'idle',
        cliSessionId: undefined,
        streamOutput: (session.streamOutput || '') + `^C\n`
      });
      addLog('Process interrupted (^C)', 'warn');
    } catch (err: any) {
      addLog(`Failed to cancel: ${err.message}`, 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      handleCancel();
      return;
    }

    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      clearTerminalOutput(session.id);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIdx =
        historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setCurrentInput(commandHistory[nextIdx]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= commandHistory.length) {
        setHistoryIndex(-1);
        setCurrentInput('');
      } else {
        setHistoryIndex(nextIdx);
        setCurrentInput(commandHistory[nextIdx]);
      }
      return;
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handlePaneClick}
      className={`relative h-full flex flex-col bg-[#0d0e12] font-mono select-none overflow-hidden cursor-text ${
        isSplit ? 'border-r border-white/[0.08] last:border-r-0' : ''
      }`}
    >
      {/* If split, show a subtle close button in top right */}
      {isSplit && onCloseSplit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCloseSplit();
          }}
          className="absolute top-2 right-2 z-20 px-1.5 py-0.5 rounded text-[10px] text-[#717784] hover:text-white bg-white/[0.04] hover:bg-white/[0.1] transition-colors"
          title="Close split pane"
        >
          ✕
        </button>
      )}

      {/* Main Console Canvas (Matching Photo 3) */}
      <div className="flex-1 overflow-auto p-4 text-[#F3F4F6] leading-relaxed select-text font-mono text-[13px] tracking-wide">
        {/* Prior Output Stream */}
        {session.streamOutput ? (
          <div className="whitespace-pre-wrap font-mono text-[#D1D5DB] mb-1">
            {session.streamOutput
              .replace(/^Windows PowerShell[\s\S]*?Copyright[^\n]*\n+/i, '')
              .replace(/^Microsoft Windows \[Version[\s\S]*?Corporation[^\n]*\n+/i, '')
              .replace(/^PS [^\n]*>\s*\n+/i, '')
              .trimStart()}
          </div>
        ) : null}

        {/* Current Command Line with Bold Prompt and Block Caret */}
        <div className="flex items-baseline flex-wrap pt-0.5">
          <span className="font-bold text-white whitespace-nowrap select-none mr-2 font-mono">
            {getPromptPrefix()}
          </span>

          <div className="relative inline-flex items-center flex-1 min-w-[200px]">
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={session.status === 'running'}
              className="w-full bg-transparent border-none outline-none text-[#F3F4F6] font-mono font-medium text-[13px] p-0 m-0 caret-[#FFFFFF] selection:bg-accent/40"
              spellCheck={false}
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>

        {/* Subtle Running Indicator */}
        {session.status === 'running' && (
          <div className="pt-2 text-[11px] text-[#717784] font-mono flex items-center gap-2 select-none">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Process executing... (Ctrl+C to abort)</span>
          </div>
        )}

        <div ref={outputEndRef} />
      </div>
    </div>
  );
};

// Main TerminalWorkspace Component (Direct replica of Photo 3)
export const TerminalWorkspace: React.FC = () => {
  const {
    project,
    terminalSessions,
    activeTerminalId,
    setActiveTerminalId,
    createTerminalSession,
    splitTerminalId,
    setSplitTerminalId,
    handleCLIStreamEvent
  } = useWorkspaceStore();

  const [isDragOverRight, setIsDragOverRight] = useState(false);

  // Listen to IPC stream events globally
  useEffect(() => {
    const unsub = window.api.onCLIStreamEvent((event) => {
      handleCLIStreamEvent(event);
    });
    return () => unsub();
  }, [handleCLIStreamEvent]);

  // Ensure default PowerShell terminal exists for active project/worktree
  useEffect(() => {
    if (terminalSessions.length === 0) {
      const newId = createTerminalSession('powershell');
      if (project) {
        useWorkspaceStore.getState().updateTerminalSession(newId, {
          title: `C:\\Windows\\system32\\cmd.exe`,
          projectName: project.name,
          workingDirectory: project.path,
          branch: project.activeBranch || '',
          provider: 'powershell',
          streamOutput: ''
        });
      }
    } else {
      const state = useWorkspaceStore.getState();
      const hasTermTab = state.openTabs.some((t) => t.type === 'terminal');
      if (!hasTermTab && state.terminalSessions.length > 0) {
        const primary = state.terminalSessions[0];
        const tabId = `term:${primary.id}`;
        useWorkspaceStore.setState({
          openTabs: [
            ...state.openTabs,
            {
              id: tabId,
              type: 'terminal',
              title: primary.title || 'Terminal',
              terminalId: primary.id
            }
          ],
          activeTabId: tabId
        });
      }
    }
  }, [terminalSessions.length, project, createTerminalSession]);

  // Active session
  const primarySession =
    terminalSessions.find((s) => s.id === activeTerminalId) ||
    terminalSessions[0];

  // Secondary split session
  const secondarySession = splitTerminalId
    ? terminalSessions.find((s) => s.id === splitTerminalId)
    : null;

  // Drag and Drop to split terminals side by side
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // If dragging over the right 45% of the screen, show split drop indicator
    if (x > rect.width * 0.55) {
      setIsDragOverRight(true);
    } else {
      setIsDragOverRight(false);
    }
  };

  const handleDragLeave = () => {
    setIsDragOverRight(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverRight(false);

    const termId = e.dataTransfer.getData('application/orc-term-id');
    if (termId && termId !== primarySession?.id) {
      setSplitTerminalId(termId);
    }
  };

  if (!primarySession) {
    return <div className="h-full bg-[#0d0e12]" />;
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="h-full w-full bg-[#0d0e12] select-none overflow-hidden relative"
    >
      {/* Side-by-side terminal layout (if split) or single terminal (100%) */}
      {secondarySession ? (
        <div className="h-full w-full grid grid-cols-2 divide-x divide-white/[0.08]">
          <TerminalSurface
            session={primarySession}
            isActive={activeTerminalId === primarySession.id}
            onFocus={() => setActiveTerminalId(primarySession.id)}
            isSplit={true}
          />
          <TerminalSurface
            session={secondarySession}
            isActive={activeTerminalId === secondarySession.id}
            onFocus={() => setActiveTerminalId(secondarySession.id)}
            onCloseSplit={() => setSplitTerminalId(null)}
            isSplit={true}
          />
        </div>
      ) : (
        <TerminalSurface
          session={primarySession}
          isActive={true}
          onFocus={() => setActiveTerminalId(primarySession.id)}
          isSplit={false}
        />
      )}

      {/* Visual Drop Zone Indicator for Drag-to-Split */}
      {isDragOverRight && (
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-accent/15 border-2 border-dashed border-accent/60 pointer-events-none flex items-center justify-center z-30 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="px-3 py-1.5 rounded-lg bg-[#14161b] text-white font-sans text-xs shadow-xl border border-white/[0.1]">
            Drop to split side by side
          </div>
        </div>
      )}

      {/* Floating Split Controls in Top Right */}
      {terminalSessions.length > 1 && (
        <div className="absolute top-2.5 right-3 z-20 flex items-center gap-1.5 bg-[#14161b]/80 backdrop-blur-md px-2 py-1 rounded-md border border-white/[0.08] text-[11px] text-[#A4A8AF]">
          {secondarySession ? (
            <button
              onClick={() => setSplitTerminalId(null)}
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
              title="Close side-by-side split"
            >
              <X className="w-3 h-3 text-rose-400" />
              <span>Unsplit</span>
            </button>
          ) : (
            <button
              onClick={() => {
                const other = terminalSessions.find((s) => s.id !== primarySession.id);
                if (other) setSplitTerminalId(other.id);
              }}
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
              title="Split side by side with next terminal (or drag tab to right)"
            >
              <Columns className="w-3 h-3 text-[#ECEDEF]" />
              <span>Split 2</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
