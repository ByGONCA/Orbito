import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  FolderGit2,
  FolderCode,
  Terminal,
  Bot,
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
  Palette,
  Upload,
  RotateCcw,
  Link as LinkIcon,
  Image as ImageIcon
} from 'lucide-react';
import type { ProjectDescriptor } from '../../../shared/types';
import { useWorkspaceStore } from '../stores/workspace.store';
import { Devicon } from '../utils/devicon-svgs';

export interface ProjectCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectDescriptor | null;
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

export const ProjectIconRenderer: React.FC<{
  iconId?: string;
  color?: string;
  className?: string;
}> = ({ iconId, color, className = 'w-4 h-4' }) => {
  const style = color ? { color } : undefined;

  // Custom uploaded image or external URL (Data URL, local file path, http/https)
  if (
    iconId &&
    (iconId.startsWith('data:image/') ||
      iconId.startsWith('file:') ||
      iconId.startsWith('http://') ||
      iconId.startsWith('https://') ||
      iconId.startsWith('/') ||
      iconId.includes('.'))
  ) {
    return (
      <img
        src={iconId}
        alt="Project Icon"
        className={`${className} object-contain rounded-[3px]`}
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  // Check if it's a devicon language logo
  if (iconId && ['typescript', 'javascript', 'react', 'python', 'rust', 'go'].includes(iconId)) {
    return <Devicon name={iconId} className={className} />;
  }

  const preset = ICON_PRESETS.find((p) => p.id === iconId);
  if (preset) {
    const IconComp = preset.icon;
    return <IconComp className={className} style={style} />;
  }

  return <FolderGit2 className={className} style={style} />;
};

export const ProjectCustomizeModal: React.FC<ProjectCustomizeModalProps> = ({
  isOpen,
  onClose,
  project
}) => {
  const { updateProjectCustomization } = useWorkspaceStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customName, setCustomName] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [customIcon, setCustomIcon] = useState('folder-git');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (project) {
      setCustomName(project.customName || '');
      setCustomColor(project.customColor || '');
      setCustomIcon(project.customIcon || 'folder-git');
    }
  }, [project]);

  if (!isOpen || !project) return null;

  const displayName = customName.trim() || project.name;
  const isCustomImage = customIcon.startsWith('data:image/') || customIcon.startsWith('file:');

  const handleResetToDefault = () => {
    setCustomName('');
    setCustomColor('');
    setCustomIcon('folder-git');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, SVG, WebP, etc.)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCustomIcon(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    setIsSubmitting(true);
    try {
      await updateProjectCustomization(project.id, {
        customName: customName.trim() || undefined,
        customColor: customColor.trim() || undefined,
        customIcon: customIcon || undefined
      });
      onClose();
    } catch {
      // Handled in store
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none font-sans animate-in fade-in duration-150">
      <div className="w-[520px] max-w-[95vw] max-h-[90vh] flex flex-col bg-[#141619] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="h-12 px-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#A4A8AF]" />
            <span className="text-xs font-semibold text-[#ECEDEF]">Customize Project</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleResetToDefault}
              className="px-2 py-1 text-[11px] text-[#747982] hover:text-[#ECEDEF] flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset to default settings"
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
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* 1. Live Preview Strip */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#747982]">
              Live Preview
            </label>
            <div
              className="p-3 rounded-xl border border-white/[0.08] transition-all flex items-center justify-between"
              style={{
                backgroundColor: customColor ? `${customColor}14` : 'rgba(255, 255, 255, 0.03)',
                borderColor: customColor ? `${customColor}40` : 'rgba(255, 255, 255, 0.08)'
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{
                    backgroundColor: customColor ? `${customColor}22` : 'rgba(255, 255, 255, 0.06)'
                  }}
                >
                  <ProjectIconRenderer
                    iconId={customIcon}
                    color={customColor || '#ECEDEF'}
                    className="w-4 h-4"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#ECEDEF] truncate">{displayName}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#747982] truncate block">
                    {project.path}
                  </span>
                </div>
              </div>

              <span className="text-[10px] font-mono text-[#747982] flex-shrink-0">
                {project.activeBranch || 'main'}
              </span>
            </div>
          </div>

          {/* 2. Custom Name Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-[#ECEDEF]">Project Name (Alias)</label>
              <span className="text-[10px] text-[#747982]">Folder: {project.name}</span>
            </div>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={project.name}
              className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-[#ECEDEF] rounded-lg px-3 py-2 text-xs text-[#ECEDEF] placeholder:text-[#747982] focus:outline-none transition-colors"
            />
          </div>

          {/* 3. Color Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-[#ECEDEF]">Highlight Color</label>
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

          {/* 4. Icon Selector & Image Upload */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-[#ECEDEF]">Project Icon</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 hover:text-white rounded-[4px] text-[10.5px] transition-colors cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>Upload Image...</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            {/* Custom image indicator if uploaded */}
            {isCustomImage && (
              <div className="flex items-center justify-between p-2 bg-white/[0.04] rounded-lg border border-white/[0.1]">
                <div className="flex items-center gap-2">
                  <img src={customIcon} alt="Custom" className="w-6 h-6 object-contain rounded" />
                  <span className="text-[11px] text-neutral-300">Custom image loaded</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomIcon('folder-git')}
                  className="text-[10px] text-neutral-400 hover:text-rose-400 cursor-pointer"
                >
                  Remove Image
                </button>
              </div>
            )}

            {/* Presets Grid */}
            <div className="grid grid-cols-8 gap-2">
              {ICON_PRESETS.map((ic) => {
                const isSelected = customIcon === ic.id;
                const IconComp = ic.icon;
                return (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => setCustomIcon(ic.id)}
                    title={ic.label}
                    className={`h-9 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white/[0.12] border border-white/[0.25] text-white shadow-xs'
                        : 'bg-white/[0.03] hover:bg-white/[0.06] text-[#A4A8AF] hover:text-[#ECEDEF] border border-transparent'
                    }`}
                  >
                    <IconComp
                      className="w-4 h-4"
                      style={customColor && isSelected ? { color: customColor } : undefined}
                    />
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
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default ProjectCustomizeModal;
