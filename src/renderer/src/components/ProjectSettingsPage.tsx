import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  Check,
  Radio,
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
  Star,
  Upload,
  Link as LinkIcon,
  RotateCcw
} from 'lucide-react';
import type { ProjectDescriptor, ProjectSettings } from '../../../shared/types';
import { useWorkspaceStore } from '../stores/workspace.store';
import { ProjectIconRenderer } from './ProjectCustomizeModal';

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

const PRESET_ICONS = [
  { id: 'folder-git', label: 'Git Repository', icon: FolderGit2 },
  { id: 'folder-code', label: 'Code Directory', icon: FolderCode },
  { id: 'terminal', label: 'Terminal / CLI', icon: Terminal },
  { id: 'code', label: 'Application', icon: Code2 },
  { id: 'sparkles', label: 'Special Project', icon: Sparkles },
  { id: 'rocket', label: 'Launch / Production', icon: Rocket },
  { id: 'database', label: 'Database Service', icon: Database },
  { id: 'cpu', label: 'Engine / Core', icon: Cpu },
  { id: 'globe', label: 'Web Platform', icon: Globe },
  { id: 'flame', label: 'Active Service', icon: Flame },
  { id: 'shield', label: 'Security Module', icon: Shield },
  { id: 'package', label: 'Package / Library', icon: Package },
  { id: 'layers', label: 'Architecture', icon: Layers },
  { id: 'workflow', label: 'Automation Flow', icon: Workflow },
  { id: 'star', label: 'Starred Project', icon: Star }
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

  // Form states
  const [customName, setCustomName] = useState('');
  const [customTag, setCustomTag] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('folder-git');
  const [iconUrlInput, setIconUrlInput] = useState('');
  const [logoInputMode, setLogoInputMode] = useState<'upload' | 'url'>('upload');

  // Git & Discord states
  const [gitAutoFetch, setGitAutoFetch] = useState(false);
  const [discordRpcEnabled, setDiscordRpcEnabled] = useState(true);
  const [detectedRemote, setDetectedRemote] = useState<any>(null);

  // UI status
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [activeSection, setActiveSection] = useState<'identity' | 'gitDiscord' | 'danger'>('identity');

  const logoUploadRef = useRef<HTMLInputElement>(null);

  // Section references for smooth scrolling
  const sectionRefs = {
    identity: useRef<HTMLDivElement>(null),
    gitDiscord: useRef<HTMLDivElement>(null),
    danger: useRef<HTMLDivElement>(null)
  };

  const scrollToSection = (section: keyof typeof sectionRefs) => {
    setActiveSection(section);
    sectionRefs[section]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (targetProject) {
      setCustomName(targetProject.customName || '');
      setCustomTag(targetProject.tag || '');
      setDescription(targetProject.description || '');
      setSelectedColor(targetProject.customColor || '');
      setSelectedIcon(targetProject.customIcon || 'folder-git');

      if (
        targetProject.customIcon &&
        (targetProject.customIcon.startsWith('http://') || targetProject.customIcon.startsWith('https://'))
      ) {
        setIconUrlInput(targetProject.customIcon);
        setLogoInputMode('url');
      } else {
        setIconUrlInput('');
      }

      const s = targetProject.settings || {};
      setGitAutoFetch(Boolean(s.gitAutoFetch));
      setDiscordRpcEnabled(s.discordRpcEnabled !== false);

      if (targetProject.path) {
        window.api?.getProjectGitRemote?.({ projectPath: targetProject.path })
          .then((remote) => setDetectedRemote(remote))
          .catch(() => setDetectedRemote(null));
      }
    }
  }, [targetProject]);

  if (!targetProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 bg-[#0D0E11]">
        <p className="text-sm font-medium">Project not found or unavailable.</p>
      </div>
    );
  }

  const handleCopyPath = async () => {
    if (!targetProject.path) return;
    await navigator.clipboard.writeText(targetProject.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  // Upload Project Logo / Icon file
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, SVG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setSelectedIcon(dataUrl);
        setIconUrlInput('');
      }
    };
    reader.readAsDataURL(file);
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

      // 2. Save project settings
      const payload: ProjectSettings = {
        ...(targetProject.settings || {}),
        gitAutoFetch,
        discordRpcEnabled
      };

      await saveProjectSettings(targetProject.id, payload);
      setSaveSuccess(true);
      addLog(`Settings for "${customName.trim() || targetProject.name}" saved successfully`, 'info');
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      addLog(`Failed to save project settings: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveProject = async () => {
    if (
      window.confirm(
        `Are you sure you want to remove "${targetProject.name}" from the workspace? Local files on disk will NOT be deleted.`
      )
    ) {
      if (activeTabId) closeTab(activeTabId);
      await closeProject(targetProject.id);
    }
  };

  const isCustomLogo =
    selectedIcon.startsWith('data:image/') ||
    selectedIcon.startsWith('http://') ||
    selectedIcon.startsWith('https://') ||
    selectedIcon.startsWith('file:') ||
    selectedIcon.includes('.');

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0D0E11] text-[#ECEDEF] overflow-hidden select-none font-sans">
      {/* 1. TOP HEADER */}
      <header className="h-14 px-8 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0 bg-[#0D0E11]/95 backdrop-blur-md z-30">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => {
              if (activeTabId) closeTab(activeTabId);
            }}
            className="p-1.5 rounded-md text-[#9CA3AF] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Back to workspace"
            aria-label="Back to workspace"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Project Identity Chip */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{
                backgroundColor: selectedColor ? `${selectedColor}22` : 'rgba(255, 255, 255, 0.06)',
                border: selectedColor ? `1px solid ${selectedColor}44` : '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <ProjectIconRenderer
                iconId={selectedIcon}
                color={selectedColor || '#ECEDEF'}
                className="w-3.5 h-3.5"
              />
            </div>
            <div className="flex items-center gap-2 truncate text-xs">
              <span className="font-semibold text-white tracking-tight truncate">
                {customName || targetProject.name}
              </span>
              {customTag && (
                <span
                  className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: selectedColor ? `${selectedColor}26` : 'rgba(255, 255, 255, 0.08)',
                    color: selectedColor || '#ECEDEF'
                  }}
                >
                  {customTag}
                </span>
              )}
              <span className="text-[#374151]">/</span>
              <span className="text-[#9CA3AF] truncate">{targetProject.path}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyPath}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#9CA3AF] hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] transition-colors cursor-pointer"
            title="Copy project path"
          >
            {copiedPath ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#9CA3AF]" />
            )}
            <span>{copiedPath ? 'Copied' : 'Copy Path'}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#0D0E11] hover:bg-[#F3F4F6] transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            {saveSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved' : 'Save Changes'}</span>
          </button>
        </div>
      </header>

      {/* 2. SUB-NAVIGATION TABS (STICKY) */}
      <div className="px-8 border-b border-white/[0.05] bg-[#0D0E11]/80 backdrop-blur-sm flex-shrink-0 flex items-center gap-6 text-xs">
        {[
          { id: 'identity', label: 'Identity & Logo' },
          { id: 'gitDiscord', label: 'Git & Integrations' },
          { id: 'danger', label: 'Danger Zone' }
        ].map((sec) => (
          <button
            key={sec.id}
            onClick={() => scrollToSection(sec.id as any)}
            className={`py-3 font-medium transition-colors cursor-pointer border-b-2 -mb-[1px] whitespace-nowrap ${
              activeSection === sec.id
                ? 'border-white text-white'
                : 'border-transparent text-[#6B7280] hover:text-[#D1D5DB]'
            }`}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {/* 3. SCROLLABLE SETTINGS BODY */}
      <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10 max-w-3xl mx-auto w-full">
        {/* SECTION 1: IDENTITY & LOGO */}
        <section ref={sectionRefs.identity} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Project Identity & Logo</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Set project display alias, tag, highlight color, and custom logo.
              </p>
            </div>

            <button
              onClick={() => {
                setCustomName('');
                setCustomTag('');
                setDescription('');
                setSelectedColor('');
                setSelectedIcon('folder-git');
                setIconUrlInput('');
              }}
              className="text-xs text-[#6B7280] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset fields to defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#9CA3AF]">Display Name (Alias)</label>
              <input
                type="text"
                placeholder={targetProject.name}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-[#14161A] border border-white/[0.08] focus:border-white/30 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#9CA3AF]">Group / Category Tag</label>
              <input
                type="text"
                placeholder="e.g. FRONTEND, API, CORE"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                className="w-full bg-[#14161A] border border-white/[0.08] focus:border-white/30 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none font-mono uppercase transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#9CA3AF]">Project Description</label>
            <input
              type="text"
              placeholder="Brief summary of this project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#14161A] border border-white/[0.08] focus:border-white/30 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
            />
          </div>

          {/* Accent Color Swatches */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-[#9CA3AF]">Theme Accent Color</label>
              {selectedColor && (
                <span className="text-[11px] font-mono text-[#6B7280]">{selectedColor}</span>
              )}
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {COLOR_PRESETS.map((c) => {
                const isSelected = selectedColor === c.hex || (!selectedColor && c.id === 'default');
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedColor(c.hex)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      isSelected ? 'ring-2 ring-white scale-110' : 'opacity-75 hover:opacity-100 hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: c.hex || 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.15)'
                    }}
                    title={c.label}
                  >
                    {isSelected && (
                      <Check
                        className="w-3.5 h-3.5"
                        style={{ color: c.hex === '#ECEDEF' ? '#101113' : '#FFFFFF' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Project Logo / Icon Upload & URL */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-white">Project Logo / Icon</label>
                <p className="text-[11px] text-[#6B7280]">
                  Upload an image from your computer or enter a direct web link (PNG, SVG, JPG, WebP).
                </p>
              </div>

              {isCustomLogo && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIcon('folder-git');
                    setIconUrlInput('');
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  Remove Custom Logo
                </button>
              )}
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-[#14161A] rounded-lg border border-white/[0.06] w-fit">
              <button
                type="button"
                onClick={() => setLogoInputMode('upload')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  logoInputMode === 'upload'
                    ? 'bg-white/[0.1] text-white shadow-xs'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>
              <button
                type="button"
                onClick={() => setLogoInputMode('url')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  logoInputMode === 'url'
                    ? 'bg-white/[0.1] text-white shadow-xs'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Image Link</span>
              </button>
            </div>

            {/* Input by Mode */}
            {logoInputMode === 'upload' ? (
              <div>
                <input
                  ref={logoUploadRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <button
                  type="button"
                  onClick={() => logoUploadRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-6 bg-[#14161A] hover:bg-[#1A1D23] border border-dashed border-white/[0.15] hover:border-white/30 rounded-xl text-xs font-medium text-white transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-[#9CA3AF]" />
                  <span>Click to choose an image file from your computer...</span>
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png or .svg"
                    value={iconUrlInput}
                    onChange={(e) => setIconUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && iconUrlInput.trim()) {
                        e.preventDefault();
                        setSelectedIcon(iconUrlInput.trim());
                      }
                    }}
                    className="w-full bg-[#14161A] border border-white/[0.08] focus:border-white/30 rounded-lg pl-9 pr-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (iconUrlInput.trim()) {
                      setSelectedIcon(iconUrlInput.trim());
                    }
                  }}
                  disabled={!iconUrlInput.trim()}
                  className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-40 text-xs font-medium text-white rounded-lg transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
            )}

            {/* Preset Symbols */}
            <div className="pt-2">
              <span className="block text-[11px] text-[#6B7280] mb-2 font-mono uppercase tracking-wider">
                Or select a preset symbol:
              </span>
              <div className="flex flex-wrap gap-2">
                {PRESET_ICONS.map((ic) => {
                  const IconComp = ic.icon;
                  const isSelected = selectedIcon === ic.id;
                  return (
                    <button
                      key={ic.id}
                      type="button"
                      onClick={() => {
                        setSelectedIcon(ic.id);
                        setIconUrlInput('');
                      }}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white/[0.14] border-white text-white shadow-xs'
                          : 'bg-[#14161A] border-white/[0.06] text-[#9CA3AF] hover:bg-white/[0.06] hover:text-white'
                      }`}
                      title={ic.label}
                    >
                      <IconComp
                        className="w-4 h-4"
                        style={selectedColor && isSelected ? { color: selectedColor } : undefined}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: GIT & INTEGRATIONS */}
        <section ref={sectionRefs.gitDiscord} className="space-y-6 pt-6 border-t border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-white" />
              <h2 className="text-base font-semibold text-white tracking-tight">Git & Integrations</h2>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Sync with remote Git repository and broadcast real-time status via Discord Rich Presence.
            </p>
          </div>

          {/* Discord RPC Switch */}
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-xs font-medium text-white">Enable Discord Rich Presence for this project</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5">
                Displays &quot;Working in {customName || targetProject.name}&quot; and your current branch on Discord.
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
          <div className="space-y-2 py-2">
            <div className="text-xs font-medium text-white flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-[#9CA3AF]" />
              <span>Remote Git Repository</span>
            </div>
            {detectedRemote?.browserUrl ? (
              <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-[#14161A] border border-white/[0.06]">
                <span className="text-[#9CA3AF] truncate font-mono">{detectedRemote.browserUrl}</span>
                <a
                  href={detectedRemote.browserUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-white underline flex items-center gap-1 hover:text-[#9CA3AF] ml-4 flex-shrink-0"
                >
                  <span>Open in Browser</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : (
              <p className="text-xs text-[#6B7280]">No remote repository configured for this project.</p>
            )}
          </div>
        </section>

        {/* SECTION 3: DANGER ZONE */}
        <section ref={sectionRefs.danger} className="space-y-4 pt-6 border-t border-rose-500/20">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h2 className="text-base font-semibold text-rose-400 tracking-tight">Danger Zone</h2>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Workspace management actions. Local files on disk will remain untouched.
            </p>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-xs font-semibold text-rose-300">Remove Project from Workspace</div>
              <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                Removes this project from Orbito and recent project lists. Your local repository files are safe.
              </div>
            </div>

            <button
              type="button"
              onClick={handleRemoveProject}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/90 text-white hover:bg-rose-600 transition-colors cursor-pointer"
            >
              Remove Project
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProjectSettingsPage;
