import crypto from 'node:crypto';
import type { OrchestrationTask, ExecutionMode, ApprovalRequest } from '../../shared/agents';
import { SPECIALIST_ROLES } from './specialist-roles';
import { skillRegistry } from '../skills/skill-registry';
import { SkillLoader } from '../skills/skill-loader';
import { contextRetrievalService } from '../context/retrieval/context-retrieval.service';
import { contextAssemblyService } from '../context/assembly/context-assembly.service';
import { executionEngine } from '../cli/execution-engine';
import { WorktreeManager } from './worktree-manager';
import { ReviewerAgent } from './reviewer-agent';
import { databaseService } from '../db/database.service';

export interface WorkerExecutionResult {
  success: boolean;
  status: 'completed' | 'waiting_approval' | 'failed';
  changedFiles: string[];
  diff?: string;
  resultSummary?: string;
  errorMessage?: string;
}

export class AgentWorker {
  /**
   * Executes an assigned task using its specialist persona, bound skills, and isolated worktree.
   */
  public static async executeTask(
    task: OrchestrationTask,
    projectPath: string,
    mode: ExecutionMode,
    onStreamChunk?: (chunk: string) => void
  ): Promise<WorkerExecutionResult> {
    const specialist = SPECIALIST_ROLES[task.role] || SPECIALIST_ROLES.backend;

    // 1. Prepare Worktree if modifying task
    let targetDir = projectPath;
    if (task.isModifying) {
      const wtRes = await WorktreeManager.createWorktree(projectPath, task.id);
      if (wtRes.success && wtRes.worktree) {
        task.worktreePath = wtRes.worktree.worktreePath;
        task.branchName = wtRes.worktree.branchName;
        targetDir = wtRes.worktree.worktreePath;
        databaseService.updateOrchestrationTask(task.id, {
          worktreePath: task.worktreePath,
          branchName: task.branchName
        });
      }
    }

    // 2. Load and compose instructions from bound skills
    const skillInstructions: string[] = [];
    const skillsToLoad = Array.from(new Set([...specialist.boundSkillIds, ...task.requiredSkills]));

    for (const sId of skillsToLoad) {
      const skill = skillRegistry.getSkill(sId);
      if (skill && skill.enabled) {
        const details = SkillLoader.loadDetails(skill);
        if (details.instructions) {
          skillInstructions.push(`### Skill: ${details.name}\n${details.instructions}`);
        }
      }
    }

    // 3. Assemble context from project / worktree
    let assembledContext = '';
    try {
      const fragments = await contextRetrievalService.retrieve({
        taskDescription: `${task.title}: ${task.description}`,
        maxCandidates: 15
      });

      const assembly = await contextAssemblyService.assemble({
        projectPath: targetDir,
        fragments,
        maxTokens: 12000,
        modelTarget: task.assignedProvider
      });

      assembledContext = assembly.assembledText;
    } catch {}

    // 4. Build Specialist Composite Prompt
    const compositePrompt = this.buildWorkerPrompt({
      specialist,
      task,
      skillInstructions,
      contextMarkdown: assembledContext
    });

    // 5. Spawn execution via CLI Engine
    const sessionId = `sess-task-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    try {
      await executionEngine.execute({
        sessionId,
        provider: task.assignedProvider,
        prompt: compositePrompt,
        workingDirectory: targetDir,
        timeoutSeconds: task.timeoutSeconds
      });

      // 6. Collect results and file diffs
      let changedFiles: string[] = [];
      let diff: string | undefined;

      if (task.isModifying) {
        changedFiles = await WorktreeManager.getChangedFiles(targetDir);
        diff = await WorktreeManager.getDiff(targetDir);
        await WorktreeManager.commitWorktreeChanges(targetDir, `feat(${task.role}): ${task.title}`);
      }

      task.changedFiles = changedFiles;
      task.diff = diff;
      task.resultSummary = `Task completed by ${specialist.title}. Modified ${changedFiles.length} file(s).`;

      // 7. Quality Gate: Independent Reviewer Agent
      databaseService.updateOrchestrationTask(task.id, {
        status: 'reviewing',
        changedFiles,
        diff,
        resultSummary: task.resultSummary
      });

      const review = await ReviewerAgent.reviewTask(task, projectPath);
      task.reviewFeedback = review.feedback;
      task.reviewStatus = review.passed ? 'passed' : 'remediation_needed';

      if (!review.passed && review.needsRemediation) {
        if (task.retryCount < task.maxRetries) {
          task.retryCount++;
          databaseService.updateOrchestrationTask(task.id, {
            retryCount: task.retryCount,
            reviewFeedback: task.reviewFeedback,
            reviewStatus: 'remediation_needed'
          });
          // Perform one remediation retry with reviewer feedback injected
          return await this.executeRemediation(task, projectPath, mode, review.feedback, onStreamChunk);
        } else {
          return {
            success: false,
            status: 'failed',
            changedFiles,
            diff,
            errorMessage: `Reviewer rejected task: ${review.feedback}`
          };
        }
      }

      // 8. Handle Approval Checkpoints based on Execution Mode
      if (task.isModifying && (mode === 'manual' || mode === 'supervised')) {
        const approval: ApprovalRequest = {
          id: `appr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          orchestrationId: task.orchestrationId,
          taskId: task.id,
          type: 'merge_worktree',
          title: `Approve merge for task: ${task.title}`,
          description: `Agent "${specialist.title}" modified ${changedFiles.length} file(s). Review diff before merging.`,
          diff,
          changedFiles,
          status: 'pending',
          createdAt: Date.now()
        };

        databaseService.createApprovalRequest(approval);
        databaseService.updateOrchestrationTask(task.id, { status: 'waiting_approval' });

        return {
          success: true,
          status: 'waiting_approval',
          changedFiles,
          diff,
          resultSummary: 'Waiting for user merge approval.'
        };
      }

      // If autonomous mode or non-modifying: merge branch immediately if worktree exists
      if (task.isModifying && task.branchName && task.branchName !== 'none') {
        const mergeRes = await WorktreeManager.mergeBranch(projectPath, task.branchName);
        if (!mergeRes.success) {
          return {
            success: false,
            status: 'failed',
            changedFiles,
            errorMessage: `Auto-merge failed: ${mergeRes.error}`
          };
        }
        await WorktreeManager.removeWorktree(projectPath, targetDir, task.branchName, true);
      }

      return {
        success: true,
        status: 'completed',
        changedFiles,
        diff,
        resultSummary: task.resultSummary
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        changedFiles: [],
        errorMessage: err.message || 'Worker execution error'
      };
    }
  }

  private static async executeRemediation(
    task: OrchestrationTask,
    projectPath: string,
    mode: ExecutionMode,
    reviewerFeedback: string,
    onStreamChunk?: (chunk: string) => void
  ): Promise<WorkerExecutionResult> {
    const targetDir = task.worktreePath || projectPath;
    const specialist = SPECIALIST_ROLES[task.role] || SPECIALIST_ROLES.backend;

    const remediationPrompt = [
      `=== REMEDIATION DIRECTIVE FOR ${specialist.title.toUpperCase()} ===`,
      `The Reviewer Agent evaluated your previous output and found the following blocking defects:`,
      reviewerFeedback,
      '',
      `Please surgically resolve these issues in ${targetDir}.`,
      `Original Task: ${task.title}`,
      `Description: ${task.description}`
    ].join('\n');

    const sessionId = `sess-remed-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    try {
      await executionEngine.execute({
        sessionId,
        provider: task.assignedProvider,
        prompt: remediationPrompt,
        workingDirectory: targetDir,
        timeoutSeconds: task.timeoutSeconds
      });

      const changedFiles = await WorktreeManager.getChangedFiles(targetDir);
      const diff = await WorktreeManager.getDiff(targetDir);
      await WorktreeManager.commitWorktreeChanges(targetDir, `fix(${task.role}): remediation for ${task.title}`);

      // Second review after remediation
      const secondReview = await ReviewerAgent.reviewTask(task, projectPath);
      if (!secondReview.passed) {
        return {
          success: false,
          status: 'failed',
          changedFiles,
          diff,
          errorMessage: `Remediation failed: ${secondReview.feedback}`
        };
      }

      return {
        success: true,
        status: 'completed',
        changedFiles,
        diff,
        resultSummary: `Remediation successful: ${secondReview.feedback}`
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        changedFiles: [],
        errorMessage: err.message || 'Remediation error'
      };
    }
  }

  private static buildWorkerPrompt(params: {
    specialist: any;
    task: OrchestrationTask;
    skillInstructions: string[];
    contextMarkdown: string;
  }): string {
    const parts: string[] = [];

    parts.push(`=== SPECIALIST PERSONA: ${params.specialist.title.toUpperCase()} ===`);
    parts.push(params.specialist.systemPrompt);
    parts.push('');

    if (params.skillInstructions.length > 0) {
      parts.push('=== BOUND DOMAIN SKILLS ===');
      parts.push(params.skillInstructions.join('\n\n'));
      parts.push('');
    }

    if (params.contextMarkdown) {
      parts.push('=== RELEVANT CODEBASE CONTEXT ===');
      parts.push(params.contextMarkdown);
      parts.push('');
    }

    parts.push('=== ASSIGNED TASK ===');
    parts.push(`Title: ${params.task.title}`);
    parts.push(`Description: ${params.task.description}`);

    if (params.task.acceptanceCriteria.length > 0) {
      parts.push('Acceptance Criteria:');
      for (const crit of params.task.acceptanceCriteria) {
        parts.push(`- ${crit}`);
      }
    }

    return parts.join('\n');
  }
}
