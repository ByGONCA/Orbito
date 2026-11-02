import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { BrowserWindow } from 'electron';
import type {
  OrchestrationRecord,
  OrchestrationTask,
  ApprovalRequest,
  OrchestrationEvent,
  ExecutionMode
} from '../../shared/agents';
import { CoordinatorAgent } from './coordinator-agent';
import { AgentScheduler } from './agent-scheduler';
import { WorktreeManager } from './worktree-manager';
import { databaseService } from '../db/database.service';

export interface StartOrchestrationParams {
  projectId: string;
  projectPath: string;
  userGoal: string;
  mode: ExecutionMode;
  provider: 'claude' | 'codex' | 'gemini';
  model?: string;
}

export class AgentOrchestrator extends EventEmitter {
  private activeSchedulers: Map<string, AgentScheduler> = new Map();

  /**
   * Initializes orchestrator, performing startup recovery on interrupted orchestrations.
   */
  public initialize(): void {
    const recovery = databaseService.recoverOrchestrationsOnStartup();
    if (recovery.recoveredOrchestrations > 0) {
      console.log(`[AgentOrchestrator] Recovered ${recovery.recoveredOrchestrations} interrupted orchestration(s) on startup.`);
    }
  }

  /**
   * Starts a new multi-agent orchestration.
   */
  public async startOrchestration(params: StartOrchestrationParams): Promise<OrchestrationRecord> {
    const { projectId, projectPath, userGoal, mode, provider, model } = params;
    const orchestrationId = `orch-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    // 1. Coordinator plans tasks DAG
    const tasks = CoordinatorAgent.plan({
      orchestrationId,
      userGoal,
      provider,
      model
    });

    // 2. Persist initial Orchestration record in SQLite
    const record: OrchestrationRecord = {
      id: orchestrationId,
      projectId,
      projectPath,
      userGoal,
      mode,
      status: 'running',
      tasks,
      createdAt: Date.now(),
      startedAt: Date.now(),
      durationMs: 0,
      totalTokensUsed: 0
    };

    databaseService.upsertOrchestration(record);

    // 3. Instantiate and configure scheduler
    const scheduler = new AgentScheduler({
      orchestrationId,
      projectPath,
      mode,
      maxConcurrent: 3
    });

    scheduler.setTasks(tasks);

    // Wire up events
    scheduler.on('event', (event: OrchestrationEvent) => {
      this.handleSchedulerEvent(orchestrationId, event);
    });

    this.activeSchedulers.set(orchestrationId, scheduler);

    // Start scheduling asynchronously
    scheduler.start().catch((err) => {
      console.error(`[AgentOrchestrator] Scheduler error in ${orchestrationId}:`, err);
    });

    return record;
  }

  /**
   * Cancels a running orchestration and cleans up workers.
   */
  public async cancelOrchestration(orchestrationId: string): Promise<boolean> {
    const scheduler = this.activeSchedulers.get(orchestrationId);
    if (scheduler) {
      scheduler.cancel();
      this.activeSchedulers.delete(orchestrationId);
    }

    databaseService.updateOrchestration(orchestrationId, {
      status: 'cancelled',
      errorMessage: 'Cancelled by user request.',
      completedAt: Date.now()
    });

    this.broadcastEvent({
      orchestrationId,
      type: 'orchestration_cancelled',
      data: { orchestrationId },
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * Resolves a pending human approval request (approve or reject with reason).
   */
  public async resolveApproval(
    approvalId: string,
    decision: 'approved' | 'rejected',
    rejectionReason?: string
  ): Promise<boolean> {
    const approval = databaseService.getApprovalRequest(approvalId);
    if (!approval || approval.status !== 'pending') {
      return false;
    }

    databaseService.resolveApprovalRequest(approvalId, decision, rejectionReason);

    const task = databaseService.getOrchestrationTask(approval.taskId);
    const orch = databaseService.getOrchestration(approval.orchestrationId);

    if (task && orch) {
      if (decision === 'approved' && task.isModifying && task.branchName) {
        // Perform merge
        const mergeRes = await WorktreeManager.mergeBranch(orch.projectPath, task.branchName);
        if (mergeRes.success && task.worktreePath) {
          await WorktreeManager.removeWorktree(orch.projectPath, task.worktreePath, task.branchName, true);
        }
      }

      // Resume scheduler
      const scheduler = this.activeSchedulers.get(approval.orchestrationId);
      if (scheduler) {
        await scheduler.resumeAfterApproval(approval.taskId, decision === 'approved', rejectionReason);
      }
    }

    return true;
  }

  /**
   * Retries a failed or blocked task in an orchestration.
   */
  public async retryTask(orchestrationId: string, taskId: string): Promise<boolean> {
    const task = databaseService.getOrchestrationTask(taskId);
    if (!task) return false;

    task.status = 'ready';
    task.errorMessage = undefined;
    task.retryCount = 0;
    databaseService.updateOrchestrationTask(task.id, {
      status: 'ready',
      errorMessage: undefined,
      retryCount: 0
    });

    const scheduler = this.activeSchedulers.get(orchestrationId);
    if (scheduler) {
      const tasks = databaseService.getOrchestrationTasks(orchestrationId);
      scheduler.setTasks(tasks);
      await scheduler.tick();
    }

    return true;
  }

  public getOrchestration(orchestrationId: string): OrchestrationRecord | null {
    return databaseService.getOrchestration(orchestrationId);
  }

  public listOrchestrations(projectId?: string): OrchestrationRecord[] {
    return databaseService.listOrchestrations(projectId);
  }

  public async getWorktreeDiff(taskId: string): Promise<string> {
    const task = databaseService.getOrchestrationTask(taskId);
    if (!task || !task.worktreePath) return '';
    return await WorktreeManager.getDiff(task.worktreePath);
  }

  private handleSchedulerEvent(orchestrationId: string, event: OrchestrationEvent): void {
    // Update orchestration status in database if finished
    if (event.type === 'orchestration_completed') {
      databaseService.updateOrchestration(orchestrationId, {
        status: 'completed',
        summary: 'All tasks successfully executed and verified.',
        completedAt: Date.now()
      });
      this.activeSchedulers.delete(orchestrationId);
    } else if (event.type === 'orchestration_failed') {
      databaseService.updateOrchestration(orchestrationId, {
        status: 'failed',
        errorMessage: event.data?.error || 'One or more tasks failed.',
        completedAt: Date.now()
      });
      this.activeSchedulers.delete(orchestrationId);
    }

    // Broadcast to UI
    this.broadcastEvent(event);
  }

  private broadcastEvent(event: OrchestrationEvent): void {
    this.emit('event', event);

    try {
      if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (!win.isDestroyed()) {
            win.webContents.send('agents:orchestration-event', event);
          }
        }
      }
    } catch {}
  }
}

export const agentOrchestrator = new AgentOrchestrator();
