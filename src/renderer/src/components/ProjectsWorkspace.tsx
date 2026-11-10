import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderOpen,
  FolderPlus,
  GitBranch,
  Bot,
  Workflow,
  Terminal,
  GitFork,
  ArrowRight,
  FileCode,
  Network,
  Sparkles,
  Layers,
  Cpu,
  Clock,
  Folders,
  Palette,
  Edit3,
  Star,
  Search,
  Settings,
  AlertTriangle,
  Trash2,
  ExternalLink
} from 'lucide-react';
import type { ProjectDescriptor } from '../../../shared/types';
import { useWorkspaceStore } from '../stores/workspace.store';
import Button from './ui/Button';
import Badge from './ui/Badge';
import orbitLogo from '../assets/Orbit.png';
import { ProjectCustomizeModal, ProjectIconRenderer } from './ProjectCustomizeModal';
import { NewProjectModal } from './NewProjectModal';
import { ProjectSettingsModal } from './ProjectSettingsModal';

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const ProjectsWorkspace: React.FC = () => {
  const {
    project,
    setProject,
    recentProjects,
    setRecentProjects,
    setFiles,
    setActiveSection,
    openTerminalTab,
    openGraphTab,
    gitStatus,
    loadGitStatus,
    activeOrchestration,
    pendingApprovals,
    setRightPanelTab,
    toggleProjectFavorite,
    removeStaleProject,
    addLog
  } = useWorkspaceStore();

  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [missingPaths, setMissingPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    window.api.getRecentProjects().then((recents) => {
      setRecentProjects(recents);
      // Verify paths on disk
      if (Array.isArray(recents)) {
        recents.forEach(async (p) => {
          try {
            const exists = await window.api.verifyProjectPath(p.path);
            if (!exists) {
              setMissingPaths((prev) => new Set(prev).add(p.path));
            }
          } catch {}
        });
      }
    }).catch(() => {});
  }, [setRecentProjects]);

  useEffect(() => {
    if (project?.path) {
      loadGitStatus(project.path);
    }
  }, [project, loadGitStatus]);

  const handleOpenFolder = async () => {
    try {
      const selected = await window.api.openDirectoryDialog();
      if (selected) {
        setProject(selected);
        const fileList = await window.api.listFiles({ projectPath: selected.path });
        setFiles(fileList);
        const recents = await window.api.getRecentProjects();
        setRecentProjects(recents);
        loadGitStatus(selected.path);
        addLog(`Opened workspace: ${selected.name}`, 'info');
      }
    } catch (err: any) {
      addLog(`Failed to open folder: ${err.message}`, 'error');
    }
  };

  const handleSelectRecent = async (p: ProjectDescriptor) => {
    try {
      const exists = await window.api.verifyProjectPath(p.path);
      if (!exists) {
        setMissingPaths((prev) => new Set(prev).add(p.path));
        addLog(`Project directory no longer exists on disk: ${p.path}`, 'warn');
        return;
      }

      setProject(p);
      const fileList = await window.api.listFiles({ projectPath: p.path });
      setFiles(fileList);
      loadGitStatus(p.path);
      addLog(`Switched project: ${p.name}`, 'info');
    } catch (err: any) {
      addLog(`Failed to switch: ${err.message}`, 'error');
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, p: ProjectDescriptor) => {
    e.stopPropagation();
    await toggleProjectFavorite(p.id);
  };

  const handleRemoveStale = async (e: React.MouseEvent, p: ProjectDescriptor) => {
    e.stopPropagation();
    await removeStaleProject(p.id);
    setMissingPaths((prev) => {
      const next = new Set(prev);
      next.delete(p.path);
      return next;
    });
  };

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return recentProjects;
    const q = searchQuery.toLowerCase();
    return recentProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.customName && p.customName.toLowerCase().includes(q)) ||
        (p.tag && p.tag.toLowerCase().includes(q)) ||
        p.path.toLowerCase().includes(q)
    );
  }, [recentProjects, searchQuery]);

  const favoriteProjects = useMemo(() => {
    return filteredProjects.filter((p) => p.isFavorite);
  }, [filteredProjects]);

  const standardProjects = useMemo(() => {
    return filteredProjects.filter((p) => !p.isFavorite);
  }, [filteredProjects]);

  // =========================================================================
  // STATE A: WELCOME / PROJECT LAUNCHER (Compact, Refined Neutral Empty State)
  // =========================================================================
  if (!project) {
    return (
      <div className="h-full overflow-y-auto bg-transparent p-6 flex flex-col justify-between select-none font-sans relative">
        <div className="max-w-lg w-full mx-auto my-auto py-6 space-y-4">
          {/* 1. Minimal Center Card */}
          <div className="p-6 text-center space-y-4 border border-white/[0.08] rounded-2xl bg-white/[0.02]">
            {/* Orbito Logo */}
            <div className="w-12 h-12 mx-auto flex items-center justify-center">
              <img
                src={orbitLogo}
                alt="Orbito Logo"
                className="w-10 h-10 object-contain drop-shadow select-none pointer-events-none"
              />
            </div>

            {/* Title & Description */}
            <div className="space-y-1">
              <h1 className="text-base font-semibold tracking-tight text-[#ECEDEF]">
                Orbito
              </h1>
              <p className="text-xs text-[#A4A8AF] max-w-sm mx-auto leading-relaxed">
                Create or open a workspace project to begin orchestrating multi-agent tasks, Git worktrees, and context intelligence.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-2.5 pt-1">
              <button
                onClick={() => setIsNewProjectModalOpen(true)}
                className="py-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </button>
              <button
                onClick={handleOpenFolder}
                className="py-2 px-4 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-all border border-white/10"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#A4A8AF]" />
                <span>Open Folder</span>
                <kbd className="ml-1 px-1.5 py-0.5 rounded bg-black/30 text-[10px] font-mono text-white/70">Ctrl+O</kbd>
              </button>
            </div>
          </div>

          {/* Search Filter if there are projects */}
          {recentProjects.length > 2 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#747982] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects by name, tag, or path..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] focus:border-white/20 focus:outline-none text-xs text-white placeholder-[#747982] font-mono"
              />
            </div>
          )}

          {/* Favorites List */}
          {favoriteProjects.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-2 text-[10px] font-mono text-amber-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>Favorite Projects</span>
                </span>
                <span>{favoriteProjects.length}</span>
              </div>
              <div className="divide-y divide-white/[0.04] overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
                {favoriteProjects.map((p) => {
                  const isMissing = missingPaths.has(p.path);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectRecent(p)}
                      className="px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.04] cursor-pointer group transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-3 flex items-center gap-2.5">
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: p.customColor ? `${p.customColor}22` : 'rgba(255, 255, 255, 0.05)'
                          }}
                        >
                          <ProjectIconRenderer
                            iconId={p.customIcon}
                            color={p.customColor || '#ECEDEF'}
                            className="w-3.5 h-3.5"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-[#ECEDEF] group-hover:text-white truncate">
                              {p.customName || p.name}
                            </span>
                            {p.tag && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-[#A4A8AF]">
                                {p.tag}
                              </span>
                            )}
                            {isMissing && (
                              <span className="text-[10px] text-rose-400 flex items-center gap-1 font-mono">
                                <AlertTriangle className="w-3 h-3" /> Missing
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-[#747982] truncate" title={p.path}>
                            {p.path}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleToggleFavorite(e, p)}
                          className="p-1 rounded hover:bg-white/[0.1] text-amber-400"
                          title="Toggle favorite"
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                        </button>
                        {isMissing ? (
                          <button
                            onClick={(e) => handleRemoveStale(e, p)}
                            className="p-1 rounded hover:bg-rose-500/20 text-rose-400"
                            title="Remove missing entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5 text-[#747982] group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Standard Recent Projects List */}
          {standardProjects.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-2 text-[10px] font-mono text-[#747982] uppercase tracking-wider">
                <span>Recent Workspaces</span>
                <span>{standardProjects.length}</span>
              </div>
              <div className="divide-y divide-white/[0.04] overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
                {standardProjects.slice(0, 6).map((p) => {
                  const isMissing = missingPaths.has(p.path);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectRecent(p)}
                      className="px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.04] cursor-pointer group transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-3 flex items-center gap-2.5">
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: p.customColor ? `${p.customColor}22` : 'rgba(255, 255, 255, 0.05)'
                          }}
                        >
                          <ProjectIconRenderer
                            iconId={p.customIcon}
                            color={p.customColor || '#ECEDEF'}
                            className="w-3.5 h-3.5"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-[#ECEDEF] group-hover:text-white truncate">
                              {p.customName || p.name}
                            </span>
                            {p.tag && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-[#A4A8AF]">
                                {p.tag}
                              </span>
                            )}
                            {isMissing && (
                              <span className="text-[10px] text-rose-400 flex items-center gap-1 font-mono">
                                <AlertTriangle className="w-3 h-3" /> Missing
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-[#747982] truncate" title={p.path}>
                            {p.path}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleToggleFavorite(e, p)}
                          className="p-1 rounded hover:bg-white/[0.1] text-[#747982] hover:text-amber-400"
                          title="Add to favorites"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        {isMissing ? (
                          <button
                            onClick={(e) => handleRemoveStale(e, p)}
                            className="p-1 rounded hover:bg-rose-500/20 text-rose-400"
                            title="Remove missing entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5 text-[#747982] group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 3. Minimalist Keyboard Shortcuts Footer */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-[#747982] font-mono py-2 border-t border-white/[0.04]">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/[0.08] text-[#A4A8AF]">Ctrl+O</kbd>
            <span>Open</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/[0.08] text-[#A4A8AF]">Ctrl+K</kbd>
            <span>Search</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/[0.08] text-[#A4A8AF]">Ctrl+`</kbd>
            <span>Terminal</span>
          </span>
        </div>

        <NewProjectModal
          isOpen={isNewProjectModalOpen}
          onClose={() => setIsNewProjectModalOpen(false)}
        />
      </div>
    );
  }

  // =========================================================================
  // STATE B: ACTIVE PROJECT DASHBOARD (Neutral Refined Frosted Glass UI)
  // =========================================================================
  const branch = gitStatus?.branch || project.activeBranch || 'main';
  const isClean = gitStatus?.isClean ?? true;
  const changedFiles = gitStatus?.changedFiles || [];
  const worktrees = gitStatus?.worktrees || [{ path: project.path, branch, isMain: true, head: 'HEAD' }];

  return (
    <div className="h-full overflow-y-auto bg-transparent p-6 space-y-5 select-none font-sans">
      {/* 1. Project Hero Header (Clean, borderless) */}
      <div
        className="p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
        style={{
          backgroundColor: project.customColor ? `${project.customColor}12` : 'rgba(255, 255, 255, 0.025)'
        }}
      >
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: project.customColor ? `${project.customColor}22` : 'rgba(255, 255, 255, 0.05)'
              }}
            >
              <ProjectIconRenderer
                iconId={project.customIcon}
                color={project.customColor || '#ECEDEF'}
                className="w-4.5 h-4.5"
              />
            </div>

            <h1 className="text-lg font-semibold tracking-tight text-[#ECEDEF] truncate">
              {project.customName || project.name}
            </h1>

            <button
              onClick={(e) => handleToggleFavorite(e, project)}
              className="p-1 rounded hover:bg-white/[0.08] transition-colors cursor-pointer"
              title={project.isFavorite ? 'Favorited' : 'Add to favorites'}
            >
              <Star
                className={`w-4 h-4 ${
                  project.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-[#747982] hover:text-amber-400'
                }`}
              />
            </button>

            {project.customName && (
              <span className="text-[10px] font-mono text-[#747982] truncate">
                ({project.name})
              </span>
            )}

            {project.tag && (
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded"
                style={{
                  backgroundColor: project.customColor ? `${project.customColor}25` : 'rgba(255, 255, 255, 0.08)',
                  color: project.customColor || '#A4A8AF'
                }}
              >
                {project.tag}
              </span>
            )}

            <Badge variant="accent" size="sm" dot>
              {branch}
            </Badge>

            <span
              className={`text-[11px] font-mono ${
                isClean ? 'text-[#747982]' : 'text-amber-400 font-medium'
              }`}
            >
              · {isClean ? 'Git Clean' : `${changedFiles.length} modified`}
            </span>
          </div>

          <p className="text-xs font-mono text-[#747982] truncate max-w-2xl" title={project.path}>
            {project.path}
          </p>

          <div className="flex items-center gap-3 text-[11px] text-[#747982] font-mono pt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Active {formatRelativeTime(project.lastOpenedAt)}</span>
            </span>
            {project.settings?.defaultProvider && (
              <>
                <span>•</span>
                <span className="text-[#A4A8AF]">Default AI: {project.settings.defaultProvider}</span>
              </>
            )}
          </div>

          {project.description && (
            <p className="text-xs text-[#A4A8AF] truncate max-w-2xl pt-0.5">
              {project.description}
            </p>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            icon={<Settings className="w-3.5 h-3.5 text-[#A4A8AF]" />}
            onClick={() => setIsSettingsModalOpen(true)}
          >
            Settings
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Palette className="w-3.5 h-3.5 text-[#A4A8AF]" />}
            onClick={() => setIsCustomizeModalOpen(true)}
          >
            Customize
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Network className="w-3.5 h-3.5 text-[#A4A8AF]" />}
            onClick={() => openGraphTab()}
          >
            Intelligence Graph
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Terminal className="w-3.5 h-3.5 text-[#A4A8AF]" />}
            onClick={() => openTerminalTab()}
          >
            Terminal
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileCode className="w-3.5 h-3.5 text-[#A4A8AF]" />}
            onClick={() => setRightPanelTab('files')}
          >
            Browse Files
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Bot className="w-3.5 h-3.5" />}
            onClick={() => setActiveSection('tasks')}
          >
            Launch Agent Task
          </Button>
        </div>
      </div>

      {/* 2. Operational Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Section: Git Working Tree & Changes */}
        <div className="p-5 bg-white/[0.025] rounded-2xl space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-xs font-medium text-[#ECEDEF] flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5 text-[#A4A8AF]" />
                <span>Working Tree Status</span>
              </span>
              <button
                onClick={() => setRightPanelTab('changes')}
                className="text-[11px] text-[#A4A8AF] hover:text-[#ECEDEF] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>View Full Diff</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {isClean ? (
              <div className="py-6 text-center text-[#747982] text-xs space-y-1">
                <p className="text-[#ECEDEF] font-medium">Working tree is clean</p>
                <p className="text-[11px]">Synced with HEAD on {branch}. No pending uncommitted changes.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {changedFiles.slice(0, 6).map((f) => (
                  <div
                    key={f.path}
                    onClick={() => {
                      setRightPanelTab('changes');
                    }}
                    className="px-2.5 py-1.5 rounded-[4px] hover:bg-white/[0.03] flex items-center justify-between text-xs cursor-pointer transition-colors"
                  >
                    <span className="truncate font-mono text-[11px] text-[#ECEDEF]">{f.path}</span>
                    <span className="font-mono text-[10px] text-amber-400 font-semibold flex-shrink-0 ml-2">
                      {f.status || 'M'}
                    </span>
                  </div>
                ))}
                {changedFiles.length > 6 && (
                  <div className="text-[10px] text-[#747982] text-center pt-1 font-mono">
                    +{changedFiles.length - 6} more modified files
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Worktrees Strip */}
          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#A4A8AF]">
            <span className="flex items-center gap-1.5 font-medium">
              <GitFork className="w-3.5 h-3.5 text-[#747982]" />
              <span>{worktrees.length} Active Worktree{worktrees.length === 1 ? '' : 's'}</span>
            </span>
            <span className="font-mono text-[11px] text-[#747982]">
              Primary: {branch}
            </span>
          </div>
        </div>

        {/* Right Section: Agent Orchestration & Active Tasks */}
        <div className="p-5 bg-white/[0.025] rounded-2xl space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-xs font-medium text-[#ECEDEF] flex items-center gap-2">
                <Bot className="w-3.5 h-3.5 text-[#A4A8AF]" />
                <span>AI Execution Environment</span>
              </span>
              <span className="text-[11px] font-mono text-[#747982]">
                {activeOrchestration ? activeOrchestration.status : 'Ready'}
              </span>
            </div>

            {activeOrchestration ? (
              <div className="p-3 bg-white/[0.03] rounded-lg space-y-2">
                <div className="text-xs text-[#ECEDEF] font-medium line-clamp-2">
                  {activeOrchestration.userGoal}
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#747982] font-mono pt-1">
                  <span>Tasks: {activeOrchestration.tasks?.length || 0}</span>
                  <span>Started: {new Date(activeOrchestration.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-[#747982] text-xs space-y-1">
                <p className="text-[#ECEDEF] font-medium">Agent Engine Ready</p>
                <p className="text-[11px]">Spawn multi-agent workflows, code review gates, and isolated task branches.</p>
              </div>
            )}

            {/* Pending Approvals alert if present */}
            {pendingApprovals.length > 0 && (
              <div className="p-2.5 bg-amber-500/[0.08] rounded-lg flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-amber-300 font-medium">
                  <span>{pendingApprovals.length} Approval{pendingApprovals.length === 1 ? '' : 's'} Required</span>
                </span>
                <button
                  onClick={() => setActiveSection('tasks')}
                  className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-medium text-[10px] hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  Review
                </button>
              </div>
            )}
          </div>

          {/* Quick Capability Access */}
          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#A4A8AF]">
            <span className="flex items-center gap-1.5 font-medium">
              <Workflow className="w-3.5 h-3.5 text-[#747982]" />
              <span>Automation Engine</span>
            </span>
            <button
              onClick={() => setActiveSection('flows')}
              className="text-[11px] text-[#A4A8AF] hover:text-[#ECEDEF] transition-colors cursor-pointer"
            >
              Open Flow Builder
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProjectCustomizeModal
        isOpen={isCustomizeModalOpen}
        onClose={() => setIsCustomizeModalOpen(false)}
        project={project}
      />

      <ProjectSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        project={project}
      />

      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
      />
    </div>
  );
};

export default ProjectsWorkspace;