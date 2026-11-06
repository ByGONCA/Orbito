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
  Cpu
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { MemoryRecord } from '../../../shared/types';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Badge } from './ui/Badge';
import { FileIcon } from '../utils/file-icons';

type SettingsSection = 'appearance' | 'workspace' | 'security' | 'memory' | 'shortcuts' | 'about';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    toggleSettings,
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

  const [activeTab, setActiveTab] = useState<SettingsSection>('appearance');
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

  const handleThemeChange = async (newTheme: 'glass' | 'solid') => {
    setTheme(newTheme);
    await window.api.updateSettings({ theme: newTheme });
    addLog(`Switched theme to [${newTheme.toUpperCase()}]`, 'info');
  };

  const isGlass = theme !== 'solid';

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
        <aside className="w-64 flex-shrink-0 border-r border-white/[0.08] bg-[#141619]/40 p-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#747982] font-mono">
            Preferências
          </div>

          <button
            onClick={() => setActiveTab('appearance')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'appearance'
                ? 'bg-white/[0.09] text-[#ECEDEF] border border-white/[0.1] shadow-xs'
                : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
            }`}
          >
            <Palette className="w-4 h-4 text-[#ECEDEF]" />
            <span>Aparência & Interface</span>
          </button>

          <button
            onClick={() => setActiveTab('workspace')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'workspace'
                ? 'bg-white/[0.09] text-[#ECEDEF] border border-white/[0.1] shadow-xs'
                : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
            }`}
          >
            <FolderGit2 className="w-4 h-4 text-[#A4A8AF]" />
            <span>Espaço de Trabalho & Git</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'security'
                ? 'bg-white/[0.09] text-[#ECEDEF] border border-white/[0.1] shadow-xs'
                : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#A4A8AF]" />
            <span>Segurança & Credenciais</span>
          </button>

          <button
            onClick={() => setActiveTab('memory')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'memory'
                ? 'bg-white/[0.09] text-[#ECEDEF] border border-white/[0.1] shadow-xs'
                : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
            }`}
          >
            <Database className="w-4 h-4 text-[#A4A8AF]" />
            <span>Memória & Agentes</span>
          </button>

          <div className="pt-3 pb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#747982] font-mono">
            Sistema
          </div>

          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'shortcuts'
                ? 'bg-white/[0.09] text-[#ECEDEF] border border-white/[0.1] shadow-xs'
                : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
            }`}
          >
            <Keyboard className="w-4 h-4 text-[#A4A8AF]" />
            <span>Atalhos de Teclado</span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'about'
                ? 'bg-white/[0.09] text-[#ECEDEF] border border-white/[0.1] shadow-xs'
                : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
            }`}
          >
            <Info className="w-4 h-4 text-[#A4A8AF]" />
            <span>Sobre o AI Workspace</span>
          </button>
        </aside>

        {/* Content Canvas */}
        <main className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto space-y-8">
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
                    {isGlass ? 'Glassmorphism Ativo' : 'Solid Dark Ativo'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
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
                        <span>Glassmorphism (Recomendado)</span>
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
                      Superfícies neutras de carvão com desfoque de fundo (backdrop blur) e bordas subtis translúcidas.
                    </p>
                  </div>

                  {/* Solid Option Card */}
                  <div
                    onClick={() => handleThemeChange('solid')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden ${
                      !isGlass
                        ? 'border-white/40 bg-white/[0.08] shadow-lg ring-1 ring-white/20'
                        : 'border-white/[0.08] hover:border-white/20 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[#ECEDEF] flex items-center gap-2 text-xs">
                        <Moon className="w-4 h-4 text-[#ECEDEF]" />
                        <span>Solid Dark</span>
                      </span>
                      {!isGlass && <Check className="w-4 h-4 text-[#ECEDEF]" />}
                    </div>

                    <div className="h-14 rounded-lg bg-[#141619] border border-white/[0.08] p-2 flex flex-col justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-white/60" />
                        <span className="w-12 h-1.5 rounded-full bg-white/20" />
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/[0.05]" />
                    </div>
                    <p className="text-[11px] text-[#A4A8AF]">
                      Painéis escuros opacos clássicos, sem transparência, com contraste focado na legibilidade.
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

          {/* TAB 5: ATALHOS DE TECLADO */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
                  Atalhos de Teclado
                </h2>
                <p className="text-xs text-[#A4A8AF]">
                  Referência rápida dos atalhos globais e de navegação no AI Workspace.
                </p>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden divide-y divide-white/[0.06] text-xs">
                {[
                  { key: 'Ctrl + P', desc: 'Abrir Paleta de Comandos (Command Palette)' },
                  { key: 'Ctrl + O', desc: 'Abrir Pasta de Projeto' },
                  { key: 'Ctrl + B', desc: 'Alternar Barra Lateral Esquerda' },
                  { key: 'Ctrl + J', desc: 'Alternar Painel Inferior de Terminal & Logs' },
                  { key: 'Ctrl + R / F5', desc: 'Recarregar Janela do Renderer' },
                  { key: 'Ctrl + Shift + I / F12', desc: 'Alternar Ferramentas de Programador (DevTools)' },
                  { key: 'Esc', desc: 'Fechar Modais / Definições / Ecrãs de Diálogo' }
                ].map((sc) => (
                  <div key={sc.key} className="flex items-center justify-between p-3.5">
                    <span className="text-[#ECEDEF]">{sc.desc}</span>
                    <span className="font-mono text-xs text-[#A4A8AF] bg-[#101113] border border-white/[0.1] px-2.5 py-1 rounded-lg">
                      {sc.key}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: SOBRE & DIAGNÓSTICO */}
          {activeTab === 'about' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
                  Sobre o AI Workspace
                </h2>
                <p className="text-xs text-[#A4A8AF]">
                  Ambiente de Desenvolvimento de Agentes Locais de Primeira Classe.
                </p>
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
