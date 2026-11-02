import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { WorktreeManager } from '../src/main/agents/worktree-manager';

const TEST_DIR = path.join(process.cwd(), '.test-worktree-workspace');

describe('Worktree Manager (Git Worktree Isolation & Overlap Checks)', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('correctly identifies non-git directory and falls back gracefully', async () => {
    const isRepo = await WorktreeManager.isGitRepo(TEST_DIR);
    expect(isRepo).toBe(false);

    // Should gracefully fallback to using projectPath directly without crash
    const res = await WorktreeManager.createWorktree(TEST_DIR, 'task-test-non-git');
    expect(res.success).toBe(true);
    expect(res.worktree?.worktreePath).toBe(TEST_DIR);
    expect(res.worktree?.branchName).toBe('none');
  });

  it('detects overlapping modified files between parallel workers', () => {
    const filesWorkerA = ['src/components/Header.tsx', 'src/shared/types.ts', 'src/utils/math.ts'];
    const filesWorkerB = ['src/components/Footer.tsx', 'src/shared/types.ts']; // Overlaps on types.ts!

    const overlap = WorktreeManager.checkOverlaps(filesWorkerA, filesWorkerB);
    expect(overlap.hasOverlap).toBe(true);
    expect(overlap.conflictingFiles).toEqual(['src/shared/types.ts']);

    const filesWorkerC = ['src/components/Sidebar.tsx', 'src/api/client.ts'];
    const noOverlap = WorktreeManager.checkOverlaps(filesWorkerA, filesWorkerC);
    expect(noOverlap.hasOverlap).toBe(false);
    expect(noOverlap.conflictingFiles.length).toBe(0);
  });

  it('detects git repo for actual repository', async () => {
    const isRepo = await WorktreeManager.isGitRepo(process.cwd());
    expect(isRepo).toBe(true);
  });
});
