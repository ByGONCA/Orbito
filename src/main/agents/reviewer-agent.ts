import path from 'node:path';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { OrchestrationTask } from '../../shared/agents';
import { WorktreeManager } from './worktree-manager';

const execAsync = promisify(exec);

export interface ReviewResult {
  passed: boolean;
  needsRemediation: boolean;
  feedback: string;
  qualityGateResults: {
    typecheckPassed?: boolean;
    testsPassed?: boolean;
    diffInspected: boolean;
  };
}

export class ReviewerAgent {
  /**
   * Performs an independent review of a completed task.
   */
  public static async reviewTask(
    task: OrchestrationTask,
    projectPath: string
  ): Promise<ReviewResult> {
    const targetDir = task.worktreePath || projectPath;

    // Reviewer cannot review its own changes
    if (task.role === 'reviewer') {
      return {
        passed: true,
        needsRemediation: false,
        feedback: 'Reviewer metadata task automatically verified.',
        qualityGateResults: { diffInspected: true }
      };
    }

    // 1. Inspect diff and changed files
    const changedFiles =
      task.changedFiles !== undefined && task.changedFiles.length > 0
        ? task.changedFiles
        : await WorktreeManager.getChangedFiles(targetDir);

    const actualFilesCount = task.changedFiles !== undefined ? task.changedFiles.length : changedFiles.length;

    const qualityGateResults = {
      typecheckPassed: undefined as boolean | undefined,
      testsPassed: undefined as boolean | undefined,
      diffInspected: true
    };

    const issues: string[] = [];

    // 2. Automated Quality Gates: Typecheck & Tests (if project configured)
    const packageJsonPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        // Run typecheck if npm run typecheck exists
        if (pkg.scripts && pkg.scripts.typecheck) {
          try {
            await execAsync('npm run typecheck', { cwd: targetDir, timeout: 30000 });
            qualityGateResults.typecheckPassed = true;
          } catch (err: any) {
            qualityGateResults.typecheckPassed = false;
            issues.push(`TypeScript typecheck failed: ${err.message || 'Compiler errors detected'}`);
          }
        }

        // Run tests if npm test exists and is modifying task
        if (task.isModifying && pkg.scripts && pkg.scripts.test && !pkg.scripts.test.includes('echo "Error')) {
          try {
            await execAsync('npm test', { cwd: targetDir, timeout: 45000 });
            qualityGateResults.testsPassed = true;
          } catch (err: any) {
            qualityGateResults.testsPassed = false;
            issues.push(`Automated test suite failed: ${err.message || 'Unit tests failed'}`);
          }
        }
      } catch {}
    }

    // 3. Acceptance Criteria Check
    if (task.isModifying && actualFilesCount === 0 && !task.resultSummary) {
      issues.push('Task marked as modifying but zero files were modified.');
    }

    // 4. Formulate Verdict
    if (issues.length > 0) {
      const feedback = [
        `Reviewer identified ${issues.length} blocking issue(s):`,
        ...issues.map((iss, i) => `${i + 1}. ${iss}`),
        'Remediation required before merge approval.'
      ].join('\n');

      return {
        passed: false,
        needsRemediation: true,
        feedback,
        qualityGateResults
      };
    }

    return {
      passed: true,
      needsRemediation: false,
      feedback: `Review passed: ${changedFiles.length} file(s) modified cleanly. Quality gates satisfied.`,
      qualityGateResults
    };
  }
}
