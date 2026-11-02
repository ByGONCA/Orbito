import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../src/main/db/database.service';
import { agentOrchestrator } from '../src/main/agents/agent-orchestrator';
import { AgentWorker } from '../src/main/agents/agent-worker';

const TEST_DIR = path.join(process.cwd(), '.test-orch-integration');

describe('Agent Orchestrator (Full Lifecycle Integration)', () => {
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
    vi.restoreAllMocks();
  });

  it('initiates an orchestration, plans DAG, and advances tasks', async () => {
    // Mock worker to simulate fast success
    vi.spyOn(AgentWorker, 'executeTask').mockImplementation(async (task) => {
      return {
        success: true,
        status: 'completed',
        changedFiles: [],
        resultSummary: `Simulated success for ${task.title}`
      };
    });

    const orch = await agentOrchestrator.startOrchestration({
      projectId: 'proj-orch-1',
      projectPath: TEST_DIR,
      userGoal: 'Fix login error bug in authentication flow',
      mode: 'autonomous',
      provider: 'claude'
    });

    expect(orch).toBeDefined();
    expect(orch.id).toContain('orch-');
    expect(orch.tasks.length).toBeGreaterThanOrEqual(2);

    // Verify first task is architect and has dependencies=[]
    const firstTask = orch.tasks[0];
    expect(firstTask.role).toBe('architect');
    expect(firstTask.dependencies.length).toBe(0);

    // Verify record in SQLite
    const retrieved = agentOrchestrator.getOrchestration(orch.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.userGoal).toContain('Fix login error');
  });

  it('cancels active orchestration when requested', async () => {
    vi.spyOn(AgentWorker, 'executeTask').mockImplementation(async () => {
      // simulate long running task
      await new Promise((r) => setTimeout(r, 5000));
      return { success: true, status: 'completed', changedFiles: [] };
    });

    const orch = await agentOrchestrator.startOrchestration({
      projectId: 'proj-orch-2',
      projectPath: TEST_DIR,
      userGoal: 'Implement feature with multiple agents',
      mode: 'supervised',
      provider: 'claude'
    });

    const cancelled = await agentOrchestrator.cancelOrchestration(orch.id);
    expect(cancelled).toBe(true);

    const record = agentOrchestrator.getOrchestration(orch.id);
    expect(record?.status).toBe('cancelled');
  });
});
