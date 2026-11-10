import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderOpen,
  FolderPlus,
  GitBranch,
  GitFork,
  Settings,
  Search,
  CheckSquare,
  Workflow,
  ChevronDown,
  ChevronRight,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Folders,
  PanelsTopLeft,
  ListChecks,
  CircleDot,
  FolderGit2,
  FolderTree,
  TreeDeciduous,
  GitCommit,
  X,
  Trash2,
  Network,
  MoreHorizontal,
  Edit3,
  Copy,
  ExternalLink,
  RefreshCw,
  Palette,
  Star,
  AlertTriangle,
  Home,
  CheckCircle2,
  Blocks
} from 'lucide-react';
import type { ProjectDescriptor } from '../../../shared/types';
import { useWorkspaceStore } from '../stores/workspace.store';
import Badge from './ui/Badge';
import { ProjectCustomizeModal, ProjectIconRenderer } from './ProjectCustomizeModal';
import { WorktreeCustomizeModal } from './WorktreeCustomizeModal';
import { NewProjectModal } from './NewProjectModal';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { OfficialLogoRenderer } from './OfficialLogos';
import { HelpAndResourcesMenu } from './HelpAndResourcesMenu';

export const LeftSidebar: React.FC = () => {
  const {
    project,
    setProject,
    recentProjects,
    setRecentProjects,
    closeProject,
    toggleProjectFavorite,
    expandedProjectIds,
    toggleProjectExpanded,
    createProjectWorktree,
    removeProjectWorktree,
    worktreeCustomizations,
    updateWorktreeCustomization,
    setFiles,
    activeSection,
    setActiveSection,
    openProjectTab,
    openProjectSettingsTab,
    openGraphTab,
    pendingApprovals,
    gitStatus,
    loadGitStatus,
    toggleSettings,
    openPluginsTab,
    setCommandPaletteOpen,
    isRightPanelOpen,
    rightPanelTab,
    toggleRightPanel,
    setRightPanelTab,
    setExplorerActiveTab,
    terminalSessions,
    setActiveTerminalId,
    orchestrationsHistory,
    addLog
  } = useWorkspaceStore();

  const [isAirGap, setIsAirGap] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeepTasksExpanded, setIsDeepTasksExpanded] = useState(true);
  const [addingWorktreeForProjId, setAddingWorktreeForProjId] = useState<string | null>(null);
  const [newWorktreeBranch, setNewWorktreeBranch] = useState('');
  const [isSubmittingWorktree, setIsSubmittingWorktree] = useState(false);
  const [customizingProject, setCustomizingProject] = useState<ProjectDescriptor | null>(null);
  const [settingProject, setSettingProject] = useState<ProjectDescriptor | null>(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [missingPaths, setMissingPaths] = useState<Set<string>>(new Set());
  const [customizingWorktree, setCustomizingWorktree] = useState<{ proj: ProjectDescriptor; wt: any } | null>(null);
  const [projectMenuOpenId, setProjectMenuOpenId] = useState<string | null>(null);
  const [copiedPathProjId, setCopiedPathProjId] = useState<string | null>(null);
  const [projectWorktreesCache, setProjectWorktreesCache] = useState<Record<string, any[]>>({});

  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  // Close open project options menu on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setProjectMenuOpenId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    window.api.getAirGapConfig().then((cfg) => setIsAirGap(cfg.enabled)).catch(() => {});
    window.api.getRecentProjects().then((recents) => {
      setRecentProjects(recents);
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

  const handleToggleAirGap = async () => {
    const next = !isAirGap;
    await window.api.updateAirGapConfig({ enabled: next });
    setIsAirGap(next);
    addLog(
      `Air-Gap mode: ${next ? 'ENABLED (Offline Local Models Only)' : 'DISABLED'}`,
      next ? 'warn' : 'info'
    );
  };

  const handleOpenFolder = async () => {
    try {
      const selected = await window.api.openDirectoryDialog();
      if (selected) {
        setProject(selected);
        const files = await window.api.listFiles({ projectPath: selected.path });
        setFiles(files);
        const recents = await window.api.getRecentProjects();
        setRecentProjects(recents);
        loadGitStatus(selected.path);
        addLog(`Opened workspace: ${selected.name}`, 'info');
      }
    } catch (err: any) {
      addLog(`Failed to open project: ${err.message}`, 'error');
    }
  };

  const normalizePath = (p?: string | null) => {
    if (!p) return '';
    return p.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();
  };

  const handleSelectProject = async (proj: any) => {
    const store = useWorkspaceStore.getState();
    const isCurrentProject = project?.id === proj.id;
    const isNotInTerminal = store.activeSection !== 'terminal' || store.activeTabId?.startsWith('tab:');

    if (isCurrentProject && !isNotInTerminal) {
      toggleProjectExpanded(proj.id);
      return;
    }

    try {
      if (!isCurrentProject) {
        setProject(proj);
        const files = await window.api.listFiles({ projectPath: proj.path });
        setFiles(files);
        loadGitStatus(proj.path);
        addLog(`Switched project context to: ${proj.name}`, 'info');
      }

      // Ensure PowerShell terminal is focused for this project
      const normProjPath = normalizePath(proj.path);
      let term = store.terminalSessions.find((t) => normalizePath(t.workingDirectory) === normProjPath);
      if (!term) {
        const newId = store.createTerminalSession('powershell');
        store.updateTerminalSession(newId, {
          title: `PowerShell (${proj.activeBranch || 'main'})`,
          projectName: proj.name,
          workingDirectory: proj.path,
          branch: proj.activeBranch || 'main',
          provider: 'powershell',
          streamOutput: ''
        });
        store.openTerminalTab(newId);
      } else {
        store.setActiveTerminalId(term.id);
        store.openTerminalTab(term.id);
      }
      store.setActiveSection('terminal');
    } catch (err: any) {
      addLog(`Failed to switch project: ${err.message}`, 'error');
    }
  };

  const handleSelectWorktree = async (parentProj: any, wt: any) => {
    if (!wt.path) return;
    try {
      const cleanRootName = parentProj.name.replace(/\s*\([^)]*\)$/, '');
      const realRootProj = recentProjects.find(
        (p) => !p.id.startsWith('wt-') && (normalizePath(p.path) === normalizePath(parentProj.path) || p.name === cleanRootName)
      ) || parentProj;

      const cleanRootId = realRootProj.id.startsWith('wt-')
        ? (project?.id && !project.id.startsWith('wt-') ? project.id : realRootProj.id.replace(/^wt-[^-]+-/, ''))
        : realRootProj.id;

      const wtDescriptor = {
        ...realRootProj,
        id: cleanRootId,
        name: cleanRootName,
        path: wt.path,
        lastOpenedAt: Date.now(),
        isGitRepo: true,
        activeBranch: wt.branch,
        permissionLevel: realRootProj.permissionLevel || 'standard'
      };
      setProject(wtDescriptor);

      // Immediate terminal switch without waiting for file system traversal (0ms lag)
      const store = useWorkspaceStore.getState();
      const normWtPath = normalizePath(wt.path);
      let term = store.terminalSessions.find(
        (t) => normalizePath(t.workingDirectory) === normWtPath
      );
      if (!term) {
        const newId = store.createTerminalSession('powershell');
        store.updateTerminalSession(newId, {
          title: `PowerShell (${wt.branch})`,
          projectName: cleanRootName,
          workingDirectory: wt.path,
          branch: wt.branch,
          provider: 'powershell',
          streamOutput: ''
        });
        store.openTerminalTab(newId);
      } else {
        store.setActiveTerminalId(term.id);
        store.openTerminalTab(term.id);
      }
      store.setActiveSection('terminal');
      addLog(`Switched active worktree to: ${wt.branch}`, 'info');

      // Asynchronous background file list & git status loading
      window.api.listFiles({ projectPath: wt.path }).then(setFiles).catch(() => {});
      loadGitStatus(wt.path);
    } catch (err: any) {
      addLog(`Failed to switch worktree: ${err.message}`, 'error');
    }
  };

  const handleCreateWorktreeSubmit = async (e: React.FormEvent, parentProj: any) => {
    e.preventDefault();
    if (!newWorktreeBranch.trim() || isSubmittingWorktree) return;
    setIsSubmittingWorktree(true);
    try {
      const ok = await createProjectWorktree(parentProj.path, newWorktreeBranch.trim());
      if (ok) {
        setNewWorktreeBranch('');
        setAddingWorktreeForProjId(null);
      }
    } finally {
      setIsSubmittingWorktree(false);
    }
  };

  const allProjects = useMemo(() => {
    const map = new Map<string, any>();

    // Current active project
    if (project) {
      const cleanName = project.name.replace(/\s*\([^)]*\)$/, '');
      const cleanId = project.id.startsWith('wt-')
        ? (recentProjects.find((p) => !p.id.startsWith('wt-'))?.id || project.id)
        : project.id;

      const cleanProj = {
        ...project,
        id: cleanId,
        name: cleanName
      };
      map.set(cleanId, cleanProj);
    }

    for (const p of recentProjects) {
      if (p.id.startsWith('wt-')) continue;
      const cleanName = p.name.replace(/\s*\([^)]*\)$/, '');
      if (!map.has(p.id)) {
        // Also check if normalized path is already in the map
        const alreadyExists = Array.from(map.values()).some(
          (existing) => normalizePath(existing.path) === normalizePath(p.path) || existing.name === cleanName
        );
        if (!alreadyExists) {
          map.set(p.id, { ...p, name: cleanName });
        }
      }
    }
    return Array.from(map.values());
  }, [project, recentProjects]);

  const filteredProjects = useMemo(() => {
    let list = allProjects;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = allProjects.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.customName && p.customName.toLowerCase().includes(q)) ||
          (p.tag && p.tag.toLowerCase().includes(q)) ||
          (p.path && p.path.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
  }, [allProjects, searchQuery]);

  // Proactively cache worktrees for all expanded projects so all branches/tags are always visible
  useEffect(() => {
    expandedProjectIds.forEach((projId) => {
      const p = filteredProjects.find((x) => x.id === projId);
      if (p?.path && p.isGitRepo) {
        const norm = normalizePath(p.path);
        if (!projectWorktreesCache[norm]) {
          window.api.getGitStatus(p.path).then((status) => {
            if (status?.worktrees && status.worktrees.length > 0) {
              setProjectWorktreesCache((prev) => ({ ...prev, [norm]: status.worktrees }));
            }
          }).catch(() => {});
        }
      }
    });
  }, [expandedProjectIds, filteredProjects, projectWorktreesCache]);

  useEffect(() => {
    if (gitStatus?.worktrees && gitStatus.worktrees.length > 0 && project?.path) {
      const norm = normalizePath(project.path);
      setProjectWorktreesCache((prev) => ({ ...prev, [norm]: (gitStatus.worktrees || []) as any[] }));
    }
  }, [gitStatus, project?.path]);

  return (
    <aside className="h-full flex flex-col bg-transparent select-none overflow-hidden text-xs font-sans pt-2 relative z-10">
      {/* 1. Global Search Bar */}
      <div className="px-2.5 pb-2 bg-transparent">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3 py-1.5 bg-white/[0.04] rounded-lg text-[#A4A8AF] hover:text-white text-xs transition-all border border-white/[0.05] hover:border-white/[0.12] hover:bg-white/[0.06] cursor-pointer shadow-xs"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-[#747982] flex-shrink-0" />
            <span className="truncate">Search tasks, files...</span>
          </div>
          <kbd className="px-1.5 py-0.5 bg-white/[0.08] text-[10px] font-mono text-[#A4A8AF] rounded border border-white/10">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* 3. Core Workspace Navigation */}
      <div className="px-2 py-1 space-y-1 flex-shrink-0">
        <button
          onClick={() => setActiveSection('tasks')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
            activeSection === 'tasks'
              ? 'bg-white/[0.08] text-white border border-white/[0.12] shadow-xs'
              : 'text-[#A4A8AF] hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <CheckSquare className={`w-4 h-4 flex-shrink-0 ${activeSection === 'tasks' ? 'text-white' : 'text-[#747982]'}`} />
            <span className="truncate">Tasks & Approvals</span>
          </div>
          {pendingApprovals.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 text-[10px] font-mono">
              {pendingApprovals.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSection('flows')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
            activeSection === 'flows'
              ? 'bg-white/[0.08] text-white border border-white/[0.12] shadow-xs'
              : 'text-[#A4A8AF] hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <Workflow className={`w-4 h-4 flex-shrink-0 ${activeSection === 'flows' ? 'text-white' : 'text-[#747982]'}`} />
            <span className="truncate">Automations</span>
          </div>
        </button>

        <button
          onClick={() => openGraphTab()}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
            activeSection === 'graph'
              ? 'bg-white/[0.08] text-white border border-white/[0.12] shadow-xs'
              : 'text-[#A4A8AF] hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <Network className={`w-4 h-4 flex-shrink-0 ${activeSection === 'graph' ? 'text-white' : 'text-[#747982]'}`} />
            <span className="truncate">Intelligence Graph</span>
          </div>
        </button>
      </div>

      {/* 4. Worktrees Section */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between text-[11px] font-semibold text-foreground-muted">
          <div className="flex items-center gap-1.5 text-foreground-secondary">
            <GitFork className="w-3.5 h-3.5 text-accent" />
            <span className="uppercase tracking-wider text-[10px]">Worktrees</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsNewProjectModalOpen(true)}
              className="p-1 hover:bg-surface-elevated rounded text-foreground-muted hover:text-emerald-400 transition-all flex items-center justify-center cursor-pointer"
              title="Add Project / Worktree"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleOpenFolder}
              className="p-1 hover:bg-surface-elevated rounded text-foreground-muted hover:text-foreground transition-all flex items-center justify-center cursor-pointer"
              title="Open Project Folder (Ctrl+O)"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredProjects.length === 0 ? (
            <div className="px-3 py-4 text-center text-[#747982] text-[11px] italic">
              No recent workspaces
            </div>
          ) : (
            filteredProjects.map((proj) => {
              const isActive = project?.id === proj.id || (project ? normalizePath(project.path) === normalizePath(proj.path) : false);
              const isExpanded = expandedProjectIds.has(proj.id);
              const branch = proj.activeBranch || (isActive && gitStatus?.branch) || 'main';
              const isClean = isActive ? gitStatus?.isClean ?? true : true;
              const changedCount = isActive ? gitStatus?.changedFiles.length ?? 0 : 0;
              const normProjPath = normalizePath(proj.path);

              const worktrees = (isActive && gitStatus?.worktrees && gitStatus.worktrees.length > 0)
                ? gitStatus.worktrees
                : (projectWorktreesCache[normProjPath] || [{ path: proj.path, branch, isMain: true, head: 'HEAD' }]);

              const isAddingWorktree = addingWorktreeForProjId === proj.id;

              const getWtCustom = (branchName: string, wtPath?: string) => {
                const normP = normalizePath(proj.path);
                const normW = wtPath ? normalizePath(wtPath) : '';
                for (const [key, val] of Object.entries(worktreeCustomizations || {})) {
                  const [savedPath, savedBranch] = key.split('::');
                  if (savedBranch === branchName) {
                    const normSaved = normalizePath(savedPath);
                    if (
                      normSaved === normP ||
                      (normW && normSaved === normW) ||
                      normSaved.endsWith(normP) ||
                      normP.endsWith(normSaved)
                    ) {
                      return val;
                    }
                  }
                }
                return undefined;
              };

              const getWorktreeAISessions = (wt: any) => {
                const normWtPath = normalizePath(wt.path);
                const aiTerminals = (terminalSessions || [])
                  .filter((ts) => {
                    const normTitle = (ts.title || '').toLowerCase();
                    if (
                      normTitle.includes('powershell') ||
                      normTitle.includes('pwsh') ||
                      normTitle.includes('cmd') ||
                      normTitle.includes('bash') ||
                      (ts.provider as string) === 'powershell' ||
                      (ts.provider as string) === 'cmd' ||
                      (ts.provider as string) === 'bash'
                    ) {
                      return false;
                    }
                    const isAi = ts.provider && !['powershell', 'cmd', 'bash'].includes(ts.provider as string);
                    if (!isAi) return false;
                    const normSessionDir = normalizePath(ts.workingDirectory);
                    return (
                      normSessionDir === normWtPath ||
                      (ts.branch === wt.branch && (normSessionDir.startsWith(normProjPath) || ts.projectName === proj.name))
                    );
                  })
                  .map((ts) => ({
                    id: ts.id,
                    provider: ts.provider,
                    title: ts.title.replace(/^(Antigravity|Claude|Gemini|Codex|Cursor|Copilot)\s*[-:]\s*/i, '').trim() || ts.provider,
                    status: ts.status,
                    timestamp: ts.lastActivityAt || ts.createdAt,
                    terminalId: ts.id,
                    orchestrationId: undefined
                  }));

                const agentTasks: any[] = [];
                for (const orch of orchestrationsHistory || []) {
                  for (const t of orch.tasks || []) {
                    const match = (t.worktreePath && normalizePath(t.worktreePath) === normWtPath) || (t.branchName && t.branchName === wt.branch);
                    if (match) {
                      agentTasks.push({
                        id: `task-${t.id}`,
                        provider: t.assignedProvider || 'antigravity',
                        title: t.title,
                        status: t.status === 'running' ? 'running' : (t.status === 'completed' ? 'completed' : 'idle'),
                        timestamp: t.completedAt || t.startedAt || t.createdAt,
                        terminalId: undefined,
                        orchestrationId: orch.id
                      });
                    }
                  }
                }

                return [...aiTerminals, ...agentTasks].slice(0, 2);
              };

              return (
                <div
                  key={proj.id}
                  style={proj.customColor ? {
                    backgroundColor: isActive ? `${proj.customColor}16` : `${proj.customColor}08`
                  } : undefined}
                  className={`rounded-lg transition-colors duration-75 overflow-visible group/proj relative ${
                    isActive
                      ? 'bg-white/[0.06]'
                      : 'hover:bg-white/[0.06]'
                  }`}
                >
                  {/* Project Row Header */}
                  <div
                    onClick={() => handleSelectProject(proj)}
                    className="flex items-center justify-between p-2 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleProjectExpanded(proj.id);
                        }}
                        className="p-0.5 text-foreground-muted hover:text-foreground rounded flex-shrink-0"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <ProjectIconRenderer
                        iconId={proj.customIcon}
                        color={proj.customColor || (isActive ? '#ECEDEF' : '#A4A8AF')}
                        className="w-4 h-4 flex-shrink-0"
                      />

                      <span
                        className={`truncate font-medium ${
                          isActive ? 'text-foreground font-semibold' : 'text-foreground-secondary'
                        }`}
                        title={proj.customName ? `${proj.customName} (${proj.name})` : proj.name}
                      >
                        {proj.customName || proj.name}
                      </span>

                      {proj.isFavorite && (
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
                      )}

                      {missingPaths.has(proj.path) && (
                        <span title="Directory missing on disk" className="text-rose-400 flex-shrink-0">
                          <AlertTriangle className="w-3 h-3" />
                        </span>
                      )}

                      {proj.tag && (
                        <span
                          className="text-[9px] font-mono px-1 rounded flex-shrink-0"
                          style={{
                            backgroundColor: proj.customColor ? `${proj.customColor}22` : 'rgba(255, 255, 255, 0.08)',
                            color: proj.customColor || '#A4A8AF'
                          }}
                        >
                          {proj.tag}
                        </span>
                      )}
                    </div>

                    {/* Right Project Actions */}
                    <div className="flex items-center gap-0.5 flex-shrink-0 pl-1">
                      {proj.isGitRepo && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isExpanded) toggleProjectExpanded(proj.id);
                            setAddingWorktreeForProjId(isAddingWorktree ? null : proj.id);
                          }}
                          className={`p-1 rounded-md text-foreground-muted hover:text-foreground hover:bg-white/[0.08] transition-all cursor-pointer ${
                            isAddingWorktree ? 'opacity-100 bg-white/[0.08] text-foreground' : 'opacity-0 group-hover/proj:opacity-100'
                          }`}
                          title="New worktree"
                          aria-label="New worktree"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Project Options 3-Dots Button */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectMenuOpenId(projectMenuOpenId === proj.id ? null : proj.id);
                          }}
                          className={`p-1 rounded-md text-foreground-muted hover:text-foreground hover:bg-white/[0.08] transition-all cursor-pointer ${
                            projectMenuOpenId === proj.id ? 'opacity-100 bg-white/[0.08] text-foreground' : 'opacity-0 group-hover/proj:opacity-100'
                          }`}
                          title="Project options"
                          aria-label="Project options"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>

                        {/* Project Actions Dropdown Menu - Clean Single Item Opening Page */}
                        {projectMenuOpenId === proj.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1 w-44 bg-[#141619] border border-white/[0.1] rounded-xl shadow-2xl py-1 text-xs z-50 animate-in fade-in zoom-in-95 duration-100"
                          >
                            <button
                              onClick={() => {
                                setProjectMenuOpenId(null);
                                openProjectSettingsTab(proj.id);
                              }}
                              className="w-full text-left px-2.5 py-1.5 hover:bg-white/[0.06] flex items-center gap-2 text-[#ECEDEF] transition-colors cursor-pointer"
                            >
                              <Settings className="w-3.5 h-3.5 text-[#A4A8AF]" />
                              <span>Project Settings</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Worktrees & Details (Clean, borderless, indented) */}
                  {isExpanded && (
                    <div className="px-2 pb-2 pt-0.5 space-y-1 text-[11px]">
                      {/* Inline Create Worktree Form */}
                      {isAddingWorktree && (
                        <form
                          onSubmit={(e) => handleCreateWorktreeSubmit(e, proj)}
                          className="p-2 bg-surface-elevated border border-border rounded-lg space-y-1.5 my-1"
                        >
                          <div className="text-[10px] text-foreground-muted font-medium">New Branch Name:</div>
                          <input
                            type="text"
                            autoFocus
                            placeholder="e.g. feat/new-feature"
                            value={newWorktreeBranch}
                            onChange={(e) => setNewWorktreeBranch(e.target.value)}
                            className="w-full bg-input border border-border focus:border-accent rounded px-2 py-1 text-xs text-foreground focus:outline-none"
                          />
                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setAddingWorktreeForProjId(null)}
                              className="px-2 py-0.5 rounded text-[10px] text-foreground-muted hover:text-foreground"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmittingWorktree || !newWorktreeBranch.trim()}
                              className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-accent text-background hover:bg-accent-hover disabled:opacity-50"
                            >
                              {isSubmittingWorktree ? 'Creating...' : 'Create'}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Worktrees list (Straight clean list with flush vertical indicator) */}
                      <div className="space-y-0.5">
                          {worktrees.map((wt: any, idx: number) => {
                            const wtCustom = getWtCustom(wt.branch, wt.path);
                            const isPrimary = wt.isMain || wt.branch === 'main' || wt.branch === 'master';
                            const isWtActive = isActive && (gitStatus?.branch === wt.branch || normalizePath(project?.path) === normalizePath(wt.path));
                            const wtDisplayName = wtCustom?.customName || wt.branch;
                            const wtHasChanges = isWtActive && (gitStatus?.changedFiles?.length ?? 0) > 0;
                            const aiSessions = getWorktreeAISessions(wt);

                            return (
                              <div key={`${wt.branch}-${idx}`} className="space-y-0.5">
                                {/* Worktree Row */}
                                <div
                                  onClick={() => handleSelectWorktree(proj, wt)}
                                  className={`relative flex items-center justify-between py-1 px-2 rounded-md cursor-pointer group/wt transition-colors duration-75 text-xs ${
                                    isWtActive
                                      ? 'bg-white/[0.08] text-white font-medium'
                                      : 'text-[#A4A8AF] hover:text-white hover:bg-white/[0.08]'
                                  }`}
                                >
                                  {isWtActive && (
                                    <div
                                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
                                      style={{ backgroundColor: wtCustom?.customColor || '#FFFFFF' }}
                                    />
                                  )}

                                  <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 pl-0.5">
                                    <GitFork className={`w-3.5 h-3.5 flex-shrink-0 ${isWtActive ? 'text-white' : 'text-[#747982]'}`} />
                                    <span className="truncate font-mono" title={wtDisplayName}>{wtDisplayName}</span>
                                    {isPrimary && (
                                      <span title="Default branch" className="flex-shrink-0">
                                        <Home className="w-2.5 h-2.5 text-neutral-500 opacity-70" />
                                      </span>
                                    )}
                                    {wtCustom?.tag && (
                                      <span
                                        className="text-[9px] font-mono px-1.5 py-0.2 rounded flex-shrink-0"
                                        style={{
                                          backgroundColor: wtCustom.customColor ? `${wtCustom.customColor}22` : 'rgba(255, 255, 255, 0.08)',
                                          color: wtCustom.customColor || '#A4A8AF'
                                        }}
                                      >
                                        {wtCustom.tag}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover/wt:opacity-100 transition-opacity">
                                      {/* Customize Worktree button */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCustomizingWorktree({ proj, wt: { ...wt, ...wtCustom } });
                                        }}
                                        className="p-1 text-neutral-500 hover:text-white rounded cursor-pointer"
                                        title="Customize worktree"
                                        aria-label="Customize worktree"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>

                                      {!isPrimary && wt.path && (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            await removeProjectWorktree(proj.path, wt.path, wt.branch);
                                          }}
                                          className="p-1 text-foreground-muted hover:text-error rounded cursor-pointer"
                                          title="Remove worktree"
                                          aria-label="Remove worktree"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Orca-Style AI Terminals & Sessions under Worktree */}
                                {aiSessions.map((sess) => {
                                  const isRunning = sess.status === 'running';
                                  const isFailed = sess.status === 'failed' || sess.status === 'error';

                                  return (
                                    <div
                                      key={sess.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectWorktree(proj, wt);
                                        if (sess.terminalId) {
                                          setActiveTerminalId(sess.terminalId);
                                          setActiveSection('terminal');
                                        } else if (sess.orchestrationId) {
                                          setActiveSection('agents');
                                        }
                                      }}
                                      className="flex items-center gap-1.5 pl-6 pr-2 py-0.5 rounded-md text-xs cursor-pointer text-[#A4A8AF] hover:text-white hover:bg-white/[0.06] transition-colors duration-75 group/aisess"
                                      title={`AI Session: ${sess.title} (${sess.status})`}
                                    >
                                      {/* Status dot / checkmark */}
                                      {isRunning ? (
                                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
                                      ) : isFailed ? (
                                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[8px] flex-shrink-0 font-bold">✕</span>
                                      ) : (
                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
                                      )}

                                      {/* AI Provider Logo */}
                                      <OfficialLogoRenderer provider={sess.provider} size={12} className="w-3 h-3 flex-shrink-0" />

                                      {/* Summary / Task title */}
                                      <span className="truncate text-[11px] text-[#A4A8AF] group-hover/aisess:text-white font-normal min-w-0 flex-1">
                                        {sess.title}
                                      </span>

                                      {/* Relative time */}
                                      {sess.timestamp && (
                                        <span className="text-[10px] text-neutral-500 font-mono flex-shrink-0 ml-1">
                                          {formatRelativeTime(sess.timestamp)}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
            })
          )}
        </div>
      </div>

      {/* 5. Footer: Settings, Help & Quick Functional Controls */}
      <div className="p-1.5 px-2 border-t border-white/[0.05] bg-transparent flex items-center justify-between text-xs select-none">
        {/* Left: Settings & Help */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleSettings(true)}
            className="p-1.5 rounded-md text-[#747982] hover:text-[#ECEDEF] hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Settings & Keyring"
            aria-label="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <HelpAndResourcesMenu />
        </div>

        {/* Right: Plugins & Extensions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => openPluginsTab()}
            className="p-1.5 rounded-md text-[#747982] hover:text-[#ECEDEF] hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Plugins & Extensions"
            aria-label="Plugins & Extensions"
          >
            <Blocks className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Project Customization Modal */}
      <ProjectCustomizeModal
        isOpen={Boolean(customizingProject)}
        onClose={() => setCustomizingProject(null)}
        project={customizingProject}
      />

      {/* Project Settings Modal */}
      <ProjectSettingsModal
        isOpen={Boolean(settingProject)}
        onClose={() => setSettingProject(null)}
        project={settingProject}
      />

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
      />

      {/* Worktree Customization Modal */}
      {customizingWorktree && (
        <WorktreeCustomizeModal
          isOpen={Boolean(customizingWorktree)}
          onClose={() => setCustomizingWorktree(null)}
          projectName={customizingWorktree.proj.name}
          projectPath={customizingWorktree.proj.path}
          worktree={customizingWorktree.wt}
          onSave={async (data) => {
            updateWorktreeCustomization(customizingWorktree.proj.path, customizingWorktree.wt.branch, data);
            if (customizingWorktree.wt.path && customizingWorktree.wt.path !== customizingWorktree.proj.path) {
              updateWorktreeCustomization(customizingWorktree.wt.path, customizingWorktree.wt.branch, data);
            }
            setCustomizingWorktree(null);
          }}
        />
      )}
    </aside>
  );
};

export default LeftSidebar;
