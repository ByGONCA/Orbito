import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Sparkles,
  GitPullRequest,
  ExternalLink,
  MessageSquare,
  FileCode,
  ShieldAlert,
  Zap,
  Bug,
  Code2,
  RefreshCw,
  Send,
  Check,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { DiffViewer } from './DiffViewer';
import type { ReviewStatus, AIFinding } from '../../../../shared/review';

export const ReviewTab: React.FC = () => {
  const {
    project,
    codeReview,
    reviewComments,
    aiReviewFindings,
    projectGitDetails,
    isAIEvaluationRunning,
    gitStatus,
    loadCodeReview,
    updateReviewDecision,
    markFileReviewStatus,
    addReviewComment,
    resolveReviewComment,
    runAICodeReview,
    loadProjectGitDetails,
    loadGitStatus,
    setActiveFile,
    addLog
  } = useWorkspaceStore();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [requestChangesModalOpen, setRequestChangesModalOpen] = useState(false);
  const [requestChangesSummary, setRequestChangesSummary] = useState('');
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [newGeneralComment, setNewGeneralComment] = useState('');
  const [isAddingGeneralComment, setIsAddingGeneralComment] = useState(false);

  // Initial load
  useEffect(() => {
    if (project?.id) {
      loadCodeReview();
      loadProjectGitDetails();
      if (project?.path) {
        loadGitStatus(project.path);
      }
    }
  }, [project?.id, project?.path, loadCodeReview, loadProjectGitDetails, loadGitStatus]);

  const handleApprove = async () => {
    await updateReviewDecision('approved', 'Approved all changes.');
  };

  const handleMarkAsReviewed = async () => {
    await updateReviewDecision('reviewed', 'Marked as reviewed.');
  };

  const handleConfirmRequestChanges = async () => {
    if (!requestChangesSummary.trim()) return;
    await updateReviewDecision('changes_requested', requestChangesSummary.trim());
    setRequestChangesSummary('');
    setRequestChangesModalOpen(false);
  };

  const toggleFindingExpand = (id: string) => {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddGeneralComment = async () => {
    if (!newGeneralComment.trim() || !project?.id) return;
    setIsAddingGeneralComment(true);
    try {
      await addReviewComment(selectedFile || 'Workspace', newGeneralComment.trim());
      setNewGeneralComment('');
    } finally {
      setIsAddingGeneralComment(false);
    }
  };

  // Severity badges & icons
  const getSeverityBadge = (severity: AIFinding['severity']) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Critical
          </span>
        );
      case 'warning':
        return (
          <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Warning
          </span>
        );
      case 'suggestion':
      default:
        return (
          <span className="text-[10px] text-sky-400 font-semibold flex items-center gap-1">
            <Zap className="w-3 h-3" /> Suggestion
          </span>
        );
    }
  };

  // Status representation
  const renderStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="flex items-center gap-1 text-emerald-400 font-medium text-xs">
            <CheckCircle className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'changes_requested':
        return (
          <span className="flex items-center gap-1 text-rose-400 font-medium text-xs">
            <XCircle className="w-3.5 h-3.5" /> Changes Requested
          </span>
        );
      case 'issues_found':
        return (
          <span className="flex items-center gap-1 text-amber-400 font-medium text-xs">
            <AlertTriangle className="w-3.5 h-3.5" /> Issues Found
          </span>
        );
      case 'reviewed':
        return (
          <span className="flex items-center gap-1 text-sky-400 font-medium text-xs">
            <Check className="w-3.5 h-3.5" /> Reviewed
          </span>
        );
      case 'not_reviewed':
      default:
        return (
          <span className="flex items-center gap-1 text-neutral-400 font-medium text-xs">
            <HelpCircle className="w-3.5 h-3.5" /> Pending Review
          </span>
        );
    }
  };

  const changedFiles = useMemo(() => {
    return gitStatus?.changedFiles || [];
  }, [gitStatus]);

  const totalAdditions = useMemo(() => {
    if (!gitStatus?.diff) return 0;
    return (gitStatus.diff.match(/^\+[^+]/gm) || []).length;
  }, [gitStatus?.diff]);

  const totalDeletions = useMemo(() => {
    if (!gitStatus?.diff) return 0;
    return (gitStatus.diff.match(/^-[^-]/gm) || []).length;
  }, [gitStatus?.diff]);

  return (
    <div className="h-full flex flex-col font-sans select-none overflow-hidden text-xs">
      {/* Top Review Status & Actions Bar */}
      <div className="p-3 border-b border-white/[0.06] bg-transparent flex flex-col gap-2.5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-xs">Code Review</span>
            {renderStatusBadge(codeReview?.status || 'not_reviewed')}
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <span className="text-emerald-400 font-semibold">+{totalAdditions}</span>
            <span className="text-rose-400 font-semibold">-{totalDeletions}</span>
          </div>
        </div>

        {/* GitHub PR Integration Banner if detected */}
        {projectGitDetails?.pullRequest && (
          <div className="flex items-center justify-between p-2 rounded bg-sky-500/[0.08] border border-sky-500/20 text-sky-200">
            <div className="flex items-center gap-2 truncate">
              <GitPullRequest className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate font-medium">
                PR #{projectGitDetails.pullRequest.number}: {projectGitDetails.pullRequest.title}
              </span>
            </div>
            <a
              href={projectGitDetails.pullRequest.url}
              target="_blank"
              rel="noreferrer"
              className="text-sky-300 hover:text-white flex items-center gap-1 text-[10px] ml-2 flex-shrink-0"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Review Action Buttons */}
        <div className="flex items-center gap-1.5 pt-1">
          <Button
            variant="primary"
            size="sm"
            onClick={handleApprove}
            className="flex-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1"
          >
            <CheckCircle className="w-3 h-3" />
            <span>Approve</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRequestChangesModalOpen(true)}
            className="flex-1 text-[11px] hover:bg-rose-500/20 hover:text-rose-300 flex items-center justify-center gap-1"
          >
            <XCircle className="w-3 h-3" />
            <span>Request Changes</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAsReviewed}
            className="text-[11px] text-neutral-400 hover:text-white"
          >
            <span>Mark Reviewed</span>
          </Button>
        </div>

        {/* AI Assisted Review Trigger */}
        <div className="pt-1">
          <button
            onClick={() => runAICodeReview()}
            disabled={isAIEvaluationRunning}
            className="w-full py-1.5 px-3 rounded bg-accent/15 hover:bg-accent/25 border border-accent/30 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 text-accent ${isAIEvaluationRunning ? 'animate-spin' : ''}`} />
            <span>{isAIEvaluationRunning ? 'Analyzing diff with AI...' : 'Run AI Code Review'}</span>
          </button>
        </div>
      </div>

      {/* Main Content: Files awaiting review & AI Findings */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-2.5 space-y-3">
        {selectedFile ? (
          /* Single file diff inspector inside review */
          <div className="h-full flex flex-col">
            <div className="h-7 px-2.5 bg-[#18191E] border-b border-white/[0.06] flex items-center justify-between text-xs flex-shrink-0">
              <button
                onClick={() => setSelectedFile(null)}
                className="text-neutral-400 hover:text-white flex items-center gap-1 transition-colors text-[11px]"
              >
                <span>&larr; Back to review summary</span>
              </button>
              <span className="font-mono text-neutral-400 text-[10px] truncate max-w-xs">{selectedFile}</span>
            </div>
            <div className="flex-1 min-h-0">
              <DiffViewer
                filePath={selectedFile}
                diff={gitStatus?.diff || ''}
                comments={reviewComments}
                onOpenInEditor={(p) => setActiveFile(p)}
                onAddComment={addReviewComment}
                onResolveComment={resolveReviewComment}
              />
            </div>
          </div>
        ) : (
          <>
            {/* AI Review Findings Section */}
            {aiReviewFindings.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    <span>AI Review Analysis ({aiReviewFindings.length})</span>
                  </span>
                </div>
                <div className="space-y-1.5">
                  {aiReviewFindings.map((finding) => {
                    const isExpanded = expandedFindings.has(finding.id);
                    return (
                      <div
                        key={finding.id}
                        className="p-2 rounded border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                      >
                        <div
                          onClick={() => toggleFindingExpand(finding.id)}
                          className="flex items-start justify-between cursor-pointer gap-2"
                        >
                          <div className="flex items-start gap-1.5 min-w-0">
                            <span className="mt-0.5 text-neutral-500">
                              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {getSeverityBadge(finding.severity)}
                                <span className="font-semibold text-white truncate text-[11px]">
                                  {finding.title}
                                </span>
                              </div>
                              <div className="font-mono text-[10px] text-neutral-400 mt-0.5">
                                {finding.file} {finding.line ? `:${finding.line}` : ''}
                              </div>
                            </div>
                          </div>
                          <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-mono">
                            {finding.category}
                          </span>
                        </div>

                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-white/[0.04] space-y-2 text-[11px] leading-relaxed text-neutral-300">
                            <p>{finding.explanation}</p>
                            {finding.suggestedFix && (
                              <div className="p-2 rounded bg-black/30 font-mono text-[10px] text-emerald-300 overflow-x-auto whitespace-pre">
                                {finding.suggestedFix}
                              </div>
                            )}
                            <div className="flex items-center justify-end">
                              <button
                                onClick={() => {
                                  addReviewComment(finding.file, `[AI ${finding.severity.toUpperCase()}] ${finding.title}: ${finding.explanation}`, finding.line);
                                }}
                                className="text-[10px] text-accent hover:underline flex items-center gap-1"
                              >
                                <MessageSquare className="w-2.5 h-2.5" />
                                <span>Convert to Review Comment</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Changed Files Awaiting Review */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
                <span>Changed Files ({changedFiles.length})</span>
                <span className="font-mono text-[10px] text-neutral-500">
                  {codeReview?.fileStatuses ? Object.keys(codeReview.fileStatuses).length : 0} reviewed
                </span>
              </div>

              {changedFiles.length === 0 ? (
                <div className="p-4 text-center text-neutral-500 italic text-[11px]">
                  No changes awaiting review.
                </div>
              ) : (
                <div className="space-y-1">
                  {changedFiles.map((f) => {
                    const status = codeReview?.fileStatuses?.[f.path] || 'pending';
                    return (
                      <div
                        key={f.path}
                        onClick={() => setSelectedFile(f.path)}
                        className="px-2.5 py-1.5 rounded cursor-pointer hover:bg-white/[0.04] text-neutral-300 hover:text-white flex items-center justify-between transition-colors border border-transparent hover:border-white/[0.04]"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileCode className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          <span className="font-mono text-[11px] truncate">{f.path}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markFileReviewStatus(f.path, status === 'reviewed' ? 'pending' : 'reviewed');
                            }}
                            className={`p-1 rounded text-[10px] transition-colors ${
                              status === 'reviewed'
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : 'text-neutral-500 hover:text-white'
                            }`}
                            title={status === 'reviewed' ? 'Mark unreviewed' : 'Mark reviewed'}
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Comments Thread Section */}
            <div className="space-y-2 pt-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Review Comments ({reviewComments.length})</span>
                </span>
              </div>

              {/* Add General Comment */}
              <div className="space-y-1.5">
                <textarea
                  value={newGeneralComment}
                  onChange={(e) => setNewGeneralComment(e.target.value)}
                  placeholder="Leave a project review comment..."
                  className="w-full h-16 p-2 bg-white/[0.03] border border-white/10 rounded text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-accent resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAddGeneralComment}
                    disabled={!newGeneralComment.trim() || isAddingGeneralComment}
                    className="text-xs flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>Comment</span>
                  </Button>
                </div>
              </div>

              {/* Comments List */}
              <div className="space-y-2">
                {reviewComments.map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 rounded bg-white/[0.02] border border-white/[0.05] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white">{c.author}</span>
                        <span className="text-neutral-500 font-mono truncate max-w-[120px]">
                          {c.filePath} {c.lineNumber ? `:${c.lineNumber}` : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => resolveReviewComment(c.id, c.status !== 'resolved')}
                        className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                          c.status === 'resolved'
                            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                            : 'text-neutral-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {c.status === 'resolved' ? 'Resolved' : 'Resolve'}
                      </button>
                    </div>
                    <p className="text-neutral-200 leading-relaxed text-xs whitespace-pre-wrap font-sans">
                      {c.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Request Changes Modal */}
      {requestChangesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1C1D24] border border-white/10 rounded-xl p-4 shadow-2xl space-y-3 font-sans">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-white">Request Changes</h3>
              <button
                onClick={() => setRequestChangesModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              Provide feedback or required adjustments before this code review can be approved.
            </p>
            <textarea
              value={requestChangesSummary}
              onChange={(e) => setRequestChangesSummary(e.target.value)}
              placeholder="Detail the changes required..."
              rows={4}
              className="w-full p-2.5 bg-[#121316] border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-400 resize-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRequestChangesModalOpen(false)}
                className="text-xs text-neutral-400"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmRequestChanges}
                disabled={!requestChangesSummary.trim()}
                className="text-xs bg-rose-600 hover:bg-rose-500 text-white"
              >
                Submit Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
