import React from 'react';
import {
  Sparkles,
  Moon,
  Sun,
  Check,
  FolderOpen
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
    description: 'Clean off-white surfaces with dark charcoal typography and light editor syntax.',
    icon: Sun
  }
];

const ThemeMiniPreview: React.FC<{ variant: 'glass' | 'solid' | 'light' }> = ({ variant }) => {
  if (variant === 'light') {
    return (
      <div className="w-full h-24 rounded-md border border-[#E1E4E8] bg-[#F8F9FA] overflow-hidden flex flex-col select-none text-[8px] font-sans shadow-xs mt-3">
        {/* Top bar */}
        <div className="h-4.5 bg-white border-b border-[#E1E4E8] px-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="flex gap-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E1E4E8]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#E1E4E8]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#E1E4E8]" />
            </div>
            <div className="h-3 px-1.5 ml-1 bg-[#F1F3F5] rounded text-[7px] text-[#1E2024] flex items-center gap-1 border-t-2 border-[#2563EB]">
              <span>App.tsx</span>
            </div>
          </div>
          <div className="text-[7px] text-[#868E96] font-mono">Orbito</div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-5 bg-[#F1F3F5] border-r border-[#E1E4E8] py-1 flex flex-col items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-[#2563EB]/15 text-[#2563EB] flex items-center justify-center text-[6px]">⌘</div>
            <div className="w-2.5 h-2.5 rounded bg-transparent text-[#868E96] flex items-center justify-center text-[6px]">⌥</div>
            <div className="w-2.5 h-2.5 rounded bg-transparent text-[#868E96] flex items-center justify-center text-[6px]">⚙</div>
          </div>

          {/* Explorer Tree */}
          <div className="w-14 bg-[#F5F7F9] border-r border-[#E1E4E8] p-1 flex flex-col gap-0.5 font-mono text-[7px] text-[#585D65]">
            <div className="flex items-center gap-0.5 text-[#1E2024] font-semibold">
              <span>▾ src</span>
            </div>
            <div className="pl-2 text-[#2563EB]">App.tsx</div>
            <div className="pl-2 text-[#868E96]">index.css</div>
          </div>

          {/* Editor Workspace */}
          <div className="flex-1 bg-white p-1.5 font-mono text-[7px] flex flex-col justify-between">
            <div className="space-y-0.5 leading-tight">
              <div className="flex items-center gap-1">
                <span className="text-[#868E96]">1</span>
                <span className="text-[#0000FF]">import</span>
                <span className="text-[#1E2024]">React</span>
                <span className="text-[#0000FF]">from</span>
                <span className="text-[#A31515]">'react'</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[#868E96]">2</span>
                <span className="text-[#0000FF]">export</span>
                <span className="text-[#0000FF]">const</span>
                <span className="text-[#795E26]">App</span>
                <span className="text-[#1E2024]">= ()</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[#868E96]">3</span>
                <span className="text-[#AF00DB]">return</span>
                <span className="text-[#800000]">&lt;Orbito /&gt;</span>
              </div>
            </div>

            {/* Bottom Status */}
            <div className="h-3 -mx-1.5 -mb-1.5 px-1.5 bg-[#F1F3F5] border-t border-[#E1E4E8] flex items-center justify-between text-[6px] text-[#585D65]">
              <span>main • ready</span>
              <span>UTF-8</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'solid') {
    return (
      <div className="w-full h-24 rounded-md border border-[#2A2D33] bg-[#101113] overflow-hidden flex flex-col select-none text-[8px] font-sans shadow-xs mt-3">
        {/* Top bar */}
        <div className="h-4.5 bg-[#121418] border-b border-[#2A2D33] px-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="flex gap-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#2A2D33]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#2A2D33]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#2A2D33]" />
            </div>
            <div className="h-3 px-1.5 ml-1 bg-[#17191C] rounded text-[7px] text-[#ECEDEF] flex items-center gap-1 border-t-2 border-[#569CD6]">
              <span>App.tsx</span>
            </div>
          </div>
          <div className="text-[7px] text-[#747982] font-mono">Orbito</div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-5 bg-[#141619] border-r border-[#2A2D33] py-1 flex flex-col items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-white/10 text-white flex items-center justify-center text-[6px]">⌘</div>
            <div className="w-2.5 h-2.5 rounded bg-transparent text-[#747982] flex items-center justify-center text-[6px]">⌥</div>
            <div className="w-2.5 h-2.5 rounded bg-transparent text-[#747982] flex items-center justify-center text-[6px]">⚙</div>
          </div>

          {/* Explorer Tree */}
          <div className="w-14 bg-[#141619] border-r border-[#2A2D33] p-1 flex flex-col gap-0.5 font-mono text-[7px] text-[#A4A8AF]">
            <div className="flex items-center gap-0.5 text-[#ECEDEF] font-semibold">
              <span>▾ src</span>
            </div>
            <div className="pl-2 text-[#569CD6]">App.tsx</div>
            <div className="pl-2 text-[#747982]">index.css</div>
          </div>

          {/* Editor Workspace */}
          <div className="flex-1 bg-[#17191C] p-1.5 font-mono text-[7px] flex flex-col justify-between">
            <div className="space-y-0.5 leading-tight">
              <div className="flex items-center gap-1">
                <span className="text-[#747982]">1</span>
                <span className="text-[#569CD6]">import</span>
                <span className="text-[#ECEDEF]">React</span>
                <span className="text-[#569CD6]">from</span>
                <span className="text-[#CE9178]">'react'</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[#747982]">2</span>
                <span className="text-[#569CD6]">export</span>
                <span className="text-[#569CD6]">const</span>
                <span className="text-[#DCDCAA]">App</span>
                <span className="text-[#ECEDEF]">= ()</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[#747982]">3</span>
                <span className="text-[#C586C0]">return</span>
                <span className="text-[#4EC9B0]">&lt;Orbito /&gt;</span>
              </div>
            </div>

            {/* Bottom Status */}
            <div className="h-3 -mx-1.5 -mb-1.5 px-1.5 bg-[#121418] border-t border-[#2A2D33] flex items-center justify-between text-[6px] text-[#A4A8AF]">
              <span>main • ready</span>
              <span>UTF-8</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Glassmorphism (variant === 'glass')
  return (
    <div className="w-full h-24 rounded-md border border-white/[0.08] bg-[#101113]/70 backdrop-blur-sm overflow-hidden flex flex-col select-none text-[8px] font-sans shadow-md relative mt-3">
      <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />
      {/* Top bar */}
      <div className="h-4.5 bg-white/[0.03] border-b border-white/[0.06] px-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="flex gap-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          </div>
          <div className="h-3 px-1.5 ml-1 bg-white/[0.08] rounded text-[7px] text-[#ECEDEF] flex items-center gap-1 border-t border-white/20">
            <span>App.tsx</span>
          </div>
        </div>
        <div className="text-[7px] text-[#747982] font-mono">Orbito</div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-5 bg-white/[0.02] border-r border-white/[0.05] py-1 flex flex-col items-center gap-1">
          <div className="w-2.5 h-2.5 rounded bg-white/[0.12] text-white flex items-center justify-center text-[6px]">⌘</div>
          <div className="w-2.5 h-2.5 rounded bg-transparent text-[#747982] flex items-center justify-center text-[6px]">⌥</div>
          <div className="w-2.5 h-2.5 rounded bg-transparent text-[#747982] flex items-center justify-center text-[6px]">⚙</div>
        </div>

        {/* Explorer Tree */}
        <div className="w-14 bg-white/[0.02] border-r border-white/[0.05] p-1 flex flex-col gap-0.5 font-mono text-[7px] text-[#A4A8AF]">
          <div className="flex items-center gap-0.5 text-[#ECEDEF] font-semibold">
            <span>▾ src</span>
          </div>
          <div className="pl-2 text-[#569CD6]">App.tsx</div>
          <div className="pl-2 text-[#747982]">index.css</div>
        </div>

        {/* Editor Workspace */}
        <div className="flex-1 bg-white/[0.015] p-1.5 font-mono text-[7px] flex flex-col justify-between">
          <div className="space-y-0.5 leading-tight">
            <div className="flex items-center gap-1">
              <span className="text-[#747982]">1</span>
              <span className="text-[#569CD6]">import</span>
              <span className="text-[#ECEDEF]">React</span>
              <span className="text-[#569CD6]">from</span>
              <span className="text-[#CE9178]">'react'</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[#747982]">2</span>
              <span className="text-[#569CD6]">export</span>
              <span className="text-[#569CD6]">const</span>
              <span className="text-[#DCDCAA]">App</span>
              <span className="text-[#ECEDEF]">= ()</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[#747982]">3</span>
              <span className="text-[#C586C0]">return</span>
              <span className="text-[#4EC9B0]">&lt;Orbito /&gt;</span>
            </div>
          </div>

          {/* Bottom Status */}
          <div className="h-3 -mx-1.5 -mb-1.5 px-1.5 bg-white/[0.03] border-t border-white/[0.05] flex items-center justify-between text-[6px] text-[#A4A8AF]">
            <span>main • ready</span>
            <span>UTF-8</span>
          </div>
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
      id: 'vscode',
      title: 'VSCode Icons',
      description: 'Official Visual Studio Code vector iconography with language-specific colors.'
    },
    {
      id: 'material',
      title: 'Material Icon Theme',
      description: 'Material Design icon set with distinctive shapes and vivid tones.'
    },
    {
      id: 'minimal',
      title: 'Minimal Monochrome',
      description: 'Clean low-contrast monochrome icons for distraction-free coding.'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">
          Appearance & Styling
        </h2>
        <p className="text-xs text-foreground-muted mt-1">
          Window material styling, file explorer icon themes, and Git status indicators.
        </p>
      </div>

      {/* Section 1: Application Theme (Primary & Prominent) */}
      <SettingSection
        title="Application Theme"
        description="Choose the visual atmosphere and surface physics for all application windows."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
          {THEME_OPTIONS.map((opt) => {
            const isSelected = activeTheme === opt.id;
            const Icon = opt.icon;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleThemeChange(opt.id)}
                className={`p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-accent/40 bg-surface-elevated shadow-sm ring-1 ring-accent/30'
                    : 'border-border/70 hover:border-border hover:bg-surface-hover/40 bg-surface/30'
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

                {/* Faithful Miniature Window Preview */}
                <ThemeMiniPreview variant={opt.id} />
              </button>
            );
          })}
        </div>
      </SettingSection>

      {/* Section 2: File & Folder Icons (Secondary & Compact) */}
      <SettingSection
        title="File & Folder Icons"
        description="Select the icon set used in the codebase tree explorer."
      >
        <div className="space-y-1.5 pt-1">
          {iconOptions.map((opt) => {
            const isSelected = fileIconTheme === opt.id;

            return (
              <div
                key={opt.id}
                onClick={() => handleIconThemeChange(opt.id)}
                className={`flex items-center justify-between gap-4 py-2.5 px-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-accent/30 bg-surface-elevated/70'
                    : 'border-transparent hover:border-border/40 hover:bg-surface-hover/40 bg-transparent'
                }`}
              >
                {/* Left: Radio & Metadata */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'border-accent bg-accent'
                        : 'border-border-strong bg-transparent'
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

                {/* Right: Inline Micro Icon Preview */}
                <div className="flex items-center gap-3 px-2 py-1 rounded bg-surface border border-border/40 font-mono text-[11px] flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <FileIcon name="src" isDirectory theme={opt.id} isExpanded />
                    <span className="text-foreground">src</span>
                  </div>
                  <div className="w-px h-3 bg-border/60" />
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

      {/* Section 3: Git File Indicators (Tertiary & Anti-Boxy) */}
      <SettingSection
        title="Git File Indicators"
        description="Display color-coded status badges and indicators in the file tree."
      >
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
      </SettingSection>
    </div>
  );
};
