import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowLeft,
  Palette,
  FolderGit2,
  ShieldCheck,
  Database,
  Keyboard,
  Info,
  Sparkles,
  Moon,
  Sun,
  Check,
  Search,
  Minus,
  Square,
  Copy,
  Trash2,
  Lock,
  Layers,
  FileCode,
  Folder,
  FolderOpen,
  FolderCode,
  ShieldAlert,
  HardDrive,
  RefreshCw,
  ExternalLink,
  Cpu,
  Radio,
  Share2,
  AlertTriangle,
  Bot,
  Terminal as TerminalIcon,
  Sliders,
  Globe,
  Smartphone,
  MessageSquare,
  FileText,
  Bell,
  BarChart2
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { MemoryRecord, DiscordStatusResponse } from '../../../shared/types';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Badge } from './ui/Badge';
import { FileIcon } from '../utils/file-icons';
import { useKeyboardShortcutsStore, formatKeyComboFromEvent } from '../stores/keyboard-shortcuts.store';
import { AgentsSettingsTab } from './settings/AgentsSettingsTab';

export type SettingsSection =
  | 'agents'
  | 'ai-providers'
  | 'orchestration'
  | 'linear'
  | 'computer-use'
  | 'voice'
  | 'orca-account'
  | 'general'
  | 'integrations'
  | 'mobile'
  | 'automations'
  | 'artifacts'
  | 'share-skills'
  | 'session-search'
  | 'workspace'
  | 'task-sources'
  | 'terminal'
  | 'quick-commands'
  | 'browser'
  | 'mobile-emulator'
  | 'floating-workspace'
  | 'appearance'
  | 'chat-ui'
  | 'input-editing'
  | 'notifications'
  | 'shortcuts'
  | 'stats-usage'
  | 'security'
  | 'memory'
  | 'about';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    toggleSettings,
    settingsActiveTab,
    setSettingsActiveTab,
    theme,
    setTheme,
    fileIconTheme,
    setFileIconTheme,
    showGitFileColors,
    setShowGitFileColors,
    project,
    gitStatus,
    loadGitStatus,
    addLog
  } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<SettingsSection>(
    (settingsActiveTab as SettingsSection) || 'agents'
  );

  useEffect(() => {
    if (settingsActiveTab) {
      setActiveTab(settingsActiveTab as SettingsSection);
    }
  }, [settingsActiveTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);

  // safeStorage test states
  const [testKey, setTestKey] = useState('anthropic-api-key');
  const [testSecret, setTestSecret] = useState('');
  const [retrievedSecret, setRetrievedSecret] = useState<string | null>(null);

  // Memories state
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [memorySearch, setMemorySearch] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Discord Rich Presence state
  const [discordStatus, setDiscordStatus] = useState<DiscordStatusResponse | null>(null);
  const [isDiscordToggling, setIsDiscordToggling] = useState(false);
  const [customClientIdInput, setCustomClientIdInput] = useState('');
  const [isSavingClientId, setIsSavingClientId] = useState(false);
  const [clientIdSavedNotice, setClientIdSavedNotice] = useState(false);

  const {
    shortcuts,
    recordingId,
    setRecordingId,
    updateShortcut,
    resetShortcut,
    resetAllToDefault
  } = useKeyboardShortcutsStore();

  // Keybind recording listener (Discord style)
  useEffect(() => {
    if (!recordingId) return;

    const handleRecordKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecordingId(null);
        return;
      }

      const combo = formatKeyComboFromEvent(e);
      if (combo) {
        updateShortcut(recordingId, combo);
      }
    };

    window.addEventListener('keydown', handleRecordKey, { capture: true });
    return () => window.removeEventListener('keydown', handleRecordKey, { capture: true });
  }, [recordingId, updateShortcut, setRecordingId]);

  // Load Discord status
  useEffect(() => {
    if (!isSettingsOpen) return;
    window.api?.getDiscordStatus?.()
      .then((status) => {
        setDiscordStatus(status);
        setCustomClientIdInput(status?.clientId || '');
      })
      .catch(() => {});

    const unsub = window.api?.onDiscordStatusChange?.((status) => {
      setDiscordStatus(status);
      if (status?.clientId) setCustomClientIdInput(status.clientId);
    });
    return () => unsub?.();
  }, [isSettingsOpen]);

  // Handle window maximize sync
  useEffect(() => {
    window.api?.isWindowMaximized?.().then(setIsMaximized).catch(() => {});
    const unsub = window.api?.onWindowStateChange?.((state) => {
      setIsMaximized(state.isMaximized);
    });
    return () => unsub?.();
  }, []);

  // Keyboard shortcut listener (ESC to close)
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        toggleSettings(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, toggleSettings]);

  // Load memories when settings opens
  useEffect(() => {
    if (isSettingsOpen) {
      loadMemories();
    }
  }, [isSettingsOpen]);

  const loadMemories = async () => {
    try {
      const list = await window.api.listMemories();
      setMemories(list || []);
    } catch (err: any) {
      addLog(`Failed to load memories: ${err.message}`, 'error');
    }
  };

  const handleStoreSecret = async () => {
    if (!testKey || !testSecret) return;
    try {
      await window.api.storeSecret({ key: testKey, value: testSecret });
      addLog(`Encrypted and stored secret '${testKey}' in OS safeStorage.`, 'info');
      setTestSecret('');
      const val = await window.api.getSecret({ key: testKey });
      setRetrievedSecret(val);
    } catch (err: any) {
      addLog(`SafeStorage error: ${err.message}`, 'error');
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await window.api.deleteMemory({ id });
      setMemories((prev) => prev.filter((m) => m.id !== id));
      addLog(`Deleted memory record ${id}`, 'info');
    } catch (err: any) {
      addLog(`Delete memory error: ${err.message}`, 'error');
    }
  };

  const handleThemeChange = async (newTheme: 'glass' | 'solid' | 'light') => {
    setTheme(newTheme);
    await window.api.updateSettings({ theme: newTheme });
    addLog(`Switched theme to [${newTheme.toUpperCase()}]`, 'info');
  };

  const handleToggleDiscord = async () => {
    if (!discordStatus || isDiscordToggling) return;
    setIsDiscordToggling(true);
    try {
      const targetState = !discordStatus.enabled;
      const res = await window.api.updateDiscordSettings({ enabled: targetState });
      setDiscordStatus(res);
      addLog(`Discord Rich Presence ${targetState ? 'ativado' : 'desativado'}.`, 'info');
    } catch (err: any) {
      addLog(`Erro ao alterar Discord Rich Presence: ${err.message}`, 'error');
    } finally {
      setIsDiscordToggling(false);
    }
  };

  const handleSaveClientId = async () => {
    setIsSavingClientId(true);
    setClientIdSavedNotice(false);
    try {
      const res = await window.api.updateDiscordSettings({ clientId: customClientIdInput.trim() });
      setDiscordStatus(res);
      setClientIdSavedNotice(true);
      setTimeout(() => setClientIdSavedNotice(false), 2000);
      addLog(`Discord Client ID atualizado.`, 'info');
    } catch (err: any) {
      addLog(`Erro ao atualizar Client ID: ${err.message}`, 'error');
    } finally {
      setIsSavingClientId(false);
    }
  };

  const handleResetClientId = async () => {
    setIsSavingClientId(true);
    try {
      const res = await window.api.updateDiscordSettings({ clientId: '' });
      setDiscordStatus(res);
      setCustomClientIdInput(res.clientId || '');
      addLog(`Discord Client ID restaurado para a predefinição.`, 'info');
    } catch (err: any) {
      addLog(`Erro ao restaurar Client ID: ${err.message}`, 'error');
    } finally {
      setIsSavingClientId(false);
    }
  };

  const isGlass = theme === 'glass';
  const isSolid = theme === 'solid';
  const isLight = theme === 'light';

  if (!isSettingsOpen) return null;

  const filteredMemories = memories.filter(
    (m) =>
      !memorySearch ||
      m.entityKey.toLowerCase().includes(memorySearch.toLowerCase()) ||
      m.content.toLowerCase().includes(memorySearch.toLowerCase()) ||
      m.tier.toLowerCase().includes(memorySearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#101113] text-[#ECEDEF] select-none font-sans overflow-hidden animate-in fade-in duration-150">
      {/* 1. TOP CHROME / HEADER (Full Frameless Window Title Bar) */}
      <div
        className="h-11 w-full flex items-center justify-between px-3 border-b border-white/[0.08] bg-[#141619]/80 backdrop-blur-md flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Left: Back Button & Title */}
        <div
          className="flex items-center gap-2.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={() => toggleSettings(false)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs text-[#ECEDEF] transition-colors cursor-pointer border border-white/[0.08]"
            title="Voltar ao Workspace (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#A4A8AF]" />
            <span className="font-medium">Voltar</span>
          </button>

          <div className="w-[1px] h-4 bg-white/[0.1] mx-1" />

          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-tight text-[#ECEDEF]">
            <span>Definições do Sistema</span>
          </div>

          <span className="text-[10px] text-[#747982] bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.06] font-mono ml-1">
            ESC para sair
          </span>
        </div>

        {/* Center: Quick Search Filter across Settings */}
        <div
          className="relative w-80 max-w-sm hidden sm:block"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Search className="w-3.5 h-3.5 text-[#747982] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Procurar definições..."
            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-white/30 text-xs text-[#ECEDEF] rounded-lg pl-8 pr-3 py-1 placeholder:text-[#747982] focus:outline-none transition-all"
          />
        </div>

        {/* Right: Window Controls */}
        <div
          className="flex items-center gap-0.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={() => window.api?.minimizeWindow?.()}
            className="w-8 h-7 flex items-center justify-center rounded-sm text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Minimizar"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => window.api?.maximizeWindow?.()}
            className="w-8 h-7 flex items-center justify-center rounded-sm text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.08] transition-colors cursor-pointer"
            title={isMaximized ? 'Restaurar' : 'Maximizar'}
          >
            {isMaximized ? <Copy className="w-3 h-3 rotate-180" /> : <Square className="w-3 h-3" />}
          </button>
          <button
            onClick={() => toggleSettings(false)}
            className="w-8 h-7 flex items-center justify-center rounded-sm text-[#A4A8AF] hover:text-white hover:bg-[#E81123] transition-colors cursor-pointer"
            title="Fechar Definições"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. MAIN BODY (Sidebar Navigation + Content Canvas) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Settings Navigation Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-white/[0.08] bg-[#141619]/40 p-3 space-y-4 overflow-y-auto no-scrollbar">
          {/* AI CAPABILITIES */}
          <div className="space-y-1">
            <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#747982] font-mono">
              AI Capabilities
            </div>

            <button
              onClick={() => {
                setActiveTab('agents');
                setSettingsActiveTab('agents');
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                activeTab === 'agents'
                  ? 'bg-white/[0.09] text-white border border-white/[0.1] shadow-xs'
                  : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Bot className="w-3.5 h-3.5 text-[#A4A8AF]" />
                <span>Agents</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('security');
                setSettingsActiveTab('security');
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-white/[0.09] text-white border border-white/[0.1] shadow-xs'
                  : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#A4A8AF]" />
                <span>AI Provider Accounts...</span>
              </div>
              <span className="text-[9px] text-[#717784] font-mono">OPTIONAL</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('memory');
                setSettingsActiveTab('memory');
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                activeTab === 'memory'
                  ? 'bg-white/[0.09] text-white border border-white/[0.1] shadow-xs'
                  : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#A4A8AF]" />
              <span>Orchestration</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('integrations');
                setSettingsActiveTab('integrations');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-[#A4A8AF]" />
              <span>Linear</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('agents');
                setSettingsActiveTab('agents');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5 text-[#A4A8AF]" />
              <span>Computer Use</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('integrations');
                setSettingsActiveTab('integrations');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-[#A4A8AF]" />
              <span>Voice</span>
            </button>
          </div>

          {/* SET UP */}
          <div className="space-y-1">
            <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#747982] font-mono">
              Set Up
            </div>

            <button
              onClick={() => {
                setActiveTab('about');
                setSettingsActiveTab('about');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-[#A4A8AF]" />
              <span>Orca Account</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('workspace');
                setSettingsActiveTab('workspace');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-[#A4A8AF]" />
              <span>General</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('integrations');
                setSettingsActiveTab('integrations');
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                activeTab === 'integrations'
                  ? 'bg-white/[0.09] text-white border border-white/[0.1] shadow-xs'
                  : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-[#A4A8AF]" />
                <span>Integrations</span>
              </div>
              {discordStatus?.enabled && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    discordStatus.connected ? 'bg-[#22C55E]' : 'bg-[#EF4444]'
                  }`}
                />
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('workspace');
                setSettingsActiveTab('workspace');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#A4A8AF]" />
              <span>Mobile</span>
            </button>
          </div>

          {/* WORKFLOWS */}
          <div className="space-y-1">
            <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#747982] font-mono">
              Workflows
            </div>

            <button
              onClick={() => {
                setActiveTab('agents');
                setSettingsActiveTab('agents');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#A4A8AF]" />
              <span>Automations</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('workspace');
                setSettingsActiveTab('workspace');
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-[#A4A8AF]" />
                <span>Artifacts</span>
              </div>
              <span className="text-[9px] text-[#717784] font-mono">BETA</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('workspace');
                setSettingsActiveTab('workspace');
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Share2 className="w-3.5 h-3.5 text-[#A4A8AF]" />
                <span>Share Skills</span>
              </div>
              <span className="text-[9px] text-[#717784] font-mono">BETA</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('workspace');
                setSettingsActiveTab('workspace');
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                activeTab === 'workspace'
                  ? 'bg-white/[0.09] text-white border border-white/[0.1] shadow-xs'
                  : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5 text-[#A4A8AF]" />
              <span>Git & Source Control</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('shortcuts');
                setSettingsActiveTab('shortcuts');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
            >
              <Keyboard className="w-3.5 h-3.5 text-[#A4A8AF]" />
              <span>Quick Commands</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('workspace');
                setSettingsActiveTab('workspace');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-[#A4A8AF]" />
              <span>Browser</span>
            </button>
          </div>

          {/* INTERFACE */}
          <div className="space-y-1">
            <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#747982] font-mono">
              Interface
            </div>

            <button
              onClick={() => {
                setActiveTab('appearance');
                setSettingsActiveTab('appearance');
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                activeTab === 'appearance'
                  ? 'bg-white/[0.09] text-white border border-white/[0.1] shadow-xs'
                  : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
              }`}
            >
              <Palette className="w-3.5 h-3.5 text-[#A4A8AF]" />
              <span>Appearance</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('shortcuts');
                setSettingsActiveTab('shortcuts');
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                activeTab === 'shortcuts'
                  ? 'bg-white/[0.09] text-white border border-white/[0.1] shadow-xs'
                  : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5 text-[#A4A8AF]" />
              <span>Shortcuts</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('about');
                setSettingsActiveTab('about');
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                activeTab === 'about'
                  ? 'bg-white/[0.09] text-white border border-white/[0.1] shadow-xs'
                  : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
              }`}
            >
              <Info className="w-3.5 h-3.5 text-[#A4A8AF]" />
              <span>Stats & Usage / About</span>
            </button>
          </div>
        </aside>

        {/* Content Canvas */}
        <main className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto space-y-8">
          {/* TAB 0: AGENTS & AI CLI INTEGRATION SYSTEM */}
          {activeTab === 'agents' && <AgentsSettingsTab />}
          {/* TAB 1: APARÊNCIA & INTERFACE */}
          {activeTab === 'appearance' && (
            <div className="space-y-8 animate-in fade-in duration-150">
              {/* Header */}
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
                  Aparência & Sistema Visual
                </h2>
                <p className="text-xs text-[#A4A8AF]">
                  Personalize o estilo visual da janela, os ícones do explorador de ficheiros e as cores de estado do Git.
                </p>
              </div>

              {/* 1.1 Tema de Cores da Aplicação */}
              <div className="space-y-3.5 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#ECEDEF]">Arquitetura de Tema</h3>
                    <p className="text-xs text-[#747982] mt-0.5">
                      Escolha entre superfícies com efeito de vidro translúcido ou superfícies sólidas opacas.
                    </p>
                  </div>
                  <Badge variant="accent" size="sm">
                    {isGlass ? 'Glassmorphism Ativo' : isSolid ? 'Solid Dark Ativo' : 'Light Ativo'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                  {/* Glass Option Card */}
                  <div
                    onClick={() => handleThemeChange('glass')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden ${
                      isGlass
                        ? 'border-white/40 bg-white/[0.08] shadow-lg ring-1 ring-white/20'
                        : 'border-white/[0.08] hover:border-white/20 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[#ECEDEF] flex items-center gap-2 text-xs">
                        <Sparkles className="w-4 h-4 text-[#ECEDEF]" />
                        <span>Glassmorphism</span>
                      </span>
                      {isGlass && <Check className="w-4 h-4 text-[#ECEDEF]" />}
                    </div>

                    <div className="h-14 rounded-lg bg-white/[0.06] backdrop-blur-md border border-white/10 p-2 flex flex-col justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-white" />
                        <span className="w-12 h-1.5 rounded-full bg-white/30" />
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10" />
                    </div>
                    <p className="text-[11px] text-[#A4A8AF]">
                      Superfícies neutras translúcidas com desfoque e separadores subtis de 1px.
                    </p>
                  </div>

                  {/* Solid Option Card */}
                  <div
                    onClick={() => handleThemeChange('solid')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden ${
                      isSolid
                        ? 'border-white/40 bg-white/[0.08] shadow-lg ring-1 ring-white/20'
                        : 'border-white/[0.08] hover:border-white/20 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[#ECEDEF] flex items-center gap-2 text-xs">
                        <Moon className="w-4 h-4 text-[#ECEDEF]" />
                        <span>Solid Dark</span>
                      </span>
                      {isSolid && <Check className="w-4 h-4 text-[#ECEDEF]" />}
                    </div>

                    <div className="h-14 rounded-lg bg-[#141619] border border-white/[0.08] p-2 flex flex-col justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-white/60" />
                        <span className="w-12 h-1.5 rounded-full bg-white/20" />
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/[0.05]" />
                    </div>
                    <p className="text-[11px] text-[#A4A8AF]">
                      Painéis escuros opacos clássicos, sem transparência, foco em contraste sólido.
                    </p>
                  </div>

                  {/* Light Option Card */}
                  <div
                    onClick={() => handleThemeChange('light')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden ${
                      isLight
                        ? 'border-white/40 bg-white/[0.08] shadow-lg ring-1 ring-white/20'
                        : 'border-white/[0.08] hover:border-white/20 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[#ECEDEF] flex items-center gap-2 text-xs">
                        <Sun className="w-4 h-4 text-[#ECEDEF]" />
                        <span>Light</span>
                      </span>
                      {isLight && <Check className="w-4 h-4 text-[#ECEDEF]" />}
                    </div>

                    <div className="h-14 rounded-lg bg-neutral-100 border border-neutral-300 p-2 flex flex-col justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-neutral-800" />
                        <span className="w-12 h-1.5 rounded-full bg-neutral-400" />
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-neutral-300" />
                    </div>
                    <p className="text-[11px] text-[#A4A8AF]">
                      Superfícies claras, alto contraste para ambientes bem iluminados.
                    </p>
                  </div>
                </div>
              </div>

              {/* 1.2 Tema de Ícones de Ficheiros e Pastas (VS Code Style vs Minimal) */}
              <div className="space-y-4 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#ECEDEF]">
                      Tema de Ícones de Ficheiros & Pastas
                    </h3>
                    <p className="text-xs text-[#747982] mt-0.5">
                      Personalize a biblioteca de ícones para o explorador de código, idêntico às extensões do VS Code.
                    </p>
                  </div>
                  <Badge variant="accent" size="sm">
                    {fileIconTheme === 'material' ? 'Material Icons (Predefinido)' : 'Minimal Monocromático'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Material Icons Option Card */}
                  <div
                    onClick={() => setFileIconTheme('material')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden ${
                      fileIconTheme === 'material'
                        ? 'border-white/40 bg-white/[0.08] shadow-lg ring-1 ring-white/20'
                        : 'border-white/[0.08] hover:border-white/20 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="font-semibold text-[#ECEDEF] text-xs flex items-center gap-2">
                        <Layers className="w-4 h-4 text-sky-400" />
                        <span>Material Theme (VS Code)</span>
                      </span>
                      {fileIconTheme === 'material' && <Check className="w-4 h-4 text-[#ECEDEF]" />}
                    </div>

                    {/* Visual Preview of Material Icons */}
                    <div className="bg-[#101113] border border-white/[0.08] rounded-lg p-2.5 space-y-1.5 mb-2.5 font-mono text-[11px]">
                      <div className="flex items-center gap-2 text-xs">
                        <FileIcon name="src" isDirectory={true} isExpanded={true} theme="material" />
                        <span className="text-[#ECEDEF]">src/</span>
                      </div>
                      <div className="flex items-center gap-2 pl-3">
                        <FileIcon name="App.tsx" isDirectory={false} theme="material" />
                        <span className="text-[#ECEDEF]">App.tsx</span>
                      </div>
                      <div className="flex items-center gap-2 pl-3">
                        <FileIcon name="index.ts" isDirectory={false} theme="material" />
                        <span className="text-[#ECEDEF]">index.ts</span>
                      </div>
                      <div className="flex items-center gap-2 pl-3">
                        <FileIcon name="package.json" isDirectory={false} theme="material" />
                        <span className="text-[#ECEDEF]">package.json</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#A4A8AF]">
                      Ícones semânticos com cores dedicadas para cada extensão (.ts, .tsx, .json, .py, .css) e pastas especiais.
                    </p>
                  </div>

                  {/* Minimal Icons Option Card */}
                  <div
                    onClick={() => setFileIconTheme('minimal')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden ${
                      fileIconTheme === 'minimal'
                        ? 'border-white/40 bg-white/[0.08] shadow-lg ring-1 ring-white/20'
                        : 'border-white/[0.08] hover:border-white/20 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="font-semibold text-[#ECEDEF] text-xs flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-[#A4A8AF]" />
                        <span>Minimal Monocromático</span>
                      </span>
                      {fileIconTheme === 'minimal' && <Check className="w-4 h-4 text-[#ECEDEF]" />}
                    </div>

                    {/* Visual Preview of Minimal Icons */}
                    <div className="bg-[#101113] border border-white/[0.08] rounded-lg p-2.5 space-y-1.5 mb-2.5 font-mono text-[11px]">
                      <div className="flex items-center gap-2 text-xs">
                        <FileIcon name="src" isDirectory={true} isExpanded={true} theme="minimal" />
                        <span className="text-[#A4A8AF]">src/</span>
                      </div>
                      <div className="flex items-center gap-2 pl-3">
                        <FileIcon name="App.tsx" isDirectory={false} theme="minimal" />
                        <span className="text-[#A4A8AF]">App.tsx</span>
                      </div>
                      <div className="flex items-center gap-2 pl-3">
                        <FileIcon name="index.ts" isDirectory={false} theme="minimal" />
                        <span className="text-[#A4A8AF]">index.ts</span>
                      </div>
                      <div className="flex items-center gap-2 pl-3">
                        <FileIcon name="package.json" isDirectory={false} theme="minimal" />
                        <span className="text-[#A4A8AF]">package.json</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#A4A8AF]">
                      Ícones neutros e minimalistas em tons de cinzento para uma estética completamente sóbria e discreta.
                    </p>
                  </div>
                </div>
              </div>

              {/* 1.3 Cores Git no Explorador de Ficheiros */}
              <div className="space-y-4 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#ECEDEF]">
                      Cores de Estado Git no Explorador
                    </h3>
                    <p className="text-xs text-[#747982] mt-0.5">
                      Destaque ficheiros e pastas com base no seu estado no repositório Git (Modificado, Novo, Eliminado).
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => setShowGitFileColors(!showGitFileColors)}
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center cursor-pointer ${
                      showGitFileColors ? 'bg-[#ECEDEF]' : 'bg-white/[0.12]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full transition-transform ${
                        showGitFileColors
                          ? 'bg-[#101113] translate-x-5'
                          : 'bg-[#A4A8AF] translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Git Color Legend Preview */}
                <div className="bg-[#101113] border border-white/[0.08] rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E5A93C]" />
                    <span className="text-[#E5A93C] font-semibold">Modificado (M)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#73C991]" />
                    <span className="text-[#73C991] font-semibold">Novo / Untracked (U)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#56B6C2]" />
                    <span className="text-[#56B6C2] font-semibold">Renomeado (R)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E06C75]" />
                    <span className="text-[#E06C75] font-semibold">Eliminado (D)</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#747982]">
                  Quando ativado, os nomes dos ficheiros modificados aparecem a cor amarela com badge 'M', os ficheiros novos a verde com badge 'U', e as pastas com ficheiros alterados exibem um contador.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: ESPAÇO DE TRABALHO & GIT */}
          {activeTab === 'workspace' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
                  Espaço de Trabalho & Controlo de Versões
                </h2>
                <p className="text-xs text-[#A4A8AF]">
                  Configurações do repositório Git, indexação de ficheiros e gestão de worktrees.
                </p>
              </div>

              {/* Active Workspace Info */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-[#ECEDEF]">Repositório Ativo</h3>
                {project ? (
                  <div className="bg-[#101113] border border-white/[0.08] rounded-xl p-3.5 space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-[#747982]">Nome:</span>
                      <span className="text-[#ECEDEF] font-semibold">{project.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#747982]">Caminho:</span>
                      <span className="text-[#A4A8AF] truncate max-w-md">{project.path}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#747982]">Ramo Git:</span>
                      <span className="text-[#ECEDEF]">{gitStatus?.branch || 'master'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#747982]">Ficheiros Alterados:</span>
                      <span className="text-[#E5A93C] font-semibold">
                        {gitStatus?.changedFiles?.length || 0} alterações
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#747982] italic">Nenhum projeto aberto no momento.</p>
                )}

                <div className="pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (project) {
                        loadGitStatus(project.path);
                        addLog('Atualizado estado do Git e índice de ficheiros.', 'info');
                      }
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Atualizar Estado do Repositório Agora</span>
                  </Button>
                </div>
              </div>

              {/* Excluded Folders */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-[#ECEDEF]">Pastas Excluídas da Indexação</h3>
                <p className="text-xs text-[#747982]">
                  Estas pastas são ignoradas pelo grafo de código e motor de inteligência para máxima performance.
                </p>
                <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
                  {['node_modules', '.git', 'dist', 'build', 'out', 'graphify-out', '.agents'].map((dir) => (
                    <span
                      key={dir}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[#A4A8AF]"
                    >
                      {dir}/
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SEGURANÇA & CREDENCIAIS */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
                  Segurança & Encriptação de Credenciais
                </h2>
                <p className="text-xs text-[#A4A8AF]">
                  Proteção de chaves de API e isolamento de rede através do cofre de credenciais do sistema operativo.
                </p>
              </div>

              {/* safeStorage Keyring */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-[#ECEDEF]">
                      Cofre de Credenciais do Sistema Operativo (safeStorage)
                    </h3>
                  </div>
                  <Badge variant="accent" size="sm">
                    DPAPI / Hardware Encriptado
                  </Badge>
                </div>

                <p className="text-xs text-[#A4A8AF] leading-relaxed">
                  Todas as chaves de API e segredos são cifrados pelo hardware e chaves de utilizador do Windows antes de qualquer gravação na base de dados SQLite. Nenhuma chave é guardada em texto limpo.
                </p>

                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={testKey}
                      onChange={(e) => setTestKey(e.target.value)}
                      placeholder="Nome da chave (ex: anthropic-key)"
                      className="px-3 py-1.5 bg-[#101113] border border-white/[0.08] rounded-xl text-[#ECEDEF] text-xs focus:outline-none focus:border-white/30 font-mono"
                    />
                    <input
                      type="password"
                      value={testSecret}
                      onChange={(e) => setTestSecret(e.target.value)}
                      placeholder="Valor secreto da chave"
                      className="sm:col-span-2 px-3 py-1.5 bg-[#101113] border border-white/[0.08] rounded-xl text-[#ECEDEF] text-xs focus:outline-none focus:border-white/30 font-mono"
                    />
                  </div>

                  <Button variant="secondary" size="md" onClick={handleStoreSecret} className="w-full">
                    Cifrar e Guardar no safeStorage
                  </Button>

                  {retrievedSecret && (
                    <div className="p-3 bg-[#101113] border border-white/[0.08] rounded-xl text-xs space-y-1 font-mono">
                      <span className="text-[#747982] block text-[10px] uppercase font-semibold">
                        Valor Decifrado pelo SO:
                      </span>
                      <span className="text-emerald-400 break-all">{retrievedSecret}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MEMÓRIA & AGENTES */}
          {activeTab === 'memory' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
                  Memória de 5 Níveis dos Agentes
                </h2>
                <p className="text-xs text-[#A4A8AF]">
                  Inspeção e gestão dos registos de memória persistentes dos agentes de IA.
                </p>
              </div>

              {/* Memory Records Explorer */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#ECEDEF]" />
                    <h3 className="text-sm font-semibold text-[#ECEDEF]">Registos em Base de Dados</h3>
                  </div>
                  <Badge variant="neutral" size="sm">
                    {memories.length} entradas guardadas
                  </Badge>
                </div>

                {/* Filter Memory */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#747982] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={memorySearch}
                    onChange={(e) => setMemorySearch(e.target.value)}
                    placeholder="Filtrar memórias por chave ou conteúdo..."
                    className="w-full bg-[#101113] border border-white/[0.08] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#ECEDEF] placeholder:text-[#747982] focus:outline-none focus:border-white/30 font-mono"
                  />
                </div>

                {/* Memories List */}
                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-white/[0.04]">
                  {filteredMemories.length === 0 ? (
                    <p className="text-xs text-[#747982] italic py-4 text-center">
                      Nenhum registo de memória encontrado.
                    </p>
                  ) : (
                    filteredMemories.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between py-2 text-xs font-mono group"
                      >
                        <div className="truncate pr-3">
                          <span className="font-semibold text-emerald-400 uppercase mr-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                            {m.tier}
                          </span>
                          <span className="text-[#747982] font-semibold">{m.entityKey}: </span>
                          <span className="text-[#ECEDEF]">{m.content}</span>
                        </div>
                        <IconButton
                          icon={Trash2}
                          onClick={() => handleDeleteMemory(m.id)}
                          tooltip="Eliminar memória"
                          size="sm"
                          className="text-[#747982] hover:text-[#E06C75]"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ATALHOS DE TECLADO (ESTILO DISCORD) */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
                    Atalhos de Teclado
                  </h2>
                  <p className="text-xs text-[#A4A8AF]">
                    Personaliza as combinações de teclas para navegação rápida e controlo do Orbito.
                  </p>
                </div>
                <button
                  onClick={resetAllToDefault}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#A4A8AF] hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  Repor Predefinições
                </button>
              </div>

              {recordingId && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between animate-pulse">
                  <span>A gravar atalho... Pressiona a combinação de teclas pretendida (ex: Ctrl + Shift + T).</span>
                  <button
                    onClick={() => setRecordingId(null)}
                    className="px-2 py-0.5 rounded text-[11px] bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  >
                    Cancelar (Esc)
                  </button>
                </div>
              )}

              <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl overflow-hidden divide-y divide-white/[0.06] text-xs">
                {shortcuts.map((sc) => {
                  const isRecording = recordingId === sc.id;
                  const isCustom = sc.currentCombo !== sc.defaultCombo;

                  return (
                    <div
                      key={sc.id}
                      className={`flex items-center justify-between p-3.5 transition-colors ${
                        isRecording ? 'bg-amber-500/10' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="space-y-0.5 max-w-[65%]">
                        <div className="flex items-center gap-2">
                          <span className="text-[#ECEDEF] font-medium">{sc.label}</span>
                          <span className="text-[10px] text-[#717784] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.04]">
                            {sc.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#717784]">{sc.description}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isRecording ? (
                          <div className="font-mono text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-black font-semibold animate-pulse shadow-sm">
                            Pressiona teclas...
                          </div>
                        ) : (
                          <button
                            onClick={() => setRecordingId(sc.id)}
                            className="font-mono text-xs text-[#ECEDEF] hover:text-white bg-[#101113] hover:bg-white/[0.08] border border-white/[0.12] hover:border-white/[0.25] px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-xs"
                            title="Clica para gravar um novo atalho"
                          >
                            {sc.currentCombo || 'Nenhum'}
                          </button>
                        )}

                        {isCustom && !isRecording && (
                          <button
                            onClick={() => resetShortcut(sc.id)}
                            className="text-[10px] text-[#717784] hover:text-[#ECEDEF] px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
                            title="Repor valor de fábrica"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: INTEGRAÇÕES & DISCORD RICH PRESENCE */}
          {activeTab === 'integrations' && (
            <div className="space-y-8 animate-in fade-in duration-150">
              {/* Header */}
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
                  Integrações & Discord Rich Presence
                </h2>
                <p className="text-xs text-[#A4A8AF]">
                  Exiba o projeto e atividade atuais do Orbito diretamente no seu perfil do Discord através do protocolo RPC oficial.
                </p>
              </div>

              {/* 1. Global Discord Enable/Disable Switch & Status */}
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-[#ECEDEF]">
                      Ativar Integração Discord Rich Presence
                    </div>
                    <div className="text-xs text-[#747982]">
                      Permite que o Orbito comunique com a aplicação Discord Desktop local.
                    </div>
                  </div>
                  <button
                    onClick={handleToggleDiscord}
                    disabled={isDiscordToggling}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      discordStatus?.enabled ? 'bg-white' : 'bg-white/[0.15]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#101113] shadow ring-0 transition duration-200 ease-in-out ${
                        discordStatus?.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Connection Status Indicator */}
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="text-[#747982]">Estado de Conexão:</span>
                  <div className="flex items-center gap-1.5 font-medium">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        !discordStatus?.enabled
                          ? 'bg-[#747982]'
                          : discordStatus.connected
                            ? 'bg-emerald-400 animate-pulse'
                            : discordStatus.status === 'connecting'
                              ? 'bg-amber-400 animate-ping'
                              : 'bg-rose-400'
                      }`}
                    />
                    <span
                      className={
                        !discordStatus?.enabled
                          ? 'text-[#747982]'
                          : discordStatus.connected
                            ? 'text-emerald-300'
                            : discordStatus.status === 'connecting'
                              ? 'text-amber-300'
                              : 'text-rose-300'
                      }
                    >
                      {!discordStatus?.enabled
                        ? 'Desativado globalmente'
                        : discordStatus.connected
                          ? 'Conectado ao Discord Desktop'
                          : discordStatus.status === 'connecting'
                            ? 'A ligar ao Discord Desktop...'
                            : 'Discord Desktop indisponível'}
                    </span>
                  </div>
                </div>

                {/* Error feedback if Discord not running */}
                {discordStatus?.enabled && !discordStatus.connected && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>{discordStatus.error || 'Discord Desktop não detetado'}</span>
                    </div>
                    <p className="text-[11px] text-rose-300/80 pl-6 leading-relaxed">
                      Certifique-se de que a aplicação Discord Desktop está aberta no seu computador. O Orbito tenta reconectar automaticamente com backoff progressivo.
                    </p>
                  </div>
                )}
              </div>

              {/* 2. Live Discord Presence Preview */}
              <div className="space-y-4 pt-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#747982] font-mono">
                  Pré-visualização da Atividade no Discord
                </div>

                <div className="max-w-md rounded-2xl bg-[#1e1f22] p-4 text-[#dbdee1] font-sans shadow-2xl space-y-3.5 border border-white/[0.06]">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
                    <span>PLAYING A GAME</span>
                    <span className="text-[10px] font-mono text-[#949ba4] bg-white/[0.05] px-1.5 py-0.5 rounded">Discord RPC</span>
                  </div>

                  <div className="flex gap-3.5 items-start">
                    <div className="relative w-14 h-14 rounded-2xl bg-[#111214] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                      <img src="/Orbit.png" alt="Orbito" className="w-10 h-10 object-contain rounded-xl" />
                      {/* Badge indicator in bottom right matching Discord spec */}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#1e1f22] flex items-center justify-center overflow-hidden shadow-sm bg-[#00A8FF]">
                        {discordStatus?.currentPresence?.state?.includes('Agent working') ? (
                          <div className="flex items-end gap-0.5 h-2.5">
                            <span className="w-0.5 h-1.5 bg-black rounded-full" />
                            <span className="w-0.5 h-2.5 bg-black rounded-full" />
                            <span className="w-0.5 h-2 bg-black rounded-full" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-0.5">
                            <span className="w-1 h-1 bg-black rounded-full" />
                            <span className="w-1 h-1 bg-black rounded-full" />
                            <span className="w-1 h-1 bg-black rounded-full" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="text-[15px] font-bold text-white truncate leading-tight">Orbito</div>
                      <div className="text-xs text-[#dbdee1] truncate">
                        {discordStatus?.enabled
                          ? discordStatus.currentPresence?.details || 'Working in Orbito'
                          : 'Integração desativada'}
                      </div>
                      <div className="text-xs text-[#949ba4] truncate">
                        {discordStatus?.enabled
                          ? discordStatus.currentPresence?.state || 'Workspace ready'
                          : 'Sem atividade publicada'}
                      </div>
                      {discordStatus?.enabled && (
                        <div className="text-xs text-[#23a55a] font-medium pt-0.5 flex items-center gap-1.5 font-mono">
                          <span>00:42:17 elapsed</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Buttons Preview */}
                  {discordStatus?.enabled && (
                    <div className="space-y-2 pt-1">
                      {(
                        discordStatus.currentPresence?.buttons || [
                          { label: 'View on GitHub', url: 'https://github.com/ByGONCA/Orbito' },
                          { label: 'Get Orbito', url: 'https://github.com/ByGONCA/Orbito' }
                        ]
                      ).map((btn, idx) => (
                        <div
                          key={idx}
                          className="w-full py-1.5 px-3 rounded-lg bg-[#4e5058]/40 hover:bg-[#4e5058]/60 text-xs text-white font-medium text-center truncate cursor-default transition-colors flex items-center justify-center gap-1.5"
                        >
                          <span>{btn.label}</span>
                          <ExternalLink className="w-3 h-3 text-[#b5bac1]" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4 Status Badges Legend matching reference */}
                <div className="pt-2">
                  <div className="text-[11px] text-[#747982] mb-2 font-mono uppercase tracking-wider">
                    Estados dos Agentes no Discord
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#A4A8AF]">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#00A8FF] flex items-center justify-center">
                        <div className="flex items-end gap-0.5 h-2.5">
                          <span className="w-0.5 h-1.5 bg-black rounded-full" />
                          <span className="w-0.5 h-2.5 bg-black rounded-full" />
                          <span className="w-0.5 h-2 bg-black rounded-full" />
                        </div>
                      </div>
                      <span className="text-[11px]">Agente Ativo</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#F59E0B] flex items-center justify-center">
                        <div className="flex items-center gap-0.5">
                          <span className="w-0.5 h-0.5 bg-black rounded-full" />
                          <span className="w-0.5 h-0.5 bg-black rounded-full" />
                          <span className="w-0.5 h-0.5 bg-black rounded-full" />
                        </div>
                      </div>
                      <span className="text-[11px]">Em Espera / Idle</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#EF4444] flex items-center justify-center text-[10px] font-bold text-black">
                        !
                      </div>
                      <span className="text-[11px]">Alerta / Erro</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#64748B] flex items-center justify-center text-[9px] font-bold text-black">
                        ⏸
                      </div>
                      <span className="text-[11px]">Pausado</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Privacy & Security Protections */}
              <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#747982] font-mono">
                  Privacidade & Segurança
                </div>
                <div className="text-xs text-[#A4A8AF] space-y-2 leading-relaxed">
                  <p>
                    <strong className="text-white">Opt-in por Projeto:</strong> Por predefinição, nenhum projeto é publicado no Discord. Cada projeto requer a sua autorização explícita nas Definições do Projeto (<code className="text-[#ECEDEF] font-mono">Mostrar este projeto no Discord</code>).
                  </p>
                  <p>
                    <strong className="text-white">O que é publicado:</strong> Apenas o nome público do projeto, o botão do repositório Git (se existir e for um URL público seguro) e o número de agentes em execução quando uma orquestração estiver ativa.
                  </p>
                  <p>
                    <strong className="text-white">O que NUNCA é partilhado:</strong> Caminhos absolutos do disco, nomes de utilizador do sistema operativo, conteúdo de ficheiros, prompts, saídas do terminal, chaves de API ou variáveis de ambiente.
                  </p>
                </div>
              </div>

              {/* 4. Advanced: Custom Discord Client ID */}
              <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#747982] font-mono">
                      Discord Application Client ID (Opcional)
                    </div>
                    <p className="text-xs text-[#747982]">
                      Configure um Application ID próprio criado no Discord Developer Portal caso deseje um ícone e nome personalizados.
                    </p>
                  </div>
                  {clientIdSavedNotice && (
                    <span className="text-xs text-emerald-400 font-medium animate-fade-in">
                      Guardado com sucesso!
                    </span>
                  )}
                </div>

                <div className="flex gap-2 max-w-lg">
                  <input
                    type="text"
                    value={customClientIdInput}
                    onChange={(e) => setCustomClientIdInput(e.target.value)}
                    placeholder="1568419446719127684"
                    className="flex-1 bg-[#101113] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-[#ECEDEF] placeholder:text-[#747982] focus:outline-none focus:border-white/30 font-mono"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isSavingClientId}
                    onClick={handleSaveClientId}
                  >
                    Guardar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isSavingClientId}
                    onClick={handleResetClientId}
                    title="Restaurar Application ID predefinido"
                  >
                    Restaurar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SOBRE & DIAGNÓSTICO */}
          {activeTab === 'about' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center gap-3">
                <img src="/Orbit.png" alt="Orbito" className="w-10 h-10 object-contain drop-shadow select-none pointer-events-none" />
                <div className="space-y-0.5">
                  <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
                    Sobre o Orbito
                  </h2>
                  <p className="text-xs text-[#A4A8AF]">
                    Ambiente de Desenvolvimento Unificado com Agentes Locais e Nuvem.
                  </p>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 space-y-3 font-mono text-xs">
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-[#747982]">Versão:</span>
                  <span className="text-[#ECEDEF] font-semibold">0.1.0 (Desktop)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-[#747982]">Plataforma:</span>
                  <span className="text-[#ECEDEF]">Windows x64 (Electron 34.5.8)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-[#747982]">Runtime Node:</span>
                  <span className="text-[#ECEDEF]">v20.19.1</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-[#747982]">Motor de Persistência:</span>
                  <span className="text-[#ECEDEF]">Dual SQLite WAL (app.sqlite & index.sqlite)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#747982]">Design System:</span>
                  <span className="text-[#ECEDEF]">Charcoal Neutral Glassmorphism (Linear / Raycast)</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SettingsModal;
