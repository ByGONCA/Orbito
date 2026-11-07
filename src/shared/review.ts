export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface ProjectExecution {
  id: string;
  projectId: string;
  promptId?: string;
  promptText: string;
  provider?: string;
  model?: string;
  status: ExecutionStatus;
  startedAt: number;
  completedAt?: number;
  branch?: string;
  baseCommit?: string;
  resultingCommit?: string;
  filesChangedCount: number;
  additions: number;
  deletions: number;
  isManual?: boolean;
}

export type FileChangeType = 'modified' | 'added' | 'deleted' | 'renamed';

export interface ExecutionFileChange {
  id: string;
  executionId: string;
  projectId: string;
  filePath: string;
  changeType: FileChangeType;
  previousContent?: string;
  currentContent?: string;
  diff: string;
  additions: number;
  deletions: number;
}

export type ReviewStatus =
  | 'not_reviewed'
  | 'reviewed'
  | 'issues_found'
  | 'changes_requested'
  | 'approved';

export interface AIFinding {
  id: string;
  severity: 'critical' | 'warning' | 'suggestion';
  file: string;
  line?: number;
  title: string;
  explanation: string;
  suggestedFix?: string;
  category: 'security' | 'bug' | 'performance' | 'style' | 'error_handling';
}

export interface CodeReview {
  id: string;
  projectId: string;
  executionId?: string;
  status: ReviewStatus;
  summary?: string;
  aiAnalysis?: AIFinding[];
  reviewer?: string;
  createdAt: number;
  updatedAt: number;
  reviewedAt?: number;
  fileStatuses?: Record<string, 'pending' | 'reviewed' | 'changes_requested'>;
}

export interface ReviewComment {
  id: string;
  reviewId: string;
  projectId: string;
  filePath: string;
  lineNumber?: number;
  diffHunk?: string;
  content: string;
  author: string;
  status: 'open' | 'resolved';
  parentCommentId?: string;
  createdAt: number;
  resolvedAt?: number;
}

export interface ProjectGitDetails {
  isGitRepo: boolean;
  branch: string;
  commitHash?: string;
  commitMessage?: string;
  remoteUrl?: string;
  gitProvider?: 'github' | 'gitlab' | 'bitbucket' | 'other';
  githubOwner?: string;
  githubRepo?: string;
  githubBrowserUrl?: string;
  pullRequest?: {
    number: number;
    title: string;
    url: string;
    status: 'open' | 'merged' | 'closed';
  };
  hasUncommittedChanges: boolean;
  stagedFiles: string[];
  uncommittedFiles: string[];
}
