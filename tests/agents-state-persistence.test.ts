import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../src/main/db/database.service';
import type { OrchestrationRecord, OrchestrationTask, ApprovalRequest } from '../src/shared/agents';

const TEST_DIR = path.join(process.cwd(), '.test-state-workspace');

describe('Agent State Manager (SQLite Persistence & Startup Recovery)', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });

    databaseService.initialize();
    databaseService.getAppDb().prepare('DELETE FROM approval_requests').run();
    databaseService.getAppDb().prepare('DELETE FROM orchestration_tasks').run();
    databaseService.getAppDb().prepare('DELETE FROM orchestrations').run();
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  const sampleTask: OrchestrationTask = {
    id: 'task-p-1',
    orchestrationId: 'orch-p-1',
    title: 'Setup Database',
    description: 'Create SQLite schema',
    acceptanceCriteria: ['Table created'],
    role: 'backend',
    assignedProvider: 'claude',
    dependencies: [],
    requiredSkills: ['refactoring'],
    requiredPermissions: { filesystem: { read: true, write: true }, terminal: { execute: false }, network: { allowed: false } },
    isModifying: true,
    status: 'pending',
    retryCount: 0,
    maxRetries: 1,
    timeoutSeconds: 60,
    createdAt: Date.now(),
    changedFiles: []
  };

  const sampleOrch: OrchestrationRecord = {
    id: 'orch-p-1',
    projectId: 'proj-1',
    projectPath: '/test/proj',
    userGoal: 'Build SQLite backend',
    mode: 'supervised',
    status: 'running',
    tasks: [sampleTask],
    createdAt: Date.now(),
    durationMs: 0,
    totalTokensUsed: 1500
  };

  it('persists and retrieves complete orchestration record and tasks', () => {
    databaseService.upsertOrchestration(sampleOrch);

    const retrieved = databaseService.getOrchestration('orch-p-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('orch-p-1');
    expect(retrieved?.userGoal).toBe('Build SQLite backend');
    expect(retrieved?.tasks.length).toBe(1);
    expect(retrieved?.tasks[0].id).toBe('task-p-1');
    expect(retrieved?.tasks[0].role).toBe('backend');
    expect(retrieved?.tasks[0].requiredSkills).toContain('refactoring');
  });

  it('persists and resolves human approval requests', () => {
    databaseService.upsertOrchestration(sampleOrch);

    const req: ApprovalRequest = {
      id: 'appr-1',
      orchestrationId: 'orch-p-1',
      taskId: 'task-p-1',
      type: 'merge_worktree',
      title: 'Approve Merge',
      description: 'Merge agent branch',
      status: 'pending',
      createdAt: Date.now()
    };

    databaseService.createApprovalRequest(req);

    const pending = databaseService.getPendingApprovals('orch-p-1');
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe('appr-1');

    databaseService.resolveApprovalRequest('appr-1', 'approved');

    const resolved = databaseService.getApprovalRequest('appr-1');
    expect(resolved?.status).toBe('approved');
    expect(databaseService.getPendingApprovals('orch-p-1').length).toBe(0);
  });

  it('recovers running orchestrations on application restart and marks them failed', () => {
    databaseService.upsertOrchestration(sampleOrch);
    databaseService.updateOrchestrationTask('task-p-1', { status: 'running' });

    const recovery = databaseService.recoverOrchestrationsOnStartup();
    expect(recovery.recoveredOrchestrations).toBe(1);
    expect(recovery.recoveredTasks).toBe(1);

    const orchAfter = databaseService.getOrchestration('orch-p-1');
    expect(orchAfter?.status).toBe('failed');
    expect(orchAfter?.errorMessage).toContain('Interrupted by application shutdown/restart');

    const taskAfter = databaseService.getOrchestrationTask('task-p-1');
    expect(taskAfter?.status).toBe('failed');
    expect(taskAfter?.errorMessage).toContain('Interrupted by application restart');
  });
});
