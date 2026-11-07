import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  Check,
  Settings,
  Bot,
  Radio,
  Key,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Palette,
  ExternalLink,
  GitBranch,
  ShieldAlert,
  Copy,
  CheckCircle2,
  FolderGit2,
  FolderCode,
  Terminal,
  Code2,
  Sparkles,
  Rocket,
  Database,
  Cpu,
  Globe,
  Flame,
  Shield,
  Package,
  Layers,
  Workflow,
  Star
} from 'lucide-react';
import type { ProjectDescriptor, ProjectSettings } from '../../../shared/types';
import { useWorkspaceStore } from '../stores/workspace.store';
import { Devicon } from '../utils/devicon-svgs';

const COLOR_PRESETS = [
  { id: 'default', label: 'Default', hex: '' },
  { id: 'emerald', label: 'Emerald', hex: '#10B981' },
  { id: 'cyan', label: 'Cyan', hex: '#06B6D4' },
  { id: 'blue', label: 'Blue', hex: '#3B82F6' },
  { id: 'violet', label: 'Violet', hex: '#8B5CF6' },
  { id: 'purple', label: 'Purple', hex: '#A855F7' },
  { id: 'rose', label: 'Rose Coral', hex: '#F43F5E' },
  { id: 'amber', label: 'Amber', hex: '#F59E0B' },
  { id: 'orange', label: 'Orange', hex: '#F97316' },
  { id: 'neutral', label: 'Neutral', hex: '#ECEDEF' }
];

const ICON_PRESETS: Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = [
  { id: 'folder-git', label: 'Git Repo', icon: FolderGit2 },
  { id: 'folder-code', label: 'Code Folder', icon: FolderCode },
  { id: 'bot', label: 'AI Agent', icon: Bot },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'code', label: 'App', icon: Code2 },
  { id: 'sparkles', label: 'Special', icon: Sparkles },
  { id: 'rocket', label: 'Launch', icon: Rocket },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'cpu', label: 'Core / Engine', icon: Cpu },
  { id: 'globe', label: 'Web', icon: Globe },
  { id: 'flame', label: 'Active', icon: Flame },
  { id: 'shield', label: 'Security', icon: Shield },
  { id: 'package', label: 'Package', icon: Package },
  { id: 'layers', label: 'Architecture', icon: Layers },
  { id: 'workflow', label: 'Automation', icon: Workflow },
  { id: 'star', label: 'Favorite', icon: Star }
];

const LANGUAGE_DEVICONS = [
  'typescript',
  'javascript',
  'react',
  'python',
  'rust',
  'go',
  'html5',
  'css3',
  'sass',
  'c',
  'cplusplus',
  'csharp',
  'java',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'dart',
  'vuejs',
  'svelte',
  'docker',
  'git',
  'postgresql',
  'sqlite',
  'bash',
  'json'
];

const PROVIDERS = [
  { id: 'claude', name: 'Anthropic Claude CLI' },
  { id: 'gemini', name: 'Google Gemini CLI' },
  { id: 'codex', name: 'OpenAI Codex / GPT' },
  { id: 'ollama', name: 'Ollama Local Models' },
  { id: 'powershell', name: 'Standard Terminal (PowerShell)' }
];

export const ProjectSettingsPage: React.FC<{ projectId?: string }> = ({ projectId }) => {
  const {
    project: activeProject,
    recentProjects,
    saveProjectSettings,
    updateProjectCustomization,
    closeProject,
    closeTab,
    activeTabId,
    addLog
  } = useWorkspaceStore();

  const targetProject = recentProjects.find((p) => p.id === projectId) || activeProject;

  const [activeSubTab, setActiveSubTab] = useState<'general' | 'ai' | 'git_discord' | 'env' | 'danger'>('general');
  const [customName, setCustomName] = useState('');
  const [customTag, setCustomTag] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');
  const [defaultProvider, setDefaultProvider] = useState('claude');
  const [defaultModel, setDefaultModel] = useState('');
  const [instructions, setInstructions] = useState('');
  const [gitAutoFetch, setGitAutoFetch] = useState(false);
  const [discordRpcEnabled, setDiscordRpcEnabled] = useState(true);
  const [detectedRemote, setDetectedRemote] = useState<any>(null);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string; masked: boolean }>>([]);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  useEffect(() => {
    if (targetProject) {
      setCustomName(targetProject.customName || '');
      setCustomTag(targetProject.tag || '');
      setDescription(targetProject.description || '');
      setSelectedColor(targetProject.customColor || '');
      setSelectedIcon(targetProject.customIcon || '');

      const s = targetProject.settings || {};
      setDefaultProvider(s.defaultProvider || 'claude');
      setDefaultModel(s.defaultModel || '');
      setInstructions(s.instructions || '');
      setGitAutoFetch(Boolean(s.gitAutoFetch));
      setDiscordRpcEnabled(s.discordRpcEnabled !== false);

      if (targetProject.path) {
        window.api?.getProjectGitRemote?.({ projectPath: targetProject.path })
          .then((remote) => setDetectedRemote(remote))
          .catch(() => setDetectedRemote(null));
      }

      if (s.envVars) {
        setEnvVars(
          Object.entries(s.envVars).map(([k, v]) => ({
            key: k,
            value: v,
            masked: true
          }))
        );
      } else {
        setEnvVars([]);
      }
    }
  }, [targetProject]);

  if (!targetProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400">
        <p>Projeto não encontrado ou indisponível.</p>
      </div>
    );
  }

  const handleCopyPath = async () => {
    if (!targetProject.path) return;
    await navigator.clipboard.writeText(targetProject.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleAddEnvVar = (e: React.FormEvent) => {
    e.preventDefault();
    const k = newKey.trim();
    if (!k) return;
    setEnvVars((prev) => [...prev.filter((item) => item.key !== k), { key: k, value: newVal, masked: true }]);
    setNewKey('');
    setNewVal('');
  };

  const handleRemoveEnvVar = (k: string) => {
    setEnvVars((prev) => prev.filter((item) => item.key !== k));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // 1. Save metadata / customization
      await updateProjectCustomization(targetProject.id, {
        customName: customName.trim() || undefined,
        customColor: selectedColor || undefined,
        customIcon: selectedIcon || undefined,
        tag: customTag.trim() || undefined,
        description: description.trim() || undefined
      });

      // 2. Build env map
      const envMap: Record<string, string> = {};
      for (const item of envVars) {
        if (item.key.trim()) {
          envMap[item.key.trim()] = item.value;
        }
      }

      // 3. Save project settings
      const payload: ProjectSettings = {
        defaultProvider,
        defaultModel: defaultModel.trim() || undefined,
        instructions: instructions.trim() || undefined,
        gitAutoFetch,
        discordRpcEnabled,
        envVars: envMap
      };

      await saveProjectSettings(targetProject.id, payload);
      setSaveSuccess(true);
      addLog(`Definições de "${targetProject.name}" guardadas com sucesso`, 'info');
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      addLog(`Erro ao guardar definições do projeto: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveProject = async () => {
    if (window.confirm(`Tens a certeza de que queres remover "${targetProject.name}" do workspace? Os ficheiros locais no disco NÃO serão apagados.`)) {
      if (activeTabId) closeTab(activeTabId);
      await closeProject(targetProject.id);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#101113] text-[#ECEDEF] overflow-hidden select-none">
      {/* Top Header */}
      <div className="px-8 py-5 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0 bg-transparent">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (activeTabId) closeTab(activeTabId);
            }}
            className="p-1.5 rounded-lg text-[#A4A8AF] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Voltar / Fechar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold tracking-tight text-white">
                {customName || targetProject.name}
              </h1>
              {customTag && (
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: selectedColor ? `${selectedColor}22` : 'rgba(255, 255, 255, 0.08)',
                    color: selectedColor || '#ECEDEF'
                  }}
                >
                  {customTag}
                </span>
              )}
            </div>
            <p className="text-xs text-[#717784] font-mono truncate max-w-xl">
              {targetProject.path}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyPath}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#A4A8AF] hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            {copiedPath ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedPath ? 'Copiado!' : 'Copiar Caminho'}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-[#E5E5E5] transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSaving ? 'A guardar...' : saveSuccess ? 'Guardado' : 'Guardar Alterações'}</span>
          </button>
        </div>
      </div>

      {/* Main Body (Horizontal layout with clean left sub-navigation) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <div className="w-60 flex-shrink-0 border-r border-white/[0.06] p-4 space-y-1">
          {[
            { id: 'general', label: 'Geral & Customização', icon: Palette },
            { id: 'ai', label: 'Instruções IA & Contexto', icon: Bot },
            { id: 'git_discord', label: 'Git & Discord Presence', icon: Radio },
            { id: 'env', label: 'Variáveis de Ambiente', icon: Key },
            { id: 'danger', label: 'Zona de Perigo', icon: ShieldAlert }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white/[0.08] text-white'
                    : 'text-[#A4A8AF] hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[#717784]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Canvas */}
        <div className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-8">
          {/* TAB: GERAL & CUSTOMIZAÇÃO */}
          {activeSubTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white">Identidade do Projeto</h3>
                <p className="text-xs text-[#717784]">Personaliza o nome visível, tags e ícone deste projeto no workspace.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A4A8AF] mb-1.5">Nome de Exibição (Custom Name)</label>
                  <input
                    type="text"
                    placeholder={targetProject.name}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.25] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A4A8AF] mb-1.5">Tag / Etiqueta</label>
                  <input
                    type="text"
                    placeholder="ex: Produção, Backend, API"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.25] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A4A8AF] mb-1.5">Descrição do Projeto</label>
                <input
                  type="text"
                  placeholder="Breve sumário sobre este projeto..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.25] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              {/* Color Presets */}
              <div>
                <label className="block text-xs font-medium text-[#A4A8AF] mb-2">Cor Temática</label>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {COLOR_PRESETS.map((c) => {
                    const isSelected = selectedColor === c.hex;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedColor(c.hex)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                          isSelected ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100 hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.hex || '#3A3D45' }}
                        title={c.label}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-black" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Icon Presets */}
              <div>
                <label className="block text-xs font-medium text-[#A4A8AF] mb-2">Ícone do Projeto</label>
                <div className="grid grid-cols-8 gap-2">
                  {/* Devicons */}
                  {LANGUAGE_DEVICONS.map((lang) => {
                    const isSelected = selectedIcon === lang;
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setSelectedIcon(lang)}
                        className={`p-2 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white/[0.12] border-white text-white'
                            : 'bg-white/[0.02] border-white/[0.06] text-[#A4A8AF] hover:bg-white/[0.06]'
                        }`}
                        title={lang}
                      >
                        <Devicon name={lang} className="w-4 h-4" />
                      </button>
                    );
                  })}

                  {/* Lucide presets */}
                  {ICON_PRESETS.map((ic) => {
                    const IconComp = ic.icon;
                    const isSelected = selectedIcon === ic.id;
                    return (
                      <button
                        key={ic.id}
                        type="button"
                        onClick={() => setSelectedIcon(ic.id)}
                        className={`p-2 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white/[0.12] border-white text-white'
                            : 'bg-white/[0.02] border-white/[0.06] text-[#A4A8AF] hover:bg-white/[0.06]'
                        }`}
                        title={ic.label}
                      >
                        <IconComp className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB: INSTRUÇÕES IA & CONTEXTO */}
          {activeSubTab === 'ai' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white">Configuração dos Modelos & Agentes</h3>
                <p className="text-xs text-[#717784]">Define o fornecedor CLI padrão e regras personalizadas de contexto para este projeto.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A4A8AF] mb-1.5">Fornecedor CLI Padrão</label>
                  <select
                    value={defaultProvider}
                    onChange={(e) => setDefaultProvider(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.25] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#141619]">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A4A8AF] mb-1.5">Modelo Específico (Opcional)</label>
                  <input
                    type="text"
                    placeholder="ex: claude-3-7-sonnet, gemini-2.5-flash"
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.25] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A4A8AF] mb-1.5">
                  Regras do Agente / Instruções de Sistema (System Prompt)
                </label>
                <textarea
                  rows={6}
                  placeholder="Instruções específicas para os agentes trabalharem neste repositório..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.25] rounded-lg p-3 text-xs text-white font-mono leading-relaxed focus:outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB: GIT & DISCORD PRESENCE */}
          {activeSubTab === 'git_discord' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white">Integração Git & Discord Rich Presence</h3>
                <p className="text-xs text-[#717784]">Partilha a tua atividade no Discord e sincroniza com o repositório remoto.</p>
              </div>

              {/* Discord RPC Toggle */}
              <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-white">Ativar Discord Rich Presence para este projeto</div>
                  <div className="text-[11px] text-[#717784] mt-0.5">
                    Apresenta &quot;Working in {customName || targetProject.name}&quot; e o repositório no teu perfil Discord.
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discordRpcEnabled}
                    onChange={(e) => setDiscordRpcEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-white/[0.1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-white" />
                </label>
              </div>

              {/* Remote Repository Status */}
              <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2">
                <div className="text-xs font-medium text-white flex items-center gap-2">
                  <GitBranch className="w-3.5 h-3.5 text-[#A4A8AF]" />
                  <span>Repositório Git Remoto</span>
                </div>
                {detectedRemote?.browserUrl ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#A4A8AF] truncate font-mono">{detectedRemote.browserUrl}</span>
                    <a
                      href={detectedRemote.browserUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-white underline flex items-center gap-1 hover:text-[#A4A8AF]"
                    >
                      <span>Abrir</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-[#717784]">Nenhum repositório remoto configurado para este projeto.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB: VARIÁVEIS DE AMBIENTE */}
          {activeSubTab === 'env' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white">Variáveis de Ambiente (.env)</h3>
                <p className="text-xs text-[#717784]">Injeta variáveis de ambiente seguras para execução de terminais e agentes.</p>
              </div>

              <form onSubmit={handleAddEnvVar} className="flex gap-2">
                <input
                  type="text"
                  placeholder="CHAVE (ex: API_KEY)"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                  className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="VALOR"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newKey.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  Adicionar
                </button>
              </form>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.06]">
                {envVars.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#717784]">Nenhuma variável de ambiente definida.</div>
                ) : (
                  envVars.map((ev, idx) => (
                    <div key={ev.key} className="flex items-center justify-between p-3 text-xs font-mono">
                      <span className="text-white font-semibold">{ev.key}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[#A4A8AF]">
                          {ev.masked ? '••••••••••••••••' : ev.value}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEnvVars((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, masked: !item.masked } : item))
                            );
                          }}
                          className="text-[#717784] hover:text-white"
                        >
                          {ev.masked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveEnvVar(ev.key)}
                          className="text-[#717784] hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: ZONA DE PERIGO */}
          {activeSubTab === 'danger' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-rose-400">Zona de Perigo</h3>
                <p className="text-xs text-[#717784]">Ações irreversíveis para a ligação deste projeto com o workspace.</p>
              </div>

              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-rose-300">Remover Projeto do Workspace</div>
                  <div className="text-[11px] text-[#A4A8AF] mt-0.5">
                    Remove este projeto da lista recente do Orbito. Não apaga nenhum ficheiro do disco.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveProject}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                >
                  Remover Projeto
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectSettingsPage;
