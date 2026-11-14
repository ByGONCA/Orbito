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
import { PromptAssemblyService } from '../prompt/prompt-assembly.service';
import { ToolOutputNormalizer } from '../services/tool-output-normalizer';
import { mcpRegistry } from '../mcp/mcp-registry';
import { mcpPermissionManager } from '../mcp/security/mcp-permission-manager';
import { traceService } from '../services/trace-service';
import { adaptiveModelRouter } from '../ai/adaptive-model-router';
import { modelContextHandoffManager } from '../ai/model-context-handoff';

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

    // Initialize or continue Task Execution Trace
    const trace = traceService.startTrace({
      orchestrationId: task.orchestrationId,
      taskId: task.id,
      taskTitle: task.title,
      agentId: task.role,
      role: specialist.title,
      worktreePath: task.worktreePath
    });
    task.traceId = trace.traceId;

    // 1. Prepare Worktree if modifying task
    let targetDir = projectPath;
    if (task.isModifying) {
      const wtStart = Date.now();
      const wtRes = await WorktreeManager.createWorktree(projectPath, task.id);
      if (wtRes.success && wtRes.worktree) {
        task.worktreePath = wtRes.worktree.worktreePath;
        task.branchName = wtRes.worktree.branchName;
        targetDir = wtRes.worktree.worktreePath;
        databaseService.updateOrchestrationTask(task.id, {
          worktreePath: task.worktreePath,
          branchName: task.branchName,
          traceId: task.traceId
        });

        traceService.recordSpan(task.id, {
          name: 'Worktree Isolation Setup',
          layer: 'worktree',
          status: 'completed',
          startedAt: wtStart,
          completedAt: Date.now(),
          metadata: { branch: task.branchName, path: targetDir }
        });
      }
    }

    // 2. Discover authorized MCP tools for this agent/task
    const mcpToolInstructions: string[] = [];
    try {
      const allServers = mcpRegistry.listServers(projectPath);
      const authorizedTools: string[] = [];

      for (const server of allServers) {
        if (!server.enabled) continue;
        const access = mcpPermissionManager.evaluateServerAccess(server, task.role, projectPath);
        if (access.allowed && server.tools && server.tools.length > 0) {
          const toolsSummary = server.tools
            .map((t) => `  - ${t.name}: ${t.description || 'No description'}`)
            .join('\n');
          authorizedTools.push(`Server: ${server.name}\n${toolsSummary}`);
        }
      }

      if (authorizedTools.length > 0) {
        mcpToolInstructions.push(
          `### Authorized Model Context Protocol (MCP) Tools:\n${authorizedTools.join('\n\n')}`
        );
      }
    } catch {}

    // 3. Load and compose instructions from bound skills
    const skillInstructions: string[] = [...mcpToolInstructions];
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

    // 4. Assemble context from project / worktree
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

    // 5. Build Specialist Composite Prompt
    const compositePrompt = this.buildWorkerPrompt({
      specialist,
      task,
      skillInstructions,
      contextMarkdown: assembledContext
    });

    // 6. Spawn execution via CLI Engine
    const sessionId = `sess-task-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const cliExecStart = Date.now();

    try {
      await executionEngine.execute({
        sessionId,
        provider: task.assignedProvider,
        targetModel: task.assignedModel,
        prompt: compositePrompt,
        workingDirectory: targetDir,
        timeoutSeconds: task.timeoutSeconds
      });

      traceService.recordSpan(task.id, {
        name: `Agent CLI Execution (${task.assignedProvider})`,
        layer: 'cli',
        status: 'completed',
        startedAt: cliExecStart,
        completedAt: Date.now(),
        metadata: { provider: task.assignedProvider, sessionId }
      });

      // 7. Collect results and file diffs
      let changedFiles: string[] = [];
      let diff: string | undefined;

      if (task.isModifying) {
        changedFiles = await WorktreeManager.getChangedFiles(targetDir);
        const rawDiff = await WorktreeManager.getDiff(targetDir);
        diff = rawDiff ? ToolOutputNormalizer.normalizeDiff(rawDiff) : undefined;
        await WorktreeManager.commitWorktreeChanges(targetDir, `feat(${task.role}): ${task.title}`);
      }

      task.changedFiles = changedFiles;
      task.diff = diff;
      task.resultSummary = `Task completed by ${specialist.title}. Modified ${changedFiles.length} file(s).`;

      // 8. Quality Gate: Automated Verification & Reviewer Inspection
      databaseService.updateOrchestrationTask(task.id, {
        status: 'verifying',
        changedFiles,
        diff,
        resultSummary: task.resultSummary
      });

      const verifyStart = Date.now();
      traceService.recordSpan(task.id, {
        name: 'Automated Quality Gate Verification',
        layer: 'verification',
        status: 'running',
        startedAt: verifyStart
      });

      const reviewStart = Date.now();
      const review = await ReviewerAgent.reviewTask(task, projectPath);
      task.reviewFeedback = review.feedback;
      task.reviewStatus = review.passed ? 'passed' : 'remediation_needed';

      traceService.recordSpan(task.id, {
        name: 'Automated Quality Gate Verification',
        layer: 'verification',
        status: review.passed ? 'completed' : 'failed',
        startedAt: verifyStart,
        completedAt: Date.now(),
        metadata: {
          typecheckPassed: review.qualityGateResults.typecheckPassed,
          testsPassed: review.qualityGateResults.testsPassed,
          diffInspected: review.qualityGateResults.diffInspected
        }
      });

      traceService.recordSpan(task.id, {
        name: 'Reviewer Agent Inspection',
        layer: 'reviewer',
        status: review.passed ? 'completed' : 'failed',
        startedAt: reviewStart,
        completedAt: Date.now(),
        metadata: { passed: review.passed, status: task.reviewStatus }
      });

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
          traceService.completeTrace(task.id, 'failed', `Reviewer rejected task: ${review.feedback}`);
          return {
            success: false,
            status: 'failed',
            changedFiles,
            diff,
            errorMessage: `Reviewer rejected task: ${review.feedback}`
          };
        }
      }

      // 9. Handle Approval Checkpoints based on Execution Mode
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

        traceService.recordSpan(task.id, {
          name: 'Human Approval Gate',
          layer: 'approval',
          status: 'running',
          startedAt: Date.now(),
          metadata: { approvalId: approval.id, filesCount: changedFiles.length }
        });

        return {
          success: true,
          status: 'waiting_approval',
          changedFiles,
          diff,
          resultSummary: 'Waiting for user merge approval.'
        };
      }

      // 10. Autonomous Integration: Pre-Merge Simulation & Safe Merge
      if (task.isModifying && task.branchName && task.branchName !== 'none') {
        const intStart = Date.now();
        databaseService.updateOrchestrationTask(task.id, { status: 'integrating' });

        // Pre-merge conflict simulation via git merge-tree
        const sim = await WorktreeManager.simulateMerge(projectPath, task.branchName);
        if (!sim.clean) {
          traceService.recordSpan(task.id, {
            name: 'Git Merge Simulation',
            layer: 'integration',
            status: 'failed',
            startedAt: intStart,
            completedAt: Date.now(),
            errorMessage: `Merge conflict simulated: ${sim.conflicts.join(', ')}`
          });
          traceService.completeTrace(task.id, 'failed', `Merge conflict simulated: ${sim.conflicts.join(', ')}`);
          return {
            success: false,
            status: 'failed',
            changedFiles,
            errorMessage: `Merge simulation detected conflict on: ${sim.conflicts.join(', ')}`
          };
        }

        // Apply merge
        const mergeRes = await WorktreeManager.mergeBranch(projectPath, task.branchName);
        if (!mergeRes.success) {
          traceService.recordSpan(task.id, {
            name: 'Git Worktree Integration',
            layer: 'integration',
            status: 'failed',
            startedAt: intStart,
            completedAt: Date.now(),
            errorMessage: mergeRes.error
          });
          traceService.completeTrace(task.id, 'failed', `Auto-merge failed: ${mergeRes.error}`);
          return {
            success: false,
            status: 'failed',
            changedFiles,
            errorMessage: `Auto-merge failed: ${mergeRes.error}`
          };
        }

        traceService.recordSpan(task.id, {
          name: 'Git Worktree Integration',
          layer: 'integration',
          status: 'completed',
          startedAt: intStart,
          completedAt: Date.now(),
          metadata: { branch: task.branchName, filesCount: changedFiles.length }
        });

        await WorktreeManager.removeWorktree(projectPath, targetDir, task.branchName, true);
      }

      traceService.completeTrace(task.id, 'completed');
      return {
        success: true,
        status: 'completed',
        changedFiles,
        diff,
        resultSummary: task.resultSummary
      };
    } catch (err: any) {
      traceService.completeTrace(task.id, 'failed', err.message || 'Worker execution error');
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

    // Escalate to higher-capability model for remediation if eligible
    const escalationRoute = adaptiveModelRouter.routeOperation({
      taskDescription: `Remediation for ${task.title}: ${reviewerFeedback}`,
      category: 'deep_reasoning',
      preferredProvider: task.assignedProvider,
      isEscalation: true,
      failedModelId: task.assignedModel
    });

    const previousModel = task.assignedModel || 'unknown';
    const effectiveModel = escalationRoute.officialModelId || escalationRoute.selectedModelId;
    const effectiveProvider = escalationRoute.selectedProvider;

    // Record model switch event and check for loops
    const switchCheck = modelContextHandoffManager.recordSwitch(task.id, {
      fromModel: previousModel,
      toModel: effectiveModel,
      fromProvider: task.assignedProvider,
      toProvider: effectiveProvider,
      reason: `Reviewer remediation required: ${reviewerFeedback.slice(0, 80)}`,
      stageName: task.title,
      timestamp: Date.now()
    });

    if (!switchCheck.allowed) {
      console.warn(`[AgentWorker] Model switch restricted during remediation: ${switchCheck.reason}`);
    }

    // Update task assignment in SQLite if model escalated
    if (effectiveModel !== previousModel) {
      task.assignedModel = effectiveModel;
      task.assignedProvider = effectiveProvider;
      databaseService.updateOrchestrationTask(task.id, {
        assignedModel: effectiveModel,
        assignedProvider: effectiveProvider
      });
    }

    // Assemble structured handoff prompt
    const handoffPackage = {
      taskId: task.id,
      orchestrationId: task.orchestrationId,
      originalGoal: task.title,
      currentObjective: `Surgically resolve blocking defects: ${reviewerFeedback}`,
      currentRole: specialist.title,
      fromModel: previousModel,
      toModel: effectiveModel,
      fromProvider: task.assignedProvider,
      toProvider: effectiveProvider,
      switchReason: escalationRoute.reason,
      completedStages: [{
        stageId: task.id,
        role: specialist.title,
        modelUsed: previousModel,
        summary: task.resultSummary || 'Initial execution attempt'
      }],
      architecturalInvariants: ['Ensure zero regression in surrounding components', 'Satisfy all acceptance criteria'],
      changedFiles: task.changedFiles || [],
      diffSnippet: task.diff,
      reviewerFeedback,
      switchCount: modelContextHandoffManager.getSwitchHistory(task.id).length
    };

    const remediationPrompt = modelContextHandoffManager.assembleHandoffPrompt(handoffPackage);
    const sessionId = `sess-remed-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    try {
      await executionEngine.execute({
        sessionId,
        provider: task.assignedProvider,
        targetModel: task.assignedModel,
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
    const assembled = PromptAssemblyService.assemblePrompt({
      systemPrompt: params.specialist.systemPrompt,
      securityConstraints: [
        'Adhere to project security guidelines and local workspace boundaries.',
        'Only modify files directly assigned to this task objective.',
        'Preserve all unrelated comments, tests, and documentation.'
      ],
      userObjective: `${params.task.title}\n${params.task.description || ''}`,
      acceptanceCriteria: params.task.acceptanceCriteria || [],
      skillInstructions: params.skillInstructions.join('\n\n'),
      contextMarkdown: params.contextMarkdown,
      expectedOutputFormat: 'Complete the task directly. Report summary of actions and changed files.'
    });

    return assembled.assembledPrompt;
  }
}
