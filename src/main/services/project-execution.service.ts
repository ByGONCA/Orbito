import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { databaseService } from '../db/database.service';
import { WorktreeManager } from '../agents/worktree-manager';
import type { ProjectExecution, ExecutionFileChange, FileChangeType } from '../../shared/review';

const execFileAsync = promisify(execFile);

interface ExecutionSnapshot {
  sessionId: string;
  projectId: string;
  projectPath: string;
  prompt: string;
  provider: string;
  model?: string;
  startedAt: number;
  initialGitStatus?: {
    isGitRepo: boolean;
    branch?: string;
    headCommit?: string;
    uncommittedFiles: Set<string>;
  };
  initialFileStats?: Map<string, { mtimeMs: number; size: number }>;
}

export class ProjectExecutionService {
  private activeSnapshots = new Map<string, ExecutionSnapshot>();

  /**
   * Helper to run git commands in project folder
   */
  private static async runGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await execFileAsync('git', args, { cwd, timeout: 30000 });
      return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
    } catch (err: any) {
      return {
        stdout: err.stdout ? err.stdout.trim() : '',
        stderr: err.stderr ? err.stderr.trim() : err.message,
        exitCode: err.code || 1
      };
    }
  }

  /**
   * Captures the initial workspace state right before an AI execution / prompt executes.
   */
  public async beforeExecution(params: {
    sessionId: string;
    projectId?: string;
    projectPath: string;
    prompt: string;
    provider: string;
    model?: string;
  }): Promise<void> {
    const { sessionId, projectId = '', projectPath, prompt, provider, model } = params;
    const now = Date.now();

    const isGit = await WorktreeManager.isGitRepo(projectPath);
    let initialGitStatus: ExecutionSnapshot['initialGitStatus'] = undefined;

    if (isGit) {
      const branchRes = await ProjectExecutionService.runGit(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath);
      const commitRes = await ProjectExecutionService.runGit(['rev-parse', 'HEAD'], projectPath);
      const statusRes = await ProjectExecutionService.runGit(['status', '--porcelain'], projectPath);

      const uncommitted = new Set<string>();
      if (statusRes.stdout) {
        const lines = statusRes.stdout.split(/\r?\n/);
        for (const l of lines) {
          if (l.trim().length > 3) {
            uncommitted.add(l.substring(3).trim().replace(/\\/g, '/'));
          }
        }
      }

      initialGitStatus = {
        isGitRepo: true,
        branch: branchRes.stdout || 'main',
        headCommit: commitRes.stdout || undefined,
        uncommittedFiles: uncommitted
      };
    }

    const snapshot: ExecutionSnapshot = {
      sessionId,
      projectId: projectId || projectPath,
      projectPath,
      prompt,
      provider,
      model,
      startedAt: now,
      initialGitStatus
    };

    this.activeSnapshots.set(sessionId, snapshot);

    // Initial record in DB with running state
    const executionRecord: ProjectExecution = {
      id: sessionId,
      projectId: projectId || projectPath,
      promptText: prompt,
      provider,
      model,
      status: 'running',
      startedAt: now,
      branch: initialGitStatus?.branch || 'main',
      baseCommit: initialGitStatus?.headCommit,
      filesChangedCount: 0,
      additions: 0,
      deletions: 0,
      isManual: false
    };

    databaseService.upsertProjectExecution(executionRecord);
  }

  /**
   * Finalizes the execution, detects modified files and calculated diffs,
   * accurately attributing additions/deletions to this specific execution.
   */
  public async afterExecution(params: {
    sessionId: string;
    status: 'completed' | 'failed' | 'cancelled';
  }): Promise<ProjectExecution | null> {
    const { sessionId, status } = params;
    const snapshot = this.activeSnapshots.get(sessionId);
    const now = Date.now();

    if (!snapshot) {
      // If snapshot wasn't in memory (e.g. after restart), just update status if record exists
      databaseService.updateProjectExecution(sessionId, { status, completedAt: now });
      return databaseService.getProjectExecution(sessionId);
    }

    this.activeSnapshots.delete(sessionId);
    const { projectPath, projectId, initialGitStatus } = snapshot;

    let resultingCommit: string | undefined = undefined;
    const fileChanges: ExecutionFileChange[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    const isGit = await WorktreeManager.isGitRepo(projectPath);

    if (isGit) {
      const commitRes = await ProjectExecutionService.runGit(['rev-parse', 'HEAD'], projectPath);
      resultingCommit = commitRes.stdout || undefined;

      // Check current git status
      const statusRes = await ProjectExecutionService.runGit(['status', '--porcelain'], projectPath);
      const currentChanged = new Set<string>();

      if (statusRes.stdout) {
        const lines = statusRes.stdout.split(/\r?\n/);
        for (const l of lines) {
          if (!l.trim()) continue;
          const code = l.substring(0, 2);
          const rawFile = l.substring(3).trim().replace(/\\/g, '/');
          currentChanged.add(rawFile);

          let changeType: FileChangeType = 'modified';
          if (code.includes('A') || code.includes('?')) {
            changeType = 'added';
          } else if (code.includes('D')) {
            changeType = 'deleted';
          } else if (code.includes('R')) {
            changeType = 'renamed';
          }

          // Fetch file diff
          const diffRes = await ProjectExecutionService.runGit(['diff', 'HEAD', '--', rawFile], projectPath);
          let diff = diffRes.stdout;

          if (!diff) {
            // Might be untracked new file
            const fullPath = path.join(projectPath, rawFile);
            if (fs.existsSync(fullPath)) {
              try {
                const content = fs.readFileSync(fullPath, 'utf8');
                const lineCount = content.split(/\r?\n/).length;
                diff = `--- /dev/null\n+++ b/${rawFile}\n@@ -0,0 +1,${lineCount} @@\n${content
                  .split(/\r?\n/)
                  .map((c) => `+${c}`)
                  .join('\n')}`;
              } catch {}
            }
          }

          // Count additions & deletions in diff
          let adds = 0;
          let dels = 0;
          if (diff) {
            const dLines = diff.split(/\r?\n/);
            for (const dl of dLines) {
              if (dl.startsWith('+') && !dl.startsWith('+++')) adds++;
              else if (dl.startsWith('-') && !dl.startsWith('---')) dels++;
            }
          }

          totalAdditions += adds;
          totalDeletions += dels;

          // Read contents if available
          let currentContent: string | undefined = undefined;
          const fullPath = path.join(projectPath, rawFile);
          if (fs.existsSync(fullPath)) {
            try {
              currentContent = fs.readFileSync(fullPath, 'utf8');
            } catch {}
          }

          fileChanges.push({
            id: `fc-${sessionId}-${Math.random().toString(36).substring(2, 7)}`,
            executionId: sessionId,
            projectId,
            filePath: rawFile,
            changeType,
            currentContent,
            diff: diff || '',
            additions: adds,
            deletions: dels
          });
        }
      }
    }

    // Persist file changes
    if (fileChanges.length > 0) {
      databaseService.insertExecutionFileChanges(fileChanges);
    }

    // Update execution record
    const updatedExecution: ProjectExecution = {
      id: sessionId,
      projectId,
      promptText: snapshot.prompt,
      provider: snapshot.provider,
      model: snapshot.model,
      status,
      startedAt: snapshot.startedAt,
      completedAt: now,
      branch: initialGitStatus?.branch || 'main',
      baseCommit: initialGitStatus?.headCommit,
      resultingCommit,
      filesChangedCount: fileChanges.length,
      additions: totalAdditions,
      deletions: totalDeletions,
      isManual: false
    };

    databaseService.upsertProjectExecution(updatedExecution);
    return updatedExecution;
  }

  /**
   * Captures or refreshes manual uncommitted workspace changes (changes not part of an AI prompt).
   */
  public async syncManualWorkspaceChanges(projectId: string, projectPath: string): Promise<ProjectExecution | null> {
    const isGit = await WorktreeManager.isGitRepo(projectPath);
    if (!isGit) return null;

    const statusRes = await ProjectExecutionService.runGit(['status', '--porcelain'], projectPath);
    if (!statusRes.stdout) return null;

    const manualId = `manual-${projectId}`;
    const branchRes = await ProjectExecutionService.runGit(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath);
    const commitRes = await ProjectExecutionService.runGit(['rev-parse', 'HEAD'], projectPath);

    const lines = statusRes.stdout.split(/\r?\n/);
    const fileChanges: ExecutionFileChange[] = [];
    let totalAdds = 0;
    let totalDels = 0;

    for (const l of lines) {
      if (!l.trim()) continue;
      const code = l.substring(0, 2);
      const rawFile = l.substring(3).trim().replace(/\\/g, '/');

      let changeType: FileChangeType = 'modified';
      if (code.includes('A') || code.includes('?')) changeType = 'added';
      else if (code.includes('D')) changeType = 'deleted';
      else if (code.includes('R')) changeType = 'renamed';

      const diffRes = await ProjectExecutionService.runGit(['diff', 'HEAD', '--', rawFile], projectPath);
      let diff = diffRes.stdout;
      if (!diff && changeType === 'added') {
        const fullPath = path.join(projectPath, rawFile);
        if (fs.existsSync(fullPath)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            diff = `--- /dev/null\n+++ b/${rawFile}\n@@ -0,0 +1,${content.split(/\r?\n/).length} @@\n${content
              .split(/\r?\n/)
              .map((c) => `+${c}`)
              .join('\n')}`;
          } catch {}
        }
      }

      let adds = 0;
      let dels = 0;
      if (diff) {
        for (const dl of diff.split(/\r?\n/)) {
          if (dl.startsWith('+') && !dl.startsWith('+++')) adds++;
          else if (dl.startsWith('-') && !dl.startsWith('---')) dels++;
        }
      }
      totalAdds += adds;
      totalDels += dels;

      fileChanges.push({
        id: `fc-man-${Math.random().toString(36).substring(2, 8)}`,
        executionId: manualId,
        projectId,
        filePath: rawFile,
        changeType,
        diff: diff || '',
        additions: adds,
        deletions: dels
      });
    }

    if (fileChanges.length === 0) return null;

    const manualRecord: ProjectExecution = {
      id: manualId,
      projectId,
      promptText: 'Manual Workspace Changes (Uncommitted)',
      provider: 'user',
      status: 'completed',
      startedAt: Date.now(),
      completedAt: Date.now(),
      branch: branchRes.stdout || 'main',
      baseCommit: commitRes.stdout || undefined,
      filesChangedCount: fileChanges.length,
      additions: totalAdds,
      deletions: totalDels,
      isManual: true
    };

    databaseService.upsertProjectExecution(manualRecord);
    databaseService.insertExecutionFileChanges(fileChanges);
    return manualRecord;
  }
}

export const projectExecutionService = new ProjectExecutionService();
