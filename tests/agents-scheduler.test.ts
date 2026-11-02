import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../src/main/db/database.service';
import { AgentScheduler } from '../src/main/agents/agent-scheduler';
import { AgentWorker } from '../src/main/agents/agent-worker';
import type { OrchestrationTask } from '../src/shared/agents';

const TEST_DIR = path.join(process.cwd(), '.test-scheduler-workspace');

describe('Agent Scheduler (Bounded Concurrency, Dependency Resolution & Cascading)', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });

    databaseService.initialize();
    databaseService.getAppDb().prepare('DELETE FROM orchestration_tasks').run();
    databaseService.getAppDb().prepare('DELETE FROM orchestrations').run();
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  const createTask = (id: string, deps: string[]): OrchestrationTask => ({
    id,
    orchestrationId: 'orch-sched-test',
    title: `Task ${id}`,
    description: `Desc ${id}`,
    acceptanceCriteria: ['Pass'],
    role: 'backend',
    assignedProvider: 'claude',
    dependencies: deps,
    requiredSkills: [],
    requiredPermissions: {
      filesystem: { read: true, write: true },
      terminal: { execute: false },
      network: { allowed: false }
    },
    isModifying: false,
    status: 'pending',
    retryCount: 0,
    maxRetries: 1,
    timeoutSeconds: 30,
    createdAt: Date.now(),
    changedFiles: []
  });

  it('schedules tasks in dependency order and advances ready queue', async () => {
    databaseService.upsertOrchestration({
      id: 'orch-sched-test',
      projectId: 'proj-1',
      projectPath: TEST_DIR,
      userGoal: 'Test scheduling',
      mode: 'autonomous',
      status: 'running',
      tasks: [],
      createdAt: Date.now(),
      durationMs: 0,
      totalTokensUsed: 0
    });

    const t1 = createTask('task-1', []);
    const t2 = createTask('task-2', ['task-1']);

    // Persist tasks in DB first
    databaseService.upsertOrchestrationTask(t1);
    databaseService.upsertOrchestrationTask(t2);

    // Mock AgentWorker to resolve immediately
    vi.spyOn(AgentWorker, 'executeTask').mockImplementation(async (task) => {
      return {
        success: true,
        status: 'completed',
        changedFiles: [],
        resultSummary: `Done ${task.id}`
      };
    });

    const scheduler = new AgentScheduler({
      orchestrationId: 'orch-sched-test',
      projectPath: TEST_DIR,
      mode: 'autonomous',
      maxConcurrent: 2
    });

    scheduler.setTasks([t1, t2]);

    const events: string[] = [];
    scheduler.on('event', (e) => events.push(e.type));

    await scheduler.start();

    const tasks = scheduler.getTasks();
    expect(tasks.find((t) => t.id === 'task-1')?.status).toBe('completed');
    expect(tasks.find((t) => t.id === 'task-2')?.status).toBe('completed');
    expect(events).toContain('task_started');
    expect(events).toContain('task_completed');
    expect(events).toContain('orchestration_completed');
  });

  it('cascades blocked status to dependent tasks when a prerequisite fails', async () => {
    databaseService.upsertOrchestration({
      id: 'orch-sched-test',
      projectId: 'proj-1',
      projectPath: TEST_DIR,
      userGoal: 'Test cascading failure',
      mode: 'autonomous',
      status: 'running',
      tasks: [],
      createdAt: Date.now(),
      durationMs: 0,
      totalTokensUsed: 0
    });

    const t1 = createTask('task-fail', []);
    const t2 = createTask('task-dependent', ['task-fail']);

    databaseService.upsertOrchestrationTask(t1);
    databaseService.upsertOrchestrationTask(t2);

    // Mock Worker to fail on task-fail
    vi.spyOn(AgentWorker, 'executeTask').mockImplementation(async () => {
      return {
        success: false,
        status: 'failed',
        changedFiles: [],
        errorMessage: 'Simulated failure in prerequisite'
      };
    });

    const scheduler = new AgentScheduler({
      orchestrationId: 'orch-sched-test',
      projectPath: TEST_DIR,
      mode: 'autonomous',
      maxConcurrent: 2
    });

    scheduler.setTasks([t1, t2]);

    await scheduler.start();

    const tasks = scheduler.getTasks();
    expect(tasks.find((t) => t.id === 'task-fail')?.status).toBe('failed');
    expect(tasks.find((t) => t.id === 'task-dependent')?.status).toBe('blocked');
    expect(tasks.find((t) => t.id === 'task-dependent')?.errorMessage).toContain('Blocked by dependency');
  });

  it('cancels all running and pending tasks when cancel() is triggered', async () => {
    const t1 = createTask('task-cancel-1', []);
    const t2 = createTask('task-cancel-2', ['task-cancel-1']);

    const scheduler = new AgentScheduler({
      orchestrationId: 'orch-sched-test',
      projectPath: TEST_DIR,
      mode: 'autonomous'
    });

    scheduler.setTasks([t1, t2]);
    scheduler.cancel();

    const tasks = scheduler.getTasks();
    expect(tasks.every((t) => t.status === 'cancelled')).toBe(true);
  });
});
