import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FolderOpen,
  GitBranch,
  Globe,
  Plus,
  CornerDownLeft,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  Code2,
  FileCode,
  Check,
  FolderPlus
} from 'lucide-react';
import type { ProjectTemplateId, ProjectTemplateInfo } from '../../../shared/types';
import { useWorkspaceStore } from '../stores/workspace.store';
import Button from './ui/Button';

export interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = 'main' | 'clone' | 'template';

const TEMPLATES: ProjectTemplateInfo[] = [
  {
    id: 'empty',
    name: 'Empty Project',
    description: 'Clean slate with basic .gitignore and README.md',
    icon: 'folder'
  },
  {
    id: 'node',
    name: 'Node.js',
    description: 'ESM package.json, src/index.js & start script',
    icon: 'node'
  },
  {
    id: 'react',
    name: 'React + Vite',
    description: 'React 18, TypeScript, Vite & modern build setup',
    icon: 'react'
  },
  {
    id: 'python',
    name: 'Python',
    description: 'Python 3 script with main.py & requirements.txt',
    icon: 'python'
  }
];

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose }) => {
  const {
    setProject,
    setFiles,
    loadGitStatus,
    setRecentProjects,
    createProject,
    cloneProject,
    setActiveSection,
    addLog
  } = useWorkspaceStore();

  const [view, setView] = useState<ModalView>('main');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Template Form State
  const [projectName, setProjectName] = useState('');
  const [parentDir, setParentDir] = useState(() => localStorage.getItem('orbito:lastParentDir') || '');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplateId>('empty');
  const [initGit, setInitGit] = useState(true);

  // Clone Form State
  const [cloneUrl, setCloneUrl] = useState('');
  const [customCloneName, setCustomCloneName] = useState('');

  // Host Platform Label
  const hostLabel = useMemo(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      if (ua.includes('Windows')) return 'Local Windows';
      if (ua.includes('Mac')) return 'Local macOS';
      if (ua.includes('Linux')) return 'Local Linux';
    }
    return 'Local Environment';
  }, []);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setView('main');
      setError(null);
      setProjectName('');
      setCloneUrl('');
      setCustomCloneName('');
      setSelectedTemplate('empty');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view !== 'main') {
          setView('main');
          setError(null);
        } else {
          onClose();
        }
      } else if (e.key === 'Enter' && view === 'main') {
        e.preventDefault();
        handleBrowseFolder();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, view, parentDir]);

  // Derived clone target name
  const derivedCloneName = useMemo(() => {
    if (customCloneName.trim()) return customCloneName.trim();
    const raw = cloneUrl.trim();
    if (!raw) return '';
    const match = raw.match(/\/([^/]+?)(?:\.git)?$/) || raw.match(/:([^/]+?)(?:\.git)?$/);
    return match ? match[1].replace(/\.git$/i, '') : '';
  }, [cloneUrl, customCloneName]);

  if (!isOpen) return null;

  // 1. Direct Browse Folder Action
  const handleBrowseFolder = async () => {
    try {
      const selected = await window.api.openDirectoryDialog();
      if (selected) {
        setProject(selected);
        const files = await window.api.listFiles({ projectPath: selected.path });
        setFiles(files);
        const recents = await window.api.getRecentProjects();
        setRecentProjects(recents);
        loadGitStatus(selected.path);
        setActiveSection('terminal');
        addLog(`Opened workspace: ${selected.name}`, 'info');
        onClose();
      }
    } catch (err: any) {
      setError(`Failed to open project: ${err.message}`);
    }
  };

  // Browse Directory for Parent Folder
  const handleSelectParentDir = async () => {
    try {
      const selected = await window.api.selectDirectory('Select Destination Folder');
      if (selected) {
        setParentDir(selected);
        localStorage.setItem('orbito:lastParentDir', selected);
        setError(null);
      }
    } catch (err: any) {
      setError(`Failed to select directory: ${err.message}`);
    }
  };

  // 2. Clone from URL Action
  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUrl = cloneUrl.trim();
    if (!rawUrl) {
      setError('Please provide a valid Git / GitHub repository URL.');
      return;
    }

    if (!parentDir) {
      setError('Please choose a destination directory.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const desc = await cloneProject({
        url: rawUrl,
        parentDirectory: parentDir,
        customName: customCloneName.trim() || undefined
      });
      setActiveSection('terminal');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to clone repository');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Create Project Action
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = projectName.trim();
    if (!trimmed) {
      setError('Please enter a valid project name.');
      return;
    }

    if (/[<>:"/\\|?*]/.test(trimmed)) {
      setError('Project name cannot contain invalid characters (<>:"/\\|?*).');
      return;
    }

    if (!parentDir) {
      setError('Please choose a destination directory.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createProject({
        name: trimmed,
        parentDirectory: parentDir,
        template: selectedTemplate,
        initGit
      });
      setActiveSection('terminal');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-[#111216] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-xs text-[#ECEDEF]">
        {/* Top Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            {view !== 'main' && (
              <button
                type="button"
                onClick={() => {
                  setView('main');
                  setError(null);
                }}
                className="p-1 rounded-md text-[#747982] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer mr-1"
                title="Voltar às opções"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-sm font-semibold text-white tracking-tight">
              {view === 'main' && 'Add a project'}
              {view === 'clone' && 'Clone repository from URL'}
              {view === 'template' && 'Create new project'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-[#A4A8AF] font-medium">
              Host: <span className="text-white">{hostLabel}</span>
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#747982] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1. MAIN SELECTION VIEW                                   */}
        {/* ======================================================== */}
        {view === 'main' && (
          <div className="p-5 space-y-4">
            {/* Primary Action: Browse Folder */}
            <div
              onClick={handleBrowseFolder}
              role="button"
              tabIndex={0}
              className="group relative flex items-center justify-between p-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/[0.1] hover:border-white/20 transition-all cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-white/[0.08] group-hover:bg-white/[0.12] flex items-center justify-center text-white transition-colors">
                  <FolderOpen className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Browse folder</div>
                  <div className="text-[11px] text-[#747982] group-hover:text-[#A4A8AF] transition-colors">
                    Local project, Git repo, or folder with many repos
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/[0.05] border border-white/[0.08] text-[11px] font-mono text-[#747982] group-hover:text-white transition-colors">
                <CornerDownLeft className="w-3 h-3" />
              </div>
            </div>

            {/* Other Ways Divider */}
            <div className="pt-2">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[#747982]">
                Other ways to add
              </span>
            </div>

            {/* Sub-options List */}
            <div className="space-y-2">
              {/* Option A: Clone from URL */}
              <div
                onClick={() => {
                  setView('clone');
                  setError(null);
                }}
                role="button"
                tabIndex={0}
                className="group flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/10 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white group-hover:text-cyan-300 transition-colors">
                      Clone from URL
                    </div>
                    <div className="text-[11px] text-[#747982]">
                      Clone a remote repository from GitHub, GitLab or Git URL
                    </div>
                  </div>
                </div>
              </div>

              {/* Option B: Create new project */}
              <div
                onClick={() => {
                  setView('template');
                  setError(null);
                }}
                role="button"
                tabIndex={0}
                className="group flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/10 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white group-hover:text-emerald-300 transition-colors">
                      Create new project
                    </div>
                    <div className="text-[11px] text-[#747982]">
                      Start from an empty folder or scaffold from a framework template
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. CLONE FROM URL VIEW                                   */}
        {/* ======================================================== */}
        {view === 'clone' && (
          <form onSubmit={handleCloneSubmit} className="p-5 space-y-4">
            {/* Git / GitHub URL Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#ECEDEF]">Repository URL (GitHub / Git)</label>
              <input
                type="text"
                value={cloneUrl}
                onChange={(e) => {
                  setCloneUrl(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="https://github.com/owner/repository.git"
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-cyan-500/50 focus:outline-none text-xs text-white placeholder-[#747982] font-mono transition-colors"
              />
              <p className="text-[11px] text-[#747982]">
                Supports standard HTTPS (<span className="text-white/70">https://github.com/...</span>) and SSH repository formats.
              </p>
            </div>

            {/* Destination Directory */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#ECEDEF]">Destination Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={parentDir}
                  onChange={(e) => {
                    setParentDir(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Select parent folder on disk..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-cyan-500/50 focus:outline-none text-xs text-white placeholder-[#747982] font-mono transition-colors"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<FolderOpen className="w-3.5 h-3.5" />}
                  onClick={handleSelectParentDir}
                >
                  Browse
                </Button>
              </div>
            </div>

            {/* Custom Project Folder Name (Optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#ECEDEF]">
                Project Folder Name <span className="text-[#747982] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={customCloneName}
                onChange={(e) => setCustomCloneName(e.target.value)}
                placeholder={derivedCloneName || 'repository-name'}
                className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-cyan-500/50 focus:outline-none text-xs text-white placeholder-[#747982] font-mono transition-colors"
              />
              {parentDir && derivedCloneName && (
                <p className="text-[11px] text-[#747982] font-mono truncate">
                  Target clone path: <span className="text-white/80">{parentDir}\{derivedCloneName}</span>
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setView('main');
                  setError(null);
                }}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting || !cloneUrl.trim() || !parentDir}
                icon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
              >
                {isSubmitting ? 'Cloning Repository...' : 'Clone & Open Project'}
              </Button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* 3. TEMPLATE CREATION VIEW                                */}
        {/* ======================================================== */}
        {view === 'template' && (
          <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
            {/* Project Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#ECEDEF]">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="my-awesome-project"
                autoFocus
                className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-white/20 focus:outline-none text-xs text-white placeholder-[#747982] font-mono transition-colors"
              />
            </div>

            {/* Destination Directory */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#ECEDEF]">Destination Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={parentDir}
                  onChange={(e) => {
                    setParentDir(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Select destination folder on disk..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-white/20 focus:outline-none text-xs text-white placeholder-[#747982] font-mono transition-colors"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<FolderOpen className="w-3.5 h-3.5" />}
                  onClick={handleSelectParentDir}
                >
                  Browse
                </Button>
              </div>
              {parentDir && projectName.trim() && (
                <p className="text-[11px] text-[#747982] font-mono truncate">
                  Target: {parentDir}\{projectName.trim()}
                </p>
              )}
            </div>

            {/* Template Selection */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#ECEDEF]">Project Template</label>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplate === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-white/[0.08] border-white/30 text-white shadow-xs'
                          : 'bg-white/[0.02] border-white/[0.06] text-[#A4A8AF] hover:bg-white/[0.04] hover:text-white hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {tmpl.id === 'react' && <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                          {tmpl.id === 'python' && <Code2 className="w-3.5 h-3.5 text-amber-400" />}
                          {tmpl.id === 'node' && <FileCode className="w-3.5 h-3.5 text-emerald-400" />}
                          {tmpl.id === 'empty' && <FolderPlus className="w-3.5 h-3.5 text-[#747982]" />}
                          <span className="text-xs font-semibold">{tmpl.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <p className="text-[11px] text-[#747982] leading-tight line-clamp-2">
                        {tmpl.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Git Init */}
            <div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={initGit}
                  onChange={(e) => setInitGit(e.target.checked)}
                  className="rounded bg-white/[0.05] border-white/20 text-emerald-500 focus:ring-0 focus:outline-none w-4 h-4 cursor-pointer"
                />
                <div className="flex items-center gap-1.5 text-xs text-[#ECEDEF]">
                  <GitBranch className="w-3.5 h-3.5 text-[#747982]" />
                  <span>Initialize as a Git repository (git init)</span>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setView('main');
                  setError(null);
                }}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting || !projectName.trim() || !parentDir}
                icon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
              >
                {isSubmitting ? 'Creating Project...' : 'Create & Open Project'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default NewProjectModal;
