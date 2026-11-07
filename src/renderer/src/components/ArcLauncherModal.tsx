import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Globe,
  FileText,
  Smartphone,
  Settings,
  ChevronRight,
  X
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { CLIProvider } from '../../../shared/cli';
import {
  PowerShellLogo,
  CmdLogo,
  GitBashLogo,
  OfficialLogoRenderer
} from './OfficialLogos';

interface ArcLauncherModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSelectProvider?: (provider: CLIProvider) => void;
}

interface MenuItem {
  id: string;
  type: 'logo' | 'app' | 'agent' | 'settings';
  title: string;
  provider?: CLIProvider;
  shortcut?: string;
  badge?: string;
  renderIcon: () => React.ReactNode;
  action: () => void;
}

const ALL_AGENTS: { id: string; title: string; provider: CLIProvider }[] = [
  { id: 'antigravity', title: 'Antigravity', provider: 'antigravity' },
  { id: 'claude', title: 'Claude', provider: 'claude' },
  { id: 'codex', title: 'Codex', provider: 'codex' },
  { id: 'copilot', title: 'GitHub Copilot', provider: 'copilot' },
  { id: 'opencode', title: 'OpenCode', provider: 'opencode' },
  { id: 'gemini', title: 'Gemini', provider: 'gemini' },
  { id: 'ollama', title: 'Ollama', provider: 'ollama' },
  { id: 'codebuff', title: 'Codebuff', provider: 'codebuff' },
  { id: 'kimi', title: 'Kimi Code', provider: 'kimi' },
  { id: 'qwen', title: 'Qwen Code', provider: 'qwen' },
  { id: 'cursor', title: 'Cursor Agent', provider: 'cursor' },
  { id: 'devin', title: 'Devin', provider: 'devin' },
  { id: 'droid', title: 'Droid', provider: 'droid' },
  { id: 'goose', title: 'Goose', provider: 'goose' },
  { id: 'hermes', title: 'Hermes Agent', provider: 'hermes' },
  { id: 'kilocode', title: 'Kilo Code', provider: 'kilocode' },
  { id: 'kiro', title: 'Kiro CLI', provider: 'kiro' },
  { id: 'vibe', title: 'Mistral Vibe', provider: 'vibe' },
  { id: 'openhands', title: 'OpenHands', provider: 'openhands' },
  { id: 'pi', title: 'Pi', provider: 'pi' },
  { id: 'roocode', title: 'Roo Code', provider: 'roocode' },
  { id: 'rovo', title: 'Rovo Dev', provider: 'rovo' },
  { id: 'trae', title: 'Trae CLI', provider: 'trae' },
  { id: 'zed', title: 'Zed Agent', provider: 'zed' },
  { id: 'aider', title: 'Aider', provider: 'aider' },
  { id: 'amp', title: 'Amp', provider: 'amp' },
  { id: 'ante', title: 'Ante', provider: 'ante' },
  { id: 'auggie', title: 'Auggie', provider: 'auggie' },
  { id: 'cline', title: 'Cline', provider: 'cline' },
  { id: 'codebuddy', title: 'CodeBuddy', provider: 'codebuddy' },
  { id: 'continue', title: 'Continue', provider: 'continue' },
  { id: 'crush', title: 'Crush', provider: 'crush' }
];

export const ArcLauncherModal: React.FC<ArcLauncherModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  onSelectProvider
}) => {
  const {
    project,
    isArcLauncherOpen,
    setArcLauncherOpen,
    createTerminalSession,
    updateTerminalSession,
    openTerminalTab,
    setActiveSection,
    openSettingsToTab,
    cliStatuses,
    setCLIStatuses,
    customPaths,
    addLog
  } = useWorkspaceStore();

  const isOpen = propIsOpen !== undefined ? propIsOpen : isArcLauncherOpen;
  const onClose = propOnClose || (() => setArcLauncherOpen(false));

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !cliStatuses && window.api?.detectCLIs) {
      window.api.detectCLIs({ customPaths }).then((res) => {
        if (res) setCLIStatuses(res);
      }).catch(() => {});
    }
  }, [isOpen, cliStatuses, customPaths, setCLIStatuses]);

  const handleLaunchTerminal = (provider: CLIProvider, title: string) => {
    onClose();
    if (onSelectProvider) {
      onSelectProvider(provider);
      return;
    }

    const newId = createTerminalSession(provider);
    const workDir = project?.path || '';
    const branch = project?.activeBranch || '';

    updateTerminalSession(newId, {
      title,
      projectName: project?.name || '',
      workingDirectory: workDir,
      branch
    });
    openTerminalTab(newId);
    setActiveSection('terminal');
    addLog(`Launched ${title}`, 'info');
  };

  // 1. Core Tools
  const coreTools: MenuItem[] = [
    {
      id: 'powershell',
      type: 'logo',
      title: 'New Terminal: PowerShell',
      provider: 'powershell',
      shortcut: 'Ctrl+T',
      renderIcon: () => <PowerShellLogo className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('powershell', `PowerShell`)
    },
    {
      id: 'cmd',
      type: 'logo',
      title: 'New Terminal: CMD Prompt',
      provider: 'cmd',
      shortcut: '',
      renderIcon: () => <CmdLogo className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('cmd', `Command Prompt`)
    },
    {
      id: 'bash',
      type: 'logo',
      title: 'New Terminal: Git Bash',
      provider: 'bash',
      shortcut: '',
      renderIcon: () => <GitBashLogo className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('bash', `Git Bash`)
    },
    {
      id: 'browser',
      type: 'app',
      title: 'New Browser Tab',
      shortcut: 'Ctrl+⇧+B',
      renderIcon: () => <Globe className="w-4 h-4 text-[#A4A8AF] flex-shrink-0" />,
      action: () => {
        onClose();
        useWorkspaceStore.getState().openBrowserTab('https://www.google.com');
      }
    },
    {
      id: 'markdown',
      type: 'app',
      title: 'New Markdown',
      shortcut: 'Ctrl+⇧+M',
      renderIcon: () => <FileText className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />,
      action: () => {
        onClose();
        useWorkspaceStore.getState().openFileTab('README.md', '# Project Notes\n');
      }
    },
    {
      id: 'emulator',
      type: 'app',
      title: 'New Mobile Emulator',
      shortcut: 'Unassigned',
      renderIcon: () => <Smartphone className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />,
      action: () => {
        onClose();
        addLog('Mobile emulator ready', 'info');
      }
    }
  ];

  // 2. Only AI Agents that are installed
  const installedAgents = ALL_AGENTS.filter(
    (agent) => cliStatuses?.[agent.provider]?.isInstalled === true
  );

  const aiAgentItems: MenuItem[] = installedAgents.map((agent) => ({
    id: agent.id,
    type: 'agent',
    title: agent.title,
    provider: agent.provider,
    renderIcon: () => (
      <OfficialLogoRenderer
        provider={agent.provider}
        title={agent.title}
        className="w-4 h-4 flex-shrink-0"
      />
    ),
    action: () => handleLaunchTerminal(agent.provider, agent.title)
  }));

  const filteredCoreTools = coreTools.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAgents = aiAgentItems.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase())
  );

  const totalFiltered = [...filteredCoreTools, ...filteredAgents];

  useEffect(() => {
    if (listRef.current && selectedIndex >= filteredCoreTools.length) {
      const idx = selectedIndex - filteredCoreTools.length;
      const el = listRef.current.children[idx] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, filteredCoreTools.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalFiltered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? Math.max(0, totalFiltered.length - 1) : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (totalFiltered[selectedIndex]) {
        totalFiltered[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 select-none animate-in fade-in duration-100"
    >
      {/* Popover Card anchored right below top-left tab '+' button */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-10 left-3 w-[320px] rounded-xl bg-[#14161a] border border-white/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col font-sans select-none text-xs"
      >
        {/* 1. Search Bar */}
        <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search open tabs, history, files, URLs, agents..."
            className="flex-1 bg-transparent text-[#ECEDEF] placeholder-[#717784] text-xs focus:outline-none font-sans caret-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-[#717784] hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 2. Core Standard Tools Section */}
        {filteredCoreTools.length > 0 && (
          <div className="py-1">
            {filteredCoreTools.map((item, index) => {
              const isSelected = selectedIndex === index;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-white/[0.08] text-white'
                      : 'text-[#ECEDEF] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                      {item.renderIcon()}
                    </div>
                    <span className="truncate text-xs font-normal text-white">
                      {item.title}
                    </span>
                  </div>
                  {item.shortcut && (
                    <span className="text-[11px] text-[#717784] font-mono flex-shrink-0">
                      {item.shortcut}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Divider */}
        {filteredCoreTools.length > 0 && filteredAgents.length > 0 && (
          <div className="h-px bg-white/[0.06] my-0.5" />
        )}

        {/* 3. AI Agents Section (only installed, single native scrollbar) */}
        {filteredAgents.length > 0 && (
          <div
            ref={listRef}
            className="overflow-y-auto max-h-[260px] py-1 space-y-0.5"
          >
            {filteredAgents.map((item, idx) => {
              const fullIndex = filteredCoreTools.length + idx;
              const isSelected = selectedIndex === fullIndex;

              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(fullIndex)}
                  className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors group ${
                    isSelected
                      ? 'bg-white/[0.08] text-white'
                      : 'text-[#ECEDEF] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                      {item.renderIcon()}
                    </div>
                    <span className="truncate text-xs font-normal text-white">
                      {item.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        item.action();
                      }}
                      className="w-5 h-5 rounded flex items-center justify-center bg-white/[0.04] text-[#717784] group-hover:text-white group-hover:bg-white/[0.08] transition-colors cursor-pointer"
                      title={`Launch ${item.title}`}
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalFiltered.length === 0 && (
          <div className="py-6 text-center text-[#717784] text-xs">
            No matching tools or agents found
          </div>
        )}

        {/* 4. Footer: Agent Settings... */}
        <div className="h-px bg-white/[0.06] my-0.5" />
        <div className="p-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              openSettingsToTab('agents');
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[#A4A8AF] hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer text-left"
          >
            <Settings className="w-3.5 h-3.5 text-[#717784]" />
            <span>Agent settings...</span>
          </button>
        </div>
      </div>
    </div>
  );
};
