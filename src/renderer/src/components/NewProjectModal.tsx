import React, { useState } from 'react';
import {
  X,
  FolderPlus,
  FolderOpen,
  GitBranch,
  Sparkles,
  Code2,
  FileCode,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { ProjectTemplateId, ProjectTemplateInfo } from '../../../shared/types';
import { useWorkspaceStore } from '../stores/workspace.store';
import Button from './ui/Button';

export interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
  const { createProject, addLog } = useWorkspaceStore();

  const [projectName, setProjectName] = useState('');
  const [parentDir, setParentDir] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplateId>('empty');
  const [initGit, setInitGit] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBrowseDestination = async () => {
    try {
      const selected = await window.api.selectDirectory('Choose Parent Directory');
      if (selected) {
        setParentDir(selected);
        setError(null);
      }
    } catch (err: any) {
      addLog(`Failed to select directory: ${err.message}`, 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
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
      onClose();
      setProjectName('');
      setParentDir('');
      setSelectedTemplate('empty');
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-[#111116] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">Create New Project</h2>
              <p className="text-xs text-[#747982]">Scaffold and initialize a workspace project</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#747982] hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreate} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

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
              placeholder="my-awesome-app"
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-white/25 focus:outline-none text-xs text-white placeholder-[#747982] transition-colors font-mono"
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
                placeholder="Select parent folder on disk..."
                className="flex-1 px-3.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-white/25 focus:outline-none text-xs text-white placeholder-[#747982] transition-colors font-mono"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<FolderOpen className="w-3.5 h-3.5" />}
                onClick={handleBrowseDestination}
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
            <div className="grid grid-cols-2 gap-2.5">
              {TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
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
                    <p className="text-[11px] text-[#747982] leading-relaxed line-clamp-2">
                      {tmpl.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Git Initialization Toggle */}
          <div className="pt-2">
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

          {/* Footer Actions */}
          <div className="pt-4 border-t border-white/[0.06] flex items-center justify-end gap-2.5">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
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
      </div>
    </div>
  );
};

export default NewProjectModal;