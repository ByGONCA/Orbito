import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GitBranch,
  GitCommit,
  Clock,
  Sparkles,
  FileCode,
  User,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play
} from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { IconButton } from '../ui/IconButton';
import { SearchField } from '../ui/SearchField';
import { DiffViewer } from './DiffViewer';
import type { ProjectExecution, ExecutionFileChange } from '../../../../shared/review';

export const ChangesTab: React.FC = () => {
  const {
    project,
    executions,
    executionFileChanges,
    selectedDiffFile,
    diffViewMode,
    changesFilter,
    gitStatus,
    loadProjectExecutions,
    loadExecutionFileChanges,
    setSelectedDiffFile,
    setDiffViewMode,
    setChangesFilter,
    setActiveFile,
    syncManualChanges,
    loadGitStatus,
    addReviewComment,
    resolveReviewComment,
    reviewComments,
    addLog
  } = useWorkspaceStore();

  const [expandedExecIds, setExpandedExecIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initial load
  useEffect(() => {
    if (project?.id) {
      loadProjectExecutions();
      syncManualChanges();
      if (project?.path) {
        loadGitStatus(project.path);
      }
    }
  }, [project?.id, project?.path, loadProjectExecutions, syncManualChanges, loadGitStatus]);

  // Expand the first/latest execution by default
  useEffect(() => {
    if (executions.length > 0 && expandedExecIds.size === 0) {
      setExpandedExecIds(new Set([executions[0].id]));
      loadExecutionFileChanges(executions[0].id);
    }
  }, [executions]);

  const handleRefresh = useCallback(async () => {
    if (!project) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadProjectExecutions(),
        syncManualChanges(),
        loadGitStatus(project.path)
      ]);
      addLog('Changes and executions refreshed', 'info');
    } finally {
      setIsRefreshing(false);
    }
  }, [project, loadProjectExecutions, syncManualChanges, loadGitStatus, addLog]);

  const toggleExpand = useCallback(
    (execId: string) => {
      setExpandedExecIds((prev) => {
        const next = new Set(prev);
        if (next.has(execId)) {
          next.delete(execId);
        } else {
          next.add(execId);
          loadExecutionFileChanges(execId);
        }
        return next;
      });
    },
    [loadExecutionFileChanges]
  );

  // Filtered executions
  const filteredExecutions = useMemo(() => {
    return executions.filter((exec) => {
      if (changesFilter === 'ai' && exec.isManual) return false;
      if (changesFilter === 'manual' && !exec.isManual) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPrompt = exec.promptText.toLowerCase().includes(q);
        const matchesId = exec.id.toLowerCase().includes(q);
        const matchesBranch = exec.branch?.toLowerCase().includes(q);
        if (!matchesPrompt && !matchesId && !matchesBranch) return false;
      }
      return true;
    });
  }, [executions, changesFilter, searchQuery]);

  // Current active diff finding
  const activeDiffData = useMemo(() => {
    if (!selectedDiffFile) return null;

    // Check if it's within loaded execution file changes
    for (const changes of Object.values(executionFileChanges)) {
      const match = changes.find((c) => c.filePath === selectedDiffFile);
      if (match) {
        return {
          diff: match.diff,
          previous: match.previousContent,
          current: match.currentContent
        };
      }
    }

    // Fallback to gitStatus.diff
    return {
      diff: gitStatus?.diff || '',
      previous: undefined,
      current: undefined
    };
  }, [selectedDiffFile, executionFileChanges, gitStatus]);

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'failed':
        return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
      case 'running':
        return <Play className="w-3.5 h-3.5 text-sky-400 animate-pulse" />;
      case 'cancelled':
      default:
        return <AlertCircle className="w-3.5 h-3.5 text-neutral-500" />;
    }
  };

  return (
    <div className="h-full flex flex-col font-sans select-none overflow-hidden">
      {/* Top Filter and Search Bar */}
      <div className="p-2 border-b border-white/[0.06] bg-transparent flex flex-col gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="flex-1">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              placeholder="Filter prompt changes..."
              className="w-full text-xs"
            />
          </div>
          <IconButton
            icon={RefreshCw}
            onClick={handleRefresh}
            tooltip="Refresh changes"
            size="sm"
            className={`text-neutral-400 hover:text-white ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto text-[11px] pb-0.5">
          {(['all', 'ai', 'manual'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setChangesFilter(f)}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors capitalize ${
                changesFilter === f
                  ? 'bg-white/[0.10] text-white font-medium'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {f === 'all' ? 'All Changes' : f === 'ai' ? 'AI Prompts' : 'Manual Edits'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area: Master List / Split Diff */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {selectedDiffFile ? (
          /* When a diff file is selected: show diff with close / back option */
          <div className="h-full flex flex-col">
            <div className="h-7 px-2.5 bg-[#18191E] border-b border-white/[0.06] flex items-center justify-between text-xs flex-shrink-0">
              <button
                onClick={() => setSelectedDiffFile(null)}
                className="text-neutral-400 hover:text-white flex items-center gap-1 transition-colors text-[11px]"
              >
                <span>&larr; Back to changes</span>
              </button>
              <span className="font-mono text-neutral-400 text-[10px] truncate max-w-xs">{selectedDiffFile}</span>
            </div>
            <div className="flex-1 min-h-0">
              <DiffViewer
                filePath={selectedDiffFile}
                diff={activeDiffData?.diff || ''}
                previousContent={activeDiffData?.previous}
                currentContent={activeDiffData?.current}
                mode={diffViewMode}
                comments={reviewComments}
                onOpenInEditor={(p) => setActiveFile(p)}
                onAddComment={addReviewComment}
                onResolveComment={resolveReviewComment}
              />
            </div>
          </div>
        ) : (
          /* Execution History List */
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredExecutions.length === 0 ? (
              <div className="p-6 text-center text-neutral-500 text-xs italic">
                {searchQuery ? 'No changes match your search.' : 'No AI prompt executions recorded yet.'}
              </div>
            ) : (
              filteredExecutions.map((exec, index) => {
                const isExpanded = expandedExecIds.has(exec.id);
                const changes = executionFileChanges[exec.id] || [];
                const promptNumber = executions.length - index;

                return (
                  <div
                    key={exec.id}
                    className="group border border-white/[0.05] hover:border-white/[0.10] rounded-lg bg-white/[0.015] transition-all overflow-hidden"
                  >
                    {/* Header: Prompt info */}
                    <div
                      onClick={() => toggleExpand(exec.id)}
                      className="p-2.5 cursor-pointer flex items-start justify-between gap-2 select-none"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="mt-0.5 text-neutral-500">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold text-white">
                              {exec.isManual ? 'Manual Workspace Changes' : `Prompt #${promptNumber}`}
                            </span>
                            {exec.isManual ? (
                              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                                <User className="w-2.5 h-2.5" /> Manual
                              </span>
                            ) : (
                              <span className="text-[10px] text-accent flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5" /> AI
                              </span>
                            )}
                            <div className="ml-1">{getStatusIcon(exec.status)}</div>
                          </div>

                          {/* Prompt text */}
                          <p className="text-[11px] text-neutral-300 mt-1 line-clamp-2 leading-relaxed">
                            {exec.promptText}
                          </p>

                          {/* Metadata row */}
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-neutral-500 font-mono">
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {formatTimestamp(exec.startedAt)}
                            </span>
                            {exec.branch && (
                              <span className="flex items-center gap-1 text-neutral-400">
                                <GitBranch className="w-2.5 h-2.5" />
                                {exec.branch}
                              </span>
                            )}
                            {exec.resultingCommit && (
                              <span className="flex items-center gap-1 text-neutral-400">
                                <GitCommit className="w-2.5 h-2.5" />
                                {exec.resultingCommit.substring(0, 7)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Additions / Deletions count */}
                      <div className="flex flex-col items-end flex-shrink-0 text-[10px] font-mono">
                        <span className="text-neutral-400">
                          {exec.filesChangedCount} {exec.filesChangedCount === 1 ? 'file' : 'files'}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-emerald-400 font-semibold">+{exec.additions}</span>
                          <span className="text-rose-400 font-semibold">-{exec.deletions}</span>
                        </div>
                      </div>
                    </div>

                    {/* Collapsible changed files list */}
                    {isExpanded && (
                      <div className="border-t border-white/[0.04] bg-black/20 p-2 space-y-1">
                        {changes.length === 0 ? (
                          <div className="py-2 text-center text-neutral-500 text-[10px] italic">
                            Loading file changes...
                          </div>
                        ) : (
                          changes.map((file) => (
                            <div
                              key={file.id}
                              onClick={() => {
                                setSelectedExecutionId(exec.id);
                                setSelectedDiffFile(file.filePath);
                              }}
                              className="px-2 py-1.5 rounded cursor-pointer hover:bg-white/[0.05] text-neutral-300 hover:text-white flex items-center justify-between text-xs transition-colors group/item"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <FileCode className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                                <span className="font-mono text-[11px] truncate">{file.filePath}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] font-mono flex-shrink-0 ml-2">
                                <span className="text-emerald-400 font-semibold">+{file.additions}</span>
                                <span className="text-rose-400 font-semibold">-{file.deletions}</span>
                                <span
                                  className={`font-semibold ml-1 ${
                                    file.changeType === 'modified'
                                      ? 'text-amber-400'
                                      : file.changeType === 'added'
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {file.changeType === 'modified'
                                    ? 'M'
                                    : file.changeType === 'added'
                                    ? 'A'
                                    : 'D'}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
