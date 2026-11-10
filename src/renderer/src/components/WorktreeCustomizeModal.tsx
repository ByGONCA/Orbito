import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  GitFork,
  Tag as TagIcon,
  RotateCcw,
  Palette,
  FileText
} from 'lucide-react';

export interface WorktreeCustomizationData {
  customName?: string;
  tag?: string;
  description?: string;
  customColor?: string;
}

export interface WorktreeCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  projectPath: string;
  worktree: {
    path: string;
    branch: string;
    isMain?: boolean;
    customName?: string;
    tag?: string;
    description?: string;
    customColor?: string;
  } | null;
  onSave: (data: WorktreeCustomizationData) => Promise<void> | void;
}

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

const TAG_PRESETS = [
  'frontend',
  'backend',
  'api',
  'docs',
  'feature',
  'hotfix',
  'experimental',
  'testing'
];

export const WorktreeCustomizeModal: React.FC<WorktreeCustomizeModalProps> = ({
  isOpen,
  onClose,
  projectName,
  worktree,
  onSave
}) => {
  const [customName, setCustomName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (worktree) {
      setCustomName(worktree.customName || '');
      setTag(worktree.tag || '');
      setDescription(worktree.description || '');
      setCustomColor(worktree.customColor || '');
    }
  }, [worktree]);

  if (!isOpen || !worktree) return null;

  const displayName = customName.trim() || worktree.branch;

  const handleReset = () => {
    setCustomName('');
    setTag('');
    setDescription('');
    setCustomColor('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({
        customName: customName.trim() || undefined,
        tag: tag.trim() || undefined,
        description: description.trim() || undefined,
        customColor: customColor.trim() || undefined
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none font-sans animate-in fade-in duration-150">
      <div className="w-[500px] max-w-[95vw] max-h-[90vh] flex flex-col bg-[#141619] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="h-12 px-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-[#A4A8AF]" />
            <span className="text-xs font-semibold text-[#ECEDEF]">Customize Worktree</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              className="px-2 py-1 text-[11px] text-[#747982] hover:text-[#ECEDEF] flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset to default"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-[#747982] hover:text-[#ECEDEF] hover:bg-white/[0.06] transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* 1. Live Preview */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#747982]">
              Live Preview in Sidebar
            </label>
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1.5">
              <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-1">
                <span>{projectName}</span>
                <span>/</span>
                <span>worktrees</span>
              </div>
              <div className="flex items-center gap-2 pl-3 border-l-2" style={{ borderColor: customColor || 'rgba(255, 255, 255, 0.4)' }}>
                <GitFork className="w-3.5 h-3.5 text-neutral-300" />
                <span className="font-mono font-medium text-white">{displayName}</span>
                {tag && (
                  <span
                    className="text-[9px] font-mono px-1.5 py-0.2 rounded"
                    style={{
                      backgroundColor: customColor ? `${customColor}22` : 'rgba(255, 255, 255, 0.08)',
                      color: customColor || '#A4A8AF'
                    }}
                  >
                    {tag}
                  </span>
                )}
                {worktree.branch !== displayName && (
                  <span className="text-[10px] text-neutral-500 font-mono">({worktree.branch})</span>
                )}
              </div>
              {description && (
                <p className="text-[10.5px] text-neutral-400 pl-6 leading-tight italic">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* 2. Custom Name / Alias */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-[#ECEDEF]">Worktree Alias / Display Name</label>
              <span className="text-[10px] text-[#747982] font-mono">Git branch: {worktree.branch}</span>
            </div>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={worktree.branch}
              className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-[#ECEDEF] rounded-lg px-3 py-2 text-xs text-[#ECEDEF] placeholder:text-[#747982] focus:outline-none transition-colors"
            />
          </div>

          {/* 3. Tag / Label */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[#ECEDEF] flex items-center gap-1.5">
              <TagIcon className="w-3 h-3 text-[#A4A8AF]" />
              <span>Tag / Role Label</span>
            </label>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {TAG_PRESETS.map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setTag(tag === tp ? '' : tp)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                    tag === tp
                      ? 'bg-white/[0.15] text-[#ECEDEF] font-medium'
                      : 'bg-white/[0.03] text-[#747982] hover:text-[#ECEDEF]'
                  }`}
                >
                  {tp}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g. frontend, backend, auth-service, docs..."
              className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-[#ECEDEF] rounded-lg px-3 py-1.5 text-xs text-[#ECEDEF] placeholder:text-[#747982] focus:outline-none transition-colors font-mono"
            />
          </div>

          {/* 4. Description */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[#ECEDEF] flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-[#A4A8AF]" />
              <span>Description / Purpose</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Frontend UI components & animations redesign"
              className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-[#ECEDEF] rounded-lg px-3 py-1.5 text-xs text-[#ECEDEF] placeholder:text-[#747982] focus:outline-none transition-colors"
            />
          </div>

          {/* 5. Highlight Color */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-[#ECEDEF] flex items-center gap-1.5">
                <Palette className="w-3 h-3 text-[#A4A8AF]" />
                <span>Branch Accent Color</span>
              </label>
              {customColor && (
                <span className="text-[10px] font-mono text-[#A4A8AF]">{customColor}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((c) => {
                const isSelected = (customColor === c.hex) || (!customColor && c.id === 'default');
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCustomColor(c.hex)}
                    title={c.label}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                      isSelected ? 'ring-2 ring-white scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: c.hex || 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)'
                    }}
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

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-[#A4A8AF] hover:text-[#ECEDEF] text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-[#ECEDEF] text-[#101113] hover:bg-white text-xs font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Worktree'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default WorktreeCustomizeModal;
