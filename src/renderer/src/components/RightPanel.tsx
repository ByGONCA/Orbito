import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  FolderTree,
  ListTree,
  Bot,
  BrainCircuit,
  Sparkles,
  Cpu,
  GitBranch,
  RefreshCw,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  File,
  FilePlus,
  FolderPlus,
  FolderMinus,
  Copy,
  Edit3,
  Trash2,
  ExternalLink,
  X,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Database,
  ArrowRight
} from 'lucide-react';
import { useWorkspaceStore, type RightPanelTab } from '../stores/workspace.store';
import type { FileNode } from '../../../shared/types';
import type { CLIProvider } from '../../../shared/cli';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Badge } from './ui/Badge';
import { SearchField } from './ui/SearchField';
import { FileIcon } from '../utils/file-icons';
import {
  CreateFileOrFolderModal,
  RenameModal,
  DeleteConfirmModal
} from './FileExplorerModals';
import { ProjectExplorer } from './explorer/ProjectExplorer';

interface FlatNode {
  node: FileNode;
  depth: number;
}

interface ModelOption {
  id: string;
  name: string;
  contextWindow: string;
  badge?: string;
  isLocal?: boolean;
}

const CLOUD_PROVIDER_MODELS: Record<'claude' | 'gemini' | 'codex', ModelOption[]> = {
  claude: [
    { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet', contextWindow: '200,000 tokens', badge: 'Hybrid Reasoning' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', contextWindow: '200,000 tokens', badge: 'Default Coding' },
    { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', contextWindow: '200,000 tokens', badge: 'Fast & Light' }
  ],
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: '1,000,000 tokens', badge: 'Ultra Fast' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: '1,000,000 tokens', badge: 'Deep Reasoning' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: '1,000,000 tokens', badge: 'Low Latency' }
  ],
  codex: [
    { id: 'gpt-4o', name: 'GPT-4o', contextWindow: '128,000 tokens', badge: 'Multimodal' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: '128,000 tokens', badge: 'Fast & Efficient' },
    { id: 'o3-mini', name: 'o3-mini', contextWindow: '200,000 tokens', badge: 'Reasoning Specialist' }
  ]
};

const getTaskStatusStyle = (status: string) => {
  switch (status) {
    case 'running':
      return 'text-emerald-400 font-semibold';
    case 'waiting_approval':
      return 'text-amber-400 font-semibold';
    case 'reviewing':
      return 'text-blue-400 font-medium';
    case 'completed':
      return 'text-emerald-400';
    case 'failed':
      return 'text-rose-400 font-semibold';
    case 'cancelled':
    case 'blocked':
      return 'text-neutral-500';
    case 'pending':
    case 'ready':
    default:
      return 'text-neutral-400';
  }
};

export const RightPanel: React.FC = () => {
  const {
    rightPanelTab,
    setRightPanelTab,
    toggleRightPanel,
    project,
    files,
    setFiles,
    openTabs,
    closeTab,
    activeFilePath,
    activeFileContent,
    activeFileSymbols,
    targetEditorLine,
    setTargetEditorLine,
    setActiveFile,
    expandedDirs,
    toggleDirExpanded,
    fileFilter,
    setFileFilter,
    terminalSessions,
    activeTerminalId,
    updateTerminalSession,
    activeOrchestration,
    setActiveOrchestration,
    orchestrationsHistory,
    setOrchestrationsHistory,
    pendingApprovals,
    setPendingApprovals,
    selectedAgentId,
    setSelectedAgentId,
    skills,
    setSkills,
    indexStats,
    projectGraph,
    isGraphLoading,
    cliStatuses,
    setCLIStatuses,
    cliAuthStatuses,
    setCLIAuthStatuses,
    activeProvider,
    setActiveProvider,
    gitStatus,
    loadGitStatus,
    fileIconTheme,
    showGitFileColors,
    setActiveSection,
    customPaths,
    createFile,
    createDirectory,
    renameItem,
    deleteItem,
    moveItem,
    addLog
  } = useWorkspaceStore();

  const fileTreeRef = useRef<HTMLDivElement>(null);
  const [outlineFilter, setOutlineFilter] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);

  // File Explorer interaction states
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode | null } | null>(null);
  const [draggedNode, setDraggedNode] = useState<FileNode | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState<{ isOpen: boolean; type: 'file' | 'folder'; parentDir: string } | null>(null);
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; node: FileNode } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; node: FileNode } | null>(null);

  // Close context menu on outside click or Escape
  useEffect(() => {
    const handleDismiss = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleDismiss);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleDismiss);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Dynamic orchestration & skills local states
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [isRefreshingProviders, setIsRefreshingProviders] = useState(false);

  // 1. Live agent orchestration subscriber & initial load
  useEffect(() => {
    if (!activeOrchestration && project?.id) {
      window.api.listOrchestrations?.({ projectId: project.id }).then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setOrchestrationsHistory(list);
          const running = list.find((o) => o.status === 'running' || o.status === 'waiting_approval');
          if (running) {
            setActiveOrchestration(running);
          } else {
            setActiveOrchestration(list[0]);
          }
        }
      }).catch(() => {});
    }

    window.api.getPendingApprovals?.().then((approvals) => {
      if (Array.isArray(approvals)) setPendingApprovals(approvals);
    }).catch(() => {});

    const unsub = window.api.onOrchestrationEvent?.(async (event) => {
      try {
        const approvals = await window.api.getPendingApprovals();
        if (Array.isArray(approvals)) setPendingApprovals(approvals);

        const currentOrchId = useWorkspaceStore.getState().activeOrchestration?.id || event.orchestrationId;
        if (currentOrchId) {
          const updated = await window.api.getOrchestration({ orchestrationId: currentOrchId });
          if (updated) {
            setActiveOrchestration(updated);
          }
        }
      } catch {
        // silent
      }
    });

    return () => {
      unsub?.();
    };
  }, [project?.id, activeOrchestration?.id, setActiveOrchestration, setOrchestrationsHistory, setPendingApprovals]);

  // 2. Dynamic skills loader
  useEffect(() => {
    if (rightPanelTab === 'skills' && skills.length === 0) {
      setIsLoadingSkills(true);
      window.api.listSkills?.().then((list) => {
        if (Array.isArray(list)) setSkills(list);
      }).catch((err: any) => {
        addLog(`Failed to load skills: ${err.message}`, 'error');
      }).finally(() => {
        setIsLoadingSkills(false);
      });
    }
  }, [rightPanelTab, skills.length, setSkills, addLog]);

  // 3. Dynamic models & providers detection
  const refreshProvidersAndModels = useCallback(async () => {
    setIsRefreshingProviders(true);
    try {
      const detected = await window.api.detectCLIs?.({ customPaths });
      if (detected) setCLIStatuses(detected);

      const authMap: any = {};
      const providersToCheck: CLIProvider[] = ['claude', 'gemini', 'codex', 'ollama'];
      await Promise.all(
        providersToCheck.map(async (p) => {
          try {
            authMap[p] = await window.api.checkCLIAuth({ provider: p, customPath: customPaths[p] });
          } catch {
            authMap[p] = { provider: p, state: 'error', isAuthenticated: false, authType: 'missing' };
          }
        })
      );
      setCLIAuthStatuses(authMap);

      const localModels = await window.api.listLocalModels?.();
      if (Array.isArray(localModels)) {
        setOllamaModels(localModels);
      }
    } catch (err: any) {
      addLog(`Provider status check error: ${err.message}`, 'warn');
    } finally {
      setIsRefreshingProviders(false);
    }
  }, [customPaths, setCLIStatuses, setCLIAuthStatuses, addLog]);

  // Map of normalized relative paths to Git status
  const gitStatusMap = useMemo(() => {
    const map = new Map<string, 'M' | 'A' | 'D' | 'R' | 'U'>();
    if (!gitStatus?.changedFiles || !project) return map;

    for (const item of gitStatus.changedFiles) {
      const norm = item.path.replace(/\\/g, '/').toLowerCase();
      map.set(norm, item.status as any);
    }
    return map;
  }, [gitStatus, project]);

  // Map of directory relative paths to changed children counts
  const dirStatusMap = useMemo(() => {
    const map = new Map<string, { count: number; hasModified: boolean; hasUntracked: boolean }>();
    if (!gitStatus?.changedFiles || !project) return map;

    for (const item of gitStatus.changedFiles) {
      const parts = item.path.replace(/\\/g, '/').split('/');
      parts.pop(); // remove filename
      let cur = '';
      for (const part of parts) {
        cur = cur ? `${cur}/${part}` : part;
        const lower = cur.toLowerCase();
        const existing = map.get(lower) || { count: 0, hasModified: false, hasUntracked: false };
        existing.count += 1;
        if (item.status === 'M') existing.hasModified = true;
        if (item.status === 'U' || item.status === 'A') existing.hasUntracked = true;
        map.set(lower, existing);
      }
    }
    return map;
  }, [gitStatus, project]);

  // Helper to compute project-relative path
  const getNodeRelPath = useCallback(
    (nodePath: string) => {
      if (!project) return nodePath.replace(/\\/g, '/');
      const normNode = nodePath.replace(/\\/g, '/');
      const normProj = project.path.replace(/\\/g, '/');
      if (normNode.toLowerCase().startsWith(normProj.toLowerCase())) {
        let rel = normNode.slice(normProj.length);
        if (rel.startsWith('/')) rel = rel.slice(1);
        return rel;
      }
      return normNode;
    },
    [project]
  );

  // Active terminal session context
  const activeTerminal = useMemo(() => {
    return terminalSessions.find((t) => t.id === activeTerminalId) || terminalSessions[0];
  }, [terminalSessions, activeTerminalId]);

  // Provider and Model state resolution
  const currentProvider = activeTerminal?.provider || activeProvider;

  const handleSelectProvider = (p: CLIProvider) => {
    setActiveProvider(p);
    let defaultModel = 'claude-3-7-sonnet';
    if (p === 'claude') defaultModel = 'claude-3-7-sonnet';
    else if (p === 'gemini') defaultModel = 'gemini-2.0-flash';
    else if (p === 'codex') defaultModel = 'gpt-4o';
    else if (p === 'ollama') defaultModel = ollamaModels.length > 0 ? ollamaModels[0] : 'llama3:latest';

    if (activeTerminal) {
      updateTerminalSession(activeTerminal.id, { provider: p, model: defaultModel });
    }
  };

  const handleSelectModel = (modelId: string) => {
    if (activeTerminal) {
      updateTerminalSession(activeTerminal.id, { model: modelId });
    }
  };

  const activeModelId = activeTerminal?.model || (
    currentProvider === 'claude' ? 'claude-3-7-sonnet' :
    currentProvider === 'gemini' ? 'gemini-2.0-flash' :
    currentProvider === 'codex' ? 'gpt-4o' :
    (ollamaModels[0] || 'llama3:latest')
  );

  const getModelMetadata = (provider: CLIProvider, modelId: string) => {
    if (provider === 'gemini') {
      return {
        contextWindow: '1,000,000 tokens',
        mode: 'Cloud GenAI CLI',
        rate: 'High throughput, multimodal'
      };
    }
    if (provider === 'claude') {
      return {
        contextWindow: '200,000 tokens',
        mode: 'Cloud Claude CLI',
        rate: 'Agentic coding & analysis'
      };
    }
    if (provider === 'codex') {
      return {
        contextWindow: '128,000 tokens',
        mode: 'Cloud OpenAI CLI',
        rate: 'Code generation & tool use'
      };
    }
    return {
      contextWindow: '32,000 - 128,000 tokens',
      mode: 'Local Air-Gap (Offline)',
      rate: 'Zero egress, local compute'
    };
  };

  const currentMetadata = getModelMetadata(currentProvider, activeModelId);
  const authStatus = cliAuthStatuses?.[currentProvider];
  const installStatus = cliStatuses?.[currentProvider];

  const getConnectionStatusBadge = () => {
    if (!installStatus?.isInstalled) {
      return <Badge variant="neutral" size="sm">Not Installed</Badge>;
    }
    if (authStatus?.state === 'authenticated' || authStatus?.isAuthenticated) {
      return <Badge variant="success" size="sm">Connected ({currentProvider === 'ollama' ? 'Local Daemon' : 'CLI Bridge'})</Badge>;
    }
    if (authStatus?.state === 'authentication_required' || authStatus?.state === 'installed') {
      return <Badge variant="warning" size="sm">Auth Required</Badge>;
    }
    return <Badge variant="neutral" size="sm">Configured</Badge>;
  };

  // Flatten recursive file tree for virtualized display
  const flatNodes = useMemo(() => {
    const result: FlatNode[] = [];
    const filterLower = fileFilter.toLowerCase().trim();

    const traverse = (items: FileNode[], depth: number) => {
      for (const item of items) {
        if (filterLower) {
          if (item.name.toLowerCase().includes(filterLower)) {
            result.push({ node: item, depth });
          }
          if (item.isDirectory && item.children) {
            traverse(item.children, depth + 1);
          }
        } else {
          result.push({ node: item, depth });
          if (item.isDirectory && expandedDirs.has(item.id) && item.children) {
            traverse(item.children, depth + 1);
          }
        }
      }
    };

    traverse(files, 0);
    return result;
  }, [files, expandedDirs, fileFilter]);

  const rowVirtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => fileTreeRef.current,
    estimateSize: () => 24,
    overscan: 10
  });

  const handleRefreshFiles = async () => {
    if (!project) return;
    try {
      const refreshed = await window.api.listFiles({ projectPath: project.path });
      setFiles(refreshed);
      loadGitStatus(project.path);
      addLog('Refreshed project file index & git status', 'info');
    } catch (err: any) {
      addLog(`File refresh error: ${err.message}`, 'error');
    }
  };

  const handleFileClick = async (node: FileNode) => {
    if (node.isDirectory) {
      toggleDirExpanded(node.id);
    } else {
      setActiveFile(node.path);
    }
  };

  const handleCollapseAllFolders = () => {
    useWorkspaceStore.setState({ expandedDirs: new Set() });
  };

  const handleDragStart = (e: React.DragEvent, node: FileNode) => {
    e.dataTransfer.setData('text/plain', node.path);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedNode(node);
  };

  const handleDragOverNode = (e: React.DragEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (draggedNode && draggedNode.path !== node.path) {
      setDragOverPath(node.path);
    }
  };

  const handleDragLeaveNode = (e: React.DragEvent, node: FileNode) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverPath((prev) => (prev === node.path ? null : prev));
  };

  const handleDropOnNode = async (e: React.DragEvent, targetNode: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    const sourcePath = e.dataTransfer.getData('text/plain') || draggedNode?.path;
    setDraggedNode(null);

    if (!sourcePath || !project) return;
    if (sourcePath === targetNode.path) return;

    const destinationDir = targetNode.isDirectory
      ? targetNode.path
      : targetNode.path.replace(/[/\\][^/\\]+$/, '');

    try {
      await moveItem(sourcePath, destinationDir);
    } catch {
      // Handled and logged by workspaceStore
    }
  };

  const handleDragOverRoot = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnRoot = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPath(null);
    const sourcePath = e.dataTransfer.getData('text/plain') || draggedNode?.path;
    setDraggedNode(null);

    if (!sourcePath || !project) return;
    try {
      await moveItem(sourcePath, project.path);
    } catch {
      // Handled and logged by workspaceStore
    }
  };

  // Outline symbols filtered
  const filteredSymbols = useMemo(() => {
    if (!outlineFilter.trim()) return activeFileSymbols;
    const q = outlineFilter.toLowerCase();
    return activeFileSymbols.filter(
      (s) => s.name.toLowerCase().includes(q) || s.kind.toLowerCase().includes(q)
    );
  }, [activeFileSymbols, outlineFilter]);

  // Tab definitions
  const tabs: Array<{ id: RightPanelTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }> = [
    { id: 'files', label: 'Explorer', icon: FolderTree, badge: gitStatus?.changedFiles.length || undefined },
    { id: 'outline', label: 'Outline', icon: ListTree, badge: activeFileSymbols.length || undefined },
    { id: 'agents', label: 'Agents', icon: Bot, badge: pendingApprovals.length || undefined },
    { id: 'context', label: 'Context', icon: BrainCircuit },
    { id: 'skills', label: 'Skills', icon: Sparkles }
  ];

  return (
    <aside className="h-full flex flex-col bg-transparent select-none overflow-hidden font-sans text-xs">
      {/* 1. Header Tabs Navigation (Icon-Only with Hover Tooltip Box) */}
      <div className="h-9 border-b border-white/[0.06] bg-transparent px-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1 overflow-visible py-1">
          {tabs.map((tab) => {
            const isActive =
              tab.id === 'files'
                ? rightPanelTab === 'files' || rightPanelTab === 'changes' || rightPanelTab === 'review'
                : rightPanelTab === tab.id;
            const Icon = tab.icon;
            return (
              <div key={tab.id} className="relative group">
                <button
                  onClick={() => setRightPanelTab(tab.id)}
                  className={`relative p-1.5 rounded-[6px] transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-white/[0.08] text-white'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                  aria-label={tab.label}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                </button>

                {/* Hover Tooltip Box */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 bg-[#1C1D24] border border-white/10 text-white text-[10px] rounded-lg shadow-dropdown z-50 whitespace-nowrap">
                  <span className="font-medium">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="ml-1 text-white font-mono font-semibold">({tab.badge})</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <IconButton
          icon={X}
          onClick={toggleRightPanel}
          tooltip="Collapse Panel"
          size="sm"
          className="text-foreground-muted hover:text-foreground"
        />
      </div>

      {/* 2. Dynamic Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col bg-transparent">
        {/* ========================================================== */}
        {/* TAB 1: PROJECT EXPLORER (FILES, CHANGES & REVIEW) */}
        {/* ========================================================== */}
        {(rightPanelTab === 'files' || rightPanelTab === 'changes' || rightPanelTab === 'review') && (
          <ProjectExplorer />
        )}

        {/* ========================================================== */}
        {/* TAB 2: OUTLINE & SYMBOLS */}
        {/* ========================================================== */}
        {rightPanelTab === 'outline' && (
          <div className="h-full flex flex-col p-2.5 space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <span className="text-[11px] font-semibold text-foreground truncate" title={activeFilePath || ''}>
                {activeFilePath ? activeFilePath.split(/[/\\]/).pop() : 'No active file'}
              </span>
              <Badge variant="neutral" size="sm">
                {activeFileSymbols.length} symbol{activeFileSymbols.length === 1 ? '' : 's'}
              </Badge>
            </div>

            {/* Outline Filter */}
            <SearchField
              value={outlineFilter}
              onChange={(e) => setOutlineFilter(e.target.value)}
              onClear={() => setOutlineFilter('')}
              placeholder="Filter symbols..."
              className="w-full"
            />

            {/* Symbols List */}
            <div className="flex-1 overflow-auto space-y-1 pr-1">
              {filteredSymbols.length === 0 ? (
                <div className="p-6 text-center text-foreground-muted italic text-[11px]">
                  {activeFilePath ? 'No AST symbols detected in this file' : 'Open a code file to inspect symbols'}
                </div>
              ) : (
                filteredSymbols.map((sym, idx) => (
                  <div
                    key={`${sym.name}-${sym.line}-${idx}`}
                    onClick={() => setTargetEditorLine(sym.line)}
                    className="p-2 bg-surface-elevated/40 border border-border/60 hover:border-accent/40 rounded-lg flex items-center justify-between cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge variant="neutral" size="sm" className="uppercase font-mono text-[8px]">
                        {sym.kind}
                      </Badge>
                      <span className="font-medium text-foreground truncate">{sym.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-accent">L{sym.line}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* TAB 3: AGENTS & ORCHESTRATION */}
        {/* ========================================================== */}
        {rightPanelTab === 'agents' && (
          <div className="h-full flex flex-col p-2.5 space-y-3 overflow-y-auto">
            {/* Active Orchestration Card */}
            <div className="p-2.5 bg-white/[0.02] rounded-[4px] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-accent" />
                  <span>Agent Orchestrator</span>
                </span>
                <span className="text-[10px] font-mono text-neutral-400 uppercase">
                  {activeOrchestration ? activeOrchestration.status : 'Idle'}
                </span>
              </div>

              {activeOrchestration ? (
                <div className="space-y-1.5 text-[11px]">
                  <div className="text-foreground-secondary line-clamp-2 leading-relaxed">
                    {activeOrchestration.userGoal}
                  </div>
                  <div className="flex justify-between text-foreground-muted text-[10px] pt-1 border-t border-white/[0.04]">
                    <span>
                      {activeOrchestration.tasks?.filter((t) => t.status === 'completed').length || 0} /{' '}
                      {activeOrchestration.tasks?.length || 0} tasks completed
                    </span>
                    <span>Started: {new Date(activeOrchestration.createdAt).toLocaleTimeString()}</span>
                  </div>
                  {/* Progress bar */}
                  {activeOrchestration.tasks?.length > 0 && (
                    <div className="w-full bg-white/[0.06] h-1 rounded-full overflow-hidden mt-1">
                      <div
                        className="bg-accent h-full transition-all duration-300"
                        style={{
                          width: `${Math.round(
                            ((activeOrchestration.tasks.filter((t) => t.status === 'completed').length) /
                              activeOrchestration.tasks.length) *
                              100
                          )}%`
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 text-[11px]">
                  <p className="text-foreground-muted leading-relaxed">
                    No active coordinator execution. Start a task from the terminal or Tasks panel.
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setActiveSection('tasks')}
                    className="w-full text-[10px] text-accent hover:text-accent-hover justify-center py-1"
                  >
                    <span>Open Tasks Workspace</span>
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              )}
            </div>

            {/* Dynamic Plan Tasks / Execution Roles */}
            {activeOrchestration && activeOrchestration.tasks?.length > 0 ? (
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-semibold text-foreground-muted tracking-wider px-1 flex items-center justify-between">
                  <span>Assigned Execution Tasks ({activeOrchestration.tasks.length})</span>
                  <button
                    onClick={() => setActiveSection('tasks')}
                    className="text-[10px] text-accent hover:text-accent-hover font-mono flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View all</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  {activeOrchestration.tasks.map((task) => {
                    const isExpanded = expandedTaskId === task.id;
                    const assignedModel = task.assignedModel || task.assignedProvider || 'Auto';
                    return (
                      <div
                        key={task.id}
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        className={`px-2.5 py-2 rounded-[4px] text-[11px] transition-colors border border-transparent cursor-pointer ${
                          isExpanded
                            ? 'bg-white/[0.05] border-white/[0.08]'
                            : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-mono text-[9px] uppercase px-1 py-0.2 rounded bg-white/[0.08] text-foreground font-semibold flex-shrink-0">
                                {task.role}
                              </span>
                              <span className="font-medium text-foreground truncate" title={task.title}>
                                {task.title}
                              </span>
                            </div>
                            <div className="text-[10px] text-foreground-muted flex items-center gap-2 mt-0.5">
                              <span className="truncate">{assignedModel}</span>
                              {task.isModifying && (
                                <span className="text-amber-400 font-mono text-[9px] flex-shrink-0">modifies code</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`text-[10px] font-mono flex items-center gap-1 ${getTaskStatusStyle(task.status)}`}>
                              {task.status === 'running' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              )}
                              {task.status}
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3 text-neutral-500" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-neutral-500" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Task Inspection */}
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-white/[0.04] text-[10px] space-y-1.5 text-foreground-muted select-text">
                            <p className="leading-relaxed text-foreground-secondary">{task.description}</p>
                            {task.acceptanceCriteria?.length > 0 && (
                              <div className="space-y-0.5">
                                <div className="text-neutral-400 font-medium">Acceptance Criteria:</div>
                                <ul className="list-disc list-inside space-y-0.5 pl-0.5">
                                  {task.acceptanceCriteria.map((c, i) => (
                                    <li key={i} className="truncate text-foreground-muted">{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {task.branchName && (
                              <div className="flex items-center gap-1 text-accent font-mono pt-0.5">
                                <GitBranch className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">Worktree: {task.branchName}</span>
                              </div>
                            )}
                            {task.changedFiles?.length > 0 && (
                              <div className="text-[10px] font-mono text-neutral-400">
                                Changed Files: {task.changedFiles.length} file(s)
                              </div>
                            )}
                            {task.errorMessage && (
                              <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono text-[10px]">
                                {task.errorMessage}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Recent Orchestrations History Switcher */}
            {orchestrationsHistory.length > 1 && (
              <div className="space-y-1 pt-1 border-t border-white/[0.04]">
                <span className="text-[10px] uppercase font-semibold text-foreground-muted tracking-wider px-1">
                  Recent Orchestrations
                </span>
                <div className="space-y-1">
                  {orchestrationsHistory.slice(0, 3).map((hist) => (
                    <button
                      key={hist.id}
                      onClick={() => setActiveOrchestration(hist)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[10px] transition-colors flex items-center justify-between cursor-pointer ${
                        activeOrchestration?.id === hist.id
                          ? 'bg-white/[0.06] text-white font-medium'
                          : 'text-neutral-400 hover:text-white hover:bg-white/[0.02]'
                      }`}
                    >
                      <span className="truncate flex-1 pr-2">{hist.userGoal}</span>
                      <span className="font-mono text-[9px] text-neutral-500 uppercase flex-shrink-0">{hist.status}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Approvals */}
            {pendingApprovals.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Pending Approvals ({pendingApprovals.length})</span>
                </div>
                {pendingApprovals.map((app) => (
                  <div key={app.id} className="p-2 bg-surface rounded-lg border border-border text-[10px] space-y-2">
                    <p className="text-foreground leading-relaxed">{app.description}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={async () => {
                          try {
                            await window.api.resolveApproval({ approvalId: app.id, decision: 'approved' });
                            setPendingApprovals(pendingApprovals.filter((a) => a.id !== app.id));
                            if (activeOrchestration) {
                              const updated = await window.api.getOrchestration({ orchestrationId: activeOrchestration.id });
                              if (updated) setActiveOrchestration(updated);
                            }
                            addLog(`Approval gate: Task APPROVED`, 'info');
                          } catch (err: any) {
                            addLog(`Approval error: ${err.message}`, 'error');
                          }
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await window.api.resolveApproval({ approvalId: app.id, decision: 'rejected' });
                            setPendingApprovals(pendingApprovals.filter((a) => a.id !== app.id));
                            if (activeOrchestration) {
                              const updated = await window.api.getOrchestration({ orchestrationId: activeOrchestration.id });
                              if (updated) setActiveOrchestration(updated);
                            }
                            addLog(`Approval gate: Task REJECTED`, 'warn');
                          } catch (err: any) {
                            addLog(`Approval error: ${err.message}`, 'error');
                          }
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================== */}
        {/* TAB 4: CONTEXT & MEMORY (PROJECT vs SESSION) */}
        {/* ========================================================== */}
        {rightPanelTab === 'context' && (
          <div className="h-full flex flex-col p-2.5 space-y-3 overflow-y-auto">
            {/* Project-Level Context */}
            {!project ? (
              <div className="p-4 bg-white/[0.02] border border-dashed border-white/[0.08] rounded-xl text-center space-y-2">
                <Database className="w-5 h-5 mx-auto text-[#747982]" />
                <div className="text-xs font-medium text-[#ECEDEF]">No Workspace Open</div>
                <p className="text-[11px] text-[#747982] leading-relaxed">
                  Open a project folder to index files, extract AST symbols, and build the intelligence graph.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#ECEDEF] flex items-center gap-1.5 text-xs">
                    <Database className="w-3.5 h-3.5 text-[#A4A8AF]" />
                    <span>Project Knowledge</span>
                  </span>
                  <Badge variant={indexStats ? 'accent' : 'neutral'} size="sm">
                    {indexStats?.isIndexing ? 'Indexing...' : indexStats ? 'Indexed' : 'Pending'}
                  </Badge>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between py-1 border-b border-white/[0.05]">
                    <span className="text-[#747982]">Indexed Files:</span>
                    <span className="text-[#ECEDEF] font-mono">
                      {indexStats?.totalFiles ?? files.length}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/[0.05]">
                    <span className="text-[#747982]">AST Code Symbols:</span>
                    <span className="text-[#ECEDEF] font-mono">
                      {indexStats ? `${indexStats.totalSymbols} symbols` : 'Not indexed'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/[0.05]">
                    <span className="text-[#747982]">FTS5 Lexical Search:</span>
                    <Badge variant="neutral" size="sm">
                      {indexStats ? 'Ready' : 'Not indexed'}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#747982]">Knowledge Graph:</span>
                    <Badge variant="neutral" size="sm">
                      {isGraphLoading
                        ? 'Analyzing...'
                        : projectGraph
                        ? `${projectGraph.nodes.length} nodes`
                        : 'Unindexed'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Session-Specific Context */}
            {!activeTerminal ? (
              <div className="p-3 bg-white/[0.02] border border-dashed border-white/[0.08] rounded-xl text-center space-y-1">
                <BrainCircuit className="w-4 h-4 mx-auto text-[#747982]" />
                <div className="text-xs font-medium text-[#ECEDEF]">No Active Session</div>
                <p className="text-[10px] text-[#747982]">
                  Launch a terminal to view active session provider, model, and branch context.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#ECEDEF] flex items-center gap-1.5 text-xs">
                    <BrainCircuit className="w-3.5 h-3.5 text-[#A4A8AF]" />
                    <span className="truncate max-w-[150px]">{activeTerminal.title}</span>
                  </span>
                  <Badge variant={activeTerminal.status === 'running' ? 'accent' : 'neutral'} size="sm">
                    {activeTerminal.status}
                  </Badge>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between py-1 border-b border-white/[0.05]">
                    <span className="text-[#747982]">Working Directory:</span>
                    <span className="text-[#ECEDEF] truncate max-w-[140px] font-mono text-[10px]" title={activeTerminal.workingDirectory || project?.path || ''}>
                      {activeTerminal.workingDirectory ? activeTerminal.workingDirectory.split(/[/\\]/).pop() : (project ? project.name : 'N/A')}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/[0.05]">
                    <span className="text-[#747982]">Active Branch:</span>
                    <Badge variant="accent" size="sm">{activeTerminal.branch || gitStatus?.branch || (project?.activeBranch ?? 'N/A')}</Badge>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/[0.05]">
                    <span className="text-[#747982]">Session Provider:</span>
                    <span className="text-[#ECEDEF] uppercase font-mono">{activeTerminal.provider}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#747982]">Model:</span>
                    <span className="text-[#ECEDEF] font-mono text-[10px]">{activeTerminal.model}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================== */}
        {/* TAB 5: SKILLS MANAGEMENT */}
        {/* ========================================================== */}
        {rightPanelTab === 'skills' && (
          <div className="h-full flex flex-col p-2.5 space-y-2.5">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="flex-1">
                <SearchField
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  onClear={() => setSkillSearch('')}
                  placeholder="Search skills..."
                  className="w-full"
                />
              </div>
              <IconButton
                icon={RefreshCw}
                onClick={async () => {
                  setIsLoadingSkills(true);
                  try {
                    const list = await window.api.listSkills();
                    setSkills(list);
                    addLog('Refreshed skills registry', 'info');
                  } catch (err: any) {
                    addLog(`Failed to refresh skills: ${err.message}`, 'error');
                  } finally {
                    setIsLoadingSkills(false);
                  }
                }}
                tooltip="Refresh skills"
                size="sm"
                className={isLoadingSkills ? 'animate-spin text-accent' : 'text-foreground-muted hover:text-foreground'}
              />
            </div>

            <div className="text-[10px] uppercase font-semibold text-foreground-muted flex items-center justify-between tracking-wider px-1">
              <span>Installed Skills</span>
              <span className="font-mono text-neutral-500">
                {skills.filter((s) => s.enabled).length} of {skills.length} enabled
              </span>
            </div>

            <div className="flex-1 overflow-auto space-y-1 pr-1">
              {isLoadingSkills && skills.length === 0 ? (
                <div className="p-6 text-center text-foreground-muted italic text-[11px]">
                  Loading skills registry...
                </div>
              ) : skills.length === 0 ? (
                <div className="p-6 text-center text-foreground-muted italic text-[11px]">
                  No skills registered in the engine.
                </div>
              ) : (
                skills
                  .filter((s) => {
                    if (!skillSearch) return true;
                    const q = skillSearch.toLowerCase();
                    return (
                      s.name.toLowerCase().includes(q) ||
                      s.description.toLowerCase().includes(q) ||
                      s.category.toLowerCase().includes(q) ||
                      s.tags?.some((t) => t.toLowerCase().includes(q))
                    );
                  })
                  .map((sk) => {
                    const isExpanded = expandedSkillId === sk.id;
                    return (
                      <div
                        key={sk.id}
                        className="px-2.5 py-2 hover:bg-white/[0.03] rounded-[4px] text-[11px] transition-colors border border-transparent hover:border-white/[0.04]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div
                            onClick={() => setExpandedSkillId(isExpanded ? null : sk.id)}
                            className="space-y-1 min-w-0 flex-1 cursor-pointer"
                          >
                            <div className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                              <Sparkles className="w-3 h-3 text-accent flex-shrink-0" />
                              <span className="truncate">{sk.name}</span>
                              <span className="text-[9px] font-mono px-1 rounded bg-white/[0.06] text-neutral-400">
                                {sk.category}
                              </span>
                              {sk.isBuiltIn ? (
                                <span className="text-[9px] font-mono text-[#747982]">built-in</span>
                              ) : (
                                <span className="text-[9px] font-mono text-accent">custom</span>
                              )}
                            </div>
                            <p className="text-[10px] text-foreground-muted leading-tight line-clamp-2">
                              {sk.description}
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              const next = !sk.enabled;
                              try {
                                await window.api.toggleSkill({ skillId: sk.id, enabled: next });
                                setSkills(skills.map((s) => (s.id === sk.id ? { ...s, enabled: next } : s)));
                                if (activeTerminal) {
                                  const cur = activeTerminal.activeSkills || [];
                                  const updated = next
                                    ? Array.from(new Set([...cur, sk.id]))
                                    : cur.filter((id) => id !== sk.id);
                                  updateTerminalSession(activeTerminal.id, { activeSkills: updated });
                                }
                                addLog(`Skill ${sk.name} is now ${next ? 'enabled' : 'disabled'}`, 'info');
                              } catch (err: any) {
                                addLog(`Skill toggle error: ${err.message}`, 'error');
                              }
                            }}
                            className={`text-[10px] font-mono transition-colors flex-shrink-0 cursor-pointer pt-0.5 ${
                              sk.enabled
                                ? 'text-accent hover:text-accent-hover font-semibold'
                                : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                          >
                            {sk.enabled ? 'Active' : 'Off'}
                          </button>
                        </div>

                        {/* Expanded Skill Details */}
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-white/[0.04] text-[10px] space-y-1 text-foreground-muted">
                            <div className="flex justify-between py-0.5">
                              <span>Version:</span>
                              <span className="text-foreground font-mono">v{sk.version}</span>
                            </div>
                            <div className="flex justify-between py-0.5">
                              <span>Author:</span>
                              <span className="text-foreground">{sk.author}</span>
                            </div>
                            {sk.permissions && (
                              <div className="pt-1">
                                <div className="text-neutral-400 font-medium mb-1">Permissions:</div>
                                <div className="flex flex-wrap gap-1 font-mono text-[9px]">
                                  {sk.permissions.filesystem?.write && (
                                    <span className="px-1 py-0.2 rounded bg-amber-500/10 text-amber-300">fs:write</span>
                                  )}
                                  {sk.permissions.filesystem?.read && (
                                    <span className="px-1 py-0.2 rounded bg-white/[0.05] text-neutral-300">fs:read</span>
                                  )}
                                  {sk.permissions.terminal?.execute && (
                                    <span className="px-1 py-0.2 rounded bg-blue-500/10 text-blue-300">terminal</span>
                                  )}
                                  {sk.permissions.network?.allowed && (
                                    <span className="px-1 py-0.2 rounded bg-purple-500/10 text-purple-300">network</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Context Menu Overlay */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(contextMenu.x, window.innerWidth - 220),
            top: Math.min(contextMenu.y, window.innerHeight - 260),
            zIndex: 9999
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-52 py-1.5 bg-[#141418] border border-white/10 rounded-xl shadow-2xl backdrop-blur-md text-xs font-sans text-neutral-300 select-none animate-in fade-in zoom-in-95 duration-100"
        >
          {contextMenu.node ? (
            <>
              {contextMenu.node.isDirectory ? (
                <>
                  <button
                    onClick={() => {
                      const node = contextMenu.node!;
                      setContextMenu(null);
                      setCreateModal({ isOpen: true, type: 'file', parentDir: node.path });
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/[0.08] hover:text-white transition-colors text-left"
                  >
                    <FilePlus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>New File...</span>
                  </button>
                  <button
                    onClick={() => {
                      const node = contextMenu.node!;
                      setContextMenu(null);
                      setCreateModal({ isOpen: true, type: 'folder', parentDir: node.path });
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/[0.08] hover:text-white transition-colors text-left"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>New Folder...</span>
                  </button>
                  <div className="my-1 border-t border-white/[0.06]" />
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      const node = contextMenu.node!;
                      setContextMenu(null);
                      setActiveFile(node.path);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/[0.08] hover:text-white transition-colors text-left"
                  >
                    <FileCode className="w-3.5 h-3.5 text-accent" />
                    <span>Open</span>
                  </button>
                  <div className="my-1 border-t border-white/[0.06]" />
                </>
              )}

              <button
                onClick={() => {
                  const node = contextMenu.node!;
                  setContextMenu(null);
                  navigator.clipboard.writeText(node.path);
                  addLog('Full path copied to clipboard', 'info');
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/[0.08] hover:text-white transition-colors text-left"
              >
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
                <span>Copy Path</span>
              </button>

              <button
                onClick={() => {
                  const node = contextMenu.node!;
                  setContextMenu(null);
                  const rel = getNodeRelPath(node.path);
                  navigator.clipboard.writeText(rel);
                  addLog('Relative path copied to clipboard', 'info');
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/[0.08] hover:text-white transition-colors text-left"
              >
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
                <span>Copy Relative Path</span>
              </button>

              <button
                onClick={() => {
                  const node = contextMenu.node!;
                  setContextMenu(null);
                  window.api?.revealInFileManager?.({ filePath: node.path });
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/[0.08] hover:text-white transition-colors text-left"
              >
                <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                <span>Reveal in File Manager</span>
              </button>

              <div className="my-1 border-t border-white/[0.06]" />

              <button
                onClick={() => {
                  const node = contextMenu.node!;
                  setContextMenu(null);
                  setRenameModal({ isOpen: true, node });
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/[0.08] hover:text-white transition-colors text-left"
              >
                <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Rename...</span>
              </button>

              <button
                onClick={() => {
                  const node = contextMenu.node!;
                  setContextMenu(null);
                  setDeleteModal({ isOpen: true, node });
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-colors text-left"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete...</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setContextMenu(null);
                  setCreateModal({ isOpen: true, type: 'file', parentDir: project?.path || '' });
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/[0.08] hover:text-white transition-colors text-left"
              >
                <FilePlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>New File...</span>
              </button>
              <button
                onClick={() => {
                  setContextMenu(null);
                  setCreateModal({ isOpen: true, type: 'folder', parentDir: project?.path || '' });
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/[0.08] hover:text-white transition-colors text-left"
              >
                <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>New Folder...</span>
              </button>
              <div className="my-1 border-t border-white/[0.06]" />
              <button
                onClick={() => {
                  setContextMenu(null);
                  handleRefreshFiles();
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/[0.08] hover:text-white transition-colors text-left"
              >
                <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
                <span>Refresh Files</span>
              </button>
              <button
                onClick={() => {
                  setContextMenu(null);
                  handleCollapseAllFolders();
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/[0.08] hover:text-white transition-colors text-left"
              >
                <FolderMinus className="w-3.5 h-3.5 text-neutral-400" />
                <span>Collapse All Folders</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* 4. Modals */}
      {createModal?.isOpen && (
        <CreateFileOrFolderModal
          isOpen={createModal.isOpen}
          type={createModal.type}
          parentDir={createModal.parentDir}
          onClose={() => setCreateModal(null)}
          onSubmit={async (name) => {
            const targetPath =
              createModal.parentDir.replace(/[/\\]$/, '') +
              '/' +
              name.replace(/^[/\\]/, '');
            if (createModal.type === 'file') {
              await createFile(targetPath);
            } else {
              await createDirectory(targetPath);
            }
          }}
        />
      )}

      {renameModal?.isOpen && (
        <RenameModal
          isOpen={renameModal.isOpen}
          currentName={renameModal.node.name}
          isDirectory={renameModal.node.isDirectory}
          onClose={() => setRenameModal(null)}
          onSubmit={async (newName) => {
            await renameItem(renameModal.node.path, newName);
          }}
        />
      )}

      {deleteModal?.isOpen && (
        <DeleteConfirmModal
          isOpen={deleteModal.isOpen}
          itemName={deleteModal.node.name}
          isDirectory={deleteModal.node.isDirectory}
          onClose={() => setDeleteModal(null)}
          onConfirm={async () => {
            await deleteItem(deleteModal.node.path);
          }}
        />
      )}
    </aside>
  );
};

export default RightPanel;
