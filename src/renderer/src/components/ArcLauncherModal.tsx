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
  AntigravityLogo,
  ClaudeLogo,
  CodexLogo,
  GeminiLogo,
  OllamaLogo,
  GoogleLogo
} from './OfficialLogos';

interface ArcLauncherModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSelectProvider?: (provider: CLIProvider) => void;
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
    toggleSettings,
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

  const menuItems = [
    {
      id: 'powershell',
      type: 'logo',
      title: 'New Terminal: PowerShell',
      shortcut: 'Ctrl+T',
      renderIcon: () => <PowerShellLogo className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('powershell', `C:\\Windows\\system32\\cmd.exe`)
    },
    {
      id: 'cmd',
      type: 'logo',
      title: 'New Terminal: CMD Prompt',
      shortcut: '',
      renderIcon: () => <CmdLogo className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('cmd', `C:\\Windows\\system32\\cmd.exe`)
    },
    {
      id: 'bash',
      type: 'logo',
      title: 'New Terminal: Git Bash',
      shortcut: '',
      renderIcon: () => <GitBashLogo className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('bash', `bash.exe`)
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
    },
    // AI Agents
    {
      id: 'antigravity',
      type: 'agent',
      title: 'Antigravity',
      badge: 'DeepMind',
      renderIcon: () => <AntigravityLogo className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('antigravity', 'Antigravity')
    },
    {
      id: 'claude',
      type: 'agent',
      title: 'Claude',
      badge: 'Anthropic',
      renderIcon: () => <ClaudeLogo className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('claude', 'Claude')
    },
    {
      id: 'codex',
      type: 'agent',
      title: 'Codex',
      badge: 'OpenAI',
      renderIcon: () => <CodexLogo className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('codex', 'Codex')
    },
    {
      id: 'gemini',
      type: 'agent',
      title: 'Gemini',
      badge: 'Google',
      renderIcon: () => <GeminiLogo className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('gemini', 'Gemini')
    },
    {
      id: 'ollama',
      type: 'agent',
      title: 'Ollama',
      badge: 'Local Models',
      renderIcon: () => <OllamaLogo className="w-4 h-4 flex-shrink-0" />,
      action: () => handleLaunchTerminal('ollama', 'Ollama')
    },
    {
      id: 'settings',
      type: 'settings',
      title: 'Agent settings...',
      renderIcon: () => <Settings className="w-4 h-4 text-[#717784] flex-shrink-0" />,
      action: () => {
        onClose();
        toggleSettings(true);
      }
    }
  ];

  const filteredItems = menuItems.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase())
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
        className="w-[360px] max-w-[95vw] rounded-2xl bg-[#14161b] border border-white/[0.10] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col font-sans text-xs"
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
              className="text-[#6B7280] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Menu Items List */}
        <div className="max-h-[380px] overflow-y-auto p-1.5 space-y-0.5 no-scrollbar">
          {filteredItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;

            return (
              <div
                key={item.id}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-white/[0.08] text-white'
                    : 'text-[#D1D5DB] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {item.renderIcon()}
                  <span className="truncate font-medium text-[12px]">{item.title}</span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.shortcut && (
                    <span className="text-[10px] font-mono text-[#717784]">
                      {item.shortcut}
                    </span>
                  )}
                  {item.type === 'agent' && (
                    <ChevronRight className="w-3.5 h-3.5 text-[#525866]" />
                  )}
                </div>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="p-4 text-center text-[#6B7280] text-xs">
              No matching commands or agents found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
