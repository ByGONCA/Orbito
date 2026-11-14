import { exec } from 'node:child_process';
import type { OrchestrationTask } from '../../shared/agents';
import { WorktreeManager } from '../agents/worktree-manager';

export interface QualityEvaluationResult {
  passed: boolean;
  score: number; // 0 - 100
  failureReasons: string[];
  deterministicChecks: {
    typeScriptCheck?: { passed: boolean; outputSnippet?: string };
    testCheck?: { passed: boolean; passedCount?: number; failedCount?: number };
    diffCheck?: { passed: boolean; modifiedFileCount: number; hasUnintendedDeletions: boolean };
    secretSanityCheck?: { passed: boolean; leakedPatterns?: string[] };
    acceptanceCriteriaMet?: { passed: boolean; unmetCriteria: string[] };
  };
  recommendedAction: 'accept' | 'retry_same_model' | 'escalate_model' | 'abort';
  escalationRationale?: string;
}

export class ModelEvaluationEngine {
  private static instance: ModelEvaluationEngine;

  private constructor() {}

  public static getInstance(): ModelEvaluationEngine {
    if (!ModelEvaluationEngine.instance) {
      ModelEvaluationEngine.instance = new ModelEvaluationEngine();
    }
    return ModelEvaluationEngine.instance;
  }

  /**
   * Deterministically evaluates task execution outcomes across compiler, diff, and safety checks.
   */
  public async evaluateTaskOutcome(
    task: OrchestrationTask,
    targetDirectory: string
  ): Promise<QualityEvaluationResult> {
    const failureReasons: string[] = [];
    const checks: QualityEvaluationResult['deterministicChecks'] = {};

    // 1. Diff & Filesystem Check
    const changedFiles = await WorktreeManager.getChangedFiles(targetDirectory);
    const diff = await WorktreeManager.getDiff(targetDirectory);

    const hasDeletions = /(^|\n)--- (a\/[^\n]+)\n\+\+\+ \/dev\/null/i.test(diff || '');
    checks.diffCheck = {
      passed: changedFiles.length > 0 || !task.isModifying,
      modifiedFileCount: changedFiles.length,
      hasUnintendedDeletions: hasDeletions
    };

    if (task.isModifying && changedFiles.length === 0) {
      failureReasons.push('Modifying task completed without altering any project files.');
    }

    if (hasDeletions && !task.description.toLowerCase().includes('delete') && !task.description.toLowerCase().includes('remove')) {
      failureReasons.push('Unintended file deletion detected in Git diff.');
    }

    // 2. Secret Sanity Check (prevent accidental credential leaks in modified files)
    const secretLeakPattern = /(sk-[a-zA-Z0-9]{32,}|ghp_[a-zA-Z0-9]{36}|AIza[0-9A-Za-z-_]{35})/g;
    const matches = (diff || '').match(secretLeakPattern);
    checks.secretSanityCheck = {
      passed: !matches || matches.length === 0,
      leakedPatterns: matches || []
    };

    if (matches && matches.length > 0) {
      failureReasons.push('Security violation: Exposed hardcoded secret or API token detected in diff.');
    }

    // 3. TypeScript Compilation Check (if tsconfig.json exists in targetDirectory)
    const tsCheck = await this.runTypeScriptCheck(targetDirectory);
    checks.typeScriptCheck = tsCheck;
    if (!tsCheck.passed) {
      failureReasons.push(`TypeScript compiler diagnostics failed: ${tsCheck.outputSnippet?.slice(0, 150)}`);
    }

    // 4. Acceptance Criteria Evaluation
    const unmet: string[] = [];
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      for (const criteria of task.acceptanceCriteria) {
        // Simple heuristic: verify criteria keywords appear in diff or summary
        const lowerCrit = criteria.toLowerCase();
        const keywords = lowerCrit.split(' ').filter((w) => w.length > 4);
        const matchesContent = keywords.some(
          (k) => (diff || '').toLowerCase().includes(k) || (task.resultSummary || '').toLowerCase().includes(k)
        );
        if (!matchesContent && keywords.length > 2) {
          unmet.push(criteria);
        }
      }
    }

    checks.acceptanceCriteriaMet = {
      passed: unmet.length === 0,
      unmetCriteria: unmet
    };

    const isPassed = failureReasons.length === 0;

    // Calculate quality score (0 - 100)
    let score = 100;
    if (!tsCheck.passed) score -= 35;
    if (!checks.diffCheck.passed) score -= 40;
    if (!checks.secretSanityCheck.passed) score -= 50;
    if (unmet.length > 0) score -= unmet.length * 10;
    score = Math.max(0, score);

    // Determine recommended escalation action
    let recommendedAction: QualityEvaluationResult['recommendedAction'] = 'accept';
    let escalationRationale: string | undefined;

    if (!isPassed) {
      if (!checks.secretSanityCheck.passed) {
        recommendedAction = 'abort';
        escalationRationale = 'Security boundary violation detected; task aborted to prevent credential leak.';
      } else if (!tsCheck.passed && task.retryCount === 0) {
        // First compile error: give same model one retry with compiler error diagnostics
        recommendedAction = 'retry_same_model';
        escalationRationale = 'Isolated syntax/type defect; retrying with compiler diagnostics.';
      } else {
        // Repeated error or logical/criteria defect: escalate to frontier model
        recommendedAction = 'escalate_model';
        escalationRationale = `Task failed quality verification (Score: ${score}/100). Escalating to higher-capability reasoning model.`;
      }
    }

    return {
      passed: isPassed,
      score,
      failureReasons,
      deterministicChecks: checks,
      recommendedAction,
      escalationRationale
    };
  }

  private runTypeScriptCheck(dir: string): Promise<{ passed: boolean; outputSnippet?: string }> {
    return new Promise((resolve) => {
      // Fast check: only run if tsconfig.json is present
      exec('npx tsc --noEmit', { cwd: dir, timeout: 15000 }, (error, stdout, stderr) => {
        if (!error) {
          resolve({ passed: true });
        } else {
          const out = (stdout || stderr || '').trim();
          resolve({
            passed: false,
            outputSnippet: out.split('\n').slice(0, 3).join('\n')
          });
        }
      });
    });
  }
}

export const modelEvaluationEngine = ModelEvaluationEngine.getInstance();
