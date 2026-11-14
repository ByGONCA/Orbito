import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import type { GitIntelligence } from '../../shared/project-intelligence';

export class GitIntelligenceService {
  public async getGitIntelligence(projectPath: string): Promise<GitIntelligence> {
    const isGit = fs.existsSync(path.join(projectPath, '.git'));
    if (!isGit) {
      return {
        branch: 'none (not a git repo)',
        headCommit: '',
        commitMessage: '',
        isDirty: false,
        modifiedFiles: [],
        stagedFiles: [],
        untrackedFiles: [],
        activeWorktrees: [],
        hotspotFiles: []
      };
    }

    let branch = 'unknown';
    let headCommit = '';
    let commitMessage = '';
    let isDirty = false;
    const modifiedFiles: string[] = [];
    const stagedFiles: string[] = [];
    const untrackedFiles: string[] = [];
    const activeWorktrees: Array<{ path: string; branch: string; isCurrent: boolean }> = [];
    const hotspotFiles: Array<{ path: string; changesCount: number }> = [];

    const runGit = (args: string): string => {
      try {
        return execSync(`git ${args}`, {
          cwd: projectPath,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 4000
        }).trim();
      } catch {
        return '';
      }
    };

    // 1. Current Branch & Head
    branch = runGit('branch --show-current') || runGit('rev-parse --abbrev-ref HEAD') || 'HEAD';
    headCommit = runGit('rev-parse --short HEAD');
    commitMessage = runGit('log -1 --pretty=%B');

    // 2. Status & Dirty state
    const statusOut = runGit('status --porcelain');
    if (statusOut) {
      isDirty = true;
      const lines = statusOut.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const code = line.substring(0, 2);
        const file = line.substring(3).trim();

        if (code[0] === '?' && code[1] === '?') {
          untrackedFiles.push(file);
        } else {
          if (code[0] !== ' ' && code[0] !== '?') {
            stagedFiles.push(file);
          }
          if (code[1] !== ' ' && code[1] !== '?') {
            modifiedFiles.push(file);
          }
        }
      }
    }

    // 3. Active Worktrees
    const worktreesOut = runGit('worktree list --porcelain');
    if (worktreesOut) {
      const blocks = worktreesOut.split('\n\n');
      for (const block of blocks) {
        let wtPath = '';
        let wtBranch = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('worktree ')) wtPath = line.substring(9).trim();
          if (line.startsWith('branch ')) wtBranch = line.substring(7).replace('refs/heads/', '').trim();
        }
        if (wtPath) {
          const normProj = path.resolve(projectPath).toLowerCase();
          const normWt = path.resolve(wtPath).toLowerCase();
          activeWorktrees.push({
            path: wtPath,
            branch: wtBranch || 'detached',
            isCurrent: normProj === normWt
          });
        }
      }
    }

    // 4. Hotspot Churn Analysis (recent commits)
    const logOut = runGit('log --name-only --oneline -n 30');
    if (logOut) {
      const counts = new Map<string, number>();
      const lines = logOut.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !/^[0-9a-f]{7,}\s/.test(trimmed)) {
          counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
        }
      }

      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      for (const [f, c] of sorted) {
        hotspotFiles.push({ path: f, changesCount: c });
      }
    }

    return {
      branch,
      headCommit,
      commitMessage,
      isDirty,
      modifiedFiles,
      stagedFiles,
      untrackedFiles,
      activeWorktrees,
      hotspotFiles
    };
  }
}

export const gitIntelligenceService = new GitIntelligenceService();
