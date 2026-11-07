import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal as TerminalIcon,
  Plus,
  X,
  ChevronDown,
  MoreHorizontal,
  Columns,
  Rows,
  Trash2,
  Check,
  SplitSquareHorizontal,
  SplitSquareVertical
} from 'lucide-react';
import { useWorkspaceStore, TerminalSessionItem } from '../stores/workspace.store';
import type { CLIProvider } from '../../../shared/cli';
import { OfficialLogoRenderer } from './OfficialLogos';

// Terminal Pane Header (matching screenshot: tab items with >_ name [x], +, >_ Command dropdown, ...)
interface TerminalPaneHeaderProps {
  sessions: TerminalSessionItem[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: (provider?: CLIProvider) => void;
  onCloseSession: (id: string) => void;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onCloseSplit?: () => void;
  isSplit: boolean;
  onClearOutput: () => void;
}

const TerminalPaneHeader: React.FC<TerminalPaneHeaderProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onCloseSession,
  onSplitHorizontal,
  onSplitVertical,
  onCloseSplit,
  isSplit,
  onClearOutput
}) => {
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => {
      setIsCommandMenuOpen(false);
      setIsMoreMenuOpen(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="h-9 bg-[#0e1015] border-b border-white/[0.08] flex items-center justify-between px-2.5 select-none z-10 flex-shrink-0"
    >
      {/* Left Tabs Strip - Styled with the exact top-tab visual design */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0 pr-2 h-full">
        {sessions.map((sess) => {
          const isActive = sess.id === activeSessionId;
          const displayTitle = sess.title || (sess.provider === 'cmd' ? 'C:\\WINDOWS\\system32\\cmd.exe' : 'PowerShell 1');

          return (
            <div
              key={sess.id}
              onClick={() => onSelectSession(sess.id)}
              className={`group relative flex items-center gap-2 px-3 h-7 rounded-md text-xs cursor-pointer transition-all max-w-[210px] flex-shrink-0 ${
                isActive
                  ? 'bg-[#1e2129] text-white font-medium shadow-xs'
                  : 'bg-transparent hover:bg-white/[0.05] text-[#A4A8AF] hover:text-[#ECEDEF]'
              }`}
              title={sess.workingDirectory || displayTitle}
            >
              {/* Dot & Official Logo matching top tabs */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    sess.status === 'running'
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-emerald-400'
                  }`}
                />
                <OfficialLogoRenderer
                  provider={sess.provider}
                  title={displayTitle}
                  className="w-3.5 h-3.5 flex-shrink-0"
                />
              </div>

              <span className="truncate text-[11px] font-mono">{displayTitle}</span>

              {sessions.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseSession(sess.id);
                  }}
                  className="p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-white/20 text-[#747982] hover:text-white transition-opacity cursor-pointer ml-0.5"
                  title="Close tab"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}

        {/* Plus button to add tab in this pane */}
        <button
          type="button"
          onClick={() => onNewSession('powershell')}
          className="p-1 hover:bg-white/[0.08] rounded-md text-[#A4A8AF] hover:text-[#ECEDEF] flex-shrink-0 transition-colors cursor-pointer"
          title="New Terminal Tab"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right Controls: Split actions + >_ Command dropdown + ... Menu */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Split Horizontal */}
        <button
          type="button"
          onClick={onSplitHorizontal}
          className="p-1.5 rounded hover:bg-white/[0.08] text-[#717784] hover:text-white transition-colors cursor-pointer"
          title="Split Down (Horizontal)"
        >
          <SplitSquareHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* Split Vertical */}
        <button
          type="button"
          onClick={onSplitVertical}
          className="p-1.5 rounded hover:bg-white/[0.08] text-[#717784] hover:text-white transition-colors cursor-pointer"
          title="Split Right (Vertical)"
        >
          <SplitSquareVertical className="w-3.5 h-3.5" />
        </button>

        {/* Unsplit / Close Split (if in split mode) */}
        {isSplit && onCloseSplit && (
          <button
            type="button"
            onClick={onCloseSplit}
            className="p-1.5 rounded hover:bg-white/[0.08] text-[#717784] hover:text-rose-400 transition-colors cursor-pointer"
            title="Close Split View"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {/* Command / Shell Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsCommandMenuOpen(!isCommandMenuOpen);
              setIsMoreMenuOpen(false);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono text-[#A4A8AF] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Select shell or run command"
          >
            <span className="text-[10px] text-[#717784] font-bold">&gt;_</span>
            <span>Command</span>
            <ChevronDown className="w-3 h-3 text-[#717784]" />
          </button>

          {isCommandMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 w-48 bg-[#14161b] border border-white/[0.1] rounded-lg shadow-2xl py-1 text-xs z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-2.5 py-1 text-[10px] text-[#717784] uppercase font-mono tracking-wider font-semibold">
                Shells
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCommandMenuOpen(false);
                  onNewSession('powershell');
                }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-white/[0.06] flex items-center justify-between text-[#ECEDEF] transition-colors cursor-pointer"
              >
                <span>PowerShell</span>
                {activeSession?.provider === 'powershell' && <Check className="w-3 h-3 text-emerald-400" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCommandMenuOpen(false);
                  onNewSession('cmd');
                }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-white/[0.06] flex items-center justify-between text-[#ECEDEF] transition-colors cursor-pointer"
              >
                <span>Command Prompt (cmd)</span>
                {activeSession?.provider === 'cmd' && <Check className="w-3 h-3 text-emerald-400" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCommandMenuOpen(false);
                  onNewSession('bash');
                }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-white/[0.06] flex items-center justify-between text-[#ECEDEF] transition-colors cursor-pointer"
              >
                <span>Git Bash / WSL</span>
                {activeSession?.provider === 'bash' && <Check className="w-3 h-3 text-emerald-400" />}
              </button>
            </div>
          )}
        </div>

        {/* ... More Options Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMoreMenuOpen(!isMoreMenuOpen);
              setIsCommandMenuOpen(false);
            }}
            className="p-1 rounded text-[#717784] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Terminal options"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {isMoreMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 w-44 bg-[#14161b] border border-white/[0.1] rounded-lg shadow-2xl py-1 text-xs z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onSplitHorizontal();
                }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-white/[0.06] flex items-center gap-2 text-[#ECEDEF] transition-colors cursor-pointer"
              >
                <Rows className="w-3.5 h-3.5 text-[#A4A8AF]" />
                <span>Split Down (Horizontal)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onSplitVertical();
                }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-white/[0.06] flex items-center gap-2 text-[#ECEDEF] transition-colors cursor-pointer"
              >
                <Columns className="w-3.5 h-3.5 text-[#A4A8AF]" />
                <span>Split Right (Vertical)</span>
              </button>

              {isSplit && onCloseSplit && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onCloseSplit();
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-white/[0.06] flex items-center gap-2 text-rose-400 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close Split</span>
                </button>
              )}

              <div className="h-px bg-white/[0.06] my-1" />

              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onClearOutput();
                }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-white/[0.06] flex items-center gap-2 text-[#ECEDEF] transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#A4A8AF]" />
                <span>Clear Output (Ctrl+L)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Single Terminal Console Surface
interface TerminalSurfaceProps {
  session: TerminalSessionItem;
  isActive: boolean;
  onFocus: () => void;
}

const TerminalSurface: React.FC<TerminalSurfaceProps> = ({ session, onFocus }) => {
  const { project, customPaths, updateTerminalSession, clearTerminalOutput, addLog } = useWorkspaceStore();

  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.streamOutput, session.status]);

  const handlePaneClick = () => {
    onFocus();
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      inputRef.current?.focus();
    }
  };

  const getPromptPrefix = () => {
    const dir = session.workingDirectory || project?.path || 'C:\\';
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

    if (cmd.toLowerCase() === 'clear' || cmd.toLowerCase() === 'cls') {
      clearTerminalOutput(session.id);
      setCurrentInput('');
      setCommandHistory((prev) => [...prev, cmd]);
      setHistoryIndex(-1);
      return;
    }

    const prefix = getPromptPrefix();
    const commandLine = `${prefix} ${currentInput}\n`;

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
        streamOutput: (session.streamOutput || '') + `\n[Error] ${err.message}\n`
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
      const nextIdx = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
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
      className="relative flex-1 flex flex-col bg-[#0d0e12] font-mono select-none overflow-hidden cursor-text min-h-0"
    >
      <div className="flex-1 overflow-auto p-4 text-[#F3F4F6] leading-relaxed select-text font-mono text-[13px] tracking-wide">
        {session.streamOutput ? (
          <div className="whitespace-pre-wrap font-mono text-[#D1D5DB] mb-1">
            {session.streamOutput
              .replace(/^Windows PowerShell[\s\S]*?Copyright[^\n]*\n+/i, '')
              .replace(/^Microsoft Windows \[Version[\s\S]*?Corporation[^\n]*\n+/i, '')
              .replace(/^PS [^\n]*>\s*\n+/i, '')
              .trimStart()}
          </div>
        ) : null}

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

// Main TerminalWorkspace Component with scoped worktree sessions and exact split layout
export const TerminalWorkspace: React.FC = () => {
  const {
    project,
    terminalSessions,
    activeTerminalId,
    setActiveTerminalId,
    createTerminalSession,
    updateTerminalSession,
    removeTerminalSession,
    clearTerminalOutput,
    handleCLIStreamEvent
  } = useWorkspaceStore();

  const [splitDirection, setSplitDirection] = useState<'horizontal' | 'vertical' | null>(null);
  const [secondaryTerminalId, setSecondaryTerminalId] = useState<string | null>(null);

  // Filter sessions scoped to active project / worktree
  const worktreeSessions = terminalSessions.filter(
    (s) => !project?.path || s.workingDirectory === project.path
  );

  // Global stream event listener
  useEffect(() => {
    const unsub = window.api.onCLIStreamEvent((event) => {
      handleCLIStreamEvent(event);
    });
    return () => unsub();
  }, [handleCLIStreamEvent]);

  // Ensure default PowerShell terminal exists for active worktree/project
  useEffect(() => {
    if (worktreeSessions.length === 0) {
      const newId = createTerminalSession('powershell');
      if (project) {
        updateTerminalSession(newId, {
          title: `PowerShell 1`,
          projectName: project.name,
          workingDirectory: project.path,
          branch: project.activeBranch || '',
          provider: 'powershell',
          streamOutput: ''
        });
      }
    }
  }, [worktreeSessions.length, project, createTerminalSession, updateTerminalSession]);

  const primarySession =
    worktreeSessions.find((s) => s.id === activeTerminalId) ||
    worktreeSessions[0];

  const secondarySession = secondaryTerminalId
    ? worktreeSessions.find((s) => s.id === secondaryTerminalId)
    : worktreeSessions.length > 1
    ? worktreeSessions.find((s) => s.id !== primarySession?.id) || null
    : null;

  const handleCreateNewTab = (provider: CLIProvider = 'powershell') => {
    const count = worktreeSessions.length + 1;
    const title = provider === 'cmd' ? `C:\\WINDOWS\\system32\\cmd.exe` : `PowerShell ${count}`;
    const newId = createTerminalSession(provider);
    if (project) {
      updateTerminalSession(newId, {
        title,
        projectName: project.name,
        workingDirectory: project.path,
        branch: project.activeBranch || '',
        provider,
        streamOutput: ''
      });
    }
    setActiveTerminalId(newId);
  };

  const handleSplitHorizontal = () => {
    setSplitDirection('horizontal');
    if (!secondarySession) {
      const newId = createTerminalSession('powershell');
      if (project) {
        updateTerminalSession(newId, {
          title: `Terminal 1`,
          projectName: project.name,
          workingDirectory: project.path,
          branch: project.activeBranch || '',
          provider: 'powershell',
          streamOutput: ''
        });
      }
      setSecondaryTerminalId(newId);
    }
  };

  const handleSplitVertical = () => {
    setSplitDirection('vertical');
    if (!secondarySession) {
      const newId = createTerminalSession('powershell');
      if (project) {
        updateTerminalSession(newId, {
          title: `Terminal 1`,
          projectName: project.name,
          workingDirectory: project.path,
          branch: project.activeBranch || '',
          provider: 'powershell',
          streamOutput: ''
        });
      }
      setSecondaryTerminalId(newId);
    }
  };

  const handleCloseSplit = () => {
    setSplitDirection(null);
    setSecondaryTerminalId(null);
  };

  if (!primarySession) {
    return <div className="h-full bg-[#0d0e12]" />;
  }

  const isSplitActive = Boolean(splitDirection && secondarySession);

  return (
    <div className="h-full w-full bg-[#0d0e12] select-none overflow-hidden relative flex flex-col">
      {isSplitActive ? (
        <div
          className={`flex-1 flex overflow-hidden ${
            splitDirection === 'horizontal' ? 'flex-col divide-y divide-white/[0.08]' : 'flex-row divide-x divide-white/[0.08]'
          }`}
        >
          {/* Top / Left Pane */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            <TerminalPaneHeader
              sessions={worktreeSessions}
              activeSessionId={primarySession.id}
              onSelectSession={(id) => setActiveTerminalId(id)}
              onNewSession={handleCreateNewTab}
              onCloseSession={(id) => removeTerminalSession(id)}
              onSplitHorizontal={handleSplitHorizontal}
              onSplitVertical={handleSplitVertical}
              onCloseSplit={handleCloseSplit}
              isSplit={true}
              onClearOutput={() => clearTerminalOutput(primarySession.id)}
            />
            <TerminalSurface
              session={primarySession}
              isActive={activeTerminalId === primarySession.id}
              onFocus={() => setActiveTerminalId(primarySession.id)}
            />
          </div>

          {/* Bottom / Right Pane (Exact layout as shown in screenshot) */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            <TerminalPaneHeader
              sessions={worktreeSessions}
              activeSessionId={secondarySession?.id || primarySession.id}
              onSelectSession={(id) => setSecondaryTerminalId(id)}
              onNewSession={handleCreateNewTab}
              onCloseSession={(id) => removeTerminalSession(id)}
              onSplitHorizontal={handleSplitHorizontal}
              onSplitVertical={handleSplitVertical}
              onCloseSplit={handleCloseSplit}
              isSplit={true}
              onClearOutput={() => secondarySession && clearTerminalOutput(secondarySession.id)}
            />
            {secondarySession && (
              <TerminalSurface
                session={secondarySession}
                isActive={activeTerminalId === secondarySession.id}
                onFocus={() => setActiveTerminalId(secondarySession.id)}
              />
            )}
          </div>
        </div>
      ) : (
        /* Single Full Terminal Pane */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TerminalPaneHeader
            sessions={worktreeSessions}
            activeSessionId={primarySession.id}
            onSelectSession={(id) => setActiveTerminalId(id)}
            onNewSession={handleCreateNewTab}
            onCloseSession={(id) => removeTerminalSession(id)}
            onSplitHorizontal={handleSplitHorizontal}
            onSplitVertical={handleSplitVertical}
            onCloseSplit={undefined}
            isSplit={false}
            onClearOutput={() => clearTerminalOutput(primarySession.id)}
          />
          <TerminalSurface
            session={primarySession}
            isActive={true}
            onFocus={() => setActiveTerminalId(primarySession.id)}
          />
        </div>
      )}
    </div>
  );
};

export default TerminalWorkspace;
