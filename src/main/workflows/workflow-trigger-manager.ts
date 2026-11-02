import fs from 'node:fs';
import path from 'node:path';
import type { WorkflowRecord, WorkflowTriggerConfig } from '../../shared/workflows';
import { workflowEngine } from './workflow-engine';
import { databaseService } from '../db/database.service';

export class WorkflowTriggerManager {
  private activeTimers = new Map<string, NodeJS.Timeout>();
  private fileWatchers = new Map<string, fs.FSWatcher>();
  private lastTriggeredTimes = new Map<string, number>();

  /**
   * Register or re-activate triggers for all enabled workflows in a project.
   */
  public async syncProjectTriggers(projectPath: string, projectId: string): Promise<void> {
    this.teardownAll();

    const workflows = databaseService.listWorkflows(projectId);
    for (const wf of workflows) {
      if (wf.trigger?.enabled) {
        this.activateTrigger(wf, projectPath);
      }
    }
  }

  /**
   * Activate a specific trigger for a workflow.
   */
  public activateTrigger(workflow: WorkflowRecord, projectPath: string): void {
    const trigger = workflow.trigger;
    if (!trigger || !trigger.enabled) return;

    const debounceMs = (trigger.config.debounceSeconds || 5) * 1000;

    switch (trigger.type) {
      case 'scheduled': {
        const intervalMs = Math.max(
          (trigger.config.intervalMinutes || 60) * 60 * 1000,
          60000 // Minimum 1 minute
        );

        const timer = setInterval(() => {
          this.safelyTriggerWorkflow(workflow, projectPath, 'scheduled', debounceMs);
        }, intervalMs);

        this.activeTimers.set(workflow.id, timer);
        break;
      }

      case 'file_change': {
        if (!fs.existsSync(projectPath)) break;

        try {
          const watcher = fs.watch(
            projectPath,
            { recursive: true },
            (_eventType, filename) => {
              if (!filename) return;
              // Ignore git, node_modules, and cache files
              if (
                filename.includes('.git') ||
                filename.includes('node_modules') ||
                filename.includes('.worktrees')
              ) {
                return;
              }

              this.safelyTriggerWorkflow(workflow, projectPath, 'file_change', debounceMs, {
                modifiedFile: filename
              });
            }
          );

          this.fileWatchers.set(workflow.id, watcher);
        } catch {
          // File watching failure fallback
        }
        break;
      }

      case 'app_startup': {
        // Run once on startup with a brief delay
        setTimeout(() => {
          this.safelyTriggerWorkflow(workflow, projectPath, 'app_startup', 1000);
        }, 3000);
        break;
      }
    }
  }

  /**
   * Handle trigger notification from external system event (e.g. orchestration completed).
   */
  public handleSystemEvent(
    eventType: 'orchestration_completed' | 'git_event',
    projectPath: string,
    projectId: string,
    payload: any = {}
  ): void {
    const workflows = databaseService.listWorkflows(projectId);
    for (const wf of workflows) {
      if (wf.trigger?.enabled && wf.trigger.type === eventType) {
        this.safelyTriggerWorkflow(wf, projectPath, eventType, 5000, payload);
      }
    }
  }

  private safelyTriggerWorkflow(
    workflow: WorkflowRecord,
    projectPath: string,
    triggerType: string,
    debounceMs: number,
    extraInputs: Record<string, any> = {}
  ): void {
    const key = `${workflow.id}:${triggerType}`;
    const now = Date.now();
    const lastTime = this.lastTriggeredTimes.get(key) || 0;

    // Deduplication check
    if (now - lastTime < debounceMs) {
      return;
    }

    this.lastTriggeredTimes.set(key, now);

    workflowEngine.executeWorkflow(
      workflow,
      { triggerType, timestamp: now, ...extraInputs },
      projectPath
    ).catch(() => {
      // Background execution error logged by engine
    });
  }

  /**
   * Tear down all active timers and file watchers.
   */
  public teardownAll(): void {
    for (const timer of this.activeTimers.values()) {
      clearInterval(timer);
    }
    this.activeTimers.clear();

    for (const watcher of this.fileWatchers.values()) {
      try {
        watcher.close();
      } catch {
        // Ignore
      }
    }
    this.fileWatchers.clear();
  }
}

export const workflowTriggerManager = new WorkflowTriggerManager();
