import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  FileCode,
  GitBranch,
  RefreshCw,
  Eye,
  Check,
  X,
  Bot,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { OrchestrationTask, ApprovalRequest, SpecialistRole } from '../../../shared/agents';

const ROLE_COLORS: Record<SpecialistRole, { bg: string; text: string; border: string }> = {
  coordinator: { bg: 'bg-surface-elevated', text: 'text-foreground', border: 'border-border' },
  architect: { bg: 'bg-surface-elevated', text: 'text-foreground', border: 'border-border' },
  backend: { bg: 'bg-surface-elevated', text: 'text-foreground', border: 'border-border' },
  frontend: { bg: 'bg-surface-elevated', text: 'text-foreground', border: 'border-border' },
  testing: { bg: 'bg-surface-elevated', text: 'text-foreground', border: 'border-border' },
  security: { bg: 'bg-surface-elevated', text: 'text-foreground', border: 'border-border' },
  documentation: { bg: 'bg-surface-elevated', text: 'text-foreground', border: 'border-border' },
  reviewer: { bg: 'bg-surface-elevated', text: 'text-foreground', border: 'border-border' }
};

export const TasksWorkspace: React.FC = () => {
  const {
    project,
    activeOrchestration,
    orchestrationsHistory,
    pendingApprovals,
    setPendingApprovals,
    setActiveOrchestration,
    addLog
  } = useWorkspaceStore();

  const [selectedTask, setSelectedTask] = useState<OrchestrationTask | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [taskDiff, setTaskDiff] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const refreshTasks = async () => {
    try {
      const approvals = await window.api.getPendingApprovals();
      setPendingApprovals(approvals);
      if (activeOrchestration) {
        const orch = await window.api.getOrchestration({ orchestrationId: activeOrchestration.id });
        if (orch) setActiveOrchestration(orch);
      }
    } catch (err: any) {
      addLog(`Failed to refresh tasks: ${err.message}`, 'error');
    }
  };

  useEffect(() => {
    refreshTasks();
    const timer = setInterval(refreshTasks, 4000);
    return () => clearInterval(timer);
  }, [activeOrchestration]);

  const handleSelectTask = async (task: OrchestrationTask) => {
    setSelectedTask(task);
    if (task.worktreePath) {
      try {
        const diff = await window.api.getWorktreeDiff({ taskId: task.id });
        setTaskDiff(diff || null);
      } catch {
        setTaskDiff(null);
      }
    } else {
      setTaskDiff(null);
    }
  };

  const handleResolveApproval = async (approvalId: string, decision: 'approved' | 'rejected', reason?: string) => {
    try {
      await window.api.resolveApproval({
        approvalId,
        decision,
        rejectionReason: reason
      });
      addLog(`Approval gate: Task ${decision.toUpperCase()}`, decision === 'approved' ? 'info' : 'warn');
      setSelectedApproval(null);
      setRejectionModalOpen(false);
      setRejectionReason('');
      refreshTasks();
    } catch (err: any) {
      addLog(`Approval error: ${err.message}`, 'error');
    }
  };

  // Collect tasks from active orchestration or history
  const allTasks: OrchestrationTask[] = activeOrchestration?.tasks || [];

  const filteredTasks = allTasks.filter((t) => {
    if (statusFilter === 'all') return true;
    return t.status === statusFilter;
  });

  return (
    <div className="h-full flex flex-col bg-transparent select-none overflow-hidden">
      {/* Top Header */}
      <div className="h-11 border-b border-border bg-surface/40 backdrop-blur-glass px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-foreground" />
            <span className="text-xs font-semibold text-foreground tracking-tight">Task Orchestration</span>
          </div>
          <span className="text-[10px] font-mono bg-surface-elevated text-foreground-secondary px-2 py-0.5 rounded border border-border">
            {allTasks.length} tasks recorded
          </span>
          {pendingApprovals.length > 0 && (
            <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {pendingApprovals.length} Awaiting Human Review
            </span>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-background-secondary p-0.5 rounded border border-border">
            {(['all', 'pending', 'running', 'awaiting_approval', 'completed', 'failed'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                  statusFilter === st
                    ? 'bg-surface-elevated text-foreground border border-border'
                    : 'text-foreground-secondary hover:text-foreground'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <button
            onClick={refreshTasks}
            className="p-1 text-foreground-muted hover:text-foreground hover:bg-surface-elevated rounded border border-border"
            title="Refresh Tasks"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Split Body: Task List on Left, Inspector / Diff on Right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Task Table / Queue */}
        <div className="w-1/2 border-r border-border flex flex-col overflow-hidden bg-background">
          {/* Pending Approvals Section if any */}
          {pendingApprovals.length > 0 && (
            <div className="p-3 bg-amber-500/5 border-b border-border space-y-2">
              <div className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Approval Gate Required</span>
              </div>
              <div className="space-y-2">
                {pendingApprovals.map((appr) => (
                  <div
                    key={appr.id}
                    className="p-2.5 bg-surface border border-amber-500/30 rounded flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-foreground block">{appr.title}</span>
                      <span className="text-[10px] font-mono text-foreground-muted">
                        Task #{appr.taskId} • Type: {appr.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedApproval(appr);
                          setRejectionModalOpen(true);
                        }}
                        className="px-2 py-1 bg-surface-elevated hover:bg-surface-hover text-rose-400 rounded border border-border text-[11px] flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        <span>Reject</span>
                      </button>
                      <button
                        onClick={() => handleResolveApproval(appr.id, 'approved')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium flex items-center gap-1 shadow-xs"
                      >
                        <Check className="w-3 h-3" />
                        <span>Approve</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Tasks List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-foreground-muted space-y-2">
                <Bot className="w-6 h-6 mx-auto text-foreground-muted" />
                <p>No orchestration tasks found for the current filter.</p>
                <p className="text-[11px]">Tasks will appear here when an agent workflow is launched.</p>
              </div>
            ) : (
              filteredTasks.map((t) => {
                const isSelected = selectedTask?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTask(t)}
                    className={`p-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-surface-elevated' : 'hover:bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {t.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                        {t.status === 'running' && <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0" />}
                        {t.status === 'pending' && <Clock className="w-3.5 h-3.5 text-foreground-muted flex-shrink-0" />}
                        {t.status === 'waiting_approval' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                        {t.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />}
                        <span className="text-xs font-medium text-foreground truncate max-w-sm">{t.title}</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface border border-border text-foreground-secondary">
                        {t.role}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-foreground-muted">
                      <span>Status: <strong className="text-foreground-secondary capitalize">{t.status.replace('_', ' ')}</strong></span>
                      {t.branchName && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <GitBranch className="w-2.5 h-2.5" />
                          <span>{t.branchName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Task Details & Worktree Diff */}
        <div className="w-1/2 flex flex-col overflow-hidden bg-background-secondary">
          {selectedTask ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="p-3 border-b border-border bg-surface flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-foreground">{selectedTask.title}</h3>
                  <span className="text-[10px] font-mono text-foreground-muted">
                    Task ID: {selectedTask.id} • Assigned Role: {selectedTask.role}
                  </span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border capitalize ${
                  selectedTask.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                  selectedTask.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                  selectedTask.status === 'waiting_approval' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                  'bg-surface-elevated text-foreground-secondary border-border'
                }`}>
                  {selectedTask.status.replace('_', ' ')}
                </span>
              </div>

              {/* Task Instructions / Spec */}
              <div className="p-3 border-b border-border bg-surface/50 text-xs text-foreground font-mono space-y-1">
                <span className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider block">
                  Task Specification & Prompt
                </span>
                <p className="leading-relaxed whitespace-pre-wrap text-[11px] text-foreground-secondary">
                  {selectedTask.description || 'No detailed specification provided.'}
                </p>
              </div>

              {/* Diff Viewer */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="h-7 px-3 border-b border-border bg-surface flex items-center justify-between text-[10px] text-foreground-secondary font-mono">
                  <span className="flex items-center gap-1.5">
                    <FileCode className="w-3 h-3" />
                    <span>Isolated Git Worktree Diff</span>
                  </span>
                  <span>{taskDiff ? `${taskDiff.split('\n').length} lines` : 'No changes recorded'}</span>
                </div>

                <div className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed bg-background select-text">
                  {taskDiff ? (
                    taskDiff.split('\n').map((line, idx) => {
                      const isAdded = line.startsWith('+') && !line.startsWith('+++');
                      const isRemoved = line.startsWith('-') && !line.startsWith('---');
                      const isHeader = line.startsWith('@@') || line.startsWith('diff --git');
                      return (
                        <div
                          key={idx}
                          className={`whitespace-pre ${
                            isAdded
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : isRemoved
                              ? 'bg-rose-500/10 text-rose-400'
                              : isHeader
                              ? 'text-cyan-400 font-bold'
                              : 'text-foreground-secondary'
                          }`}
                        >
                          {line || ' '}
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center text-foreground-muted text-xs">
                      No git worktree modifications for this task.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-foreground-muted p-6 text-center">
              Select a task from the list on the left to inspect its instructions, role assignment, and worktree diff.
            </div>
          )}
        </div>
      </div>

      {/* Rejection Modal */}
      {rejectionModalOpen && selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface border border-border rounded max-w-md w-full p-4 space-y-3 shadow-xl">
            <h3 className="text-xs font-semibold text-foreground">Remediation Feedback</h3>
            <p className="text-[11px] text-foreground-secondary">
              Provide feedback for the approval request ({selectedApproval.type}) before agent remediation.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Fix edge case in authentication handler..."
              rows={3}
              className="w-full bg-background border border-border rounded p-2 text-xs font-mono text-foreground focus:outline-none focus:border-foreground"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectionModalOpen(false)}
                className="px-3 py-1 text-xs text-foreground-secondary hover:text-foreground bg-surface-elevated rounded border border-border"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolveApproval(selectedApproval.id, 'rejected', rejectionReason)}
                className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded font-medium"
              >
                Reject Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
