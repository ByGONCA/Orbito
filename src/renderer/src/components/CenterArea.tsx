import React from 'react';
import {
  X,
  FileCode,
  Sparkles,
  Terminal,
  ShieldCheck,
  Cpu,
  FolderOpen,
  ArrowRight
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { ProvidersPanel } from './ProvidersPanel';
import { CLIConsole } from './CLIConsole';

export const CenterArea: React.FC = () => {
  const {
    activeFilePath,
    activeFileContent,
    closeActiveFile,
    uiMode,
    project,
    addLog,
    setProject,
    setFiles,
    activeCenterTab,
    setActiveCenterTab
  } = useWorkspaceStore();

  const handleOpenFolder = async () => {
    try {
      const selected = await window.api.openDirectoryDialog();
      if (selected) {
        setProject(selected);
        const files = await window.api.listFiles({ projectPath: selected.path });
        setFiles(files);
      }
    } catch (err: any) {
      addLog(`Error: ${err.message}`, 'error');
    }
  };

  if (activeCenterTab === 'providers') {
    return <ProvidersPanel />;
  }

  if (activeCenterTab === 'console') {
    return <CLIConsole />;
  }

  if (activeFilePath && activeFileContent !== null) {
    const lines = activeFileContent.split('\n');
    const fileName = activeFilePath.split(/[/\\]/).pop();

    return (
      <div className="flex flex-col h-full bg-background overflow-hidden">
        {/* Tab Header */}
        <div className="h-8 border-b border-border bg-card/40 flex items-center px-2 select-none">
          <div className="flex items-center gap-2 bg-background border border-border px-3 py-1 rounded text-xs font-medium text-foreground max-w-sm">
            <FileCode className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="truncate">{fileName}</span>
            <button
              onClick={closeActiveFile}
              className="ml-1 p-0.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <span className="ml-auto text-[11px] text-muted-foreground pr-2">
            {lines.length} lines
          </span>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-foreground select-text">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-secondary/30">
                  <td className="w-10 pr-4 text-right text-muted-foreground/50 select-none text-[11px]">
                    {idx + 1}
                  </td>
                  <td className="whitespace-pre font-mono">{line || ' '}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Welcome / Dashboard View when no file is active
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-background select-none overflow-auto">
      {uiMode === 'simple' ? (
        // Simple Mode Greeting
        <div className="max-w-md w-full space-y-6">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Welcome to AI Workspace
            </h2>
            <p className="text-xs text-muted-foreground">
              A unified local-first environment for intelligent AI collaboration.
            </p>
          </div>

          {!project ? (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4 text-left shadow-sm">
              <span className="text-xs font-semibold text-foreground block">
                Get started with your code
              </span>
              <p className="text-xs text-muted-foreground">
                Select any folder on your machine. Your files stay strictly on your local disk.
              </p>
              <button
                onClick={handleOpenFolder}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Select Project Folder</span>
              </button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Active Workspace</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Ready
                </span>
              </div>
              <p className="text-xs font-medium text-foreground">{project.name}</p>
              <p className="text-[11px] text-muted-foreground break-all">{project.path}</p>
              <div className="pt-2">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Sandbox Security Kernel Active (Path Traversal Protected)</span>
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Advanced Mode Dashboard
        <div className="max-w-xl w-full space-y-6 text-left">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">Advanced Developer Console</h2>
            </div>
            <span className="text-[11px] font-mono bg-secondary px-2 py-0.5 rounded border border-border">
              Phase 1: Foundation
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-lg p-3 space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span>Persistence Architecture</span>
              </span>
              <p className="text-xs font-medium text-foreground">Dual SQLite (WAL Mode)</p>
              <p className="text-[10px] text-muted-foreground">app.sqlite + index.sqlite isolated</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-3 space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Security Kernel</span>
              </span>
              <p className="text-xs font-medium text-foreground">Canonical Path Guard</p>
              <p className="text-[10px] text-muted-foreground">Symlink & traversal defense active</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4 space-y-2">
            <span className="text-xs font-semibold text-foreground block">System Quick Actions</span>
            <div className="flex gap-2">
              <button
                onClick={handleOpenFolder}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded border border-border text-foreground transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Open Project</span>
              </button>

              <button
                onClick={() => setActiveCenterTab('providers')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded border border-border text-foreground transition-colors"
              >
                <Cpu className="w-3.5 h-3.5 text-primary" />
                <span>AI Providers</span>
              </button>

              <button
                onClick={() => setActiveCenterTab('console')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground font-medium rounded text-xs hover:bg-primary/90 transition-colors shadow-xs"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Open CLI Console</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
