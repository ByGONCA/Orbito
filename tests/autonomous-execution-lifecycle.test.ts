import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../src/main/db/database.service';
import { AgentScheduler } from '../src/main/agents/agent-scheduler';
import { AgentWorker } from '../src/main/agents/agent-worker';
import { CoordinatorAgent } from '../src/main/agents/coordinator-agent';
import { agentOrchestrator } from '../src/main/agents/agent-orchestrator';
import type { OrchestrationTask, AutonomousPlan } from '../src/shared/agents';

const TEST_DIR = path.join(process.cwd(), '.test-autonomous-workspace');

describe('Autonomous Execution Lifecycle & Engineering Intelligence Suite', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });

    databaseService.initialize();
    databaseService.getAppDb().prepare('DELETE FROM orchestration_tasks').run();
    databaseService.getAppDb().prepare('DELETE FROM orchestrations').run();
    databaseService.getAppDb().prepare('DELETE FROM autonomous_plans').run();
    databaseService.getAppDb().prepare('DELETE FROM project_knowledge_entries').run();
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('1. executes an autonomous plan and records learned engineering knowledge upon completion', async () => {
    const orchId = 'orch-auto-lifecycle-1';
    const projectId = 'proj-auto-1';

    const { plan, tasks } = CoordinatorAgent.createPlan({
      orchestrationId: orchId,
      userGoal: 'Implement cache layer for fast symbol lookup',
      provider: 'claude',
      mode: 'autonomous'
    });

    databaseService.saveAutonomousPlan(plan, projectId);

    databaseService.upsertOrchestration({
      id: orchId,
      projectId,
      projectPath: TEST_DIR,
      userGoal: plan.userGoal,
      mode: 'autonomous',
      status: 'running',
      tasks,
      plan,
      createdAt: Date.now(),
      startedAt: Date.now(),
      durationMs: 0,
      totalTokensUsed: 0
    });

    for (const t of tasks) {
      databaseService.upsertOrchestrationTask(t);
    }

    // Mock worker execution to simulate successful execution and verification
    vi.spyOn(AgentWorker, 'executeTask').mockImplementation(async (task) => {
      return {
        success: true,
        status: 'completed',
        changedFiles: task.isModifying ? ['src/cache.ts'] : [],
        diff: task.isModifying ? '+export class Cache {}' : undefined,
        resultSummary: `Completed task: ${task.title}`
      };
    });

    const scheduler = new AgentScheduler({
      orchestrationId: orchId,
      projectPath: TEST_DIR,
      mode: 'autonomous',
      maxConcurrent: 2
    });

    scheduler.setTasks(tasks);

    const events: string[] = [];
    scheduler.on('event', (e) => events.push(e.type));

    const completedPromise = new Promise<void>((resolve) => {
      scheduler.on('event', (e) => {
        if (e.type === 'orchestration_completed' || e.type === 'orchestration_failed') {
          resolve();
        }
      });
    });

    await scheduler.start();
    await completedPromise;

    // Verify all tasks reached completed state
    const finishedTasks = scheduler.getTasks();
    expect(finishedTasks.every((t) => t.status === 'completed')).toBe(true);

    // Verify events sequence
    expect(events).toContain('orchestration_started');
    expect(events).toContain('task_started');
    expect(events).toContain('task_completed');
    expect(events).toContain('orchestration_completed');

    // Verify learned engineering memory entry was stored in SQLite
    const entries = databaseService.listKnowledgeEntries(projectId);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].category).toBe('convention');
    expect(entries[0].title).toContain('Autonomous Task Execution');
    expect(entries[0].source).toBe('agent_summary');

    // Verify autonomous plan retrieval
    const retrievedPlan = databaseService.getAutonomousPlan(orchId);
    expect(retrievedPlan).toBeDefined();
    expect(retrievedPlan?.userGoal).toBe(plan.userGoal);
  });

  it('2. pauses modifying tasks for human approval in supervised mode and resumes upon decision', async () => {
    const orchId = 'orch-supervised-approval';
    const projectId = 'proj-supervised';

    const modifyingTask: OrchestrationTask = {
      id: 'task-mod-1',
      orchestrationId: orchId,
      title: 'Modify configuration parameters',
      description: 'Update timeout threshold',
      acceptanceCriteria: ['Pass'],
      role: 'backend',
      assignedProvider: 'claude',
      dependencies: [],
      requiredSkills: [],
      requiredPermissions: {
        filesystem: { read: true, write: true },
        terminal: { execute: false },
        network: { allowed: false }
      },
      isModifying: true,
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
      timeoutSeconds: 30,
      createdAt: Date.now(),
      changedFiles: []
    };

    databaseService.upsertOrchestration({
      id: orchId,
      projectId,
      projectPath: TEST_DIR,
      userGoal: 'Modify configuration parameters',
      mode: 'supervised',
      status: 'running',
      tasks: [modifyingTask],
      createdAt: Date.now(),
      startedAt: Date.now(),
      durationMs: 0,
      totalTokensUsed: 0
    });

    databaseService.upsertOrchestrationTask(modifyingTask);

    // Mock worker to simulate waiting for approval
    vi.spyOn(AgentWorker, 'executeTask').mockImplementation(async (task) => {
      return {
        success: true,
        status: 'waiting_approval',
        changedFiles: ['config.json'],
        diff: '+ "timeout": 5000',
        resultSummary: 'Waiting for merge approval'
      };
    });

    const scheduler = new AgentScheduler({
      orchestrationId: orchId,
      projectPath: TEST_DIR,
      mode: 'supervised',
      maxConcurrent: 1
    });

    scheduler.setTasks([modifyingTask]);

    const events: string[] = [];
    scheduler.on('event', (e) => events.push(e.type));

    await scheduler.start();

    // Verify task entered waiting_approval state
    expect(scheduler.getTasks()[0].status).toBe('waiting_approval');
    expect(events).toContain('task_approval_needed');

    // Simulate user approving the request
    await scheduler.resumeAfterApproval('task-mod-1', true);

    expect(scheduler.getTasks()[0].status).toBe('completed');
    expect(events).toContain('task_completed');
    expect(events).toContain('orchestration_completed');
  });

  it('3. cancels pending and running tasks when scheduler is cancelled', async () => {
    const orchId = 'orch-cancel-test';

    const t1: OrchestrationTask = {
      id: 'task-c1',
      orchestrationId: orchId,
      title: 'Long running task',
      description: 'Long running task',
      acceptanceCriteria: ['Pass'],
      role: 'architect',
      assignedProvider: 'claude',
      dependencies: [],
      requiredSkills: [],
      requiredPermissions: {
        filesystem: { read: true, write: false },
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
    };

    const scheduler = new AgentScheduler({
      orchestrationId: orchId,
      projectPath: TEST_DIR,
      mode: 'autonomous',
      maxConcurrent: 1
    });

    scheduler.setTasks([t1]);
    scheduler.cancel();

    expect(scheduler.getTasks()[0].status).toBe('cancelled');
    expect(scheduler.getTasks()[0].errorMessage).toContain('Cancelled by user');
  });
});
