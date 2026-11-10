import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Bot,
  Terminal,
  GitBranch,
  Shield,
  FileText,
  Key,
  Plus,
  Trash2,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle,
  Save,
  Palette,
  Radio,
  ExternalLink,
  Globe
} from 'lucide-react';
import type { ProjectDescriptor, ProjectSettings } from '../../../shared/types';
import { useWorkspaceStore } from '../stores/workspace.store';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { ProjectIconRenderer } from './ProjectCustomizeModal';
import { CustomSelect } from './ui/Select';

export interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectDescriptor | null;
}

const PROVIDERS = [
  { id: 'claude', name: 'Anthropic Claude CLI' },
  { id: 'gemini', name: 'Google Gemini CLI' },
  { id: 'codex', name: 'OpenAI Codex / GPT' },
  { id: 'ollama', name: 'Ollama Local Models' },
  { id: 'powershell', name: 'Standard Terminal (PowerShell)' }
];

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  project
}) => {
  const { saveProjectSettings, updateProjectCustomization, addLog } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<'general' | 'fileIcons' | 'git' | 'discord' | 'env'>('general');
  const [customName, setCustomName] = useState('');
  const [customTag, setCustomTag] = useState('');
  const [description, setDescription] = useState('');
  const [customFileIcons, setCustomFileIcons] = useState<Record<string, string>>({});
  const [newExt, setNewExt] = useState('');
  const [newFileIconUrl, setNewFileIconUrl] = useState('');
  const [gitAutoFetch, setGitAutoFetch] = useState(false);
  const [discordRpcEnabled, setDiscordRpcEnabled] = useState(false);
  const [detectedRemote, setDetectedRemote] = useState<any>(null);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [globalDiscordStatus, setGlobalDiscordStatus] = useState<any>(null);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string; masked: boolean }>>([]);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  useEffect(() => {
    if (project) {
      setCustomName(project.customName || '');
      setCustomTag(project.tag || '');
      setDescription(project.description || '');

      const s = project.settings || {};
      setGitAutoFetch(Boolean(s.gitAutoFetch));
      setDiscordRpcEnabled(Boolean(s.discordRpcEnabled));
      setCustomFileIcons(s.customFileIcons || {});

      if (project.path) {
        setIsLoadingRemote(true);
        window.api?.getProjectGitRemote?.({ projectPath: project.path })
          .then((remote) => setDetectedRemote(remote))
          .catch(() => setDetectedRemote(null))
          .finally(() => setIsLoadingRemote(false));
        window.api?.getDiscordStatus?.()
          .then((status) => setGlobalDiscordStatus(status))
          .catch(() => {});
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
  }, [project, isOpen]);

  if (!isOpen || !project) return null;

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

  const handleToggleMask = (index: number) => {
    setEnvVars((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, masked: !item.masked } : item))
    );
  };

  const handleSaveAll = async () => {
    setIsSubmitting(true);
    setSuccessNotice(false);

    try {
      // 1. Update project customization metadata
      await updateProjectCustomization(project.id, {
        customName: customName.trim() || undefined,
        tag: customTag.trim() || undefined,
        description: description.trim() || undefined
      });

      // 2. Build environment variables map
      const envMap: Record<string, string> = {};
      for (const item of envVars) {
        if (item.key.trim()) {
          envMap[item.key.trim()] = item.value;
        }
      }

      // 3. Save project settings
      const settingsPayload: ProjectSettings = {
        gitAutoFetch,
        discordRpcEnabled,
        envVars: envMap,
        customFileIcons
      };

      await saveProjectSettings(project.id, settingsPayload);
      setSuccessNotice(true);
      setTimeout(() => {
        setSuccessNotice(false);
        onClose();
      }, 700);
    } catch (err: any) {
      addLog(`Failed to save project settings: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-2xl bg-[#111116] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.1] flex items-center justify-center">
              <ProjectIconRenderer
                iconId={project.customIcon}
                color={project.customColor || '#ECEDEF'}
                className="w-4 h-4"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white tracking-tight">
                  {project.customName || project.name}
                </h2>
                <span className="text-[10px] font-mono text-[#747982]">Project Settings</span>
              </div>
              <p className="text-[11px] text-[#747982] font-mono truncate max-w-md">{project.path}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#747982] hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-white/[0.06] flex gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'general'
                ? 'border-white text-white'
                : 'border-transparent text-[#747982] hover:text-[#A4A8AF]'
            }`}
          >
            General & Metadata
          </button>
          <button
            onClick={() => setActiveTab('fileIcons')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'fileIcons'
                ? 'border-white text-white'
                : 'border-transparent text-[#747982] hover:text-[#A4A8AF]'
            }`}
          >
            File Icons
          </button>
          <button
            onClick={() => setActiveTab('git')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'git'
                ? 'border-white text-white'
                : 'border-transparent text-[#747982] hover:text-[#A4A8AF]'
            }`}
          >
            Git & Worktrees
          </button>
          <button
            onClick={() => setActiveTab('discord')}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'discord'
                ? 'border-white text-white'
                : 'border-transparent text-[#747982] hover:text-[#A4A8AF]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Discord RPC</span>
          </button>
          <button
            onClick={() => setActiveTab('env')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'env'
                ? 'border-white text-white'
                : 'border-transparent text-[#747982] hover:text-[#A4A8AF]'
            }`}
          >
            Environment Variables
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* TAB 1: General */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#ECEDEF]">Project Display Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={project.name}
                  className="w-full px-3.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-white/25 focus:outline-none text-xs text-white placeholder-[#747982]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#ECEDEF]">Project Group / Tag</label>
                <input
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  placeholder="e.g. FRONTEND, CLIENT, CORE, API"
                  className="w-full px-3.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-white/25 focus:outline-none text-xs text-white placeholder-[#747982] font-mono uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#ECEDEF]">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Brief note or mission statement for this project..."
                  className="w-full px-3.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-white/25 focus:outline-none text-xs text-white placeholder-[#747982] resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: File Icons */}
          {activeTab === 'fileIcons' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-white">Custom File Type Icons</h4>
                <p className="text-[11px] text-[#717784]">
                  Assign custom icons or logos to file extensions (.ts, .tsx, .py, etc.) via URL or image link.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ext (e.g. py, tsx)"
                  value={newExt}
                  onChange={(e) => setNewExt(e.target.value.toLowerCase())}
                  className="w-28 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-white focus:outline-none"
                />
                <input
                  type="url"
                  placeholder="Icon URL (https://... or data:image/...)"
                  value={newFileIconUrl}
                  onChange={(e) => setNewFileIconUrl(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = newExt.trim().replace(/^\./, '').toLowerCase();
                    if (!clean || !newFileIconUrl.trim()) return;
                    setCustomFileIcons((prev) => ({ ...prev, [clean]: newFileIconUrl.trim() }));
                    setNewExt('');
                    setNewFileIconUrl('');
                  }}
                  disabled={!newExt.trim() || !newFileIconUrl.trim()}
                  className="px-3 py-1.5 bg-white text-black font-semibold text-xs rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  Add
                </button>
              </div>

              <div className="space-y-1.5 pt-2">
                {Object.entries(customFileIcons).length === 0 ? (
                  <p className="text-[11px] text-[#717784] font-mono">No custom file icons configured.</p>
                ) : (
                  Object.entries(customFileIcons).map(([ext, url]) => (
                    <div
                      key={ext}
                      className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <img src={url} alt={ext} className="w-4 h-4 object-contain rounded" />
                        <span className="text-white font-medium">.{ext}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomFileIcons((prev) => {
                            const next = { ...prev };
                            delete next[ext];
                            return next;
                          });
                        }}
                        className="text-[#717784] hover:text-rose-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Git */}
          {activeTab === 'git' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs text-[#A4A8AF] space-y-1">
                <span className="font-semibold text-white">Git Repository Status</span>
                <p className="text-[11px]">
                  {project.isGitRepo
                    ? `Active branch: ${project.activeBranch || 'main'}. Git worktree isolation is fully enabled.`
                    : 'This project is not currently initialized as a Git repository.'}
                </p>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={gitAutoFetch}
                    onChange={(e) => setGitAutoFetch(e.target.checked)}
                    className="rounded bg-white/[0.05] border-white/20 text-emerald-500 focus:ring-0 focus:outline-none w-4 h-4 cursor-pointer"
                  />
                  <div className="text-xs text-[#ECEDEF]">
                    <span>Automatically poll Git branch status on project focus</span>
                    <p className="text-[11px] text-[#747982]">Keeps working tree indicators and diffs synchronized.</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB: Discord Rich Presence */}
          {activeTab === 'discord' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Global state notification if disabled */}
              {globalDiscordStatus && !globalDiscordStatus.enabled && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <span className="font-semibold text-white">Integração Global Discord Desativada</span>
                    <p className="text-[11px] text-amber-300/80 mt-0.5">
                      To publish this project to Discord, also enable Discord Rich Presence in Global Settings (Settings → Integrations).
                    </p>
                  </div>
                </div>
              )}

              {/* Main Opt-in Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-white">
                    Mostrar este projeto no Discord
                  </div>
                  <p className="text-[11px] text-[#747982]">
                    Publica o nome do projeto e os botões de repositório no seu perfil Discord quando este projeto estiver ativo.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discordRpcEnabled}
                    onChange={(e) => setDiscordRpcEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-white/[0.1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-white" />
                </label>
              </div>

              {/* Git Remote Detection Information */}
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#747982] font-mono">
                  Repositório Git Detetado
                </div>

                {isLoadingRemote ? (
                  <div className="text-xs text-[#747982] flex items-center gap-2 py-2">
                    <span className="w-2 h-2 rounded-full bg-white/40 animate-ping" />
                    <span>A detetar remotos Git configurados...</span>
                  </div>
                ) : detectedRemote ? (
                  <div className="space-y-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#747982]">Fornecedor Git:</span>
                      <span className="font-semibold text-white capitalize flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-[#A4A8AF]" />
                        {detectedRemote.provider} ({detectedRemote.remoteName})
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#747982]">URL Público Normalizado:</span>
                      <a
                        href={detectedRemote.browserUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white hover:underline truncate max-w-xs font-mono text-[11px] flex items-center gap-1"
                      >
                        <span className="truncate">{detectedRemote.browserUrl}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0 text-[#747982]" />
                      </a>
                    </div>
                    {detectedRemote.rawUrl !== detectedRemote.browserUrl && (
                      <div className="flex items-center justify-between text-[11px] text-[#747982] pt-1 border-t border-white/[0.04]">
                        <span>Origem Git Bruta:</span>
                        <span className="font-mono truncate max-w-xs">{detectedRemote.rawUrl}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-[#747982] space-y-1">
                    <div className="font-medium text-[#A4A8AF]">No remote Git repository detected</div>
                    <p className="text-[11px]">
                      Este projeto não tem nenhum remote configurado (ou não é um repositório Git). O Discord exibirá este projeto como "Local project" com o botão predefinido do Orbito.
                    </p>
                  </div>
                )}
              </div>

              {/* Buttons Preview */}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#747982] font-mono">
                  Botões no Discord (Máximo 2)
                </div>

                <div className="space-y-2 max-w-md">
                  {detectedRemote?.browserUrl ? (
                    <>
                      <div className="p-2.5 rounded-lg bg-[#2b2d31] border border-white/[0.06] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-[#747982]">Botão 1</span>
                          <span className="text-white font-medium">{detectedRemote.providerLabel}</span>
                        </div>
                        <span className="text-[10px] text-[#949ba4] font-mono truncate max-w-[200px]">
                          {detectedRemote.browserUrl}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#2b2d31] border border-white/[0.06] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-[#747982]">Botão 2</span>
                          <span className="text-white font-medium">Get Orbito</span>
                        </div>
                        <span className="text-[10px] text-[#949ba4] font-mono">
                          https://github.com/ByGONCA/Orbito
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-[#2b2d31] border border-white/[0.06] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#747982]">Botão 1</span>
                        <span className="text-white font-medium">Get Orbito</span>
                      </div>
                      <span className="text-[10px] text-[#949ba4] font-mono">
                        https://github.com/ByGONCA/Orbito
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Environment Variables */}
          {activeTab === 'env' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2.5">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
                <div>
                  <span className="font-semibold text-white">Isolated Project Secrets</span>
                  <p className="text-[11px] text-emerald-300/80 mt-0.5">
                    Environment variables configured here are isolated to this project. They are never logged or committed to source control.
                  </p>
                </div>
              </div>

              {/* Add New Key-Value */}
              <form onSubmit={handleAddEnvVar} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="KEY (e.g. API_URL)"
                  className="w-1/3 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-white/25 focus:outline-none text-xs text-white placeholder-[#747982] font-mono uppercase"
                />
                <input
                  type="password"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-white/25 focus:outline-none text-xs text-white placeholder-[#747982] font-mono"
                />
                <Button type="submit" variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                  Add
                </Button>
              </form>

              {/* Variables List */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
                {envVars.length === 0 ? (
                  <p className="text-xs text-[#747982] italic py-2">No custom environment variables defined.</p>
                ) : (
                  envVars.map((item, idx) => (
                    <div
                      key={item.key}
                      className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] flex items-center justify-between text-xs font-mono"
                    >
                      <span className="text-[#ECEDEF] font-semibold">{item.key}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[#747982]">
                          {item.masked ? '••••••••••••' : item.value}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleMask(idx)}
                          className="text-[#747982] hover:text-white transition-colors"
                        >
                          {item.masked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveEnvVar(item.key)}
                          className="text-[#747982] hover:text-rose-400 transition-colors"
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {successNotice && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <Check className="w-3.5 h-3.5" /> Saved successfully
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveAll}
              disabled={isSubmitting}
              icon={<Save className="w-3.5 h-3.5" />}
            >
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettingsModal;