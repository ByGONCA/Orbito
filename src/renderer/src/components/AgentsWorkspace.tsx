import React, { useState, useEffect } from 'react';
import {
  Bot,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  GitBranch,
  Shield,
  Layers,
  Check,
  X,
  FileCode,
  Terminal,
  ChevronRight,
  ArrowRight,
  Cpu,
  Eye,
  Ban,
  Activity,
  GitCommit
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import type {
  OrchestrationRecord,
  OrchestrationTask,
  ApprovalRequest,
  ExecutionMode,
  SpecialistRole
} from '../../../shared/agents';

const ROLE_COLORS: Record<SpecialistRole, { bg: string; text: string; border: string }> = {
  coordinator: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  architect: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  backend: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  frontend: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  testing: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  security: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  documentation: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  reviewer: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30' }
};

export const AgentsWorkspace: React.FC = () => {
  const {
    project,
    uiMode,
    activeProvider,
    activeOrchestration,
    setActiveOrchestration,
    orchestrationsHistory,
    setOrchestrationsHistory,
    pendingApprovals,
    setPendingApprovals,
    addLog
  } = useWorkspaceStore();

  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<ExecutionMode>('supervised');
  const [selectedTask, setSelectedTask] = useState<OrchestrationTask | null>(null);
  const [activeApproval, setActiveApproval] = useState<ApprovalRequest | null>(null);
  const [rejectionFeedback, setRejectionFeedback] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [taskDiff, setTaskDiff] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dag' | 'monitor' | 'approvals' | 'history'>('dag');

  const refreshData = async () => {
    if (!project) return;
    try {
      const list = await window.api.listOrchestrations({ projectId: project.id });
      setOrchestrationsHistory(list);

      const approvals = await window.api.getPendingApprovals();
      setPendingApprovals(approvals);

      if (activeOrchestration) {
        const updated = await window.api.getOrchestration({ orchestrationId: activeOrchestration.id });
        if (updated) {
          setActiveOrchestration(updated);
          if (selectedTask) {
            const found = updated.tasks.find((t) => t.id === selectedTask.id);
            if (found) setSelectedTask(found);
          }
        }
      } else if (list.length > 0) {
        setActiveOrchestration(list[0]);
      }
    } catch (err: any) {
      console.warn('Refresh error:', err);
    }
  };

  useEffect(() => {
    refreshData();

    // Listen to real-time events from main process
    const cleanup = window.api.onOrchestrationEvent((event) => {
      refreshData();
      addLog(`[Agent Event] ${event.type}: ${event.data?.title || event.data?.error || ''}`, 'info');
    });

    return () => {
      cleanup();
    };
  }, [project?.id, activeOrchestration?.id]);

  const handleStartOrchestration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !project) return;
    setIsStarting(true);
    try {
      addLog(`Coordinator initializing multi-agent plan for: "${prompt}"`, 'info');
      const orch = await window.api.startOrchestration({
        projectId: project.id,
        projectPath: project.path,
        userGoal: prompt,
        mode,
        provider: activeProvider
      });

      setActiveOrchestration(orch);
      setSelectedTask(orch.tasks[0] || null);
      setPrompt('');
      setActiveTab('dag');
      await refreshData();
    } catch (err: any) {
      addLog(`Failed to start orchestration: ${err.message}`, 'error');
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancelOrchestration = async () => {
    if (!activeOrchestration) return;
    try {
      await window.api.cancelOrchestration({ orchestrationId: activeOrchestration.id });
      addLog(`Orchestration cancelled: ${activeOrchestration.id}`, 'warn');
      await refreshData();
    } catch (err: any) {
      addLog(`Cancel error: ${err.message}`, 'error');
    }
  };

  const handleResolveApproval = async (decision: 'approved' | 'rejected') => {
    if (!activeApproval) return;
    try {
      await window.api.resolveApproval({
        approvalId: activeApproval.id,
        decision,
        rejectionReason: decision === 'rejected' ? rejectionFeedback : undefined
      });
      addLog(`Approval request ${decision}: ${activeApproval.title}`, decision === 'approved' ? 'info' : 'warn');
      setActiveApproval(null);
      setRejectionFeedback('');
      await refreshData();
    } catch (err: any) {
      addLog(`Approval error: ${err.message}`, 'error');
    }
  };

  const handleRetryTask = async (taskId: string) => {
    if (!activeOrchestration) return;
    try {
      await window.api.retryOrchestrationTask({
        orchestrationId: activeOrchestration.id,
        taskId
      });
      addLog(`Task queued for retry: ${taskId}`, 'info');
      await refreshData();
    } catch (err: any) {
      addLog(`Retry error: ${err.message}`, 'error');
    }
  };

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

  const completedCount = activeOrchestration?.tasks.filter((t) => t.status === 'completed').length || 0;
  const totalCount = activeOrchestration?.tasks.length || 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Top Header Bar */}
      <div className="border-b border-border bg-card/60 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Multi-Agent Orchestrator
              {activeOrchestration && (
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full capitalize bg-secondary text-foreground">
                  {activeOrchestration.status}
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              Autonomous DAG coordination with isolated Git Worktrees & Human-in-the-Loop review
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-secondary/60 p-0.5 rounded-lg border border-border text-xs">
          <button
            onClick={() => setActiveTab('dag')}
            className={`px-3 py-1 font-medium rounded transition-colors ${
              activeTab === 'dag' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Visual DAG
          </button>
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-3 py-1 font-medium rounded transition-colors ${
              activeTab === 'monitor' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Agent Monitor
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-3 py-1 font-medium rounded transition-colors relative ${
              activeTab === 'approvals' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Approvals
            {pendingApprovals.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-amber-500 text-black text-[10px] font-bold rounded-full">
                {pendingApprovals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1 font-medium rounded transition-colors ${
              activeTab === 'history' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {/* Goal Formulation Bar */}
      <div className="p-3 border-b border-border bg-card/20">
        <form onSubmit={handleStartOrchestration} className="flex items-center gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isStarting || !project}
            placeholder={
              project
                ? "Describe a multi-step task (e.g. 'Build an authentication API with tests and security review')..."
                : "Please open a project workspace first..."
            }
            className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary font-sans"
          />

          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ExecutionMode)}
            className="bg-secondary/70 border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground capitalize"
          >
            <option value="supervised">Supervised (Approve Merges)</option>
            <option value="autonomous">Autonomous (Auto-merge)</option>
            <option value="manual">Manual (Step-by-step)</option>
          </select>

          <button
            type="submit"
            disabled={isStarting || !project || !prompt.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isStarting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Plan & Coordinate</span>
          </button>

          {activeOrchestration?.status === 'running' && (
            <button
              type="button"
              onClick={handleCancelOrchestration}
              className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
        </form>
      </div>

      {/* Active Orchestration Status Banner */}
      {activeOrchestration && (
        <div className="bg-secondary/30 px-5 py-2 border-b border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-foreground truncate max-w-md">
              Goal: {activeOrchestration.userGoal}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground capitalize">Mode: {activeOrchestration.mode}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-[11px]">{progressPercent}% Completed</span>
              <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden border border-border">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {completedCount} of {totalCount} tasks
            </span>
          </div>
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Active View (DAG, Approvals, History) */}
        <div className="flex-1 overflow-auto p-5">
          {/* TAB 1: VISUAL DAG */}
          {activeTab === 'dag' && (
            <div className="space-y-4">
              {!activeOrchestration || activeOrchestration.tasks.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-xl">
                  <Bot className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <h3 className="font-semibold text-sm text-foreground">No Active Orchestration</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    Describe a task above to have the Coordinator Agent decompose it into a dependency graph of specialized agents.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeOrchestration.tasks.map((task, idx) => {
                    const color = ROLE_COLORS[task.role] || ROLE_COLORS.backend;
                    const isSelected = selectedTask?.id === task.id;

                    return (
                      <div
                        key={task.id}
                        onClick={() => handleSelectTask(task)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                          isSelected
                            ? 'border-primary ring-1 ring-primary bg-card shadow-sm'
                            : 'border-border bg-card/60 hover:border-primary/50'
                        }`}
                      >
                        <div>
                          {/* Card Top: Index, Role Pill, Status */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${color.bg} ${color.text} ${color.border}`}>
                              {task.role}
                            </span>

                            <div className="flex items-center gap-1.5 text-xs">
                              {task.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                              {task.status === 'running' && <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
                              {task.status === 'waiting_approval' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />}
                              {task.status === 'reviewing' && <Eye className="w-3.5 h-3.5 text-fuchsia-400" />}
                              {task.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                              {task.status === 'blocked' && <Ban className="w-3.5 h-3.5 text-muted-foreground" />}
                              {task.status === 'ready' && <Activity className="w-3.5 h-3.5 text-primary" />}
                              {task.status === 'pending' && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                              <span className="capitalize text-[11px] text-muted-foreground">{task.status.replace('_', ' ')}</span>
                            </div>
                          </div>

                          <h4 className="font-semibold text-xs text-foreground mb-1 line-clamp-1">{task.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{task.description}</p>
                        </div>

                        {/* Card Bottom: Worktree & Dependencies */}
                        <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            {task.isModifying ? (
                              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                                <GitBranch className="w-3 h-3" /> Worktree Isolated
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Read-Only Analysis</span>
                            )}
                          </div>

                          {task.dependencies.length > 0 && (
                            <span className="bg-secondary px-1.5 py-0.5 rounded">
                              Deps: {task.dependencies.length}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: APPROVALS */}
          {activeTab === 'approvals' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                Human-in-the-Loop Approval Center ({pendingApprovals.length})
              </h3>

              {pendingApprovals.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  No pending approvals. In Supervised Mode, modifying tasks pause here for user diff review before merging.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingApprovals.map((appr) => (
                    <div key={appr.id} className="p-4 rounded-xl border border-border bg-card space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-xs text-foreground">{appr.title}</div>
                          <div className="text-xs text-muted-foreground">{appr.description}</div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
                          {appr.type.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Changed files list */}
                      {appr.changedFiles && appr.changedFiles.length > 0 && (
                        <div className="text-xs bg-secondary/40 p-2.5 rounded-lg border border-border">
                          <div className="font-medium text-foreground mb-1">Modified Files:</div>
                          <ul className="list-disc pl-4 text-muted-foreground space-y-0.5 font-mono text-[11px]">
                            {appr.changedFiles.map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Diff Preview */}
                      {appr.diff && (
                        <div className="bg-background border border-border rounded-lg p-3 max-h-48 overflow-y-auto text-xs font-mono text-muted-foreground whitespace-pre">
                          {appr.diff}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                        <button
                          onClick={() => {
                            setActiveApproval(appr);
                            const reason = window.prompt('Enter rejection reason for agent remediation:');
                            if (reason) {
                              setRejectionFeedback(reason);
                              handleResolveApproval('rejected');
                            }
                          }}
                          className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-medium rounded-lg transition-colors"
                        >
                          Reject with Feedback
                        </button>

                        <button
                          onClick={() => {
                            setActiveApproval(appr);
                            handleResolveApproval('approved');
                          }}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Merge to Main</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EXECUTION HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-foreground">Orchestrations History</h3>
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-[11px]">
                    <tr>
                      <th className="px-4 py-2">ID</th>
                      <th className="px-4 py-2">Goal</th>
                      <th className="px-4 py-2">Mode</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Tasks</th>
                      <th className="px-4 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {orchestrationsHistory.map((orch) => (
                      <tr key={orch.id} className="hover:bg-secondary/20">
                        <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">{orch.id.slice(0, 14)}</td>
                        <td className="px-4 py-2 font-medium text-foreground truncate max-w-xs">{orch.userGoal}</td>
                        <td className="px-4 py-2 capitalize">{orch.mode}</td>
                        <td className="px-4 py-2 capitalize">{orch.status}</td>
                        <td className="px-4 py-2">{orch.tasks.length}</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => {
                              setActiveOrchestration(orch);
                              setSelectedTask(orch.tasks[0] || null);
                              setActiveTab('dag');
                            }}
                            className="text-primary hover:underline font-medium text-[11px]"
                          >
                            Inspect DAG
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Agent Monitor Drawer */}
        <div className="w-80 border-l border-border bg-card/40 flex flex-col h-full overflow-hidden">
          <div className="p-3 border-b border-border bg-card/60 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-primary" />
              Agent Task Inspector
            </h3>
            {selectedTask && (
              <span className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                {selectedTask.id}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {selectedTask ? (
              <>
                <div>
                  <div className="font-semibold text-foreground text-sm mb-1">{selectedTask.title}</div>
                  <div className="text-muted-foreground leading-relaxed">{selectedTask.description}</div>
                </div>

                <div className="p-3 bg-secondary/40 rounded-lg border border-border space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assigned Role:</span>
                    <span className="font-semibold capitalize text-foreground">{selectedTask.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CLI Provider:</span>
                    <span className="font-semibold capitalize text-foreground">{selectedTask.assignedProvider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-semibold capitalize text-foreground">{selectedTask.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Worktree:</span>
                    <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                      {selectedTask.branchName || 'main (shared)'}
                    </span>
                  </div>
                </div>

                {selectedTask.acceptanceCriteria.length > 0 && (
                  <div>
                    <div className="font-semibold text-foreground mb-1">Acceptance Criteria:</div>
                    <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                      {selectedTask.acceptanceCriteria.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedTask.reviewFeedback && (
                  <div className="p-2.5 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-lg text-fuchsia-300">
                    <div className="font-semibold flex items-center gap-1 mb-1">
                      <Eye className="w-3 h-3" /> Reviewer Feedback:
                    </div>
                    <div className="text-[11px] whitespace-pre-wrap">{selectedTask.reviewFeedback}</div>
                  </div>
                )}

                {selectedTask.errorMessage && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300">
                    <div className="font-semibold mb-0.5">Error:</div>
                    <div className="text-[11px]">{selectedTask.errorMessage}</div>
                  </div>
                )}

                {selectedTask.status === 'failed' && (
                  <button
                    onClick={() => handleRetryTask(selectedTask.id)}
                    className="w-full py-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-primary" />
                    <span>Retry Task</span>
                  </button>
                )}

                {taskDiff && (
                  <div>
                    <div className="font-semibold text-foreground mb-1 flex items-center gap-1">
                      <FileCode className="w-3.5 h-3.5 text-primary" /> Worktree Git Diff:
                    </div>
                    <div className="p-2.5 bg-background border border-border rounded-lg text-[10px] font-mono text-muted-foreground max-h-48 overflow-y-auto whitespace-pre">
                      {taskDiff}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-muted-foreground text-center py-8 italic">
                Select a task from the Visual DAG to inspect specialist details, review feedback, and git diffs.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
