import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import type {
  OrchestrationTask,
  ExecutionMode,
  OrchestrationEventType
} from '../../shared/agents';
import { AgentWorker } from './agent-worker';
import { DAGValidator } from './dag-validator';
import { databaseService } from '../db/database.service';
import { WorktreeManager } from './worktree-manager';
import { agentCapabilityRegistry } from './agent-capability-registry';
import { traceService } from '../services/trace-service';

export interface SchedulerOptions {
  orchestrationId: string;
  projectPath: string;
  mode: ExecutionMode;
  maxConcurrent?: number;
}

export class AgentScheduler extends EventEmitter {
  private orchestrationId: string;
  private projectPath: string;
  private mode: ExecutionMode;
  private maxConcurrent: number;
  private tasks: Map<string, OrchestrationTask> = new Map();
  private activeWorkersCount = 0;
  private isCancelled = false;
  private running = false;

  constructor(options: SchedulerOptions) {
    super();
    this.orchestrationId = options.orchestrationId;
    this.projectPath = options.projectPath;
    this.mode = options.mode;
    this.maxConcurrent = options.maxConcurrent || 3;
  }

  public setTasks(taskList: OrchestrationTask[]): void {
    this.tasks.clear();
    for (const t of taskList) {
      this.tasks.set(t.id, t);
    }
  }

  public getTasks(): OrchestrationTask[] {
    return Array.from(this.tasks.values());
  }

  public getActiveWorkersCount(): number {
    return this.activeWorkersCount;
  }

  /**
   * Starts scheduling and executing tasks according to DAG dependencies.
   */
  public async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.isCancelled = false;

    this.emitEvent('orchestration_started', {
      orchestrationId: this.orchestrationId,
      totalTasks: this.tasks.size
    });

    await this.tick();
  }

  /**
   * Cancels the active scheduler, halts queue, and marks non-completed tasks as cancelled.
   */
  public cancel(): void {
    this.isCancelled = true;
    this.running = false;

    for (const task of this.tasks.values()) {
      if (['pending', 'ready', 'running', 'waiting_approval', 'reviewing'].includes(task.status)) {
        task.status = 'cancelled';
        task.errorMessage = 'Cancelled by user or parent workflow.';
        databaseService.updateOrchestrationTask(task.id, {
          status: 'cancelled',
          errorMessage: task.errorMessage
        });
        traceService.completeTrace(task.id, 'cancelled', task.errorMessage);
        agentCapabilityRegistry.trackTaskEnd(task.role);
      }
    }

    this.emitEvent('orchestration_cancelled', { orchestrationId: this.orchestrationId });
  }

  /**
   * Main scheduler tick: resolves dependencies, cascades failures, and starts ready tasks.
   */
  public async tick(): Promise<void> {
    if (this.isCancelled) return;

    // 1. Dependency Resolution & Cascading
    let stateChanged = false;

    for (const task of this.tasks.values()) {
      if (task.status === 'pending') {
        const deps = task.dependencies.map((dId) => this.tasks.get(dId));

        // Check if any dependency failed or was cancelled
        const failedDep = deps.find((d) => d && (d.status === 'failed' || d.status === 'cancelled' || d.status === 'blocked'));
        if (failedDep) {
          task.status = 'blocked';
          task.errorMessage = `Blocked by dependency "${failedDep.title}" which ${failedDep.status}.`;
          databaseService.updateOrchestrationTask(task.id, {
            status: 'blocked',
            errorMessage: task.errorMessage
          });
          stateChanged = true;
          this.emitEvent('task_blocked', { taskId: task.id, blockedBy: failedDep.id });
          continue;
        }

        // Check if all dependencies are completed
        const allCompleted = deps.length === 0 || deps.every((d) => d && d.status === 'completed');
        if (allCompleted) {
          task.status = 'ready';
          databaseService.updateOrchestrationTask(task.id, { status: 'ready' });
          stateChanged = true;
          this.emitEvent('task_scheduled', { taskId: task.id, title: task.title });
        }
      }
    }

    // 2. Schedule Ready Tasks within Bounded Concurrency Limit
    const readyTasks = Array.from(this.tasks.values()).filter((t) => t.status === 'ready');

    for (const task of readyTasks) {
      if (this.activeWorkersCount >= this.maxConcurrent) {
        break; // Bounded parallelism ceiling reached
      }

      // Check for file conflict overlap with other actively running tasks
      if (task.isModifying && task.plannedFiles && task.plannedFiles.length > 0) {
        const conflict = await WorktreeManager.checkTaskFileConflicts(task.id, task.plannedFiles);
        if (!conflict.canRunParallel) {
          // Defer running this task until conflicting tasks finish to protect git worktree
          continue;
        }
      }

      // Transition to running
      task.status = 'running';
      task.startedAt = Date.now();
      databaseService.updateOrchestrationTask(task.id, {
        status: 'running',
        startedAt: task.startedAt
      });

      agentCapabilityRegistry.trackTaskStart(task.role);
      this.activeWorkersCount++;
      this.emitEvent('task_started', {
        taskId: task.id,
        title: task.title,
        role: task.role,
        provider: task.assignedProvider
      });

      // Dispatch async worker without blocking tick loop
      this.dispatchWorker(task);
    }

    // 3. Check Overall Orchestration Completion
    const allTasks = Array.from(this.tasks.values());
    const isFinished = allTasks.every((t) => ['completed', 'failed', 'cancelled', 'blocked'].includes(t.status));

    if (isFinished && this.activeWorkersCount === 0) {
      this.running = false;
      const anyFailed = allTasks.some((t) => t.status === 'failed' || t.status === 'blocked');
      const allSuccess = allTasks.every((t) => t.status === 'completed');

      if (allSuccess) {
        // Record persistent engineering memory upon successful completion
        try {
          const orch = databaseService.getOrchestration(this.orchestrationId);
          if (orch && orch.projectId) {
            const allFiles = Array.from(new Set(allTasks.flatMap((t) => t.changedFiles)));
            databaseService.upsertKnowledgeEntry({
              id: `know-${this.orchestrationId}`,
              projectId: orch.projectId,
              category: 'convention',
              key: `orch-success-${this.orchestrationId}`,
              title: `Autonomous Task Execution: ${orch.userGoal.substring(0, 50)}`,
              content: `Successfully completed ${allTasks.length} task(s) under mode ${this.mode}. Touched: ${allFiles.join(', ') || 'no file changes'}`,
              confidence: 0.95,
              source: 'agent_summary',
              isConfirmed: true,
              metadata: { orchestrationId: this.orchestrationId, totalTasks: allTasks.length },
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          }
        } catch {}

        this.emitEvent('orchestration_completed', {
          orchestrationId: this.orchestrationId,
          tasksCount: allTasks.length
        });
      } else if (anyFailed) {
        this.emitEvent('orchestration_failed', {
          orchestrationId: this.orchestrationId,
          error: 'One or more tasks failed or were blocked.'
        });
      }
    }
  }

  public static isTransientError(errorMessage: string | Error): boolean {
    const msg = typeof errorMessage === 'string' ? errorMessage : (errorMessage?.message || '');
    const lower = msg.toLowerCase();
    return (
      lower.includes('rate limit') ||
      lower.includes('429') ||
      lower.includes('timeout') ||
      lower.includes('timed out') ||
      lower.includes('etimedout') ||
      lower.includes('econnreset') ||
      lower.includes('econnrefused') ||
      lower.includes('socket hang up') ||
      lower.includes('temporarily unavailable') ||
      lower.includes('network error') ||
      lower.includes('503') ||
      lower.includes('502') ||
      lower.includes('mcp request timeout')
    );
  }

  public static handleTaskFailure(
    task: { retryCount: number; maxRetries?: number },
    err: string | Error
  ): { shouldRetry: boolean; nextRetryCount: number; backoffDelayMs: number } {
    const errorMsg = typeof err === 'string' ? err : (err?.message || '');
    const isTransient = this.isTransientError(errorMsg);
    const maxRetries = task.maxRetries !== undefined ? task.maxRetries : 2;

    if (isTransient && task.retryCount < maxRetries) {
      const nextRetryCount = task.retryCount + 1;
      const baseDelay = Math.min(8000, 1000 * Math.pow(2, nextRetryCount - 1));
      const jitter = Math.floor(Math.random() * 500);
      const backoffDelayMs = baseDelay + jitter;
      return {
        shouldRetry: true,
        nextRetryCount,
        backoffDelayMs
      };
    }

    return {
      shouldRetry: false,
      nextRetryCount: task.retryCount,
      backoffDelayMs: 0
    };
  }

  private isTransientError(errorMessage: string): boolean {
    return AgentScheduler.isTransientError(errorMessage);
  }

  private async dispatchWorker(task: OrchestrationTask): Promise<void> {
    try {
      const res = await AgentWorker.executeTask(task, this.projectPath, this.mode, (chunk) => {
        this.emitEvent('task_output', { taskId: task.id, chunk });
      });

      task.completedAt = Date.now();
      task.changedFiles = res.changedFiles;
      task.diff = res.diff;
      task.resultSummary = res.resultSummary;

      if (res.status === 'waiting_approval') {
        task.status = 'waiting_approval';
        databaseService.updateOrchestrationTask(task.id, {
          status: 'waiting_approval',
          changedFiles: res.changedFiles,
          diff: res.diff,
          resultSummary: res.resultSummary
        });
        this.emitEvent('task_approval_needed', { taskId: task.id, title: task.title });
      } else if (res.success) {
        task.status = 'completed';
        databaseService.updateOrchestrationTask(task.id, {
          status: 'completed',
          completedAt: task.completedAt,
          changedFiles: res.changedFiles,
          diff: res.diff,
          resultSummary: res.resultSummary
        });
        this.emitEvent('task_completed', { taskId: task.id, title: task.title });
      } else {
        await this.handleTaskFailure(task, res.errorMessage || 'Execution failure');
      }
    } catch (err: any) {
      await this.handleTaskFailure(task, err?.message || 'Worker crash');
    } finally {
      agentCapabilityRegistry.trackTaskEnd(task.role);
      this.activeWorkersCount--;
      // Trigger next tick immediately to advance downstream dependencies
      await this.tick();
    }
  }

  private async handleTaskFailure(task: OrchestrationTask, errorMessage: string): Promise<void> {
    task.completedAt = Date.now();
    const isTransient = this.isTransientError(errorMessage);
    const maxRetries = task.maxRetries !== undefined ? task.maxRetries : 2;

    if (isTransient && task.retryCount < maxRetries && !this.isCancelled) {
      task.retryCount++;
      // Exponential backoff with jitter: min(8000, 1000 * 2^retryCount) + jitter (0-500ms)
      const baseDelay = Math.min(8000, 1000 * Math.pow(2, task.retryCount - 1));
      const jitter = Math.floor(Math.random() * 500);
      const backoffMs = baseDelay + jitter;

      task.status = 'ready'; // Re-queue task
      databaseService.updateOrchestrationTask(task.id, {
        status: 'ready',
        retryCount: task.retryCount,
        errorMessage: `Transient error: "${errorMessage}". Retrying in ${backoffMs}ms (attempt ${task.retryCount}/${maxRetries})...`
      });

      this.emitEvent('task_retry_scheduled', {
        taskId: task.id,
        retryCount: task.retryCount,
        backoffMs,
        error: errorMessage
      });

      // Brief sleep for jittered backoff before tick evaluates it again
      await new Promise((r) => setTimeout(r, backoffMs));
    } else {
      task.status = 'failed';
      task.errorMessage = errorMessage;
      databaseService.updateOrchestrationTask(task.id, {
        status: 'failed',
        completedAt: task.completedAt,
        errorMessage: task.errorMessage
      });
      this.emitEvent('task_failed', { taskId: task.id, error: task.errorMessage });
    }
  }

  /**
   * Resumes a task that was waiting for approval after user resolved it.
   */
  public async resumeAfterApproval(taskId: string, approved: boolean, rejectionReason?: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (approved) {
      task.status = 'completed';
      task.completedAt = Date.now();
      databaseService.updateOrchestrationTask(task.id, {
        status: 'completed',
        completedAt: task.completedAt
      });
      this.emitEvent('task_completed', { taskId: task.id, title: task.title });
    } else {
      task.status = 'failed';
      task.errorMessage = `User rejected merge: ${rejectionReason || 'No reason provided'}`;
      databaseService.updateOrchestrationTask(task.id, {
        status: 'failed',
        errorMessage: task.errorMessage
      });
      this.emitEvent('task_failed', { taskId: task.id, error: task.errorMessage });
    }

    await this.tick();
  }

  /**
   * Deterministically reconciles interrupted tasks and orchestrations on application startup without duplicate side effects.
   */
  public static async reconcileStartupInterruptedTasks(
    db: any,
    incidentRegistrar?: (incident: any) => void
  ): Promise<{
    reconciledTasksCount: number;
    requiresInterventionCount: number;
    classificationSummary: {
      DIRTY_RECOVERABLE: number;
      EXTERNAL_SIDE_EFFECTS_UNKNOWN: number;
      CLEAN_INTERRUPTED: number;
      PROVEN_COMPLETE: number;
      PROVEN_FAILED: number;
    };
  }> {
    let reconciledTasksCount = 0;
    let requiresInterventionCount = 0;
    const now = Date.now();
    const classificationSummary = {
      DIRTY_RECOVERABLE: 0,
      EXTERNAL_SIDE_EFFECTS_UNKNOWN: 0,
      CLEAN_INTERRUPTED: 0,
      PROVEN_COMPLETE: 0,
      PROVEN_FAILED: 0
    };

    try {
      const activeTasks = db.prepare(`
        SELECT id, orchestration_id, title, role, status, worktree_path, branch_name
        FROM orchestration_tasks
        WHERE status IN ('running', 'ready', 'reviewing', 'waiting_approval')
      `).all() as any[];

      for (const t of activeTasks) {
        reconciledTasksCount++;
        let isDirty = false;
        let hasUntracked = false;
        let snapshotResult: any = null;

        if (t.worktree_path && fs.existsSync(t.worktree_path)) {
          try {
            isDirty = await WorktreeManager.hasUncommittedChanges(t.worktree_path);
            snapshotResult = await WorktreeManager.saveWorktreeSnapshot(t.worktree_path, t.id);
            if (snapshotResult && snapshotResult.untrackedFiles && snapshotResult.untrackedFiles.length > 0) {
              hasUntracked = true;
            }
          } catch {}
        }

        // Check if task had active tool execution or in-flight trace spans
        let hasInFlightToolTraces = false;
        try {
          const traceCheck = db.prepare(`
            SELECT count(*) as count FROM task_traces
            WHERE task_id = ? AND status = 'running'
          `).get(t.id) as any;
          if (traceCheck && traceCheck.count > 0) {
            hasInFlightToolTraces = true;
          }
        } catch {}

        if (isDirty || hasUntracked) {
          // State: DIRTY_RECOVERABLE
          classificationSummary.DIRTY_RECOVERABLE++;
          requiresInterventionCount++;
          const snapshotDesc = snapshotResult?.patchPath || snapshotResult?.snapshotRef || 'directory preserved';

          db.prepare(`
            UPDATE orchestration_tasks
            SET status = 'requires_intervention',
                error_message = ?,
                completed_at = ?
            WHERE id = ?
          `).run(
            `[DIRTY_RECOVERABLE] Interrupted by shutdown with uncommitted worktree changes. Complete snapshot: ${snapshotDesc}`,
            now,
            t.id
          );

          if (incidentRegistrar) {
            incidentRegistrar({
              id: `interrupted-task-${t.id}`,
              type: 'interrupted_task',
              title: `Task Interrupted [DIRTY_RECOVERABLE]: ${t.title}`,
              description: `Task [${t.id}] was interrupted with uncommitted changes or untracked files. Physical worktree directory and snapshot preserved.`,
              severity: 'high',
              timestamp: now,
              suggestedAction: 'Inspect worktree snapshot, review changes, and resolve or re-queue.',
              targetId: t.id,
              isDestructive: false
            });
          }
        } else if (t.status === 'running' || hasInFlightToolTraces) {
          // State: EXTERNAL_SIDE_EFFECTS_UNKNOWN
          classificationSummary.EXTERNAL_SIDE_EFFECTS_UNKNOWN++;
          requiresInterventionCount++;

          db.prepare(`
            UPDATE orchestration_tasks
            SET status = 'requires_intervention',
                error_message = ?,
                completed_at = ?
            WHERE id = ?
          `).run(
            `[EXTERNAL_SIDE_EFFECTS_UNKNOWN] Interrupted during active tool execution. External APIs, network calls, or remote state may have been modified.`,
            now,
            t.id
          );

          if (incidentRegistrar) {
            incidentRegistrar({
              id: `interrupted-task-${t.id}`,
              type: 'interrupted_task',
              title: `Task Interrupted [EXTERNAL_SIDE_EFFECTS_UNKNOWN]: ${t.title}`,
              description: `Task [${t.id}] was actively executing tools when interrupted. External side effects may have occurred.`,
              severity: 'high',
              timestamp: now,
              suggestedAction: 'Verify external API state, remote repository branches, or MCP tool targets before resuming.',
              targetId: t.id,
              isDestructive: false
            });
          }
        } else {
          // State: CLEAN_INTERRUPTED
          classificationSummary.CLEAN_INTERRUPTED++;
          db.prepare(`
            UPDATE orchestration_tasks
            SET status = 'interrupted',
                error_message = '[CLEAN_INTERRUPTED] Interrupted by application restart/shutdown',
                completed_at = ?
            WHERE id = ?
          `).run(now, t.id);

          if (incidentRegistrar) {
            incidentRegistrar({
              id: `interrupted-task-${t.id}`,
              type: 'interrupted_task',
              title: `Task Interrupted [CLEAN_INTERRUPTED]: ${t.title}`,
              description: `Task [${t.id}] was in ${t.status} state without uncommitted edits or active tool traces.`,
              severity: 'medium',
              timestamp: now,
              suggestedAction: 'Review task requirements and re-queue if desired.',
              targetId: t.id,
              isDestructive: false
            });
          }
        }
      }

      // Reconcile active orchestrations
      db.prepare(`
        UPDATE orchestrations
        SET status = 'interrupted',
            error_message = 'Interrupted by application restart/shutdown',
            completed_at = ?
        WHERE status IN ('planning', 'running', 'reviewing')
      `).run(now);

      // Reconcile active traces
      try {
        db.prepare(`UPDATE task_traces SET status = 'interrupted', completed_at = ? WHERE status = 'running'`).run(now);
      } catch {}

    } catch (err: any) {
      console.error('[AgentScheduler] Startup reconciliation error:', err.message);
    }

    return {
      reconciledTasksCount,
      requiresInterventionCount,
      classificationSummary
    };
  }

  private emitEvent(type: OrchestrationEventType, data: any): void {
    this.emit('event', {
      orchestrationId: this.orchestrationId,
      taskId: data?.taskId,
      type,
      data,
      timestamp: Date.now()
    });
  }
}
