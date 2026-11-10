import React, { useState, useEffect, useMemo } from 'react';
import {
  Blocks,
  Search,
  Check,
  CheckCircle2,
  Download,
  Trash2,
  X,
  Settings,
  Plus,
  Code2,
  Copy,
  FolderOpen,
  Terminal,
  ShieldCheck,
  Star,
  Cloud,
  FileCode,
  GitBranch,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import type { ExtensionRecord, CatalogPluginItem } from '../../../../shared/extensions';

export const PluginsWorkspace: React.FC = () => {
  const { openSettingsToTab, addLog } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<'discover' | 'installed' | 'developer'>('discover');
  const [catalog, setCatalog] = useState<CatalogPluginItem[]>([]);
  const [installed, setInstalled] = useState<ExtensionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [localFolderInput, setLocalFolderInput] = useState('');
  const [isLocalModalOpen, setIsLocalModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [catList, instList] = await Promise.all([
        window.api.getCatalogPlugins?.().catch(() => []) || [],
        window.api.listExtensions?.().catch(() => []) || []
      ]);
      setCatalog(catList);
      setInstalled(instList);
    } catch (err: any) {
      console.error('Falha ao carregar catálogo de plugins:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const installedMap = useMemo(() => {
    return new Map(installed.map((p) => [p.id, p]));
  }, [installed]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        item.displayName.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.author.toLowerCase().includes(query);
      const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [catalog, searchQuery, selectedCategory]);

  const handleInstallCatalog = async (pluginId: string) => {
    setInstallingId(pluginId);
    try {
      const res = await window.api.installCatalogPlugin({ pluginId });
      if (res.success && res.extension) {
        setInstalled((prev) => [...prev.filter((p) => p.id !== res.extension!.id), res.extension!]);
        setStatusNotice(`Plugin "${res.extension.displayName}" instalado com sucesso!`);
        addLog(`Plugin instalado: ${res.extension.displayName}`, 'info');
        setTimeout(() => setStatusNotice(null), 3500);
      } else {
        alert(res.error || 'Falha ao instalar o plugin do catálogo.');
      }
    } catch (err: any) {
      alert(`Erro na instalação: ${err.message}`);
    } finally {
      setInstallingId(null);
    }
  };

  const handleToggle = async (extensionId: string, currentEnabled: boolean) => {
    const nextState = !currentEnabled;
    try {
      const res = await window.api.toggleExtension({
        extensionId,
        enabled: nextState
      });
      if (res.success) {
        setInstalled((prev) =>
          prev.map((e) => (e.id === extensionId ? { ...e, enabled: nextState } : e))
        );
        addLog(`${nextState ? 'Ativado' : 'Desativado'} plugin: ${extensionId}`, 'info');
      }
    } catch (err: any) {
      alert(`Erro ao alternar estado do plugin: ${err.message}`);
    }
  };

  const handleUninstall = async (extensionId: string) => {
    if (!confirm('Tens a certeza que desejas desinstalar este plugin?')) return;
    try {
      const res = await window.api.uninstallExtension({ extensionId });
      if (res.success) {
        setInstalled((prev) => prev.filter((p) => p.id !== extensionId));
        setStatusNotice('Plugin desinstalado com sucesso.');
        addLog(`Plugin removido: ${extensionId}`, 'info');
        setTimeout(() => setStatusNotice(null), 3000);
      }
    } catch (err: any) {
      alert(`Erro ao desinstalar plugin: ${err.message}`);
    }
  };

  const handleInstallLocalFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localFolderInput.trim()) return;
    try {
      const res = await window.api.installExtension({ directoryPath: localFolderInput.trim() });
      if (res.success && res.extension) {
        setInstalled((prev) => [...prev.filter((p) => p.id !== res.extension!.id), res.extension!]);
        setIsLocalModalOpen(false);
        setLocalFolderInput('');
        setStatusNotice(`Plugin local "${res.extension.displayName}" carregado!`);
        setActiveTab('installed');
        addLog(`Plugin local carregado: ${res.extension.displayName}`, 'info');
        setTimeout(() => setStatusNotice(null), 3500);
      } else {
        alert(res.error || 'A pasta indicada não contém um ficheiro extension.json válido.');
      }
    } catch (err: any) {
      alert(`Erro ao carregar plugin: ${err.message}`);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ai-tools':
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'git':
        return <GitBranch className="w-4 h-4 text-emerald-400" />;
      case 'editor':
        return <FileCode className="w-4 h-4 text-blue-400" />;
      case 'developer':
        return <Cpu className="w-4 h-4 text-amber-400" />;
      default:
        return <Layers className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0D0E11] text-[#ECEDEF] select-none font-sans overflow-hidden">
      {/* 1. Header Toolbar (Limpo, Anti-Boxiness, Tipografia Nítida) */}
      <div className="px-8 pt-7 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] flex-shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-white">Plugins & Extensibilidade</h1>
            <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-400">
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              <span>Cloud Ready</span>
            </span>
          </div>
          <p className="text-xs text-[#747982] mt-0.5">
            Descobre, instala e gere extensões e integrações para o teu ecossistema Orbito.
          </p>
        </div>

        {/* Controlos e Tabs de Navegação */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.08] text-xs">
            <button
              onClick={() => setActiveTab('discover')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'discover'
                  ? 'bg-white text-black shadow-xs'
                  : 'text-[#A4A8AF] hover:text-white'
              }`}
            >
              Descobrir
            </button>
            <button
              onClick={() => setActiveTab('installed')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'installed'
                  ? 'bg-white text-black shadow-xs'
                  : 'text-[#A4A8AF] hover:text-white'
              }`}
            >
              <span>Instalados</span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {installed.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('developer')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'developer'
                  ? 'bg-white text-black shadow-xs'
                  : 'text-[#A4A8AF] hover:text-white'
              }`}
            >
              Criar Plugin
            </button>
          </div>

          <button
            onClick={() => setIsLocalModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-white transition-colors cursor-pointer flex items-center gap-1.5 border border-white/[0.08]"
            title="Carregar um plugin a partir de uma pasta local"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Carregar local</span>
          </button>

          <button
            onClick={() => openSettingsToTab('plugins')}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.08] transition-colors cursor-pointer"
            title="Definições e Isolamento do Sandbox"
            aria-label="Definições de Plugins"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notificação Temporária de Sucesso */}
      {statusNotice && (
        <div className="px-8 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button onClick={() => setStatusNotice(null)} className="p-0.5 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Conteúdo com Scroll */}
      <div className="flex-1 overflow-y-auto min-h-0 px-8 py-6 space-y-8 pb-16">
        {/* ========================================================= */}
        {/* TAB 1: DESCOBRIR (CATÁLOGO DE PLUGINS / MARKETPLACE)       */}
        {/* ========================================================= */}
        {activeTab === 'discover' && (
          <div className="space-y-6">
            {/* Banner de Sincronização Cloud */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#747982] pb-1">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-400" />
                <span className="text-zinc-300 font-medium">Catálogo Oficial Orbito Cloud</span>
                <span>•</span>
                <span>Pronto para instalar e sincronizar em qualquer ambiente</span>
              </div>
              <button
                onClick={loadData}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Atualizar catálogo"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>
            </div>

            {/* Barra de Pesquisa e Filtros de Categoria */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar plugins por nome, autor ou funcionalidade..."
                  className="w-full bg-[#131519] border border-white/[0.08] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/25 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-zinc-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Categorias (Tipografia limpa, sem pill boxes excessivas) */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 text-xs">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'ai-tools', label: 'Ferramentas AI' },
                  { id: 'git', label: 'Git' },
                  { id: 'editor', label: 'Editor' },
                  { id: 'developer', label: 'Produtividade' },
                  { id: 'general', label: 'Geral' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-white/[0.12] text-white border border-white/[0.15]'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grelha de Plugins */}
            {filteredCatalog.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#747982] space-y-2">
                <Blocks className="w-8 h-8 text-zinc-600 mx-auto stroke-[1.5]" />
                <p className="text-sm font-medium text-zinc-300">Nenhum plugin encontrado</p>
                <p className="text-xs text-[#747982] max-w-sm mx-auto">
                  Tenta pesquisar por outro termo ou seleciona outra categoria no menu acima.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCatalog.map((plugin) => {
                  const isInstalled = installedMap.has(plugin.id);
                  const isInstalling = installingId === plugin.id;

                  return (
                    <div
                      key={plugin.id}
                      className="rounded-xl bg-[#131519] border border-white/[0.06] hover:border-white/[0.14] transition-all p-5 flex flex-col justify-between space-y-4 shadow-sm"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                              {getCategoryIcon(plugin.category)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h3 className="text-sm font-semibold text-white truncate">{plugin.displayName}</h3>
                                {plugin.isOfficial && (
                                  <span className="text-[10px] font-mono text-blue-400" title="Extensão Oficial Orbito">
                                    Oficial
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[#747982] font-mono">
                                v{plugin.version} • {plugin.author}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-amber-400 font-mono flex-shrink-0">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            <span>{plugin.rating}</span>
                          </div>
                        </div>

                        <p className="text-xs text-[#A4A8AF] line-clamp-3 leading-relaxed">
                          {plugin.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between text-[11px]">
                        <span className="text-[#525866] flex items-center gap-1 font-mono">
                          <Download className="w-3 h-3" />
                          <span>{plugin.downloads.toLocaleString()}</span>
                        </span>

                        {isInstalled ? (
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-medium flex items-center gap-1 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Instalado</span>
                            </span>
                            <button
                              onClick={() => setActiveTab('installed')}
                              className="text-zinc-400 hover:text-white text-[11px] transition-colors cursor-pointer"
                            >
                              Gerir
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleInstallCatalog(plugin.id)}
                            disabled={isInstalling}
                            className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
                          >
                            {isInstalling ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>A instalar...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3 h-3" />
                                <span>Instalar</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: PLUGINS INSTALADOS                                 */}
        {/* ========================================================= */}
        {activeTab === 'installed' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-3 text-xs">
              <h2 className="text-xs font-semibold text-[#A4A8AF] uppercase tracking-wider font-mono">
                Extensões no Sistema
              </h2>
              <span className="text-[#747982] font-mono">{installed.length} instalados</span>
            </div>

            {installed.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#747982] space-y-3">
                <FolderOpen className="w-8 h-8 text-zinc-600 mx-auto stroke-[1.5]" />
                <p className="text-sm font-medium text-zinc-300">Nenhum plugin instalado de momento</p>
                <p className="text-xs text-[#747982] max-w-md mx-auto leading-relaxed">
                  Podes explorar o catálogo oficial e instalar novas ferramentas com um único clique.
                </p>
                <button
                  onClick={() => setActiveTab('discover')}
                  className="px-4 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors cursor-pointer shadow-xs"
                >
                  Explorar Catálogo de Plugins
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {installed.map((ext) => (
                  <div
                    key={ext.id}
                    className="rounded-xl bg-[#131519] border border-white/[0.06] hover:border-white/[0.12] transition-all p-4 flex flex-col justify-between space-y-3 shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-semibold text-white truncate">{ext.displayName}</h3>
                            <span className="text-[10px] font-mono text-[#747982]">v{ext.version}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-[#747982] mt-0.5 font-mono">
                            <span>{ext.author}</span>
                            <span>•</span>
                            <span className={ext.enabled ? 'text-emerald-400' : 'text-zinc-500'}>
                              {ext.enabled ? 'Ativo' : 'Desativado'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleToggle(ext.id, ext.enabled)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                            ext.enabled
                              ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                              : 'bg-white/[0.06] text-zinc-400 hover:text-white'
                          }`}
                        >
                          {ext.enabled ? 'Ligado' : 'Desligado'}
                        </button>
                      </div>

                      <p className="text-xs text-[#A4A8AF] line-clamp-2 mt-2 leading-relaxed">
                        {ext.description || 'Extensão instalada no workspace.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[11px] text-[#525866]">
                      <span className="truncate max-w-[180px] font-mono text-[10px]" title={ext.installPath}>
                        {ext.installPath || ext.id}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopy(ext.installPath || ext.id, ext.id)}
                          className="p-1 rounded text-zinc-500 hover:text-white transition-colors cursor-pointer"
                          title="Copiar Caminho"
                        >
                          {copiedId === ext.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>

                        <button
                          onClick={() => handleUninstall(ext.id)}
                          className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Desinstalar Plugin"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: CRIAR PLUGIN (DOCUMENTAÇÃO DO DESENVOLVEDOR)        */}
        {/* ========================================================= */}
        {activeTab === 'developer' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-2 text-white">
                <Code2 className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-semibold">Como Criar um Plugin para o Orbito</h2>
              </div>
              <p className="text-xs text-[#A4A8AF] leading-relaxed max-w-3xl">
                O ecossistema do Orbito é aberto e concebido para que possas construir as tuas próprias ferramentas. Um plugin é simplesmente uma pasta com dois ficheiros essenciais: o manifesto de configuração (<code className="text-zinc-300 font-mono">extension.json</code>) e o código de execução (<code className="text-zinc-300 font-mono">index.js</code>).
              </p>

              {/* Grelha de Passos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                {/* Passo 1 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#747982]">
                    <span>1. CRIAR O MANIFESTO (EXTENSION.JSON)</span>
                    <span>Metadados & Permissões</span>
                  </div>
                  <pre className="p-4 rounded-xl bg-[#090A0C] border border-white/[0.06] font-mono text-[11px] text-zinc-300 overflow-x-auto leading-relaxed">
{`{
  "id": "meu-plugin",
  "name": "meu-plugin",
  "displayName": "O Meu Utilitário",
  "version": "1.0.0",
  "main": "index.js",
  "permissions": {
    "filesystem": { "read": true },
    "shell": false
  }
}`}
                  </pre>
                </div>

                {/* Passo 2 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#747982]">
                    <span>2. IMPLEMENTAR A LÓGICA (INDEX.JS)</span>
                    <span>Ciclo de Vida</span>
                  </div>
                  <pre className="p-4 rounded-xl bg-[#090A0C] border border-white/[0.06] font-mono text-[11px] text-zinc-300 overflow-x-auto leading-relaxed">
{`module.exports = {
  activate(context) {
    context.log("Plugin ativado no Orbito!");
    // Registar comandos ou handlers de workspace
  },
  deactivate() {
    // Limpeza de recursos
  }
};`}
                  </pre>
                </div>
              </div>

              {/* Rodapé do Guia com CLI */}
              <div className="pt-3 border-t border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#747982]">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Também podes validar e carregar via CLI no terminal:</span>
                  <code className="text-zinc-200 font-mono bg-white/[0.04] px-2 py-0.5 rounded">
                    node bin/orbito.js plugins install ./minha-pasta
                  </code>
                </div>

                <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Execução em Sandbox Isolado (Node.js Process Isolation)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal para Carregar Plugin Local */}
      {isLocalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-md bg-[#131519] border border-white/[0.1] rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <FolderOpen className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold">Carregar Plugin Local</h3>
              </div>
              <button
                onClick={() => setIsLocalModalOpen(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#747982] leading-relaxed">
              Indica o caminho absoluto ou relativo para a pasta que contém o ficheiro <code className="text-zinc-300 font-mono">extension.json</code> e o ponto de entrada <code className="text-zinc-300 font-mono">index.js</code>.
            </p>

            <form onSubmit={handleInstallLocalFolder} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono text-[#747982] mb-1.5 uppercase">
                  Caminho do Diretório
                </label>
                <input
                  type="text"
                  value={localFolderInput}
                  onChange={(e) => setLocalFolderInput(e.target.value)}
                  placeholder="Ex: ./plugins/example-clock-panel ou C:/projetos/meu-plugin"
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-colors font-mono"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLocalModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!localFolderInput.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-neutral-200 text-black transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  Instalar Plugin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PluginsWorkspace;
