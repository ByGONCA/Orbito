import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { WorktreeConflictCheck } from '../../shared/agents';

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  taskId: string;
  branchName: string;
  worktreePath: string;
  createdAt: number;
  plannedFiles?: string[];
}

export interface OverlapCheckResult {
  hasOverlap: boolean;
  conflictingFiles: string[];
}

export interface CrossProcessLockData {
  pid: number;
  hostname: string;
  processStartTime: number;
  createdAt: number;
  lockId: string;
  repoPath: string;
  taskId?: string;
  taskOwner?: string;
}

export class WorktreeManager {
  private static activeWorktreeRegistry: Map<string, WorktreeInfo> = new Map();
  private static repoLocks: Map<string, Promise<any>> = new Map();
  private static heldLocks: Map<string, { lockId: string; count: number }> = new Map();

  private static isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err: any) {
      return err.code === 'EPERM';
    }
  }

  /**
   * Resolves the canonical common Git directory for a repository or linked worktree.
   * Ensures that all worktrees belonging to the same repository resolve to the same shared directory.
   */
  public static async resolveCommonGitDir(projectPath: string): Promise<string | null> {
    try {
      const gitPath = path.join(projectPath, '.git');
      if (!fs.existsSync(gitPath)) return null;

      // 1. Try git rev-parse --git-common-dir
      try {
        const res = await this.runGit(['rev-parse', '--git-common-dir'], projectPath);
        if (res.exitCode === 0 && res.stdout) {
          const resolved = path.isAbsolute(res.stdout)
            ? res.stdout
            : path.resolve(projectPath, res.stdout);
          try {
            return fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved);
          } catch {
            return resolved;
          }
        }
      } catch {}

      // 2. Fallback: inspect .git filesystem entry
      const stats = fs.statSync(gitPath);
      if (stats.isDirectory()) {
        try {
          return fs.realpathSync.native ? fs.realpathSync.native(gitPath) : fs.realpathSync(gitPath);
        } catch {
          return gitPath;
        }
      }

      // If .git is a file (linked worktree pointer), read gitdir: <path>
      const content = fs.readFileSync(gitPath, 'utf8').trim();
      if (content.startsWith('gitdir:')) {
        const gitDirPointer = content.replace(/^gitdir:\s*/, '').trim();
        const resolvedGitDir = path.isAbsolute(gitDirPointer)
          ? gitDirPointer
          : path.resolve(projectPath, gitDirPointer);

        const commondirFile = path.join(resolvedGitDir, 'commondir');
        if (fs.existsSync(commondirFile)) {
          const commonRelative = fs.readFileSync(commondirFile, 'utf8').trim();
          const commonDir = path.isAbsolute(commonRelative)
            ? commonRelative
            : path.resolve(resolvedGitDir, commonRelative);
          try {
            return fs.realpathSync.native ? fs.realpathSync.native(commonDir) : fs.realpathSync(commonDir);
          } catch {
            return commonDir;
          }
        }

        try {
          return fs.realpathSync.native ? fs.realpathSync.native(resolvedGitDir) : fs.realpathSync(resolvedGitDir);
        } catch {
          return resolvedGitDir;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  public static async getLockFilePath(projectPath: string): Promise<string | null> {
    const commonDir = await this.resolveCommonGitDir(projectPath);
    if (!commonDir) return null;
    return path.join(commonDir, 'orbito-repo.lock');
  }

  /**
   * Atomically acquires cross-process file lock on repository with stale PID dead-process detection,
   * hostname verification, process start identity, and in-process re-entrancy tracking.
   */
  public static async acquireCrossProcessLock(
    projectPath: string,
    timeoutMs = 8000,
    taskId?: string,
    taskOwner?: string
  ): Promise<string | null> {
    const commonDir = await this.resolveCommonGitDir(projectPath);
    if (!commonDir) return null;

    const normCommon = path.resolve(commonDir).toLowerCase();

    // In-process re-entrancy check
    const existing = this.heldLocks.get(normCommon);
    if (existing) {
      existing.count++;
      return existing.lockId;
    }

    const lockFilePath = path.join(commonDir, 'orbito-repo.lock');
    const lockId = crypto.randomUUID();
    const processStartTime = Math.floor(Date.now() - (process.uptime() * 1000));

    const payload: CrossProcessLockData = {
      pid: process.pid,
      hostname: os.hostname(),
      processStartTime,
      createdAt: Date.now(),
      lockId,
      repoPath: commonDir,
      taskId,
      taskOwner
    };

    const startTime = Date.now();
    let delayMs = 25;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const fd = fs.openSync(lockFilePath, 'wx');
        fs.writeFileSync(fd, JSON.stringify(payload), 'utf8');
        fs.closeSync(fd);

        this.heldLocks.set(normCommon, { lockId, count: 1 });
        return lockId;
      } catch (err: any) {
        if (err.code !== 'EEXIST') {
          return null;
        }

        // Lock file exists — inspect holding process
        try {
          const content = fs.readFileSync(lockFilePath, 'utf8');
          const data: CrossProcessLockData = JSON.parse(content);

          const isLocalHost = data.hostname === os.hostname();

          if (!isLocalHost) {
            // NEVER automatically break another machine's lock without explicit protocol!
            // Wait for lock release until timeout
          } else {
            const holdingProcessDead = !this.isProcessAlive(data.pid);
            if (holdingProcessDead) {
              // Stale lock from dead local process — atomically rename to avoid race
              const staleToken = `${lockFilePath}.stale-${Date.now()}`;
              try {
                fs.renameSync(lockFilePath, staleToken);
                try { fs.unlinkSync(staleToken); } catch {}
                continue; // retry immediate acquisition
              } catch {
                // Another process unlinked or claimed
              }
            }
          }
        } catch {
          // Unparseable, corrupted, or 0-byte lock file — safe atomic rename
          const corruptToken = `${lockFilePath}.corrupt-${Date.now()}`;
          try {
            fs.renameSync(lockFilePath, corruptToken);
            try { fs.unlinkSync(corruptToken); } catch {}
            continue;
          } catch {}
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs = Math.min(200, delayMs * 1.5);
      }
    }

    throw new Error(`Repository concurrency lock timeout: ${projectPath} is locked by another process (lockfile: ${lockFilePath}).`);
  }

  /**
   * Releases cross-process file lock if owned by our lockId.
   */
  public static async releaseCrossProcessLock(projectPath: string, lockId: string | null): Promise<void> {
    if (!lockId) return;
    const commonDir = await this.resolveCommonGitDir(projectPath);
    if (!commonDir) return;

    const normCommon = path.resolve(commonDir).toLowerCase();
    const existing = this.heldLocks.get(normCommon);
    if (existing) {
      if (existing.lockId !== lockId) {
        return; // Lock owned by another token
      }
      existing.count--;
      if (existing.count > 0) {
        return; // Still held by nested call
      }
      this.heldLocks.delete(normCommon);
    }

    const lockFilePath = path.join(commonDir, 'orbito-repo.lock');
    if (!fs.existsSync(lockFilePath)) return;

    try {
      const content = fs.readFileSync(lockFilePath, 'utf8');
      const data: CrossProcessLockData = JSON.parse(content);
      if (data.lockId === lockId) {
        fs.unlinkSync(lockFilePath);
      }
    } catch {}
  }

  /**
   * Serializes mutating Git operations per repository path both intra-process and cross-process.
   */
  public static async withRepoLock<T>(projectPath: string, fn: () => Promise<T>): Promise<T> {
    const norm = path.resolve(projectPath).toLowerCase();
    const prev = this.repoLocks.get(norm) || Promise.resolve();
    let releaseIntra: () => void = () => {};
    const next = new Promise<void>((r) => { releaseIntra = r; });
    this.repoLocks.set(norm, prev.then(() => next, () => next));
    await prev;

    let crossLockId: string | null = null;
    try {
      crossLockId = await this.acquireCrossProcessLock(projectPath);
      return await fn();
    } finally {
      if (crossLockId) {
        await this.releaseCrossProcessLock(projectPath, crossLockId);
      }
      releaseIntra();
      if (this.repoLocks.get(norm) === next) {
        this.repoLocks.delete(norm);
      }
    }
  }
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

    const worktree: WorktreeInfo = {
      taskId,
      branchName,
      worktreePath,
      createdAt: Date.now()
    };
    this.activeWorktreeRegistry.set(taskId, worktree);

    return {
      success: true,
      worktree
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
   * Performs multi-step pre-merge safety validation immediately before integration.
   */
  public static async verifyPreMergeSafety(
    projectPath: string,
    branchName: string
  ): Promise<{ safe: boolean; reason?: string; conflicts?: string[] }> {
    const isRepo = await this.isGitRepo(projectPath);
    if (!isRepo || branchName === 'none') {
      return { safe: true };
    }

    // 1. Re-read target branch HEAD
    const headRes = await this.runGit(['rev-parse', 'HEAD'], projectPath);
    if (headRes.exitCode !== 0) {
      return { safe: false, reason: 'Failed to read current repository HEAD' };
    }

    // 2. Re-read source branch HEAD
    const branchHeadRes = await this.runGit(['rev-parse', branchName], projectPath);
    if (branchHeadRes.exitCode !== 0) {
      return { safe: false, reason: `Target branch "${branchName}" does not exist or has no commits` };
    }

    // 3. User Change Protection: Assert main working tree is clean
    const isDirty = await this.hasUncommittedChanges(projectPath);
    if (isDirty) {
      return {
        safe: false,
        reason: 'User working tree contains uncommitted changes. Stash or commit changes before integrating agent task branch.'
      };
    }

    // 4. Proactive merge simulation
    const sim = await this.simulateMerge(projectPath, branchName);
    if (!sim.clean) {
      return {
        safe: false,
        reason: `Merge conflict predicted: ${sim.conflicts.join(', ')}`,
        conflicts: sim.conflicts
      };
    }

    return { safe: true };
  }

  /**
   * Merges an agent branch into current main branch upon approval with pre-merge safety checks and mutex locking.
   */
  public static async mergeBranch(
    projectPath: string,
    branchName: string
  ): Promise<{ success: boolean; conflicts?: string[]; error?: string }> {
    return this.withRepoLock(projectPath, async () => {
      const isRepo = await this.isGitRepo(projectPath);
      if (!isRepo || branchName === 'none') {
        return { success: true };
      }

      // Step 1: Pre-merge safety verification
      const safety = await this.verifyPreMergeSafety(projectPath, branchName);
      if (!safety.safe) {
        return {
          success: false,
          error: safety.reason,
          conflicts: safety.conflicts
        };
      }

      // Step 2: Merge execution
      const mergeRes = await this.runGit(['merge', '--no-ff', '-m', `Merge agent branch ${branchName}`, branchName], projectPath);

      if (mergeRes.exitCode !== 0) {
        const statusRes = await this.runGit(['diff', '--name-only', '--diff-filter=U'], projectPath);
        const conflicts = statusRes.stdout ? statusRes.stdout.split('\n').filter(Boolean) : [];

        // Abort failed merge cleanly to protect user repository
        await this.runGit(['merge', '--abort'], projectPath);

        return {
          success: false,
          conflicts,
          error: `Merge conflict detected on branch ${branchName}: ${conflicts.join(', ')}`
        };
      }

      return { success: true };
    });
  }

  /**
   * Removes a worktree and safely deletes ephemeral branch without destroying uncommitted work.
   */
  public static async removeWorktree(
    projectPath: string,
    worktreePath: string,
    branchName?: string,
    deleteBranch = false
  ): Promise<boolean> {
    if (!fs.existsSync(worktreePath)) return true;
    if (projectPath === worktreePath) return true; // Invariant: Never delete project root!

    // Safety check: if worktree contains uncommitted changes, do not delete branch
    let hasDirtyChanges = false;
    try {
      hasDirtyChanges = await this.hasUncommittedChanges(worktreePath);
    } catch {}

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
      if (hasDirtyChanges) {
        // Quarantine to stash branch instead of destructive deletion
        const stashBranch = `orphaned/${branchName.replace(/^agent\//, '')}-${Date.now()}`;
        try {
          await this.runGit(['branch', '-m', branchName, stashBranch], projectPath);
        } catch {}
      } else {
        await this.runGit(['branch', '-D', branchName], projectPath);
      }
    }

    for (const [tId, wt] of this.activeWorktreeRegistry.entries()) {
      if (wt.worktreePath === worktreePath) {
        this.activeWorktreeRegistry.delete(tId);
      }
    }

    return true;
  }

  /**
   * Detects interrupted Git states in the repository (interrupted merge, rebase, or stale index lock).
   */
  public static async detectInterruptedGitOperations(projectPath: string): Promise<{
    hasInterruptedOperation: boolean;
    operationType?: 'merge' | 'rebase' | 'cherry_pick' | 'index_lock';
    details?: string;
  }> {
    const isRepo = await this.isGitRepo(projectPath);
    if (!isRepo) return { hasInterruptedOperation: false };

    const gitDir = path.join(projectPath, '.git');

    // Check for interrupted merge
    if (fs.existsSync(path.join(gitDir, 'MERGE_HEAD'))) {
      return {
        hasInterruptedOperation: true,
        operationType: 'merge',
        details: 'An in-progress git merge was interrupted. Run git merge --abort or resolve conflicts.'
      };
    }

    // Check for interrupted rebase
    if (fs.existsSync(path.join(gitDir, 'rebase-merge')) || fs.existsSync(path.join(gitDir, 'rebase-apply'))) {
      return {
        hasInterruptedOperation: true,
        operationType: 'rebase',
        details: 'An in-progress git rebase was interrupted. Run git rebase --abort to safely recover.'
      };
    }

    // Check for stale index.lock
    const lockPath = path.join(gitDir, 'index.lock');
    if (fs.existsSync(lockPath)) {
      const stats = fs.statSync(lockPath);
      // If lock file is older than 60 seconds, it is likely abandoned from a crashed process
      if (Date.now() - stats.mtimeMs > 60000) {
        return {
          hasInterruptedOperation: true,
          operationType: 'index_lock',
          details: 'Stale .git/index.lock detected from a previously terminated Git process.'
        };
      }
    }

    return { hasInterruptedOperation: false };
  }

  /**
   * Safely aborts an interrupted merge or rebase, or cleans a stale lock file.
   */
  public static async abortInterruptedGitOperation(
    projectPath: string,
    operationType: 'merge' | 'rebase' | 'index_lock',
    explicitConfirm = false
  ): Promise<{ success: boolean; message: string }> {
    if (!explicitConfirm) {
      throw new Error('Explicit confirmation is required to recover interrupted Git operations.');
    }

    if (operationType === 'merge') {
      const res = await this.runGit(['merge', '--abort'], projectPath);
      return { success: res.exitCode === 0, message: res.exitCode === 0 ? 'Aborted interrupted merge.' : res.stderr };
    }

    if (operationType === 'rebase') {
      const res = await this.runGit(['rebase', '--abort'], projectPath);
      return { success: res.exitCode === 0, message: res.exitCode === 0 ? 'Aborted interrupted rebase.' : res.stderr };
    }

    if (operationType === 'index_lock') {
      const lockPath = path.join(projectPath, '.git', 'index.lock');
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
        return { success: true, message: 'Removed stale .git/index.lock file.' };
      }
    }

    return { success: false, message: 'Unknown or unrecoverable operation.' };
  }

  /**
   * Simulates a merge between current HEAD and target branch without modifying worktree or staging.
   * Uses git merge-tree to proactively detect conflicts.
   */
  public static async simulateMerge(
    projectPath: string,
    branchName: string
  ): Promise<{ clean: boolean; conflicts: string[]; error?: string }> {
    const isRepo = await this.isGitRepo(projectPath);
    if (!isRepo || branchName === 'none') {
      return { clean: true, conflicts: [] };
    }

    // git merge-tree HEAD <branchName>
    const res = await this.runGit(['merge-tree', 'HEAD', branchName], projectPath);
    if (res.exitCode !== 0) {
      return { clean: false, conflicts: [branchName], error: res.stderr || 'Merge simulation failed' };
    }

    // If merge-tree stdout contains conflict indicators: "<<<<<<<" or "changed in both"
    const hasConflict = res.stdout.includes('<<<<<<<') || res.stdout.includes('changed in both');
    const conflicts: string[] = [];

    if (hasConflict) {
      const lines = res.stdout.split('\n');
      for (const line of lines) {
        if (line.includes('changed in both') || line.includes('conflict in')) {
          conflicts.push(line.trim());
        }
      }
      return { clean: false, conflicts: conflicts.length > 0 ? conflicts : ['Merge conflict detected'] };
    }

    return { clean: true, conflicts: [] };
  }

  /**
   * Checks planned/modified files of a task against all currently running tasks to prevent collision.
   */
  public static async checkTaskFileConflicts(
    taskId: string,
    targetFiles: string[]
  ): Promise<WorktreeConflictCheck> {
    const conflictingTaskIds: string[] = [];
    const conflictingFiles: string[] = [];

    const targetSet = new Set(targetFiles.map((f) => f.replace(/\\/g, '/')));

    for (const [otherTaskId, info] of this.activeWorktreeRegistry.entries()) {
      if (otherTaskId === taskId) continue;

      let otherFiles: string[] = [];
      if (info.plannedFiles && info.plannedFiles.length > 0) {
        otherFiles = [...info.plannedFiles];
      } else {
        otherFiles = await this.getChangedFiles(info.worktreePath);
      }
      for (const f of otherFiles) {
        const norm = f.replace(/\\/g, '/');
        if (targetSet.has(norm)) {
          if (!conflictingTaskIds.includes(otherTaskId)) {
            conflictingTaskIds.push(otherTaskId);
          }
          if (!conflictingFiles.includes(norm)) {
            conflictingFiles.push(norm);
          }
        }
      }
    }

    return {
      taskId,
      plannedFiles: targetFiles,
      conflictingTaskIds,
      conflictingFiles,
      canRunParallel: conflictingFiles.length === 0
    };
  }

  /**
   * Saves a safe patch snapshot of uncommitted/staged work in an active worktree.
   */
  public static async saveWorktreeSnapshot(worktreePath: string, taskId?: string): Promise<{
    patchPath: string | null;
    manifestPath: string | null;
    snapshotRef: string | null;
    untrackedFiles: string[];
    modifiedFiles: string[];
  } | null> {
    if (!fs.existsSync(worktreePath)) return null;

    try {
      const isRepo = await this.isGitRepo(worktreePath);
      const untrackedFiles: string[] = [];
      const modifiedFiles: string[] = [];

      if (isRepo) {
        const statusRes = await this.runGit(['status', '--porcelain=v1', '-uall'], worktreePath);
        if (statusRes.exitCode === 0 && statusRes.stdout) {
          const lines = statusRes.stdout.split('\n').filter(Boolean);
          for (const line of lines) {
            const code = line.substring(0, 2).trim();
            const file = line.substring(3).trim();
            if (code === '??') {
              untrackedFiles.push(file);
            } else {
              modifiedFiles.push(file);
            }
          }
        }
      }

      const diff = isRepo ? await this.getDiff(worktreePath) : null;
      const timestamp = Date.now();
      const patchPath = path.join(worktreePath, `.snapshot-${timestamp}.patch`);
      if (diff) {
        fs.writeFileSync(patchPath, diff, 'utf8');
      }

      // Save complete snapshot manifest
      const manifestPath = path.join(worktreePath, `.snapshot-${timestamp}.json`);
      const manifest = {
        taskId: taskId || 'unknown',
        worktreePath,
        timestamp,
        untrackedFiles,
        modifiedFiles,
        hasPatch: Boolean(diff),
        patchPath: diff ? patchPath : null
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

      let snapshotRef: string | null = null;
      if (isRepo && (untrackedFiles.length > 0 || modifiedFiles.length > 0)) {
        try {
          const refName = `refs/orbito/interrupted/${taskId || 'unassigned'}-${timestamp}`;
          await this.runGit(['add', '-A'], worktreePath);
          const commitRes = await this.runGit(['commit', '-m', `orbito-recovery-snapshot: ${taskId || 'interrupted'}`, '--no-verify'], worktreePath);
          if (commitRes.exitCode === 0) {
            const headRes = await this.runGit(['rev-parse', 'HEAD'], worktreePath);
            if (headRes.exitCode === 0) {
              await this.runGit(['update-ref', refName, headRes.stdout], worktreePath);
              snapshotRef = refName;
            }
          }
        } catch {}
      }

      return {
        patchPath: diff ? patchPath : null,
        manifestPath,
        snapshotRef,
        untrackedFiles,
        modifiedFiles
      };
    } catch {
      return null;
    }
  }

  /**
   * Directly registers an active task worktree (used for tracking and testing).
   */
  public static registerActiveTaskWorktree(worktree: WorktreeInfo): void {
    this.activeWorktreeRegistry.set(worktree.taskId, worktree);
  }

  /**
   * Unregisters an active task worktree.
   */
  public static unregisterActiveTaskWorktree(taskId: string): void {
    this.activeWorktreeRegistry.delete(taskId);
  }

  public static getActiveLockCount(): number {
    return this.repoLocks.size;
  }

  public static async listQuarantinedBranches(projectPath: string): Promise<string[]> {
    const isRepo = await this.isGitRepo(projectPath);
    if (!isRepo) return [];
    const res = await this.runGit(['branch', '--list', 'orphaned/*'], projectPath);
    if (res.exitCode !== 0 || !res.stdout) return [];
    return res.stdout.split('\n').map(b => b.replace(/^[* ]+/, '').trim()).filter(Boolean);
  }

  /**
   * Clears all active worktree registrations.
   */
  public static clearActiveTaskWorktrees(): void {
    this.activeWorktreeRegistry.clear();
  }

  /**
   * Lists all active task worktrees tracked by the coordinator.
   */
  public static async listActiveTaskWorktrees(
    projectPath?: string
  ): Promise<Array<{ taskId: string; branchName: string; worktreePath: string; createdAt: number; isMain: boolean; changedFilesCount: number }>> {
    const results: Array<{ taskId: string; branchName: string; worktreePath: string; createdAt: number; isMain: boolean; changedFilesCount: number }> = [];

    for (const [taskId, wt] of this.activeWorktreeRegistry.entries()) {
      if (projectPath && !wt.worktreePath.startsWith(projectPath)) continue;

      let changedCount = 0;
      try {
        const files = await this.getChangedFiles(wt.worktreePath);
        changedCount = files.length;
      } catch {}

      results.push({
        taskId,
        branchName: wt.branchName,
        worktreePath: wt.worktreePath,
        createdAt: wt.createdAt,
        isMain: projectPath ? path.resolve(wt.worktreePath) === path.resolve(projectPath) : false,
        changedFilesCount: changedCount
      });
    }

    return results;
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
