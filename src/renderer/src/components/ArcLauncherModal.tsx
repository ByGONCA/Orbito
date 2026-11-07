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
  shortcut?: string;
  badge?: string;
  renderIcon: () => React.ReactNode;
  action: () => void;
}

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
    addLog
  } = useWorkspaceStore();

  const isOpen = propIsOpen !== undefined ? propIsOpen : isArcLauncherOpen;
  const onClose = propOnClose || (() => setArcLauncherOpen(false));

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

  const coreTools: MenuItem[] = [
    {
      id: 'powershell',
      type: 'logo',
      title: 'New Terminal: PowerShell',
      shortcut: 'Ctrl+T',
      renderIcon: () => <PowerShellLogo className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('powershell', `PowerShell`)
    },
    {
      id: 'cmd',
      type: 'logo',
      title: 'New Terminal: CMD Prompt',
      shortcut: '',
      renderIcon: () => <CmdLogo className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('cmd', `Command Prompt`)
    },
    {
      id: 'bash',
      type: 'logo',
      title: 'New Terminal: Git Bash',
      shortcut: '',
      renderIcon: () => <GitBashLogo className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('bash', `Git Bash`)
    },
    {
      id: 'browser',
      type: 'app',
      title: 'New Browser Tab',
      shortcut: 'Ctrl+Shift+B',
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
      shortcut: 'Ctrl+Shift+M',
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

  // All 30 AI Agents + Orbito Local/DeepMind agents
  const aiAgentItems: MenuItem[] = [
    {
      id: 'antigravity',
      type: 'agent',
      title: 'Antigravity',
      badge: 'DeepMind',
      renderIcon: () => <OfficialLogoRenderer provider="antigravity" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('antigravity', 'Antigravity')
    },
    {
      id: 'claude',
      type: 'agent',
      title: 'Claude Code',
      badge: 'Anthropic',
      renderIcon: () => <OfficialLogoRenderer provider="claude" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('claude', 'Claude Code')
    },
    {
      id: 'codex',
      type: 'agent',
      title: 'OpenAI Codex',
      badge: 'OpenAI',
      renderIcon: () => <OfficialLogoRenderer provider="codex" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('codex', 'OpenAI Codex')
    },
    {
      id: 'gemini',
      type: 'agent',
      title: 'Gemini CLI',
      badge: 'Google',
      renderIcon: () => <OfficialLogoRenderer provider="gemini" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('gemini', 'Gemini CLI')
    },
    {
      id: 'ollama',
      type: 'agent',
      title: 'Ollama',
      badge: 'Local Air-Gap',
      renderIcon: () => <OfficialLogoRenderer provider="ollama" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('ollama', 'Ollama')
    },
    {
      id: 'aider',
      type: 'agent',
      title: 'Aider',
      badge: 'Pair Programming',
      renderIcon: () => <OfficialLogoRenderer provider="aider" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('aider', 'Aider')
    },
    {
      id: 'amp',
      type: 'agent',
      title: 'Amp',
      badge: 'Amp AI',
      renderIcon: () => <OfficialLogoRenderer provider="amp" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('amp', 'Amp')
    },
    {
      id: 'ante',
      type: 'agent',
      title: 'Ante',
      badge: 'Antigma Rust',
      renderIcon: () => <OfficialLogoRenderer provider="ante" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('ante', 'Ante')
    },
    {
      id: 'auggie',
      type: 'agent',
      title: 'Auggie',
      badge: 'Augment Code',
      renderIcon: () => <OfficialLogoRenderer provider="auggie" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('auggie', 'Auggie')
    },
    {
      id: 'cline',
      type: 'agent',
      title: 'Cline',
      badge: 'Autonomous',
      renderIcon: () => <OfficialLogoRenderer provider="cline" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('cline', 'Cline')
    },
    {
      id: 'codebuddy',
      type: 'agent',
      title: 'CodeBuddy',
      badge: 'CodeBuddy',
      renderIcon: () => <OfficialLogoRenderer provider="codebuddy" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('codebuddy', 'CodeBuddy')
    },
    {
      id: 'codebuff',
      type: 'agent',
      title: 'Codebuff',
      badge: 'YC F24',
      renderIcon: () => <OfficialLogoRenderer provider="codebuff" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('codebuff', 'Codebuff')
    },
    {
      id: 'continue',
      type: 'agent',
      title: 'Continue',
      badge: 'Continue.dev',
      renderIcon: () => <OfficialLogoRenderer provider="continue" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('continue', 'Continue')
    },
    {
      id: 'crush',
      type: 'agent',
      title: 'Crush',
      badge: 'Charmbracelet',
      renderIcon: () => <OfficialLogoRenderer provider="crush" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('crush', 'Crush')
    },
    {
      id: 'cursor',
      type: 'agent',
      title: 'Cursor Agent',
      badge: 'Anysphere',
      renderIcon: () => <OfficialLogoRenderer provider="cursor" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('cursor', 'Cursor Agent')
    },
    {
      id: 'devin',
      type: 'agent',
      title: 'Devin',
      badge: 'Cognition',
      renderIcon: () => <OfficialLogoRenderer provider="devin" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('devin', 'Devin')
    },
    {
      id: 'droid',
      type: 'agent',
      title: 'Droid',
      badge: 'Factory AI',
      renderIcon: () => <OfficialLogoRenderer provider="droid" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('droid', 'Droid (Factory)')
    },
    {
      id: 'copilot',
      type: 'agent',
      title: 'GitHub Copilot CLI',
      badge: 'GitHub',
      renderIcon: () => <OfficialLogoRenderer provider="copilot" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('copilot', 'GitHub Copilot CLI')
    },
    {
      id: 'goose',
      type: 'agent',
      title: 'Goose',
      badge: 'Block Open Source',
      renderIcon: () => <OfficialLogoRenderer provider="goose" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('goose', 'Goose')
    },
    {
      id: 'hermes',
      type: 'agent',
      title: 'Hermes Agent',
      badge: 'Nous Research',
      renderIcon: () => <OfficialLogoRenderer provider="hermes" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('hermes', 'Hermes Agent')
    },
    {
      id: 'kilocode',
      type: 'agent',
      title: 'Kilo Code',
      badge: 'Kilo AI',
      renderIcon: () => <OfficialLogoRenderer provider="kilocode" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('kilocode', 'Kilo Code')
    },
    {
      id: 'kimi',
      type: 'agent',
      title: 'Kimi Code',
      badge: 'Moonshot AI',
      renderIcon: () => <OfficialLogoRenderer provider="kimi" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('kimi', 'Kimi Code')
    },
    {
      id: 'kiro',
      type: 'agent',
      title: 'Kiro CLI',
      badge: 'Kiro AI',
      renderIcon: () => <OfficialLogoRenderer provider="kiro" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('kiro', 'Kiro CLI')
    },
    {
      id: 'vibe',
      type: 'agent',
      title: 'Mistral Vibe',
      badge: 'Mistral AI',
      renderIcon: () => <OfficialLogoRenderer provider="vibe" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('vibe', 'Mistral Vibe')
    },
    {
      id: 'opencode',
      type: 'agent',
      title: 'OpenCode',
      badge: 'Open Weights',
      renderIcon: () => <OfficialLogoRenderer provider="opencode" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('opencode', 'OpenCode')
    },
    {
      id: 'openhands',
      type: 'agent',
      title: 'OpenHands',
      badge: 'All-Hands',
      renderIcon: () => <OfficialLogoRenderer provider="openhands" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('openhands', 'OpenHands')
    },
    {
      id: 'pi',
      type: 'agent',
      title: 'Pi Coding Agent',
      badge: 'Inflection',
      renderIcon: () => <OfficialLogoRenderer provider="pi" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('pi', 'Pi Coding Agent')
    },
    {
      id: 'qwen',
      type: 'agent',
      title: 'Qwen Code',
      badge: 'Alibaba Cloud',
      renderIcon: () => <OfficialLogoRenderer provider="qwen" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('qwen', 'Qwen Code')
    },
    {
      id: 'roocode',
      type: 'agent',
      title: 'Roo Code',
      badge: 'Roo Cline',
      renderIcon: () => <OfficialLogoRenderer provider="roocode" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('roocode', 'Roo Code')
    },
    {
      id: 'rovo',
      type: 'agent',
      title: 'Rovo Dev',
      badge: 'Atlassian',
      renderIcon: () => <OfficialLogoRenderer provider="rovo" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('rovo', 'Rovo Dev')
    },
    {
      id: 'trae',
      type: 'agent',
      title: 'Trae CLI',
      badge: 'ByteDance',
      renderIcon: () => <OfficialLogoRenderer provider="trae" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('trae', 'Trae CLI')
    },
    {
      id: 'zed',
      type: 'agent',
      title: 'Zed Agent',
      badge: 'Zed Industries',
      renderIcon: () => <OfficialLogoRenderer provider="zed" className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('zed', 'Zed Agent')
    }
  ];

  const settingsItem: MenuItem = {
    id: 'settings',
    type: 'settings',
    title: 'Agent settings...',
    renderIcon: () => <Settings className="w-4 h-4 text-[#717784] flex-shrink-0" />,
    action: () => {
      onClose();
      setActiveSection('providers');
    }
  };

  const allItems: MenuItem[] = [...coreTools, ...aiAgentItems, settingsItem];

  const filteredItems = allItems.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    (item.badge && item.badge.toLowerCase().includes(search.toLowerCase()))
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? Math.max(0, filteredItems.length - 1) : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-100"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[380px] max-w-[95vw] max-h-[85vh] rounded-2xl bg-[#14161b] border border-white/[0.10] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col font-sans text-xs"
      >
        {/* Search Input Bar */}
        <div className="p-3 border-b border-white/[0.08] flex items-center gap-2.5">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search open tabs, history, files, URLs, agents..."
            className="flex-1 bg-transparent text-white placeholder-[#6B7280] text-xs focus:outline-none font-sans"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-[#6B7280] hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Scrollable Items List */}
        <div className="flex-1 overflow-y-auto max-h-[420px] p-1.5 space-y-0.5 custom-scrollbar">
          {filteredItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <div
                key={item.id}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-white/[0.08] text-white'
                    : 'text-[#A4A8AF] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    {item.renderIcon()}
                  </div>
                  <span className="truncate font-medium text-xs">{item.title}</span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.badge && (
                    <span className="text-[11px] text-[#717784] font-medium">
                      {item.badge}
                    </span>
                  )}
                  {item.shortcut && (
                    <span className="text-[10px] text-[#6B7280] font-mono">
                      {item.shortcut}
                    </span>
                  )}
                  {item.type === 'agent' && (
                    <ChevronRight className="w-3.5 h-3.5 text-[#52525B]" />
                  )}
                </div>
              </div>
            );
          })}
          {filteredItems.length === 0 && (
            <div className="py-8 text-center text-[#717784] text-xs">
              No matching tools or agents found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
