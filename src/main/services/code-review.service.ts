import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../db/database.service';
import type { CodeReview, ReviewComment, AIFinding, ReviewStatus } from '../../shared/review';

export class CodeReviewService {
  /**
   * Retrieves active or creates a new CodeReview entity for the project or execution.
   */
  public async getOrCreateReview(projectId: string, executionId?: string): Promise<CodeReview> {
    if (executionId) {
      const existing = databaseService.getCodeReview(executionId);
      if (existing) return existing;
    }

    const latest = databaseService.getCodeReviewByProject(projectId);
    if (latest && latest.status !== 'approved') {
      return latest;
    }

    const newReviewId = executionId || `rev-${projectId}-${Date.now()}`;
    const now = Date.now();
    const newReview: CodeReview = {
      id: newReviewId,
      projectId,
      executionId,
      status: 'not_reviewed',
      summary: 'Initial changes awaiting inspection',
      createdAt: now,
      updatedAt: now,
      fileStatuses: {}
    };

    databaseService.upsertCodeReview(newReview);
    return newReview;
  }

  /**
   * Updates the review decision: approve, request changes, mark reviewed.
   */
  public async updateReviewDecision(params: {
    reviewId: string;
    status: ReviewStatus;
    reviewer?: string;
    summary?: string;
  }): Promise<CodeReview | null> {
    const { reviewId, status, reviewer = 'Lead Reviewer', summary } = params;
    const review = databaseService.getCodeReview(reviewId);
    if (!review) return null;

    review.status = status;
    review.reviewer = reviewer;
    if (summary) review.summary = summary;
    review.updatedAt = Date.now();
    if (status === 'approved' || status === 'reviewed') {
      review.reviewedAt = Date.now();
    }

    databaseService.upsertCodeReview(review);
    return review;
  }

  /**
   * Updates per-file review status.
   */
  public async markFileStatus(params: {
    reviewId: string;
    filePath: string;
    status: 'pending' | 'reviewed' | 'changes_requested';
  }): Promise<CodeReview | null> {
    const { reviewId, filePath, status } = params;
    const review = databaseService.getCodeReview(reviewId);
    if (!review) return null;

    const fileStatuses = review.fileStatuses || {};
    fileStatuses[filePath] = status;
    review.fileStatuses = fileStatuses;
    review.updatedAt = Date.now();

    databaseService.upsertCodeReview(review);
    return review;
  }

  /**
   * Review comments management
   */
  public async addComment(params: {
    reviewId: string;
    projectId: string;
    filePath: string;
    lineNumber?: number;
    diffHunk?: string;
    content: string;
    author: string;
    parentCommentId?: string;
  }): Promise<ReviewComment> {
    const comment: ReviewComment = {
      id: `rc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      reviewId: params.reviewId,
      projectId: params.projectId,
      filePath: params.filePath,
      lineNumber: params.lineNumber,
      diffHunk: params.diffHunk,
      content: params.content,
      author: params.author || 'Reviewer',
      status: 'open',
      parentCommentId: params.parentCommentId,
      createdAt: Date.now()
    };

    databaseService.createReviewComment(comment);
    return comment;
  }

  public listComments(reviewId: string): ReviewComment[] {
    return databaseService.listReviewComments(reviewId);
  }

  public resolveComment(commentId: string, resolved: boolean): boolean {
    return databaseService.resolveReviewComment(commentId, resolved);
  }

  /**
   * AI-Assisted Automated Code Review:
   * Heuristic static analysis and security scanning over unified diffs and modified files.
   */
  public async runAIReview(params: {
    reviewId: string;
    projectPath: string;
    diff: string;
    changedFiles: string[];
  }): Promise<AIFinding[]> {
    const { reviewId, diff, changedFiles } = params;
    const findings: AIFinding[] = [];

    const lines = diff.split(/\r?\n/);
    let currentFile = changedFiles[0] || 'unknown';
    let currentLine = 1;

    for (const l of lines) {
      if (l.startsWith('+++ b/')) {
        currentFile = l.replace('+++ b/', '').trim();
        continue;
      }
      if (l.startsWith('@@')) {
        const match = l.match(/\+(\d+)/);
        if (match) currentLine = parseInt(match[1], 10);
        continue;
      }

      if (l.startsWith('+') && !l.startsWith('+++')) {
        const addedCode = l.substring(1);
        currentLine++;

        // 1. Security: Dangerous eval or dynamic execution
        if (/\beval\s*\(/.test(addedCode)) {
          findings.push({
            id: `ai-find-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            severity: 'critical',
            file: currentFile,
            line: currentLine,
            title: 'Use of eval() detected',
            explanation: 'Direct evaluation of strings as code introduces arbitrary code execution vulnerabilities.',
            suggestedFix: 'Replace eval() with structured JSON.parse() or a safe parser.',
            category: 'security'
          });
        }

        // 2. Security: Shell injection risk
        if (/exec\s*\([^,)]*\+/.test(addedCode) || /spawn\s*\([^,)]*\+/.test(addedCode)) {
          findings.push({
            id: `ai-find-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            severity: 'critical',
            file: currentFile,
            line: currentLine,
            title: 'Unsanitized Command Execution',
            explanation: 'String concatenation inside child_process execution calls can lead to command injection.',
            suggestedFix: 'Use execFile() with parameterized array arguments rather than shell string interpolation.',
            category: 'security'
          });
        }

        // 3. Security: Hardcoded API keys or Secrets
        if (/(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/i.test(addedCode)) {
          findings.push({
            id: `ai-find-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            severity: 'critical',
            file: currentFile,
            line: currentLine,
            title: 'Potential Hardcoded Secret',
            explanation: 'Detected credential or token string assigned directly in source code.',
            suggestedFix: 'Store secrets in environment variables or safe storage service.',
            category: 'security'
          });
        }

        // 4. Bug / Error Handling: Empty catch block
        if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(addedCode)) {
          findings.push({
            id: `ai-find-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            severity: 'warning',
            file: currentFile,
            line: currentLine,
            title: 'Silent Error Suppression',
            explanation: 'Empty catch block suppresses runtime exceptions without logging or handling.',
            suggestedFix: 'Add error logging or rethrow unexpected exceptions.',
            category: 'error_handling'
          });
        }

        // 5. Performance / Anti-Pattern: Synchronous file access
        if (/fs\.readFileSync|fs\.writeFileSync/.test(addedCode) && !currentFile.includes('.test.')) {
          findings.push({
            id: `ai-find-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            severity: 'suggestion',
            file: currentFile,
            line: currentLine,
            title: 'Synchronous File I/O in Runtime Path',
            explanation: 'Synchronous fs calls block the Node.js event loop during intensive I/O operations.',
            suggestedFix: 'Prefer fs.promises or asynchronous streams.',
            category: 'performance'
          });
        }

        // 6. Bug: Loose equality with null/undefined
        if (/[!=]==\s*(?:null|undefined)/.test(addedCode)) {
          findings.push({
            id: `ai-find-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            severity: 'suggestion',
            file: currentFile,
            line: currentLine,
            title: 'Strict Null Comparison',
            explanation: 'Check whether loose == null is intended to cover both null and undefined, or if strict is required.',
            suggestedFix: 'Use optional chaining or explicit checks.',
            category: 'bug'
          });
        }
      } else if (!l.startsWith('-')) {
        currentLine++;
      }
    }

    // Persist findings in CodeReview record
    const review = databaseService.getCodeReview(reviewId);
    if (review) {
      review.aiAnalysis = findings;
      if (findings.some((f) => f.severity === 'critical')) {
        review.status = 'issues_found';
        review.summary = `AI Code Analysis detected ${findings.length} issue(s), including critical security risks.`;
      } else if (findings.length > 0) {
        review.summary = `AI Code Analysis completed with ${findings.length} advisory finding(s).`;
      } else {
        review.summary = 'AI Code Analysis completed: Clean diff, zero high-risk patterns identified.';
      }
      review.updatedAt = Date.now();
      databaseService.upsertCodeReview(review);
    }

    return findings;
  }
}

export const codeReviewService = new CodeReviewService();
