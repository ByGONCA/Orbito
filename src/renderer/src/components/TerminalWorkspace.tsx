import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  SplitSquareVertical,
  Maximize2,
  Minimize2,
  Search,
  FileCode,
  Globe,
  FileText,
  Smartphone,
  Settings,
  Network,
  Bot,
  Workflow,
  CheckSquare,
  ArrowRight,
  ExternalLink,
  Blocks
} from 'lucide-react';
import { useWorkspaceStore, TerminalSessionItem } from '../stores/workspace.store';
import type { CLIProvider } from '../../../shared/cli';
import { OfficialLogoRenderer } from './OfficialLogos';
import { FileIcon } from '../utils/file-icons';
import { CodeEditor } from './CodeEditor';
import { EmbeddedBrowser } from './EmbeddedBrowser';
import { PluginsWorkspace } from './plugins/PluginsWorkspace';
import { NativeTerminal, type NativeTerminalProps } from './NativeTerminal';
export type { NativeTerminalProps };

export interface UnifiedTabItem {
  id: string;
  type: 'terminal' | 'file' | 'browser' | 'graph' | 'plugins';
  title: string;
  terminalId?: string;
  filePath?: string;
  url?: string;
  isDirty?: boolean;
  session?: TerminalSessionItem;
}

const ALL_AGENT_PROVIDERS: { id: string; title: string; provider: CLIProvider }[] = [
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

// Unified Workspace Pane Header (tabs for Terminals, AI Agents, Code Files, Browser + Search '+' button)
interface TerminalPaneHeaderProps {
  paneId: 'primary' | 'secondary';
  tabs: UnifiedTabItem[];
  activeTabId: string | null;
  onSelectTab: (tab: UnifiedTabItem) => void;
  onCloseTab: (tab: UnifiedTabItem) => void;
  onNewSession: (provider?: CLIProvider) => void;
  onOpenFile: (file: { path: string; name: string }) => void;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onCloseSplit?: () => void;
  isSplit: boolean;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onClearOutput?: () => void;
  isTerminalActive: boolean;
  onDragStartTab: (tab: UnifiedTabItem, e: React.DragEvent) => void;
  onDragEndTab: (tab: UnifiedTabItem, e: React.DragEvent) => void;
  onDropReorderTab: (sourceTabId: string, targetTabId: string) => void;
  onDropOnHeader: (sourceTabId: string, paneId: 'primary' | 'secondary') => void;
  onDetachTab: (tab: UnifiedTabItem, x?: number, y?: number) => void;
}

const TerminalPaneHeader: React.FC<TerminalPaneHeaderProps> = ({
  paneId,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewSession,
  onOpenFile,
  onSplitHorizontal,
  onSplitVertical,
  onCloseSplit,
  isSplit,
  isMaximized,
  onToggleMaximize,
  onClearOutput,
  isTerminalActive,
  onDragStartTab,
  onDragEndTab,
  onDropReorderTab,
  onDropOnHeader,
  onDetachTab
}) => {
  const {
    cliStatuses,
    setCLIStatuses,
    customPaths,
    openSettingsToTab,
    files,
    project,
    setActiveFile,
    openFileTab,
    openBrowserTab,
    setActiveSection,
    openGraphTab
  } = useWorkspaceStore();

  useEffect(() => {
    if (!cliStatuses && window.api?.detectCLIs) {
      window.api.detectCLIs({ customPaths }).then((res) => {
        if (res) setCLIStatuses(res);
      }).catch(() => {});
    }
  }, [cliStatuses, customPaths, setCLIStatuses]);

  const installedAgents = useMemo(() => {
    if (cliStatuses && Object.keys(cliStatuses).length > 0) {
      const installed = ALL_AGENT_PROVIDERS.filter(
        (agent) => cliStatuses[agent.provider]?.isInstalled === true
      );
      if (installed.length > 0) return installed;
    }
    // Default while detecting or fallback
    return ALL_AGENT_PROVIDERS.filter((agent) =>
      ['antigravity', 'codex', 'copilot', 'opencode', 'claude', 'gemini'].includes(agent.provider)
    );
  }, [cliStatuses]);

  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPlusMenuOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isPlusMenuOpen]);

  useEffect(() => {
    const handleClickOutside = () => {
      setIsPlusMenuOpen(false);
      setIsCommandMenuOpen(false);
      setIsMoreMenuOpen(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const activeSession = tabs.find((t) => t.id === activeTabId)?.session || tabs[0]?.session;

  // Flatten workspace files for search
  const flatFiles = useMemo(() => {
    const list: Array<{ name: string; path: string }> = [];
    const traverse = (items: any[]) => {
      for (const item of items) {
        if (!item.isDirectory) {
          list.push({ name: item.name, path: item.path });
        }
        if (item.children) traverse(item.children);
      }
    };
    if (files) traverse(files);
    return list;
  }, [files]);

  // Shell items
  const shellItems = useMemo(
    () => [
      {
        id: 'powershell',
        type: 'shell',
        category: 'Shells',
        title: 'PowerShell',
        provider: 'powershell' as CLIProvider,
        renderIcon: () => (
          <OfficialLogoRenderer provider="powershell" title="PowerShell" className="w-4 h-4 flex-shrink-0" />
        ),
        action: () => {
          setIsPlusMenuOpen(false);
          onNewSession('powershell');
        }
      },
      {
        id: 'cmd',
        type: 'shell',
        category: 'Shells',
        title: 'Command Prompt',
        provider: 'cmd' as CLIProvider,
        renderIcon: () => (
          <OfficialLogoRenderer provider="cmd" title="Command Prompt" className="w-4 h-4 flex-shrink-0" />
        ),
        action: () => {
          setIsPlusMenuOpen(false);
          onNewSession('cmd');
        }
      },
      {
        id: 'bash',
        type: 'shell',
        category: 'Shells',
        title: 'Git Bash',
        provider: 'bash' as CLIProvider,
        renderIcon: () => (
          <OfficialLogoRenderer provider="bash" title="Git Bash" className="w-4 h-4 flex-shrink-0" />
        ),
        action: () => {
          setIsPlusMenuOpen(false);
          onNewSession('bash');
        }
      }
    ],
    [onNewSession]
  );

  // Agent items
  const agentItems = useMemo(
    () =>
      installedAgents.map((agent) => ({
        id: agent.id,
        type: 'agent',
        category: 'AI Agents',
        title: agent.title,
        provider: agent.provider,
        renderIcon: () => (
          <OfficialLogoRenderer
            provider={agent.provider}
            title={agent.title}
            className="w-4 h-4 flex-shrink-0"
          />
        ),
        action: () => {
          setIsPlusMenuOpen(false);
          onNewSession(agent.provider);
        }
      })),
    [installedAgents, onNewSession]
  );

  // Tools and command actions
  const commandItems = useMemo(
    () => [
      {
        id: 'cmd-browser',
        type: 'tool',
        category: 'Tools',
        title: 'New Browser Tab',
        shortcut: 'Ctrl+Shift+B',
        renderIcon: () => <Globe className="w-4 h-4 text-[#A4A8AF] flex-shrink-0" />,
        action: () => {
          setIsPlusMenuOpen(false);
          openBrowserTab('https://www.google.com');
        }
      },
      {
        id: 'cmd-markdown',
        type: 'tool',
        category: 'Tools',
        title: 'New Markdown',
        shortcut: 'Ctrl+Shift+M',
        renderIcon: () => <FileText className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />,
        action: () => {
          setIsPlusMenuOpen(false);
          openFileTab('README.md', '# Project Notes\n');
        }
      },
      {
        id: 'cmd-emulator',
        type: 'tool',
        category: 'Tools',
        title: 'New Mobile Emulator',
        renderIcon: () => <Smartphone className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />,
        action: () => {
          setIsPlusMenuOpen(false);
          useWorkspaceStore.getState().addLog('Mobile emulator ready', 'info');
        }
      },
      {
        id: 'cmd-split-h',
        type: 'command',
        category: 'Commands',
        title: 'Split Terminal (Horizontal)',
        renderIcon: () => <SplitSquareHorizontal className="w-4 h-4 text-[#A4A8AF] flex-shrink-0" />,
        action: () => {
          setIsPlusMenuOpen(false);
          onSplitHorizontal();
        }
      },
      {
        id: 'cmd-split-v',
        type: 'command',
        category: 'Commands',
        title: 'Split Terminal (Vertical)',
        renderIcon: () => <SplitSquareVertical className="w-4 h-4 text-[#A4A8AF] flex-shrink-0" />,
        action: () => {
          setIsPlusMenuOpen(false);
          onSplitVertical();
        }
      },
      {
        id: 'cmd-clear',
        type: 'command',
        category: 'Commands',
        title: 'Clear Terminal Output',
        renderIcon: () => <Trash2 className="w-4 h-4 text-[#A4A8AF] flex-shrink-0" />,
        action: () => {
          setIsPlusMenuOpen(false);
          onClearOutput?.();
        }
      },
      {
        id: 'cmd-graph',
        type: 'command',
        category: 'Navigation',
        title: 'Go to Intelligence Graph',
        renderIcon: () => <Network className="w-4 h-4 text-[#A4A8AF] flex-shrink-0" />,
        action: () => {
          setIsPlusMenuOpen(false);
          openGraphTab();
        }
      },
      {
        id: 'cmd-agents',
        type: 'command',
        category: 'Navigation',
        title: 'Go to Multi-Agent Orchestration',
        renderIcon: () => <Bot className="w-4 h-4 text-[#A4A8AF] flex-shrink-0" />,
        action: () => {
          setIsPlusMenuOpen(false);
          setActiveSection('agents');
        }
      },
      {
        id: 'cmd-tasks',
        type: 'command',
        category: 'Navigation',
        title: 'Go to Task Orchestration & Approvals',
        renderIcon: () => <CheckSquare className="w-4 h-4 text-[#A4A8AF] flex-shrink-0" />,
        action: () => {
          setIsPlusMenuOpen(false);
          setActiveSection('tasks');
        }
      },
      {
        id: 'cmd-flows',
        type: 'command',
        category: 'Navigation',
        title: 'Go to Visual Flow Builder',
        renderIcon: () => <Workflow className="w-4 h-4 text-[#A4A8AF] flex-shrink-0" />,
        action: () => {
          setIsPlusMenuOpen(false);
          setActiveSection('flows');
        }
      },
      {
        id: 'cmd-settings',
        type: 'command',
        category: 'Preferences',
        title: 'Open Settings',
        renderIcon: () => <Settings className="w-4 h-4 text-[#A4A8AF] flex-shrink-0" />,
        action: () => {
          setIsPlusMenuOpen(false);
          openSettingsToTab('agents');
        }
      }
    ],
    [openBrowserTab, openFileTab, onSplitHorizontal, onSplitVertical, onClearOutput, openGraphTab, setActiveSection, openSettingsToTab]
  );

  const q = search.toLowerCase().trim();

  // Filtered collections
  const filteredShells = useMemo(
    () => shellItems.filter((s) => s.title.toLowerCase().includes(q) || s.provider.toLowerCase().includes(q)),
    [shellItems, q]
  );

  const filteredAgents = useMemo(
    () => agentItems.filter((a) => a.title.toLowerCase().includes(q) || a.provider.toLowerCase().includes(q)),
    [agentItems, q]
  );

  const filteredCommands = useMemo(
    () => commandItems.filter((c) => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)),
    [commandItems, q]
  );

  const filteredFiles = useMemo(() => {
    if (!q) return [];
    return flatFiles
      .filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
      .slice(0, 8)
      .map((f) => ({
        id: `file-${f.path}`,
        type: 'file',
        category: 'Files',
        title: f.name,
        subtitle: f.path,
        renderIcon: () => (
          <FileIcon name={f.name} isDirectory={false} className="w-4 h-4 flex-shrink-0" theme="material" />
        ),
        action: () => {
          setIsPlusMenuOpen(false);
          onOpenFile({ name: f.name, path: f.path });
        }
      }));
  }, [flatFiles, q, onOpenFile]);

  // Flat list of all current visible items for index-based keyboard selection
  const allVisibleItems = useMemo(() => {
    if (q) {
      return [...filteredShells, ...filteredAgents, ...filteredCommands, ...filteredFiles];
    }
    return [...shellItems, ...agentItems, ...commandItems.slice(0, 2)];
  }, [q, filteredShells, filteredAgents, filteredCommands, filteredFiles, shellItems, agentItems, commandItems]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsPlusMenuOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, allVisibleItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev <= 0 ? Math.max(0, allVisibleItems.length - 1) : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allVisibleItems[selectedIndex]) {
        allVisibleItems[selectedIndex].action();
      }
    }
  };

  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-item-index="${selectedIndex}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Helper to render an item row
  const renderItemRow = (
    item: {
      id: string;
      title: string;
      subtitle?: string;
      shortcut?: string;
      provider?: CLIProvider;
      renderIcon: () => React.ReactNode;
      action: () => void;
    },
    index: number
  ) => {
    const isSelected = selectedIndex === index;
    const isRunning = item.provider && activeSession?.provider === item.provider;

    return (
      <div
        key={item.id}
        data-item-index={index}
        onClick={item.action}
        onMouseEnter={() => setSelectedIndex(index)}
        className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors group ${
          isSelected ? 'bg-white/[0.08] text-white' : 'text-[#ECEDEF] hover:bg-white/[0.04]'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            {item.renderIcon()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate text-xs font-normal text-white">{item.title}</span>
            {item.subtitle && (
              <span className="truncate text-[10px] text-[#717784] font-mono leading-tight">
                {item.subtitle}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {item.shortcut && (
            <span className="text-[10px] text-[#717784] font-mono">{item.shortcut}</span>
          )}
          {isRunning && <Check className="w-3 h-3 text-emerald-400" />}
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="h-9 bg-[#0e1015] border-b border-white/[0.08] flex items-center justify-between px-2.5 select-none z-20 flex-shrink-0 relative terminal-pane-header"
    >
      {/* Left Tabs Strip + Plus button */}
      <div className="flex items-center flex-1 min-w-0 h-full gap-1">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            const sourceId =
              e.dataTransfer.getData('application/orbito-tab-id') ||
              e.dataTransfer.getData('text/plain');
            if (sourceId && onDropOnHeader) {
              onDropOnHeader(sourceId, paneId);
            }
          }}
          className="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar min-w-0 h-full"
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isTerminal = tab.type === 'terminal';
            const isFile = tab.type === 'file';
            const isBrowser = tab.type === 'browser';
            const sess = tab.session;
            const displayTitle = tab.title || (sess?.provider === 'cmd' ? 'Command Prompt' : 'Terminal');

            return (
              <div
                key={tab.id}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', tab.id);
                  e.dataTransfer.setData('application/orbito-tab-id', tab.id);
                  onDragStartTab(tab, e);
                }}
                onDragEnd={(e) => onDragEndTab(tab, e)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const sourceId =
                    e.dataTransfer.getData('application/orbito-tab-id') ||
                    e.dataTransfer.getData('text/plain');
                  if (sourceId && sourceId !== tab.id) {
                    onDropReorderTab(sourceId, tab.id);
                  }
                }}
                onClick={() => onSelectTab(tab)}
                className={`group relative flex items-center gap-2 px-3 h-7 rounded-md text-xs cursor-pointer transition-all max-w-[210px] flex-shrink-0 ${
                  isActive
                    ? 'bg-[#1e2129] text-white font-medium shadow-xs'
                    : 'bg-transparent hover:bg-white/[0.05] text-[#A4A8AF] hover:text-[#ECEDEF]'
                }`}
                title={tab.filePath || sess?.workingDirectory || displayTitle}
              >
                {/* Icon based on tab type */}
                {isTerminal ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        sess?.status === 'running'
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <OfficialLogoRenderer
                      provider={sess?.provider || 'powershell'}
                      title={displayTitle}
                      className="w-3.5 h-3.5 flex-shrink-0"
                    />
                  </div>
                ) : isFile ? (
                  <FileIcon
                    name={tab.title}
                    isDirectory={false}
                    className="w-3.5 h-3.5 flex-shrink-0"
                    theme="material"
                  />
                ) : isBrowser ? (
                  <Globe className="w-3.5 h-3.5 text-[#A4A8AF] flex-shrink-0" />
                ) : tab.type === 'plugins' ? (
                  <Blocks className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                ) : (
                  <TerminalIcon className="w-3.5 h-3.5 text-[#A4A8AF] flex-shrink-0" />
                )}

                <span className="truncate text-[11px] font-mono">{displayTitle}</span>

                {/* Modified file badge */}
                {isFile && tab.isDirty && (
                  <span className="text-[10px] text-amber-400 font-mono font-bold">M</span>
                )}

                <div className="flex items-center gap-0.5 ml-0.5">
                  {/* Detach Tab Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDetachTab(tab);
                    }}
                    className="p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-white/20 text-[#747982] hover:text-purple-300 transition-opacity cursor-pointer"
                    title="Detach into new window"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>

                  {/* Close Tab Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab);
                    }}
                    className="p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-white/20 text-[#747982] hover:text-white transition-opacity cursor-pointer"
                    title="Close tab"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Single Plus button that opens the comprehensive menu */}
        <div className="relative flex items-center flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsPlusMenuOpen((prev) => !prev);
              setIsCommandMenuOpen(false);
              setIsMoreMenuOpen(false);
            }}
            className={`p-1 hover:bg-white/[0.08] rounded-md text-[#A4A8AF] hover:text-[#ECEDEF] transition-colors cursor-pointer ${
              isPlusMenuOpen ? 'bg-white/[0.1] text-white' : ''
            }`}
            title="New Terminal, Agent, or File"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Plus Menu Popup with Search Bar matching Orca */}
          {isPlusMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 top-full mt-1.5 w-[330px] bg-[#14161b] border border-white/[0.1] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col font-sans select-none text-xs z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              {/* Search Bar */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.08] bg-transparent">
                <Search className="w-3.5 h-3.5 text-[#747982] flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search open tabs, files, commands, agents..."
                  className="flex-1 bg-transparent text-[#ECEDEF] placeholder-[#747982] text-xs focus:outline-none font-sans caret-white"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setSelectedIndex(0);
                      searchInputRef.current?.focus();
                    }}
                    className="text-[#747982] hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Scrollable list */}
              <div ref={listRef} className="max-h-[360px] overflow-y-auto no-scrollbar py-1">
                {/* 1. When searching */}
                {q ? (
                  <>
                    {filteredShells.length > 0 && (
                      <div className="py-1">
                        <div className="px-3 py-1 text-[10px] text-[#717784] uppercase font-mono tracking-wider font-semibold">
                          Shells
                        </div>
                        {filteredShells.map((item) => {
                          const idx = allVisibleItems.indexOf(item);
                          return renderItemRow(item, idx);
                        })}
                      </div>
                    )}

                    {filteredAgents.length > 0 && (
                      <div className="py-1">
                        <div className="px-3 py-1 text-[10px] text-[#717784] uppercase font-mono tracking-wider font-semibold">
                          AI Agents
                        </div>
                        {filteredAgents.map((item) => {
                          const idx = allVisibleItems.indexOf(item);
                          return renderItemRow(item, idx);
                        })}
                      </div>
                    )}

                    {filteredCommands.length > 0 && (
                      <div className="py-1">
                        <div className="px-3 py-1 text-[10px] text-[#717784] uppercase font-mono tracking-wider font-semibold">
                          Commands &amp; Tools
                        </div>
                        {filteredCommands.map((item) => {
                          const idx = allVisibleItems.indexOf(item);
                          return renderItemRow(item, idx);
                        })}
                      </div>
                    )}

                    {filteredFiles.length > 0 && (
                      <div className="py-1">
                        <div className="px-3 py-1 text-[10px] text-[#717784] uppercase font-mono tracking-wider font-semibold">
                          Files
                        </div>
                        {filteredFiles.map((item) => {
                          const idx = allVisibleItems.indexOf(item);
                          return renderItemRow(item, idx);
                        })}
                      </div>
                    )}

                    {allVisibleItems.length === 0 && (
                      <div className="py-6 text-center text-[#717784] text-xs">
                        No matching commands, files, or agents found
                      </div>
                    )}
                  </>
                ) : (
                  /* 2. Default view when search is empty */
                  <>
                    {/* Shells */}
                    <div className="py-0.5">
                      <div className="px-3 py-1 text-[10px] text-[#717784] uppercase font-mono tracking-wider font-semibold">
                        Shells
                      </div>
                      {shellItems.map((item, idx) => renderItemRow(item, idx))}
                    </div>

                    {/* AI Agents */}
                    {agentItems.length > 0 && (
                      <div className="py-0.5">
                        <div className="h-px bg-white/[0.06] my-1" />
                        <div className="px-3 py-1 text-[10px] text-[#717784] uppercase font-mono tracking-wider font-semibold">
                          AI Agents
                        </div>
                        {agentItems.map((item, idx) =>
                          renderItemRow(item, shellItems.length + idx)
                        )}
                      </div>
                    )}

                    {/* Tools */}
                    <div className="py-0.5">
                      <div className="h-px bg-white/[0.06] my-1" />
                      <div className="px-3 py-1 text-[10px] text-[#717784] uppercase font-mono tracking-wider font-semibold">
                        Tools
                      </div>
                      {commandItems.slice(0, 2).map((item, idx) =>
                        renderItemRow(item, shellItems.length + agentItems.length + idx)
                      )}
                    </div>

                    {/* Footer: Agent Settings */}
                    <div className="h-px bg-white/[0.06] my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false);
                        openSettingsToTab('agents');
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-white/[0.06] flex items-center gap-2 text-[#717784] hover:text-[#ECEDEF] transition-colors cursor-pointer text-[11px]"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#717784]" />
                      <span>Agent settings...</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Clear terminal, Split actions, Command dropdown, More Menu */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Clear Output (for active terminal) */}
        {isTerminalActive && onClearOutput && (
          <button
            type="button"
            onClick={onClearOutput}
            className="p-1.5 rounded hover:bg-white/[0.08] text-[#717784] hover:text-white transition-colors cursor-pointer"
            title="Clear Output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

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

        {/* Maximize / Restore Split Window */}
        {isSplit && onToggleMaximize && (
          <button
            type="button"
            onClick={onToggleMaximize}
            className={`p-1.5 rounded hover:bg-white/[0.08] transition-colors cursor-pointer ${
              isMaximized ? 'text-accent bg-white/[0.06]' : 'text-[#717784] hover:text-white'
            }`}
            title={isMaximized ? 'Restaurar Tamanho da Janela' : 'Maximizar Janela do Terminal'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}

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
              <div className="h-px bg-white/[0.06] my-1" />
              <button
                type="button"
                onClick={() => {
                  setIsCommandMenuOpen(false);
                  onNewSession();
                }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-white/[0.06] flex items-center justify-between text-[#A4A8AF] hover:text-white transition-colors cursor-pointer text-[11px]"
              >
                <span>All Terminals &amp; AI Agents...</span>
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

              {isTerminalActive && onClearOutput && (
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Single Terminal Console Surface powered by genuine native CLI PTY
export const TerminalSurface = NativeTerminal;

// Docking Drop Zone Overlay for live drag-and-drop feedback (top, bottom, left, right, center)
interface DockDropZoneOverlayProps {
  zone: 'left' | 'right' | 'top' | 'bottom' | 'center';
}

const DockDropZoneOverlay: React.FC<DockDropZoneOverlayProps> = ({ zone }) => {
  let styleClasses = '';
  let label = '';
  let Icon = SplitSquareVertical;

  switch (zone) {
    case 'right':
      styleClasses = 'inset-y-0 right-0 w-1/2';
      label = 'Split Right';
      Icon = SplitSquareVertical;
      break;
    case 'left':
      styleClasses = 'inset-y-0 left-0 w-1/2';
      label = 'Split Left';
      Icon = SplitSquareVertical;
      break;
    case 'bottom':
      styleClasses = 'inset-x-0 bottom-0 h-1/2';
      label = 'Split Down';
      Icon = SplitSquareHorizontal;
      break;
    case 'top':
      styleClasses = 'inset-x-0 top-0 h-1/2';
      label = 'Split Up';
      Icon = SplitSquareHorizontal;
      break;
    case 'center':
    default:
      styleClasses = 'inset-0';
      label = 'Open in this pane';
      Icon = ArrowRight;
      break;
  }

  return (
    <div className={`absolute ${styleClasses} p-2.5 z-40 pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95`}>
      <div className="h-full w-full rounded-2xl border-2 border-dashed border-sky-400/80 bg-[#0d1526]/90 backdrop-blur-md flex flex-col items-center justify-center text-sky-200 shadow-2xl">
        <div className="w-11 h-11 rounded-xl bg-sky-500/25 flex items-center justify-center mb-2.5 text-sky-300 shadow-inner">
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-xs font-medium font-sans text-white tracking-wide">{label}</span>
      </div>
    </div>
  );
};

// Main Unified Workspace Component hosting Terminals, Code Editor, Browser, and Split View
export const TerminalWorkspace: React.FC = () => {
  const {
    project,
    openTabs,
    terminalSessions,
    activeTerminalId,
    setActiveTerminalId,
    activeTabId,
    setActiveTabId,
    setActiveFile,
    openFileTab,
    closeTab,
    createTerminalSession,
    updateTerminalSession,
    removeTerminalSession,
    clearTerminalOutput,
    handleCLIStreamEvent,
    setArcLauncherOpen
  } = useWorkspaceStore();

  const [splitDirection, setSplitDirection] = useState<'horizontal' | 'vertical' | null>(null);
  const [pane2TabIds, setPane2TabIds] = useState<string[]>([]);
  const [primaryTabId, setPrimaryTabId] = useState<string | null>(null);
  const [secondaryTabId, setSecondaryTabId] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState<number>(0.5);
  const [maximizedPane, setMaximizedPane] = useState<'primary' | 'secondary' | null>(null);
  const [isResizingSplit, setIsResizingSplit] = useState<boolean>(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSplit(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      let ratio = 0.5;
      if (splitDirection === 'horizontal') {
        const raw = (moveEvent.clientY - rect.top) / rect.height;
        ratio = Math.max(0.12, Math.min(0.88, raw));
      } else {
        const raw = (moveEvent.clientX - rect.left) / rect.width;
        ratio = Math.max(0.12, Math.min(0.88, raw));
      }
      setSplitRatio(ratio);
    };

    const onMouseUp = () => {
      setIsResizingSplit(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Tab drag & drop docking and detach states
  const [draggedTab, setDraggedTab] = useState<UnifiedTabItem | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    isPrimary: boolean;
    zone: 'left' | 'right' | 'top' | 'bottom' | 'center';
  } | null>(null);
  const wasDockedOrDroppedRef = useRef<boolean>(false);

  // Filter sessions scoped to active project / worktree
  const worktreeSessions = useMemo(() => {
    if (!project) return terminalSessions;
    const normProj = project.path ? project.path.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '') : '';
    return terminalSessions.filter((s) => {
      if (s.projectId && s.projectId === project.id) return true;
      if (!s.workingDirectory || !normProj) return true;
      const normWork = s.workingDirectory.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
      return normWork === normProj || normWork.startsWith(normProj + '/');
    });
  }, [terminalSessions, project]);

  // Global stream event listener
  useEffect(() => {
    const unsub = window.api.onCLIStreamEvent((event) => {
      handleCLIStreamEvent(event);
    });
    return () => unsub();
  }, [handleCLIStreamEvent]);

  // Unified tabs computed from openTabs + active worktree terminal sessions
  const unifiedTabs = useMemo(() => {
    const list: UnifiedTabItem[] = [];
    const seenIds = new Set<string>();

    for (const t of openTabs) {
      if (t.type === 'terminal') {
        const sess =
          worktreeSessions.find((s) => s.id === t.terminalId || `term:${s.id}` === t.id) ||
          terminalSessions.find((s) => s.id === t.terminalId || `term:${s.id}` === t.id);
        if (sess) {
          seenIds.add(sess.id);
          seenIds.add(t.id);
          list.push({
            id: t.id,
            type: 'terminal',
            title: sess.title || t.title,
            terminalId: sess.id,
            session: sess
          });
        }
      } else if (t.type === 'file') {
        seenIds.add(t.id);
        list.push({
          id: t.id,
          type: 'file',
          title: t.title,
          filePath: t.filePath,
          isDirty: t.isDirty
        });
      } else if (t.type === 'browser') {
        seenIds.add(t.id);
        list.push({
          id: t.id,
          type: 'browser',
          title: t.title,
          url: t.url
        });
      } else if (t.type === 'plugins') {
        seenIds.add(t.id);
        list.push({
          id: t.id,
          type: 'plugins' as any,
          title: t.title
        });
      }
    }

    for (const sess of worktreeSessions) {
      const tabId = `term:${sess.id}`;
      if (!seenIds.has(sess.id) && !seenIds.has(tabId)) {
        list.push({
          id: tabId,
          type: 'terminal',
          title: sess.title,
          terminalId: sess.id,
          session: sess
        });
      }
    }

    return list;
  }, [openTabs, worktreeSessions]);

  // Partition tabs between Pane 1 and Pane 2 so they are mutually exclusive
  const pane1Tabs = useMemo(() => {
    return unifiedTabs.filter((t) => !pane2TabIds.includes(t.id));
  }, [unifiedTabs, pane2TabIds]);

  const pane2Tabs = useMemo(() => {
    return unifiedTabs.filter((t) => pane2TabIds.includes(t.id));
  }, [unifiedTabs, pane2TabIds]);

  // If pane 2 tabs become empty, collapse split automatically
  useEffect(() => {
    if (splitDirection && pane2Tabs.length === 0) {
      setSplitDirection(null);
      setSecondaryTabId(null);
    }
  }, [splitDirection, pane2Tabs.length]);

  // If pane 1 tabs become empty, restore pane 2 tabs to primary pane and collapse split
  useEffect(() => {
    if (splitDirection && pane1Tabs.length === 0 && pane2Tabs.length > 0) {
      setPane2TabIds([]);
      setSplitDirection(null);
      setPrimaryTabId(pane2Tabs[0].id);
      setSecondaryTabId(null);
    }
  }, [splitDirection, pane1Tabs.length, pane2Tabs]);

  // Sync activeTabId from store with primary tab
  useEffect(() => {
    if (activeTabId && activeTabId !== primaryTabId && pane1Tabs.some((t) => t.id === activeTabId)) {
      setPrimaryTabId(activeTabId);
    }
  }, [activeTabId, primaryTabId, pane1Tabs]);

  const primaryTab =
    pane1Tabs.find((t) => t.id === primaryTabId) ||
    pane1Tabs.find((t) => t.id === activeTabId) ||
    pane1Tabs[0] ||
    null;

  const secondaryTab =
    pane2Tabs.find((t) => t.id === secondaryTabId) ||
    pane2Tabs[0] ||
    null;

  const handleSelectTab = (tab: UnifiedTabItem, isPrimary: boolean) => {
    if (isPrimary) {
      setPrimaryTabId(tab.id);
      setActiveTabId(tab.id);
      if (tab.type === 'terminal' && tab.terminalId) {
        setActiveTerminalId(tab.terminalId);
      } else if (tab.type === 'file' && tab.filePath) {
        setActiveFile(tab.filePath);
      }
    } else {
      setSecondaryTabId(tab.id);
      if (tab.type === 'terminal' && tab.terminalId) {
        setActiveTerminalId(tab.terminalId);
      } else if (tab.type === 'file' && tab.filePath) {
        setActiveFile(tab.filePath);
      }
    }
  };

  const handleCloseTab = (tab: UnifiedTabItem) => {
    if (pane2TabIds.includes(tab.id)) {
      const closingIndex = pane2Tabs.findIndex((t) => t.id === tab.id);
      const nextPane2 = pane2TabIds.filter((id) => id !== tab.id);
      setPane2TabIds(nextPane2);
      if (nextPane2.length === 0) {
        setSplitDirection(null);
        setSecondaryTabId(null);
      } else if (secondaryTabId === tab.id) {
        const nextIndex = closingIndex > 0 ? closingIndex - 1 : 0;
        const targetId = nextPane2[nextIndex] || nextPane2[0];
        setSecondaryTabId(targetId);
        const targetTab = pane2Tabs.find((t) => t.id === targetId);
        if (targetTab?.type === 'terminal' && targetTab.terminalId) {
          setActiveTerminalId(targetTab.terminalId);
        } else if (targetTab?.type === 'file' && targetTab.filePath) {
          setActiveFile(targetTab.filePath);
        }
      }
    } else {
      const closingIndex = pane1Tabs.findIndex((t) => t.id === tab.id);
      const nextPane1 = pane1Tabs.filter((t) => t.id !== tab.id);
      if (nextPane1.length === 0) {
        if (pane2TabIds.length > 0) {
          setPane2TabIds([]);
          setSplitDirection(null);
          setPrimaryTabId(pane2TabIds[0]);
          setSecondaryTabId(null);
        } else {
          setArcLauncherOpen(true);
        }
      } else if (primaryTabId === tab.id) {
        const nextIndex = closingIndex > 0 ? closingIndex - 1 : 0;
        const targetTab = nextPane1[nextIndex] || nextPane1[0];
        setPrimaryTabId(targetTab.id);
        setActiveTabId(targetTab.id);
        if (targetTab.type === 'terminal' && targetTab.terminalId) {
          setActiveTerminalId(targetTab.terminalId);
        } else if (targetTab.type === 'file' && targetTab.filePath) {
          setActiveFile(targetTab.filePath);
        }
      }
    }

    if (tab.type === 'terminal' && tab.terminalId) {
      window.api?.terminalKill?.({ terminalId: tab.terminalId });
      removeTerminalSession(tab.terminalId);
    } else {
      closeTab(tab.id);
    }
  };

  // Drag and drop handlers
  const handleDragStartTab = (tab: UnifiedTabItem) => {
    wasDockedOrDroppedRef.current = false;
    setDraggedTab(tab);
  };

  const handleDragEndTab = (tab: UnifiedTabItem, e: React.DragEvent) => {
    // If released without docking on an edge or dropping on a tab bar, automatically detach!
    if (!wasDockedOrDroppedRef.current) {
      handleDetachTab(tab, e.screenX, e.screenY);
    }

    setDraggedTab(null);
    setDropTarget(null);
  };

  const handleDropReorderTab = (sourceId: string, targetId: string) => {
    wasDockedOrDroppedRef.current = true;
    useWorkspaceStore.getState().reorderTabs(sourceId, targetId);

    const targetInPane2 = pane2TabIds.includes(targetId);
    const sourceInPane2 = pane2TabIds.includes(sourceId);

    if (targetInPane2 && !sourceInPane2) {
      setPane2TabIds((prev) => [...prev, sourceId]);
      setSecondaryTabId(sourceId);
    } else if (!targetInPane2 && sourceInPane2) {
      setPane2TabIds((prev) => prev.filter((id) => id !== sourceId));
      setPrimaryTabId(sourceId);
    }
  };

  const handleDropOnHeader = (sourceId: string, targetPane: 'primary' | 'secondary') => {
    wasDockedOrDroppedRef.current = true;
    if (targetPane === 'secondary') {
      if (!pane2TabIds.includes(sourceId)) {
        setPane2TabIds((prev) => [...prev, sourceId]);
        setSecondaryTabId(sourceId);
      }
    } else {
      if (pane2TabIds.includes(sourceId)) {
        setPane2TabIds((prev) => prev.filter((id) => id !== sourceId));
        setPrimaryTabId(sourceId);
      }
    }
  };

  const handleDetachTab = (tab: UnifiedTabItem, x?: number, y?: number) => {
    if (window.api?.openDetachedTabWindow) {
      const currentProject = useWorkspaceStore.getState().project;
      window.api.openDetachedTabWindow({ tab, project: currentProject, x, y });

      // Cleanly remove tab from local window without killing the backend PTY session
      if (tab.type === 'terminal' && tab.terminalId) {
        useWorkspaceStore.setState((s) => {
          const sessionIndex = s.terminalSessions.findIndex((ts) => ts.id === tab.terminalId);
          const remaining = s.terminalSessions.filter((ts) => ts.id !== tab.terminalId);
          const nextSessionIndex = sessionIndex > 0 ? sessionIndex - 1 : 0;
          const nextActive = s.activeTerminalId === tab.terminalId ? (remaining[nextSessionIndex]?.id || null) : s.activeTerminalId;
          return {
            terminalSessions: remaining,
            openTabs: s.openTabs.filter((t) => !(t.type === 'terminal' && (t.terminalId === tab.terminalId || t.id === tab.id))),
            activeTerminalId: nextActive
          };
        });
      } else {
        closeTab(tab.id);
      }

      if (pane2TabIds.includes(tab.id)) {
        const closingIndex = pane2Tabs.findIndex((t) => t.id === tab.id);
        const nextPane2 = pane2TabIds.filter((id) => id !== tab.id);
        setPane2TabIds(nextPane2);
        if (nextPane2.length === 0) {
          setSplitDirection(null);
          setSecondaryTabId(null);
        } else if (secondaryTabId === tab.id) {
          const nextIndex = closingIndex > 0 ? closingIndex - 1 : 0;
          const targetId = nextPane2[nextIndex] || nextPane2[0];
          setSecondaryTabId(targetId);
          const targetTab = pane2Tabs.find((t) => t.id === targetId);
          if (targetTab?.type === 'terminal' && targetTab.terminalId) {
            setActiveTerminalId(targetTab.terminalId);
          } else if (targetTab?.type === 'file' && targetTab.filePath) {
            setActiveFile(targetTab.filePath);
          }
        }
      } else {
        const closingIndex = pane1Tabs.findIndex((t) => t.id === tab.id);
        const nextPane1 = pane1Tabs.filter((t) => t.id !== tab.id);
        if (nextPane1.length === 0) {
          if (pane2TabIds.length > 0) {
            setPane2TabIds([]);
            setSplitDirection(null);
            setPrimaryTabId(pane2TabIds[0]);
            setSecondaryTabId(null);
          } else {
            setArcLauncherOpen(true);
          }
        } else if (primaryTabId === tab.id) {
          const nextIndex = closingIndex > 0 ? closingIndex - 1 : 0;
          const targetTab = nextPane1[nextIndex] || nextPane1[0];
          setPrimaryTabId(targetTab.id);
          setActiveTabId(targetTab.id);
          if (targetTab.type === 'terminal' && targetTab.terminalId) {
            setActiveTerminalId(targetTab.terminalId);
          } else if (targetTab.type === 'file' && targetTab.filePath) {
            setActiveFile(targetTab.filePath);
          }
        }
      }
    }
  };

  const handlePaneDragOver = (e: React.DragEvent, isPrimary: boolean) => {
    if (!draggedTab) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    let zone: 'left' | 'right' | 'top' | 'bottom' | 'center' = 'center';
    if (x > 0.72) zone = 'right';
    else if (x < 0.28) zone = 'left';
    else if (y > 0.72) zone = 'bottom';
    else if (y < 0.28) zone = 'top';
    else zone = 'center';

    setDropTarget({ isPrimary, zone });
  };

  const handlePaneDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTarget(null);
    }
  };

  const handlePaneDrop = (e: React.DragEvent, isPrimary: boolean) => {
    e.preventDefault();
    if (!draggedTab) return;
    wasDockedOrDroppedRef.current = true;

    const zone = dropTarget?.zone || 'center';

    if (zone === 'right' || zone === 'bottom') {
      setSplitDirection(zone === 'right' ? 'vertical' : 'horizontal');
      // Dragged tab moves to Pane 2
      setPane2TabIds((prev) => {
        const next = prev.filter((id) => id !== draggedTab.id);
        return [...next, draggedTab.id];
      });
      setSecondaryTabId(draggedTab.id);

      // If dragged tab was in Pane 1 and left it empty, create a replacement PowerShell session
      const remainingPane1 = pane1Tabs.filter((t) => t.id !== draggedTab.id);
      if (remainingPane1.length === 0) {
        const newLeftId = createTerminalSession('powershell');
        setPrimaryTabId(`term:${newLeftId}`);
      } else if (primaryTabId === draggedTab.id) {
        setPrimaryTabId(remainingPane1[0].id);
      }
    } else if (zone === 'left' || zone === 'top') {
      setSplitDirection(zone === 'left' ? 'vertical' : 'horizontal');
      // Remaining tabs go to Pane 2, draggedTab is in Pane 1
      const otherTabs = unifiedTabs.filter((t) => t.id !== draggedTab.id);
      if (otherTabs.length > 0) {
        setPane2TabIds(otherTabs.map((t) => t.id));
        setSecondaryTabId(otherTabs[0].id);
      }
      setPrimaryTabId(draggedTab.id);
    } else {
      // Center: move to or activate in this pane
      if (isPrimary) {
        setPane2TabIds((prev) => prev.filter((id) => id !== draggedTab.id));
        handleSelectTab(draggedTab, true);
      } else {
        setPane2TabIds((prev) => (prev.includes(draggedTab.id) ? prev : [...prev, draggedTab.id]));
        handleSelectTab(draggedTab, false);
      }
    }

    setDraggedTab(null);
    setDropTarget(null);
  };

  const handleNewSession = (provider?: CLIProvider, isPrimary = true) => {
    if (provider) {
      const newId = createTerminalSession(provider);
      if (project) {
        updateTerminalSession(newId, {
          projectName: project.name,
          workingDirectory: project.path,
          branch: project.activeBranch || ''
        });
      }
      const newTabId = `term:${newId}`;
      if (isPrimary) {
        setActiveTerminalId(newId);
        setPrimaryTabId(newTabId);
      } else {
        setPane2TabIds((prev) => [...prev, newTabId]);
        setSecondaryTabId(newTabId);
      }
    } else {
      setArcLauncherOpen(true);
    }
  };

  const handleOpenFile = async (file: { path: string; name: string }, isPrimary = true) => {
    if (!project) return;
    const tabId = `file:${file.path}`;
    try {
      const content = await window.api.readFileContent({
        filePath: file.path,
        projectPath: project.path
      });
      openFileTab(file.path, content);
      setActiveFile(file.path, content);
    } catch {
      openFileTab(file.path, '');
      setActiveFile(file.path, '');
    }

    if (isPrimary) {
      setPrimaryTabId(tabId);
    } else {
      setPane2TabIds((prev) => (prev.includes(tabId) ? prev : [...prev, tabId]));
      setSecondaryTabId(tabId);
    }
  };

  const handleSplitHorizontal = () => {
    setSplitDirection('horizontal');
    if (pane2TabIds.length === 0) {
      const other = pane1Tabs.find((t) => t.id !== primaryTab?.id);
      if (other) {
        setPane2TabIds([other.id]);
        setSecondaryTabId(other.id);
      } else {
        const newId = createTerminalSession('powershell');
        const newTabId = `term:${newId}`;
        setPane2TabIds([newTabId]);
        setSecondaryTabId(newTabId);
      }
    }
  };

  const handleSplitVertical = () => {
    setSplitDirection('vertical');
    if (pane2TabIds.length === 0) {
      const other = pane1Tabs.find((t) => t.id !== primaryTab?.id);
      if (other) {
        setPane2TabIds([other.id]);
        setSecondaryTabId(other.id);
      } else {
        const newId = createTerminalSession('powershell');
        const newTabId = `term:${newId}`;
        setPane2TabIds([newTabId]);
        setSecondaryTabId(newTabId);
      }
    }
  };

  const handleCloseSplit = () => {
    setPane2TabIds([]);
    setSplitDirection(null);
    setSecondaryTabId(null);
    setMaximizedPane(null);
    setSplitRatio(0.5);
  };

  const renderPaneContent = (tabs: UnifiedTabItem[], activeTab: UnifiedTabItem | null, isPrimary: boolean) => {
    if (tabs.length === 0 || !activeTab) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none font-sans bg-transparent">
          <TerminalIcon className="w-8 h-8 text-[#717784] mb-2" />
          <p className="text-xs text-[#ECEDEF] font-medium">No active tab</p>
        </div>
      );
    }

    return (
      <div className="flex-1 min-h-0 relative overflow-hidden bg-transparent">
        {tabs.map((tab) => {
          const isTabActive = activeTab?.id === tab.id;

          if (tab.type === 'terminal') {
            const session =
              tab.session ||
              worktreeSessions.find((s) => s.id === tab.terminalId || `term:${s.id}` === tab.id) ||
              terminalSessions.find((s) => s.id === tab.terminalId || `term:${s.id}` === tab.id);
            if (!session) {
              if (!isTabActive) return null;
              return (
                <div key={tab.id} className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none font-sans bg-transparent">
                  <TerminalIcon className="w-8 h-8 text-[#717784] mb-2" />
                  <p className="text-xs text-[#ECEDEF] font-medium">Terminal session closed</p>
                </div>
              );
            }
            return (
              <div
                key={tab.id}
                style={{ display: isTabActive ? 'flex' : 'none' }}
                className="w-full h-full min-h-0 overflow-hidden flex-col"
              >
                <NativeTerminal
                  key={session.id}
                  session={session}
                  isActive={isTabActive && (isPrimary ? activeTerminalId === session.id : true)}
                  onFocus={() => setActiveTerminalId(session.id)}
                />
              </div>
            );
          }

          if (!isTabActive) return null;

          if (tab.type === 'file') {
            return (
              <div key={tab.id} className="w-full h-full min-h-0 overflow-hidden">
                <CodeEditor filePath={tab.filePath} />
              </div>
            );
          }

          if (tab.type === 'browser') {
            return (
              <div key={tab.id} className="w-full h-full min-h-0 overflow-hidden">
                <EmbeddedBrowser url={tab.url} tabId={tab.id} />
              </div>
            );
          }

          if (tab.type === 'plugins') {
            return (
              <div key={tab.id} className="w-full h-full min-h-0 overflow-hidden">
                <PluginsWorkspace />
              </div>
            );
          }

          return null;
        })}
      </div>
    );
  };

  if (unifiedTabs.length === 0) {
    return (
      <div className="h-full w-full bg-transparent flex flex-col items-center justify-center p-6 text-center select-none font-sans glass-workspace-surface">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#A4A8AF] mb-4 shadow-sm">
          <TerminalIcon className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-[#ECEDEF] mb-1">
          No Active Tabs
        </h3>
        <p className="text-xs text-[#717784] max-w-sm mb-5 leading-relaxed">
          Launch a terminal shell, autonomous AI agent, or open a file in{' '}
          <span className="text-[#ECEDEF] font-medium font-mono">{project?.name || 'this workspace'}</span>.
        </p>
        <button
          type="button"
          onClick={() => setArcLauncherOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-white border border-white/[0.1] transition-all cursor-pointer shadow-lg hover:border-white/20"
        >
          <Plus className="w-4 h-4" />
          <span>Select Terminal, Agent, or File...</span>
          <kbd className="text-[10px] bg-white/[0.1] px-1.5 py-0.5 rounded font-mono ml-1 text-[#A4A8AF]">
            Ctrl+T
          </kbd>
        </button>
      </div>
    );
  }

  const isSplitActive = Boolean(splitDirection && pane2Tabs.length > 0 && pane1Tabs.length > 0);

  return (
    <div className="h-full w-full bg-transparent select-none overflow-hidden relative flex flex-col">
      {/* Floating Guidance Banner when dragging a tab */}
      {draggedTab && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-medium shadow-2xl backdrop-blur-md select-none pointer-events-none bg-[#181a20]/95 text-[#ECEDEF] border-white/20 shadow-black/60 animate-in fade-in zoom-in-95 duration-100"
        >
          <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
          <span>Drop anywhere to open in a new window &bull; Drag to edge to split</span>
        </div>
      )}

      {/* Invisible global overlay during split resize to capture mouse movements smoothly */}
      {isResizingSplit && (
        <div
          className="fixed inset-0 z-50 select-none pointer-events-auto"
          style={{ cursor: splitDirection === 'horizontal' ? 'row-resize' : 'col-resize' }}
        />
      )}

      {isSplitActive ? (
        <div
          ref={splitContainerRef}
          className={`flex-1 flex overflow-hidden relative ${
            splitDirection === 'horizontal' ? 'flex-col' : 'flex-row'
          }`}
        >
          {/* Left / Top Pane */}
          {maximizedPane !== 'secondary' && (
            <div
              onDragOver={(e) => handlePaneDragOver(e, true)}
              onDragLeave={handlePaneDragLeave}
              onDrop={(e) => handlePaneDrop(e, true)}
              style={
                maximizedPane === 'primary'
                  ? { flex: '1 1 100%', width: '100%', height: '100%' }
                  : splitDirection === 'horizontal'
                  ? { height: `${splitRatio * 100}%`, flexShrink: 0 }
                  : { width: `${splitRatio * 100}%`, flexShrink: 0 }
              }
              className="flex flex-col min-h-0 min-w-0 overflow-hidden relative glass-workspace-surface"
            >
              {dropTarget?.isPrimary === true && (
                <DockDropZoneOverlay zone={dropTarget.zone} />
              )}
              <TerminalPaneHeader
                paneId="primary"
                tabs={pane1Tabs}
                activeTabId={primaryTab?.id || null}
                onSelectTab={(tab) => handleSelectTab(tab, true)}
                onCloseTab={handleCloseTab}
                onNewSession={(p) => handleNewSession(p, true)}
                onOpenFile={(f) => handleOpenFile(f, true)}
                onSplitHorizontal={handleSplitHorizontal}
                onSplitVertical={handleSplitVertical}
                onCloseSplit={handleCloseSplit}
                isSplit={true}
                isMaximized={maximizedPane === 'primary'}
                onToggleMaximize={() =>
                  setMaximizedPane((curr) => (curr === 'primary' ? null : 'primary'))
                }
                onClearOutput={
                  primaryTab?.type === 'terminal' && primaryTab.terminalId
                    ? () => clearTerminalOutput(primaryTab.terminalId!)
                    : undefined
                }
                isTerminalActive={primaryTab?.type === 'terminal'}
                onDragStartTab={handleDragStartTab}
                onDragEndTab={handleDragEndTab}
                onDropReorderTab={handleDropReorderTab}
                onDropOnHeader={handleDropOnHeader}
                onDetachTab={handleDetachTab}
              />
              {renderPaneContent(pane1Tabs, primaryTab, true)}
            </div>
          )}

          {/* Draggable Divider between split panes */}
          {!maximizedPane && (
            <div
              onMouseDown={handleSplitterMouseDown}
              onDoubleClick={() => setSplitRatio(0.5)}
              title="Arrastar para aumentar/diminuir janela &bull; Duplo clique para restaurar 50%"
              className={
                splitDirection === 'horizontal'
                  ? 'h-1 relative cursor-row-resize bg-white/[0.06] hover:bg-white/20 active:bg-accent/60 transition-colors z-30 flex-shrink-0 select-none'
                  : 'w-1 relative cursor-col-resize bg-white/[0.06] hover:bg-white/20 active:bg-accent/60 transition-colors z-30 flex-shrink-0 select-none'
              }
            >
              <div
                className={
                  splitDirection === 'horizontal'
                    ? 'absolute -top-1.5 -bottom-1.5 inset-x-0 cursor-row-resize'
                    : 'absolute -left-1.5 -right-1.5 inset-y-0 cursor-col-resize'
                }
              />
            </div>
          )}

          {/* Right / Bottom Pane (Split view) */}
          {maximizedPane !== 'primary' && (
            <div
              onDragOver={(e) => handlePaneDragOver(e, false)}
              onDragLeave={handlePaneDragLeave}
              onDrop={(e) => handlePaneDrop(e, false)}
              style={
                maximizedPane === 'secondary'
                  ? { flex: '1 1 100%', width: '100%', height: '100%' }
                  : splitDirection === 'horizontal'
                  ? { height: `${(1 - splitRatio) * 100}%`, flexShrink: 0 }
                  : { width: `${(1 - splitRatio) * 100}%`, flexShrink: 0 }
              }
              className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden relative glass-workspace-surface"
            >
              {dropTarget?.isPrimary === false && (
                <DockDropZoneOverlay zone={dropTarget.zone} />
              )}
              <TerminalPaneHeader
                paneId="secondary"
                tabs={pane2Tabs}
                activeTabId={secondaryTab?.id || null}
                onSelectTab={(tab) => handleSelectTab(tab, false)}
                onCloseTab={handleCloseTab}
                onNewSession={(p) => handleNewSession(p, false)}
                onOpenFile={(f) => handleOpenFile(f, false)}
                onSplitHorizontal={handleSplitHorizontal}
                onSplitVertical={handleSplitVertical}
                onCloseSplit={handleCloseSplit}
                isSplit={true}
                isMaximized={maximizedPane === 'secondary'}
                onToggleMaximize={() =>
                  setMaximizedPane((curr) => (curr === 'secondary' ? null : 'secondary'))
                }
                onClearOutput={
                  secondaryTab?.type === 'terminal' && secondaryTab.terminalId
                    ? () => clearTerminalOutput(secondaryTab.terminalId!)
                    : undefined
                }
                isTerminalActive={secondaryTab?.type === 'terminal'}
                onDragStartTab={handleDragStartTab}
                onDragEndTab={handleDragEndTab}
                onDropReorderTab={handleDropReorderTab}
                onDropOnHeader={handleDropOnHeader}
                onDetachTab={handleDetachTab}
              />
              {renderPaneContent(pane2Tabs, secondaryTab, false)}
            </div>
          )}
        </div>
      ) : (
        /* Single Unified Workspace Pane */
        <div
          onDragOver={(e) => handlePaneDragOver(e, true)}
          onDragLeave={handlePaneDragLeave}
          onDrop={(e) => handlePaneDrop(e, true)}
          className="flex-1 flex flex-col min-h-0 overflow-hidden relative glass-workspace-surface"
        >
          {dropTarget?.isPrimary === true && (
            <DockDropZoneOverlay zone={dropTarget.zone} />
          )}
          <TerminalPaneHeader
            paneId="primary"
            tabs={pane1Tabs}
            activeTabId={primaryTab?.id || null}
            onSelectTab={(tab) => handleSelectTab(tab, true)}
            onCloseTab={handleCloseTab}
            onNewSession={(p) => handleNewSession(p, true)}
            onOpenFile={(f) => handleOpenFile(f, true)}
            onSplitHorizontal={handleSplitHorizontal}
            onSplitVertical={handleSplitVertical}
            onCloseSplit={undefined}
            isSplit={false}
            onClearOutput={
              primaryTab?.type === 'terminal' && primaryTab.terminalId
                ? () => clearTerminalOutput(primaryTab.terminalId!)
                : undefined
            }
            isTerminalActive={primaryTab?.type === 'terminal'}
            onDragStartTab={handleDragStartTab}
            onDragEndTab={handleDragEndTab}
            onDropReorderTab={handleDropReorderTab}
            onDropOnHeader={handleDropOnHeader}
            onDetachTab={handleDetachTab}
          />
          {renderPaneContent(pane1Tabs, primaryTab, true)}
        </div>
      )}
    </div>
  );
};

export default TerminalWorkspace;
