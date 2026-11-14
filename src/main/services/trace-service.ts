import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { BrowserWindow } from 'electron';
import type { TaskExecutionTrace, TraceSpan } from '../../shared/agents';
import { databaseService } from '../db/database.service';

export class TraceService extends EventEmitter {
  private activeTraces: Map<string, TaskExecutionTrace> = new Map();

  /**
   * Starts a new distributed execution trace for a task.
   */
  public startTrace(params: {
    orchestrationId: string;
    taskId: string;
    taskTitle: string;
    agentId: string;
    role: string;
    worktreePath?: string;
  }): TaskExecutionTrace {
    const traceId = `trace-${randomUUID()}`;
    const now = Date.now();

    const trace: TaskExecutionTrace = {
      traceId,
      orchestrationId: params.orchestrationId,
      taskId: params.taskId,
      taskTitle: params.taskTitle,
      agentId: params.agentId,
      role: params.role,
      worktreePath: params.worktreePath,
      spans: [],
      startedAt: now,
      status: 'running'
    };

    // Add initial root span for orchestrator scheduling
    this.addSpan(trace, {
      name: 'Orchestrator Assignment',
      layer: 'orchestrator',
      status: 'completed',
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      metadata: { role: params.role, agentId: params.agentId }
    });

    this.activeTraces.set(traceId, trace);
    this.activeTraces.set(params.taskId, trace); // Index by taskId as well
    databaseService.saveTaskTrace(trace);
    this.broadcastTrace(trace);

    return trace;
  }

  /**
   * Adds an execution span to an active trace.
   */
  public recordSpan(
    traceIdOrTaskId: string,
    span: Omit<TraceSpan, 'id'>
  ): TraceSpan | null {
    const trace = this.activeTraces.get(traceIdOrTaskId);
    if (!trace) return null;

    const fullSpan: TraceSpan = {
      id: `span-${randomUUID()}`,
      ...span,
      durationMs: span.durationMs ?? (span.completedAt ? span.completedAt - span.startedAt : undefined)
    };

    trace.spans.push(fullSpan);
    if (trace.worktreePath && !fullSpan.metadata?.worktreePath) {
      fullSpan.metadata = { ...fullSpan.metadata, worktreePath: trace.worktreePath };
    }

    databaseService.saveTaskTrace(trace);
    this.broadcastTrace(trace);
    return fullSpan;
  }

  /**
   * Helper to append a span directly.
   */
  private addSpan(trace: TaskExecutionTrace, span: Omit<TraceSpan, 'id'>): void {
    const fullSpan: TraceSpan = {
      id: `span-${randomUUID()}`,
      ...span
    };
    trace.spans.push(fullSpan);
  }

  /**
   * Concludes a trace with final outcome and duration.
   */
  public completeTrace(
    traceIdOrTaskId: string,
    status: 'completed' | 'failed' | 'cancelled',
    errorMessage?: string
  ): TaskExecutionTrace | null {
    const trace = this.activeTraces.get(traceIdOrTaskId);
    if (!trace) return null;

    const now = Date.now();
    trace.completedAt = now;
    trace.durationMs = now - trace.startedAt;
    trace.status = status;

    if (errorMessage) {
      this.recordSpan(trace.traceId, {
        name: 'Failure Assessment',
        layer: 'reviewer',
        status: 'failed',
        startedAt: now,
        completedAt: now,
        durationMs: 0,
        errorMessage
      });
    }

    databaseService.saveTaskTrace(trace);
    this.broadcastTrace(trace);

    // Keep in cache for query, clean up secondary index
    this.activeTraces.delete(trace.taskId);
    return trace;
  }

  /**
   * Clears in-memory active trace cache (used on process restart or testing).
   */
  public clearCache(): void {
    this.activeTraces.clear();
  }

  /**
   * Retrieves a trace from cache or database.
   */
  public getTrace(traceIdOrTaskId: string): TaskExecutionTrace | null {
    const cached = this.activeTraces.get(traceIdOrTaskId);
    if (cached) return cached;
    return databaseService.getTaskTrace(traceIdOrTaskId);
  }

  /**
   * Lists traces for Developer Mode.
   */
  public listTraces(orchestrationId?: string, limit: number = 50): TaskExecutionTrace[] {
    return databaseService.listTaskTraces(orchestrationId, limit);
  }

  private broadcastTrace(trace: TaskExecutionTrace): void {
    this.emit('trace-updated', trace);

    try {
      if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (!win.isDestroyed()) {
            win.webContents.send('tracing:task-trace', trace);
          }
        }
      }
    } catch {}
  }
}

export const traceService = new TraceService();
