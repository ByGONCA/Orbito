import React from 'react';
import { Database, Shield, Info, CheckCircle2 } from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';

export const RightPanel: React.FC = () => {
  const { uiMode, project } = useWorkspaceStore();

  return (
    <aside className="h-full flex flex-col bg-card/40 border-l border-border select-none overflow-auto text-xs">
      <div className="h-8 border-b border-border flex items-center px-3 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
        {uiMode === 'simple' ? 'Context & Safety' : 'Inspector & Memory'}
      </div>

      <div className="p-3 space-y-4">
        {uiMode === 'simple' ? (
          // Simple Mode Panel
          <>
            <div className="bg-card border border-border rounded-lg p-3 space-y-2">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                <span>Safety Guarantees</span>
              </span>
              <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <span>Files remain on local disk only</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <span>No background cloud uploads</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <span>Changes require user approval</span>
                </li>
              </ul>
            </div>

            <div className="bg-secondary/40 border border-border rounded-lg p-3 space-y-1.5">
              <span className="font-semibold text-foreground flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>Simple Mode Tip</span>
              </span>
              <p className="text-[11px] text-muted-foreground leading-normal">
                Click any file on the left explorer to view its contents with clean syntax line numbers.
              </p>
            </div>
          </>
        ) : (
          // Advanced Mode Panel
          <>
            <div className="bg-card border border-border rounded-lg p-3 space-y-2">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-primary" />
                <span>5-Tier Memory Architecture</span>
              </span>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between py-0.5 border-b border-border/50">
                  <span className="text-muted-foreground">Global Memory</span>
                  <span className="font-mono text-foreground">Active</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-border/50">
                  <span className="text-muted-foreground">Workspace Memory</span>
                  <span className="font-mono text-foreground">Active</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-border/50">
                  <span className="text-muted-foreground">Project Memory</span>
                  <span className="font-mono text-foreground">
                    {project ? 'Loaded' : 'Idle'}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-border/50">
                  <span className="text-muted-foreground">Task Memory</span>
                  <span className="font-mono text-foreground">0 active</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Session Memory</span>
                  <span className="font-mono text-foreground">Transient</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-3 space-y-2">
              <span className="font-semibold text-foreground">Security Tier</span>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Active Permission:</span>
                <span className="font-mono bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">
                  {project?.permissionLevel || 'Standard'}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
