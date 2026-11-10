import React, { useState, useEffect } from 'react';
import {
  Layers,
  GitBranch,
  ShieldAlert,
  Check,
  X,
  RefreshCw,
  Clock,
  Terminal
} from 'lucide-react';
import { SettingSection } from '../common/SettingSection';
import { SettingRow } from '../common/SettingRow';
import { Button } from '../../ui/Button';
import { useWorkspaceStore } from '../../../stores/workspace.store';
import type { ApprovalRequest } from '../../../../../shared/agents';

export const OrchestrationPage: React.FC = () => {
  const addLog = useWorkspaceStore((state) => state.addLog);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadApprovals = async () => {
    setIsLoading(true);
    try {
      const pending = await window.api.getPendingApprovals();
      setApprovals(pending || []);
    } catch (err: any) {
      addLog(`Failed to load pending approvals: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleResolve = async (approvalId: string, decision: 'approved' | 'rejected') => {
    setResolvingId(approvalId);
    try {
      await window.api.resolveApproval({ approvalId, decision });
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
      addLog(`Task approval ${approvalId} resolved as [${decision.toUpperCase()}].`, 'info');
    } catch (err: any) {
      addLog(`Failed to resolve approval: ${err.message}`, 'error');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
          Orchestration
        </h2>
      </div>

      {/* Section 1: Architecture Pipeline */}
      <SettingSection
        title="Execution Architecture"
        description="Orbito breaks complex user prompts into directed acyclic graphs (DAGs) and executes subtasks across isolated Git worktrees."
      >
        <div className="space-y-3 pt-1">
          <SettingRow
            title="Coordinator Agent (DAG Planner)"
            description="Decomposes high-level instructions into atomic subtasks with dependency tracking."
          >
            <span className="text-xs font-mono text-[#A4A8AF]">Active</span>
          </SettingRow>

          <SettingRow
            title="Worktree Concurrency Cap"
            description="Parallel agent processes running simultaneously across dedicated branch worktrees."
          >
            <span className="text-xs font-mono text-[#ECEDEF]">3 concurrent tasks</span>
          </SettingRow>

          <SettingRow
            title="Filesystem Isolation"
            description="Agents modify isolated worktree copies to prevent collisions before final merge."
          >
            <span className="text-xs font-mono text-emerald-400">Git Worktree Sandbox</span>
          </SettingRow>
        </div>
      </SettingSection>

      {/* Section 2: Pending Approvals Queue */}
      <SettingSection
        title="Pending Human Approvals"
        description="Tasks requiring manual human confirmation before destructive actions or file commits."
        action={
          <Button
            variant="ghost"
            size="sm"
            disabled={isLoading}
            onClick={loadApprovals}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      >
        <div className="space-y-2 pt-1">
          {approvals.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#747982] font-mono">
              No tasks currently awaiting approval.
            </div>
          ) : (
            approvals.map((req) => (
              <div
                key={req.id}
                className="py-3 px-3.5 rounded-lg bg-white/[0.02] border-0 flex items-start justify-between gap-4"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#ECEDEF]">
                      {req.title}
                    </span>
                    <span className="text-[10px] font-mono text-amber-400 uppercase px-1.5 py-0.5 rounded bg-amber-400/10 border-0">
                      {req.type}
                    </span>
                  </div>
                  <p className="text-xs text-[#747982] leading-relaxed">
                    {req.description}
                  </p>
                  {req.command && (
                    <div className="font-mono text-[11px] text-[#A4A8AF] bg-black/40 px-2 py-1 rounded border-0 mt-1.5 flex items-center gap-1.5">
                      <Terminal className="w-3 h-3 text-[#747982]" />
                      <span className="truncate">{req.command}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={resolvingId === req.id}
                    onClick={() => handleResolve(req.id, 'rejected')}
                    className="text-rose-400 hover:text-rose-300"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    <span>Reject</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={resolvingId === req.id}
                    onClick={() => handleResolve(req.id, 'approved')}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    <span>Approve</span>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SettingSection>
    </div>
  );
};
