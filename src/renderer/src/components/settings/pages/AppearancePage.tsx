import React from 'react';
import {
  Sparkles,
  Moon,
  Sun,
  Check,
  FolderOpen,
  Bot,
  GitBranch,
  Network,
  ChevronRight
} from 'lucide-react';
import { SettingSection } from '../common/SettingSection';
import { SettingRow } from '../common/SettingRow';
import { SettingToggle } from '../common/SettingToggle';
import { useWorkspaceStore } from '../../../stores/workspace.store';
import { FileIcon, type FileIconTheme } from '../../../utils/file-icons';

interface ThemeOption {
  id: 'glass' | 'solid' | 'light';
  title: string;
  badge?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'glass',
    title: 'Glassmorphism',
    badge: 'Recommended',
    description: 'Translucent charcoal glass panels with soft backdrop blur and delicate reflections.',
    icon: Sparkles
  },
  {
    id: 'solid',
    title: 'Solid Dark',
    description: 'Classic opaque dark panels with zero transparency for maximum contrast.',
    icon: Moon
  },
  {
    id: 'light',
    title: 'Light Theme',
    description: 'Clean off-white surfaces with dark charcoal typography and high-clarity contrast.',
    icon: Sun
  }
];

const ThemeMiniPreview: React.FC<{ variant: 'glass' | 'solid' | 'light' }> = ({ variant }) => {
  if (variant === 'light') {
    return (
      <div className="w-full h-28 rounded-xl bg-[#F8FAFC] overflow-hidden flex flex-col select-none text-[8px] font-sans shadow-xs mt-3 border-0">
        {/* Top bar */}
        <div className="h-5 bg-white px-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1]" />
            </div>
            <div className="flex items-center gap-1 ml-1 text-[7px]">
              <span className="px-1.5 py-0.5 rounded text-[#2563EB] bg-[#EFF6FF] flex items-center gap-0.5 font-medium">
                <Sparkles className="w-2 h-2 text-[#2563EB]" />
                <span>Agents</span>
              </span>
              <span className="px-1 py-0.5 text-[#64748B]">Workflows</span>
              <span className="px-1 py-0.5 text-[#64748B]">Graph</span>
            </div>
          </div>
          <div className="text-[7px] text-[#2563EB] font-mono flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-[#10B981]" />
            <span>AI Online</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Rail */}
          <div className="w-6 bg-[#F1F5F9] py-1.5 flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="w-3.5 h-3.5 rounded bg-[#2563EB]/15 text-[#2563EB] flex items-center justify-center">
              <Bot className="w-2.5 h-2.5" />
            </div>
            <div className="w-3.5 h-3.5 rounded text-[#64748B] flex items-center justify-center">
              <GitBranch className="w-2.5 h-2.5" />
            </div>
            <div className="w-3.5 h-3.5 rounded text-[#64748B] flex items-center justify-center">
              <Network className="w-2.5 h-2.5" />
            </div>
          </div>

          {/* AI Workspace Canvas */}
          <div className="flex-1 bg-white p-2 flex flex-col justify-between overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-full bg-[#2563EB] text-white flex items-center justify-center">
                  <Sparkles className="w-2 h-2" />
                </div>
                <div>
                  <div className="text-[7.5px] font-semibold text-[#0F172A] tracking-tight leading-none">
                    Multi-Agent Orchestrator
                  </div>
                  <div className="text-[6px] text-[#64748B] leading-tight">Autonomous workspace intelligence</div>
                </div>
              </div>
              <div className="text-[6px] font-mono px-1 py-0.5 rounded bg-[#F1F5F9] text-[#334155]">
                Gemini 3.8
              </div>
            </div>

            {/* Specialist Agents Cards */}
            <div className="grid grid-cols-3 gap-1 py-0.5">
              <div className="p-1 rounded bg-[#F8FAFC] flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[6.5px] font-medium text-[#2563EB]">Lead Architect</span>
                  <span className="w-1 h-1 rounded-full bg-[#2563EB]" />
                </div>
                <span className="text-[5.5px] text-[#64748B] truncate">Planning tasks</span>
              </div>
              <div className="p-1 rounded bg-[#F8FAFC] flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[6.5px] font-medium text-[#0F172A]">Frontend Agent</span>
                  <span className="w-1 h-1 rounded-full bg-[#10B981]" />
                </div>
                <span className="text-[5.5px] text-[#64748B] truncate">Active execution</span>
              </div>
              <div className="p-1 rounded bg-[#F8FAFC] flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[6.5px] font-medium text-[#0F172A]">QA Specialist</span>
                  <span className="w-1 h-1 rounded-full bg-[#F59E0B]" />
                </div>
                <span className="text-[5.5px] text-[#64748B] truncate">Verifying specs</span>
              </div>
            </div>

            {/* Status Footer */}
            <div className="h-3 -mx-2 -mb-2 px-2 bg-[#F8FAFC] flex items-center justify-between text-[6px] text-[#64748B]">
              <div className="flex items-center gap-1">
                <span className="text-[#2563EB]">✦</span>
                <span>3 Agents Active</span>
                <span>•</span>
                <span>Graph Synced</span>
              </div>
              <span className="font-mono text-[5.5px]">Autonomous</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'solid') {
    return (
      <div className="w-full h-28 rounded-xl bg-[#101216] overflow-hidden flex flex-col select-none text-[8px] font-sans shadow-xs mt-3 border-0">
        {/* Top bar */}
        <div className="h-5 bg-[#16191F] px-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#2A2D33]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#2A2D33]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#2A2D33]" />
            </div>
            <div className="flex items-center gap-1 ml-1 text-[7px]">
              <span className="px-1.5 py-0.5 rounded text-blue-400 bg-blue-500/10 flex items-center gap-0.5 font-medium">
                <Sparkles className="w-2 h-2 text-blue-400" />
                <span>Agents</span>
              </span>
              <span className="px-1 py-0.5 text-[#747982]">Workflows</span>
              <span className="px-1 py-0.5 text-[#747982]">Graph</span>
            </div>
          </div>
          <div className="text-[7px] text-blue-400 font-mono flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            <span>AI Online</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Rail */}
          <div className="w-6 bg-[#13151A] py-1.5 flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="w-3.5 h-3.5 rounded bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Bot className="w-2.5 h-2.5" />
            </div>
            <div className="w-3.5 h-3.5 rounded text-[#747982] flex items-center justify-center">
              <GitBranch className="w-2.5 h-2.5" />
            </div>
            <div className="w-3.5 h-3.5 rounded text-[#747982] flex items-center justify-center">
              <Network className="w-2.5 h-2.5" />
            </div>
          </div>

          {/* AI Workspace Canvas */}
          <div className="flex-1 bg-[#181B22] p-2 flex flex-col justify-between overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                  <Sparkles className="w-2 h-2" />
                </div>
                <div>
                  <div className="text-[7.5px] font-semibold text-[#ECEDEF] tracking-tight leading-none">
                    Multi-Agent Orchestrator
                  </div>
                  <div className="text-[6px] text-[#747982] leading-tight">Autonomous workspace intelligence</div>
                </div>
              </div>
              <div className="text-[6px] font-mono px-1 py-0.5 rounded bg-[#1F232B] text-[#A4A8AF]">
                Gemini 3.8
              </div>
            </div>

            {/* Specialist Agents Cards */}
            <div className="grid grid-cols-3 gap-1 py-0.5">
              <div className="p-1 rounded bg-[#13151A] flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[6.5px] font-medium text-blue-400">Lead Architect</span>
                  <span className="w-1 h-1 rounded-full bg-blue-400" />
                </div>
                <span className="text-[5.5px] text-[#747982] truncate">Planning tasks</span>
              </div>
              <div className="p-1 rounded bg-[#13151A] flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[6.5px] font-medium text-[#ECEDEF]">Frontend Agent</span>
                  <span className="w-1 h-1 rounded-full bg-emerald-400" />
                </div>
                <span className="text-[5.5px] text-[#747982] truncate">Active execution</span>
              </div>
              <div className="p-1 rounded bg-[#13151A] flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[6.5px] font-medium text-[#ECEDEF]">QA Specialist</span>
                  <span className="w-1 h-1 rounded-full bg-amber-400" />
                </div>
                <span className="text-[5.5px] text-[#747982] truncate">Verifying specs</span>
              </div>
            </div>

            {/* Status Footer */}
            <div className="h-3 -mx-2 -mb-2 px-2 bg-[#14161B] flex items-center justify-between text-[6px] text-[#747982]">
              <div className="flex items-center gap-1">
                <span className="text-blue-400">✦</span>
                <span>3 Agents Active</span>
                <span>•</span>
                <span>Graph Synced</span>
              </div>
              <span className="font-mono text-[5.5px]">Autonomous</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Glassmorphism (variant === 'glass')
  return (
    <div className="w-full h-28 rounded-xl bg-[#0c0d12]/80 backdrop-blur-md overflow-hidden flex flex-col select-none text-[8px] font-sans shadow-md relative mt-3 border-0">
      {/* Specular top highlight */}
      <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />

      {/* Top bar */}
      <div className="h-5 bg-white/[0.02] px-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          </div>
          <div className="flex items-center gap-1 ml-1 text-[7px]">
            <span className="px-1.5 py-0.5 rounded text-cyan-300 bg-cyan-500/15 flex items-center gap-0.5 font-medium">
              <Sparkles className="w-2 h-2 text-cyan-300" />
              <span>Agents</span>
            </span>
            <span className="px-1 py-0.5 text-[#747982]">Workflows</span>
            <span className="px-1 py-0.5 text-[#747982]">Graph</span>
          </div>
        </div>
        <div className="text-[7px] text-cyan-300 font-mono flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-emerald-400" />
          <span>AI Online</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Rail */}
        <div className="w-6 bg-white/[0.015] py-1.5 flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="w-3.5 h-3.5 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
            <Bot className="w-2.5 h-2.5" />
          </div>
          <div className="w-3.5 h-3.5 rounded text-[#747982] flex items-center justify-center">
            <GitBranch className="w-2.5 h-2.5" />
          </div>
          <div className="w-3.5 h-3.5 rounded text-[#747982] flex items-center justify-center">
            <Network className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* AI Workspace Canvas */}
        <div className="flex-1 bg-white/[0.015] p-2 flex flex-col justify-between overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-2 h-2" />
              </div>
              <div>
                <div className="text-[7.5px] font-semibold text-[#ECEDEF] tracking-tight leading-none">
                  Multi-Agent Orchestrator
                </div>
                <div className="text-[6px] text-[#747982] leading-tight">Autonomous workspace intelligence</div>
              </div>
            </div>
            <div className="text-[6px] font-mono px-1 py-0.5 rounded bg-white/[0.05] text-[#A4A8AF]">
              Gemini 3.8
            </div>
          </div>

            {/* Specialist Agents Cards */}
          <div className="grid grid-cols-3 gap-1 py-0.5">
            <div className="p-1 rounded bg-white/[0.04] flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[6.5px] font-medium text-cyan-300">Lead Architect</span>
                <span className="w-1 h-1 rounded-full bg-cyan-400" />
              </div>
              <span className="text-[5.5px] text-[#747982] truncate">Planning tasks</span>
            </div>
            <div className="p-1 rounded bg-white/[0.02] flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[6.5px] font-medium text-[#ECEDEF]">Frontend Agent</span>
                <span className="w-1 h-1 rounded-full bg-emerald-400" />
              </div>
              <span className="text-[5.5px] text-[#747982] truncate">Active execution</span>
            </div>
            <div className="p-1 rounded bg-white/[0.02] flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[6.5px] font-medium text-[#ECEDEF]">QA Specialist</span>
                <span className="w-1 h-1 rounded-full bg-amber-400" />
              </div>
              <span className="text-[5.5px] text-[#747982] truncate">Verifying specs</span>
            </div>
          </div>

          {/* Status Footer */}
          <div className="h-3 -mx-2 -mb-2 px-2 bg-white/[0.02] flex items-center justify-between text-[6px] text-[#747982]">
            <div className="flex items-center gap-1">
              <span className="text-cyan-400">✦</span>
              <span>3 Agents Active</span>
              <span>•</span>
              <span>Graph Synced</span>
            </div>
            <span className="font-mono text-[5.5px]">Autonomous</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface GitStatusPreviewProps {
  showColors: boolean;
  theme: FileIconTheme;
}

const GitStatusPreview: React.FC<GitStatusPreviewProps> = ({ showColors, theme }) => {
  return (
    <div className="mt-3.5 p-3.5 rounded-xl bg-white/[0.02] flex flex-col gap-3 border-0">
      <div className="flex items-center justify-between text-[11px] font-mono text-foreground-muted pb-1">
        <span className="flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5 text-accent" />
          <span className="font-sans font-medium text-foreground">Explorer Preview</span>
          <span className="text-[10px] text-foreground-muted font-normal">• Live Status Simulation</span>
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-mono ${
            showColors
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'text-foreground-muted bg-white/[0.04]'
          }`}
        >
          {showColors ? 'Status Highlights Active' : 'Monochrome (Highlights Off)'}
        </span>
      </div>

      <div className="space-y-1 font-mono text-[11px] select-none pl-1">
        {/* Folder: src */}
        <div className="flex items-center gap-1.5 text-foreground-secondary py-0.5">
          <ChevronRight className="w-3 h-3 text-foreground-muted rotate-90 transition-transform" />
          <FileIcon name="src" isDirectory theme={theme} isExpanded />
          <span className="font-semibold text-foreground">src</span>
        </div>

        {/* Sub-folder: agents */}
        <div className="flex items-center gap-1.5 text-foreground-secondary pl-4 py-0.5">
          <ChevronRight className="w-3 h-3 text-foreground-muted rotate-90 transition-transform" />
          <FileIcon name="agents" isDirectory theme={theme} isExpanded />
          <span>agents</span>
        </div>

        {/* Modified file: Orchestrator.ts */}
        <div className="flex items-center justify-between pl-8 py-0.5 rounded hover:bg-white/[0.03]">
          <div className="flex items-center gap-1.5 min-w-0">
            <FileIcon name="Orchestrator.ts" isDirectory={false} theme={theme} />
            <span
              className={`truncate transition-colors ${
                showColors ? 'text-amber-400 font-medium' : 'text-foreground-secondary'
              }`}
            >
              Orchestrator.ts
            </span>
          </div>
          {showColors && (
            <span
              className="text-[10px] font-bold text-amber-400 font-mono px-1"
              title="Modified in working tree"
            >
              M
            </span>
          )}
        </div>

        {/* Untracked/New file: AgentWorkflow.tsx */}
        <div className="flex items-center justify-between pl-8 py-0.5 rounded hover:bg-white/[0.03]">
          <div className="flex items-center gap-1.5 min-w-0">
            <FileIcon name="AgentWorkflow.tsx" isDirectory={false} theme={theme} />
            <span
              className={`truncate transition-colors ${
                showColors ? 'text-emerald-400 font-medium' : 'text-foreground-secondary'
              }`}
            >
              AgentWorkflow.tsx
            </span>
          </div>
          {showColors && (
            <span
              className="text-[10px] font-bold text-emerald-400 font-mono px-1"
              title="Untracked / New file"
            >
              U
            </span>
          )}
        </div>

        {/* Unchanged clean file: workspace.store.ts */}
        <div className="flex items-center justify-between pl-8 py-0.5 rounded hover:bg-white/[0.03]">
          <div className="flex items-center gap-1.5 min-w-0">
            <FileIcon name="workspace.store.ts" isDirectory={false} theme={theme} />
            <span className="truncate text-foreground-secondary">workspace.store.ts</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 pt-2 text-[10px] text-foreground-muted">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>Modified (M) — Amber</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Untracked (U) — Green</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-foreground-muted" />
          <span>Clean — Default</span>
        </div>
      </div>
    </div>
  );
};

export const AppearancePage: React.FC = () => {
  const {
    theme,
    setTheme,
    fileIconTheme,
    setFileIconTheme,
    showGitFileColors,
    setShowGitFileColors,
    addLog
  } = useWorkspaceStore();

  const activeTheme = (['glass', 'solid', 'light'].includes(theme) ? theme : 'glass') as 'glass' | 'solid' | 'light';
  const activeIconTheme: FileIconTheme = fileIconTheme === 'minimal' ? 'minimal' : 'material';

  const handleThemeChange = async (newTheme: 'glass' | 'solid' | 'light') => {
    setTheme(newTheme);
    await window.api.updateSettings({ theme: newTheme });
    addLog(`Switched application theme to [${newTheme.toUpperCase()}]`, 'info');
  };

  const handleIconThemeChange = async (newIconTheme: FileIconTheme) => {
    setFileIconTheme(newIconTheme);
    await window.api.updateSettings({ fileIconTheme: newIconTheme });
    addLog(`Changed file icon theme to [${newIconTheme.toUpperCase()}]`, 'info');
  };

  const handleToggleGitColors = async (checked: boolean) => {
    setShowGitFileColors(checked);
    await window.api.updateSettings({ showGitFileColors: checked });
    addLog(`Git file status colors ${checked ? 'enabled' : 'disabled'}.`, 'info');
  };

  const iconOptions: Array<{
    id: FileIconTheme;
    title: string;
    description: string;
  }> = [
    {
      id: 'material',
      title: 'Material Icon Theme',
      description: 'Material Design icon set with distinctive shapes and vivid tones.'
    },
    {
      id: 'minimal',
      title: 'Minimal Monochrome',
      description: 'Clean low-contrast monochrome icons for distraction-free navigation.'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">
          Appearance
        </h2>
      </div>

      {/* Section 1: Application Theme */}
      <SettingSection title="Application Theme">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
          {THEME_OPTIONS.map((opt) => {
            const isSelected = activeTheme === opt.id;
            const Icon = opt.icon;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleThemeChange(opt.id)}
                className={`p-3.5 rounded-xl text-left transition-all duration-150 cursor-pointer flex flex-col justify-between border-0 ${
                  isSelected
                    ? 'bg-white/[0.08] shadow-sm'
                    : 'bg-white/[0.02] hover:bg-white/[0.05]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-xs text-foreground flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-foreground" />
                      <span>{opt.title}</span>
                    </span>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-foreground-muted leading-relaxed line-clamp-2">
                    {opt.description}
                  </p>
                </div>

                {/* Miniature Application AI Workspace Preview */}
                <ThemeMiniPreview variant={opt.id} />
              </button>
            );
          })}
        </div>
      </SettingSection>

      {/* Section 2: File & Folder Icons */}
      <SettingSection title="File & Folder Icons">
        <div className="space-y-1.5 pt-1">
          {iconOptions.map((opt) => {
            const isSelected = activeIconTheme === opt.id;

            return (
              <div
                key={opt.id}
                onClick={() => handleIconThemeChange(opt.id)}
                className={`flex items-center justify-between gap-4 py-2.5 px-3 rounded-lg transition-all cursor-pointer border-0 ${
                  isSelected
                    ? 'bg-white/[0.08]'
                    : 'hover:bg-white/[0.03] bg-transparent'
                }`}
              >
                {/* Left: Radio & Metadata */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-white/[0.1]'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-accent-foreground" />}
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground flex items-center gap-2">
                      <span>{opt.title}</span>
                    </div>
                    <p className="text-[11px] text-foreground-muted truncate mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                </div>

                {/* Right: Inline Micro Icon Preview (No white borders) */}
                <div className="flex items-center gap-3 px-2.5 py-1 rounded-md bg-white/[0.04] font-mono text-[11px] flex-shrink-0 border-0">
                  <div className="flex items-center gap-1.5">
                    <FileIcon name="src" isDirectory theme={opt.id} isExpanded />
                    <span className="text-foreground">src</span>
                  </div>
                  <div className="w-px h-3 bg-white/10" />
                  <div className="flex items-center gap-1.5">
                    <FileIcon name="App.tsx" isDirectory={false} theme={opt.id} />
                    <span className="text-foreground-secondary">App.tsx</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SettingSection>

      {/* Section 3: Git File Indicators */}
      <SettingSection title="Git File Indicators">
        <SettingRow
          title="Color-Coded File Status"
          description="Highlight modified files in amber and untracked files in green in the explorer."
        >
          <SettingToggle
            checked={showGitFileColors}
            onChange={handleToggleGitColors}
            ariaLabel="Enable Git file status colors"
          />
        </SettingRow>

        {/* Live Visual Preview of Color-Coded Status (No white borders) */}
        <GitStatusPreview showColors={showGitFileColors} theme={activeIconTheme} />
      </SettingSection>
    </div>
  );
};
