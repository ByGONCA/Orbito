import React from 'react';
import {
  FolderOpen,
  GitBranch,
  Settings,
  Sparkles,
  Terminal,
  Activity,
  Layers,
  Code2,
  Cpu,
  BrainCircuit,
  Bot
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';

export const Header: React.FC = () => {
  const {
    project,
    uiMode,
    setUiMode,
    setProject,
    setFiles,
    toggleSettings,
    addLog,
    activeCenterTab,
    setActiveCenterTab
  } = useWorkspaceStore();

  const handleOpenFolder = async () => {
    try {
      addLog('Opening native directory picker dialog...', 'info');
      const selected = await window.api.openDirectoryDialog();
      if (selected) {
        setProject(selected);
        addLog(`Opened workspace: ${selected.name} (${selected.path})`, 'info');
        const files = await window.api.listFiles({ projectPath: selected.path });
        setFiles(files);
        addLog(`Indexed ${files.length} top-level nodes.`, 'info');
      }
    } catch (err: any) {
      addLog(`Failed to open project: ${err.message}`, 'error');
    }
  };

  const handleToggleMode = async () => {
    const nextMode = uiMode === 'simple' ? 'advanced' : 'simple';
    setUiMode(nextMode);
    addLog(`Switched interface mode to: ${nextMode.toUpperCase()}`, 'info');
    await window.api.updateSettings({ uiMode: nextMode });
  };

  return (
    <header className="h-12 border-b border-border bg-card flex items-center justify-between px-3 select-none">
      {/* Brand & Active Project */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-semibold text-sm tracking-tight text-primary">
          <div className="w-6 h-6 rounded bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Layers className="w-3.5 h-3.5 text-primary" />
          </div>
          <span>AI Workspace</span>
        </div>

        <div className="h-4 w-px bg-border" />

        {project ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded border border-border">
            <FolderOpen className="w-3.5 h-3.5 text-foreground" />
            <span className="font-medium text-foreground max-w-[160px] truncate">{project.name}</span>
            {project.isGitRepo && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground border-l border-border pl-2">
                <GitBranch className="w-3 h-3 text-emerald-500" />
                <span>{project.activeBranch || 'main'}</span>
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">No project opened</span>
        )}
      </div>

      {/* Center View Switcher */}
      <div className="flex items-center gap-1 bg-secondary/80 p-0.5 rounded-lg border border-border">
        <button
          onClick={() => setActiveCenterTab('code')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            activeCenterTab === 'code'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Editor</span>
        </button>

        <button
          onClick={() => setActiveCenterTab('providers')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            activeCenterTab === 'providers'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-primary" />
          <span>AI Providers</span>
        </button>

        <button
          onClick={() => setActiveCenterTab('console')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            activeCenterTab === 'console'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>CLI Console</span>
        </button>

        <button
          onClick={() => setActiveCenterTab('context')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            activeCenterTab === 'context'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BrainCircuit className="w-3.5 h-3.5 text-primary" />
          <span>Context</span>
        </button>

        <button
          onClick={() => setActiveCenterTab('skills')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            activeCenterTab === 'skills'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Skills</span>
        </button>

        <button
          onClick={() => setActiveCenterTab('agents')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            activeCenterTab === 'agents'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-emerald-400" />
          <span>Agents</span>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleOpenFolder}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded border border-border transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Open Folder</span>
        </button>

        {/* Mode Toggle Button */}
        <button
          onClick={handleToggleMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
            uiMode === 'simple'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
              : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
          }`}
          title="Toggle between Simple Mode (guided, clean) and Advanced Mode (power user, terminal)"
        >
          {uiMode === 'simple' ? (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simple Mode</span>
            </>
          ) : (
            <>
              <Terminal className="w-3.5 h-3.5" />
              <span>Advanced Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => toggleSettings()}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
          title="Settings & Keyring"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
