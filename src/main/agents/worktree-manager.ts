import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  taskId: string;
  branchName: string;
  worktreePath: string;
  createdAt: number;
}

export interface OverlapCheckResult {
  hasOverlap: boolean;
  conflictingFiles: string[];
}

export class WorktreeManager {
  /**
   * Executes a git command safely in the target repository directory.
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
   * Checks if target directory is a valid git repository root.
   */
  public static async isGitRepo(projectPath: string): Promise<boolean> {
    if (!fs.existsSync(projectPath)) return false;
    // Must have .git directory or file (in case of worktree)
    const gitPath = path.join(projectPath, '.git');
    if (!fs.existsSync(gitPath)) return false;

    const res = await this.runGit(['rev-parse', '--is-inside-work-tree'], projectPath);
    return res.exitCode === 0 && res.stdout === 'true';
  }

  /**
   * Checks if working tree has uncommitted dirty changes.
   */
  public static async hasUncommittedChanges(projectPath: string): Promise<boolean> {
    const res = await this.runGit(['status', '--porcelain'], projectPath);
    return res.exitCode === 0 && res.stdout.length > 0;
  }

  /**
   * Creates an isolated Git worktree on an ephemeral branch for a task.
   */
  public static async createWorktree(projectPath: string, taskId: string): Promise<{ success: boolean; worktree?: WorktreeInfo; error?: string }> {
    const isRepo = await this.isGitRepo(projectPath);
    if (!isRepo) {
      // Non-git project fallback: use project directory directly
      return {
        success: true,
        worktree: {
          taskId,
          branchName: 'none',
          worktreePath: projectPath,
          createdAt: Date.now()
        }
      };
    }

    const sanitizedTaskId = taskId.replace(/[^a-z0-9_-]/gi, '_');
    const branchName = `agent/task-${sanitizedTaskId}`;
    const worktreesDir = path.join(projectPath, '.worktrees');
    const worktreePath = path.join(worktreesDir, `wt-${sanitizedTaskId}`);

    // Ensure .worktrees is ignored in git
    const gitignorePath = path.join(projectPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      try {
        const gitignore = fs.readFileSync(gitignorePath, 'utf8');
        if (!gitignore.includes('.worktrees')) {
          fs.appendFileSync(gitignorePath, '\n# AI Workspace temporary agent worktrees\n.worktrees/\n');
        }
      } catch {}
    }

    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true });
    }

    // Clean up if path or branch already existed from previous run
    if (fs.existsSync(worktreePath)) {
      await this.removeWorktree(projectPath, worktreePath, branchName, true);
    }

    // Attempt worktree creation
    // git worktree add -b <branchName> <worktreePath> HEAD
    const res = await this.runGit(['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'], projectPath);

    if (res.exitCode !== 0) {
      // If branch already existed, attempt worktree add without -b
      const retryRes = await this.runGit(['worktree', 'add', worktreePath, branchName], projectPath);
      if (retryRes.exitCode !== 0) {
        return {
          success: false,
          error: `Failed to create worktree: ${res.stderr || retryRes.stderr}`
        };
      }
    }

    return {
      success: true,
      worktree: {
        taskId,
        branchName,
        worktreePath,
        createdAt: Date.now()
      }
    };
  }

  /**
   * Retrieves changed files in a worktree compared to base branch.
   */
  public static async getChangedFiles(worktreePath: string): Promise<string[]> {
    const list = await this.getChangedFilesWithStatus(worktreePath);
    return list.map((item) => item.path);
  }

  /**
   * Retrieves changed files with their git status code (M, A, D, R, U)
   */
  public static async getChangedFilesWithStatus(
    worktreePath: string
  ): Promise<Array<{ path: string; status: 'M' | 'A' | 'D' | 'R' | 'U' }>> {
    if (!fs.existsSync(worktreePath)) return [];
    // git status --porcelain -uall to report untracked files inside subfolders
    const res = await this.runGit(['status', '--porcelain', '-uall'], worktreePath);
    if (res.exitCode !== 0) return [];

    const lines = res.stdout.split('\n');
    const result: Array<{ path: string; status: 'M' | 'A' | 'D' | 'R' | 'U' }> = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const code = line.substring(0, 2);
      let filePart = line.substring(3).trim();

      // Handle renames: R  old -> new
      if (filePart.includes('->')) {
        filePart = filePart.split('->').pop()!.trim();
      }
      // Strip quotes if present
      if (filePart.startsWith('"') && filePart.endsWith('"')) {
        filePart = filePart.slice(1, -1);
      }

      let status: 'M' | 'A' | 'D' | 'R' | 'U' = 'M';
      if (code.includes('?') || code === '??') {
        status = 'U'; // Untracked
      } else if (code.includes('A')) {
        status = 'A'; // Added
      } else if (code.includes('D')) {
        status = 'D'; // Deleted
      } else if (code.includes('R')) {
        status = 'R'; // Renamed
      } else if (code.includes('M')) {
        status = 'M'; // Modified
      }

      if (filePart) {
        result.push({
          path: filePart.replace(/\\/g, '/'),
          status
        });
      }
    }

    return result;
  }

  /**
   * Retrieves full unified git diff of modifications in a worktree.
   */
  public static async getDiff(worktreePath: string): Promise<string> {
    if (!fs.existsSync(worktreePath)) return '';
    // Diff both staged and unstaged
    const res = await this.runGit(['diff', 'HEAD'], worktreePath);
    if (res.stdout) return res.stdout;

    // If no commits yet or unstaged only
    const unstaged = await this.runGit(['diff'], worktreePath);
    return unstaged.stdout || '';
  }

  /**
   * Checks for overlapping modified files between two branches or worktrees.
   */
  public static checkOverlaps(filesA: string[], filesB: string[]): OverlapCheckResult {
    const setA = new Set(filesA);
    const conflictingFiles: string[] = [];

    for (const file of filesB) {
      if (setA.has(file)) {
        conflictingFiles.push(file);
      }
    }

    return {
      hasOverlap: conflictingFiles.length > 0,
      conflictingFiles
    };
  }

  /**
   * Commits all changes inside the worktree branch.
   */
  public static async commitWorktreeChanges(worktreePath: string, message: string): Promise<{ success: boolean; error?: string }> {
    await this.runGit(['add', '-A'], worktreePath);
    const status = await this.runGit(['status', '--porcelain'], worktreePath);
    if (!status.stdout) {
      // Nothing to commit
      return { success: true };
    }

    const commitRes = await this.runGit(['commit', '-m', message], worktreePath);
    if (commitRes.exitCode !== 0) {
      return { success: false, error: commitRes.stderr };
    }
    return { success: true };
  }

  /**
   * Merges an agent branch into current main branch upon approval.
   */
  public static async mergeBranch(projectPath: string, branchName: string): Promise<{ success: boolean; conflicts?: string[]; error?: string }> {
    const isRepo = await this.isGitRepo(projectPath);
    if (!isRepo || branchName === 'none') {
      return { success: true };
    }

    const mergeRes = await this.runGit(['merge', '--no-ff', '-m', `Merge agent branch ${branchName}`, branchName], projectPath);

    if (mergeRes.exitCode !== 0) {
      // Check if merge conflicts
      const statusRes = await this.runGit(['diff', '--name-only', '--diff-filter=U'], projectPath);
      const conflicts = statusRes.stdout ? statusRes.stdout.split('\n').filter(Boolean) : [];

      // Abort failed merge to protect user repository
      await this.runGit(['merge', '--abort'], projectPath);

      return {
        success: false,
        conflicts,
        error: `Merge conflict detected on branch ${branchName}: ${conflicts.join(', ')}`
      };
    }

    return { success: true };
  }

  /**
   * Removes a worktree and optionally deletes the ephemeral branch.
   */
  public static async removeWorktree(
    projectPath: string,
    worktreePath: string,
    branchName?: string,
    deleteBranch = false
  ): Promise<boolean> {
    if (!fs.existsSync(worktreePath)) return true;
    if (projectPath === worktreePath) return true; // Never delete project root!

    // git worktree remove --force <path>
    await this.runGit(['worktree', 'remove', '--force', worktreePath], projectPath);
    await this.runGit(['worktree', 'prune'], projectPath);

    // Delete folder if still present
    if (fs.existsSync(worktreePath)) {
      try {
        fs.rmSync(worktreePath, { recursive: true, force: true });
      } catch {}
    }

    if (deleteBranch && branchName && branchName !== 'none') {
      await this.runGit(['branch', '-D', branchName], projectPath);
    }

    return true;
  }

  /**
   * Lists all git worktrees for a repository.
   */
  public static async listWorktrees(projectPath: string): Promise<Array<{ path: string; head: string; branch: string; isMain: boolean }>> {
    const isRepo = await this.isGitRepo(projectPath);
    if (!isRepo) return [];
    const res = await this.runGit(['worktree', 'list', '--porcelain'], projectPath);
    if (res.exitCode !== 0) return [];

    const lines = res.stdout.split('\n');
    const worktrees: Array<{ path: string; head: string; branch: string; isMain: boolean }> = [];
    let current: Partial<{ path: string; head: string; branch: string; isMain: boolean }> = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          worktrees.push(current as any);
        }
        const wtPath = line.substring(9).trim();
        current = {
          path: wtPath,
          head: '',
          branch: 'main',
          isMain: path.resolve(wtPath) === path.resolve(projectPath)
        };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.substring(5).trim();
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7).trim().replace('refs/heads/', '');
      } else if (!line.trim() && current.path) {
        worktrees.push(current as any);
        current = {};
      }
    }
    if (current.path) {
      worktrees.push(current as any);
    }
    return worktrees;
  }
}
