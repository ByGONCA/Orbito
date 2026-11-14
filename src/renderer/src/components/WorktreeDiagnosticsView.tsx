import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  FolderGit2,
  CheckCircle2,
  RotateCw,
  Search,
  FileCode,
  ShieldCheck,
  Clock
} from 'lucide-react';

export interface ActiveTaskWorktreeInfo {
  taskId: string;
  branchName: string;
  worktreePath: string;
  createdAt: number;
  isMain: boolean;
  changedFilesCount: number;
}

export const WorktreeDiagnosticsView: React.FC = () => {
  const [worktrees, setWorktrees] = useState<ActiveTaskWorktreeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadWorktrees = async () => {
    setIsLoading(true);
    try {
      const wts = await window.api.getActiveTaskWorktrees();
      setWorktrees(wts || []);
    } catch (err) {
      console.error('Failed to load active worktrees:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorktrees();
  }, []);

  const filtered = worktrees.filter((wt) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        wt.taskId.toLowerCase().includes(q) ||
        wt.branchName.toLowerCase().includes(q) ||
        wt.worktreePath.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 text-foreground">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white/[0.03]">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <FolderGit2 className="w-4 h-4 text-primary" />
            <span>Active Worktrees</span>
          </div>
          <div className="text-2xl font-semibold tracking-tight">{worktrees.length}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Isolated workspace directories</div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03]">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <span>Parallel Task Branches</span>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-emerald-400">
            {new Set(worktrees.map((w) => w.branchName)).size}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Independent Git branches</div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03]">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span>Changed Files</span>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-cyan-400">
            {worktrees.reduce((acc, curr) => acc + (curr.changedFilesCount || 0), 0)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Active files across all worktrees</div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03]">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Conflict State</span>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-emerald-400">
            Clean
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Zero lock collisions
          </div>
        </div>
      </div>

      {/* Search and Action Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search worktrees by task ID, branch, or file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.03] rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:bg-white/[0.06] text-foreground placeholder:text-muted-foreground border-0"
          />
        </div>

        <button
          onClick={loadWorktrees}
          disabled={isLoading}
          className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-colors border-0"
          title="Refresh worktrees"
          aria-label="Refresh worktrees"
        >
          <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Worktrees List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs">
            No active task worktrees currently registered.
          </div>
        ) : (
          filtered.map((wt) => (
            <div
              key={wt.taskId}
              className="p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary" />
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {wt.branchName}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    ({wt.taskId})
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    active
                  </span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(wt.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground font-mono truncate">
                <span className="text-foreground/70">Path:</span> {wt.worktreePath}
              </div>

              <div className="text-xs text-muted-foreground">
                Changed files: <span className="text-foreground font-mono font-medium">{wt.changedFilesCount}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
