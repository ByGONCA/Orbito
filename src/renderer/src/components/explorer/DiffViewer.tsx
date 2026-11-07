import React, { useState, useMemo } from 'react';
import {
  Columns,
  AlignJustify,
  ExternalLink,
  MessageSquare,
  Check,
  Send,
  X,
  FileCode,
  CornerDownRight
} from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { Button } from '../ui/Button';
import type { ReviewComment } from '../../../../shared/review';

interface DiffViewerProps {
  filePath: string;
  diff: string;
  previousContent?: string;
  currentContent?: string;
  mode?: 'unified' | 'side-by-side';
  comments?: ReviewComment[];
  onOpenInEditor?: (filePath: string) => void;
  onAddComment?: (filePath: string, content: string, lineNumber?: number, diffHunk?: string) => Promise<void>;
  onResolveComment?: (commentId: string, resolved: boolean) => Promise<void>;
}

interface ParsedDiffLine {
  type: 'add' | 'del' | 'normal' | 'hunk';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  filePath,
  diff,
  previousContent,
  currentContent,
  mode: initialMode = 'unified',
  comments = [],
  onOpenInEditor,
  onAddComment,
  onResolveComment
}) => {
  const [viewMode, setViewMode] = useState<'unified' | 'side-by-side'>(initialMode);
  const [activeCommentLine, setActiveCommentLine] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Parse unified diff into structured lines
  const parsedLines = useMemo<ParsedDiffLine[]>(() => {
    if (!diff) return [];
    const rawLines = diff.split('\n');
    const lines: ParsedDiffLine[] = [];
    let oldNum = 0;
    let newNum = 0;

    for (const line of rawLines) {
      if (line.startsWith('@@')) {
        // Hunk header e.g. @@ -1,10 +1,15 @@
        const match = line.match(/@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
        if (match) {
          oldNum = parseInt(match[1], 10);
          newNum = parseInt(match[2], 10);
        }
        lines.push({ type: 'hunk', content: line });
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        lines.push({
          type: 'add',
          content: line.slice(1),
          newLineNumber: newNum++
        });
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        lines.push({
          type: 'del',
          content: line.slice(1),
          oldLineNumber: oldNum++
        });
      } else if (line.startsWith(' ') || (!line.startsWith('\\') && !line.startsWith('diff ') && !line.startsWith('index '))) {
        lines.push({
          type: 'normal',
          content: line.startsWith(' ') ? line.slice(1) : line,
          oldLineNumber: oldNum++,
          newLineNumber: newNum++
        });
      }
    }
    return lines;
  }, [diff]);

  // Addition / deletion count
  const stats = useMemo(() => {
    let adds = 0;
    let dels = 0;
    for (const l of parsedLines) {
      if (l.type === 'add') adds++;
      if (l.type === 'del') dels++;
    }
    return { adds, dels };
  }, [parsedLines]);

  const fileComments = useMemo(() => {
    return comments.filter((c) => c.filePath === filePath);
  }, [comments, filePath]);

  const handleCreateComment = async (lineNumber?: number) => {
    if (!commentText.trim() || !onAddComment) return;
    setIsSubmittingComment(true);
    try {
      await onAddComment(filePath, commentText.trim(), lineNumber);
      setCommentText('');
      setActiveCommentLine(null);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#121316] text-[#D8DEE9] font-mono text-[11px] overflow-hidden select-text">
      {/* Diff Toolbar */}
      <div className="h-8 px-3 border-b border-white/[0.06] bg-[#16171B] flex items-center justify-between flex-shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
          <span className="font-semibold text-white truncate text-xs">{filePath}</span>
          <div className="flex items-center gap-1.5 ml-2 text-[10px]">
            <span className="text-emerald-400 font-semibold">+{stats.adds}</span>
            <span className="text-rose-400 font-semibold">-{stats.dels}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('unified')}
            className={`p-1 rounded transition-colors cursor-pointer ${
              viewMode === 'unified'
                ? 'bg-white/10 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            title="Unified Diff View"
            aria-label="Unified Diff View"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`p-1 rounded transition-colors cursor-pointer ${
              viewMode === 'side-by-side'
                ? 'bg-white/10 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            title="Side-by-Side Diff View"
            aria-label="Side-by-Side Diff View"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>

          {onOpenInEditor && (
            <button
              onClick={() => onOpenInEditor(filePath)}
              className="ml-1 p-1 rounded text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Open file in main editor"
              aria-label="Open in Editor"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Diff Content View */}
      <div className="flex-1 overflow-auto">
        {parsedLines.length === 0 ? (
          <div className="h-full flex items-center justify-center text-neutral-500 italic p-6">
            No changes detected for this file.
          </div>
        ) : viewMode === 'unified' ? (
          /* ================= UNIFIED DIFF VIEW ================= */
          <div className="divide-y divide-white/[0.02]">
            {parsedLines.map((line, idx) => {
              const lineComments = fileComments.filter(
                (c) => c.lineNumber === (line.newLineNumber || line.oldLineNumber)
              );
              const isHunk = line.type === 'hunk';
              const isAdd = line.type === 'add';
              const isDel = line.type === 'del';
              const lineTargetNum = line.newLineNumber || line.oldLineNumber;

              return (
                <div key={idx} className="group relative">
                  <div
                    className={`flex items-start transition-colors ${
                      isHunk
                        ? 'bg-blue-500/[0.07] text-blue-400 text-[10px] py-0.5 font-medium'
                        : isAdd
                        ? 'bg-emerald-500/[0.08] hover:bg-emerald-500/[0.12] text-emerald-200'
                        : isDel
                        ? 'bg-rose-500/[0.08] hover:bg-rose-500/[0.12] text-rose-200'
                        : 'hover:bg-white/[0.02] text-neutral-300'
                    }`}
                  >
                    {/* Line numbers gutter */}
                    <div className="flex-shrink-0 w-16 select-none flex text-neutral-500 text-[10px] pr-2 text-right border-r border-white/[0.05]">
                      <span className="w-8">{line.oldLineNumber ?? ''}</span>
                      <span className="w-8">{line.newLineNumber ?? ''}</span>
                    </div>

                    {/* Diff marker (+, -, space) */}
                    <div className="flex-shrink-0 w-5 text-center select-none font-bold text-xs opacity-75">
                      {isAdd ? '+' : isDel ? '-' : isHunk ? '@' : ' '}
                    </div>

                    {/* Code Content */}
                    <div className="flex-1 whitespace-pre overflow-x-auto pr-8 py-0.5 font-mono">
                      {line.content || ' '}
                    </div>

                    {/* Inline comment trigger button */}
                    {!isHunk && onAddComment && (
                      <button
                        onClick={() =>
                          setActiveCommentLine(activeCommentLine === lineTargetNum ? null : lineTargetNum || null)
                        }
                        className="opacity-0 group-hover:opacity-100 absolute right-2 top-0.5 p-1 rounded bg-[#202228] text-neutral-300 hover:text-white border border-white/10 shadow-xs transition-opacity"
                        title="Add review comment to this line"
                      >
                        <MessageSquare className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>

                  {/* Inline Comments on this Line */}
                  {lineComments.length > 0 && (
                    <div className="ml-16 mr-4 my-1.5 space-y-1.5 pl-3 border-l-2 border-accent/70 bg-[#17181D] p-2 rounded">
                      {lineComments.map((comment) => (
                        <div key={comment.id} className="text-xs">
                          <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
                            <span className="font-semibold text-white">{comment.author}</span>
                            <div className="flex items-center gap-2">
                              <span>{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {onResolveComment && (
                                <button
                                  onClick={() => onResolveComment(comment.id, comment.status !== 'resolved')}
                                  className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                                    comment.status === 'resolved'
                                      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                                      : 'text-neutral-400 border-white/10 hover:text-white hover:border-white/20'
                                  }`}
                                >
                                  {comment.status === 'resolved' ? 'Resolved' : 'Resolve'}
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-neutral-200 leading-normal font-sans text-xs whitespace-pre-wrap">
                            {comment.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Inline Comment Box */}
                  {activeCommentLine === lineTargetNum && onAddComment && (
                    <div className="ml-16 mr-4 my-2 p-2.5 bg-[#17181D] border border-white/10 rounded font-sans">
                      <div className="text-[10px] text-neutral-400 mb-1.5 flex items-center justify-between">
                        <span>Comment on line {lineTargetNum}</span>
                        <button
                          onClick={() => setActiveCommentLine(null)}
                          className="text-neutral-500 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Write your review comment (Markdown supported)..."
                        className="w-full h-16 p-2 bg-[#101114] border border-white/10 rounded text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-accent resize-none"
                      />
                      <div className="flex items-center justify-end gap-1.5 mt-2">
                        <button
                          onClick={() => setActiveCommentLine(null)}
                          className="px-2.5 py-1 text-xs text-neutral-400 hover:text-white rounded"
                        >
                          Cancel
                        </button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleCreateComment(lineTargetNum)}
                          disabled={!commentText.trim() || isSubmittingComment}
                          className="text-xs flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>Add Comment</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ================= SIDE-BY-SIDE DIFF VIEW ================= */
          <div className="grid grid-cols-2 divide-x divide-white/[0.06] min-w-full">
            {/* Left Pane: Old version / deletions */}
            <div className="divide-y divide-white/[0.02]">
              <div className="px-3 py-1 bg-white/[0.02] text-[10px] text-neutral-400 font-semibold sticky top-0 border-b border-white/[0.04]">
                Original Version
              </div>
              {parsedLines
                .filter((l) => l.type === 'del' || l.type === 'normal' || l.type === 'hunk')
                .map((line, idx) => (
                  <div
                    key={`left-${idx}`}
                    className={`flex items-start text-[11px] ${
                      line.type === 'del'
                        ? 'bg-rose-500/[0.09] text-rose-200'
                        : line.type === 'hunk'
                        ? 'bg-blue-500/[0.05] text-blue-400 py-0.5'
                        : 'text-neutral-300'
                    }`}
                  >
                    <div className="w-10 text-right pr-2 text-[10px] text-neutral-500 select-none flex-shrink-0">
                      {line.oldLineNumber ?? ''}
                    </div>
                    <div className="w-4 text-center select-none opacity-60 flex-shrink-0">
                      {line.type === 'del' ? '-' : ' '}
                    </div>
                    <div className="flex-1 whitespace-pre overflow-x-auto pr-2 py-0.5 font-mono">
                      {line.content || ' '}
                    </div>
                  </div>
                ))}
            </div>

            {/* Right Pane: New version / additions */}
            <div className="divide-y divide-white/[0.02]">
              <div className="px-3 py-1 bg-white/[0.02] text-[10px] text-neutral-400 font-semibold sticky top-0 border-b border-white/[0.04]">
                Modified Version
              </div>
              {parsedLines
                .filter((l) => l.type === 'add' || l.type === 'normal' || l.type === 'hunk')
                .map((line, idx) => (
                  <div
                    key={`right-${idx}`}
                    className={`flex items-start text-[11px] ${
                      line.type === 'add'
                        ? 'bg-emerald-500/[0.09] text-emerald-200'
                        : line.type === 'hunk'
                        ? 'bg-blue-500/[0.05] text-blue-400 py-0.5'
                        : 'text-neutral-300'
                    }`}
                  >
                    <div className="w-10 text-right pr-2 text-[10px] text-neutral-500 select-none flex-shrink-0">
                      {line.newLineNumber ?? ''}
                    </div>
                    <div className="w-4 text-center select-none opacity-60 flex-shrink-0">
                      {line.type === 'add' ? '+' : ' '}
                    </div>
                    <div className="flex-1 whitespace-pre overflow-x-auto pr-2 py-0.5 font-mono">
                      {line.content || ' '}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
