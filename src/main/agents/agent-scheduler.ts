import { EventEmitter } from 'node:events';
import type {
  OrchestrationTask,
  ExecutionMode,
  OrchestrationEventType
} from '../../shared/agents';
import { AgentWorker } from './agent-worker';
import { DAGValidator } from './dag-validator';
import { databaseService } from '../db/database.service';

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

      // Transition to running
      task.status = 'running';
      task.startedAt = Date.now();
      databaseService.updateOrchestrationTask(task.id, {
        status: 'running',
        startedAt: task.startedAt
      });

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
        task.status = 'failed';
        task.errorMessage = res.errorMessage || 'Execution failure';
        databaseService.updateOrchestrationTask(task.id, {
          status: 'failed',
          completedAt: task.completedAt,
          errorMessage: task.errorMessage
        });
        this.emitEvent('task_failed', { taskId: task.id, error: task.errorMessage });
      }
    } catch (err: any) {
      task.status = 'failed';
      task.completedAt = Date.now();
      task.errorMessage = err.message || 'Worker crash';
      databaseService.updateOrchestrationTask(task.id, {
        status: 'failed',
        completedAt: task.completedAt,
        errorMessage: task.errorMessage
      });
      this.emitEvent('task_failed', { taskId: task.id, error: task.errorMessage });
    } finally {
      this.activeWorkersCount--;
      // Trigger next tick immediately to advance downstream dependencies
      await this.tick();
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
