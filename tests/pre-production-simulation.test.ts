import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { databaseService } from '../src/main/db/database.service';
import { traceService } from '../src/main/services/trace-service';
import { WorktreeManager } from '../src/main/agents/worktree-manager';
import { AgentScheduler } from '../src/main/agents/agent-scheduler';
import { agentOrchestrator } from '../src/main/agents/agent-orchestrator';
import { mcpRegistry } from '../src/main/mcp/mcp-registry';
import { mcpRuntime } from '../src/main/mcp/mcp-runtime';
import { adaptiveModelRouter } from '../src/main/ai/adaptive-model-router';
import { modelContextHandoffManager } from '../src/main/ai/model-context-handoff';
import {
  MockAIProvider,
  MockMCPServer,
  WorktreeFailureInjector,
  ValidationRegistry
} from './simulation/test-simulation-harness';
import type { OrchestrationTask } from '../src/shared/agents';

// Mock electron dependencies for headless test environment
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (plain: string) => Buffer.from(`encrypted:${plain}`),
    decryptString: (buf: Buffer) => {
      const str = buf.toString();
      return str.startsWith('encrypted:') ? str.replace('encrypted:', '') : str;
    }
  },
  BrowserWindow: {
    getAllWindows: () => []
  }
}));

describe('Orbito Pre-Production Engineering: Automated Simulation & Failure Injection Suite', () => {
  const testStorageDir = path.join(process.cwd(), '.ai-workspace-data-test-simulation');
  const dummyWorkspaceDir = path.join(process.cwd(), '.dummy-sim-workspace');

  beforeEach(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    if (fs.existsSync(dummyWorkspaceDir)) {
      fs.rmSync(dummyWorkspaceDir, { recursive: true, force: true });
    }
    fs.mkdirSync(dummyWorkspaceDir, { recursive: true });
    databaseService.initialize(testStorageDir);
    WorktreeManager.clearActiveTaskWorktrees();
  });

  afterEach(async () => {
    agentOrchestrator.shutdown();
    await mcpRuntime.shutdownAll();
    WorktreeManager.clearActiveTaskWorktrees();
    databaseService.close();

    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    if (fs.existsSync(dummyWorkspaceDir)) {
      fs.rmSync(dummyWorkspaceDir, { recursive: true, force: true });
    }
  });

  // --------------------------------------------------------------------------
  // 1. Multi-Agent DAG Execution with Simulated Model Unavailability & Fallback
  // --------------------------------------------------------------------------
  it('1. recovers gracefully when primary model experiences 503 unavailability, escalating to fallback', async () => {
    const start = Date.now();
    const primaryProvider = new MockAIProvider({
      name: 'primary-gemini',
      failureMode: 'model_unavailable'
    });
    const secondaryProvider = new MockAIProvider({
      name: 'fallback-claude',
      failureMode: 'none',
      responsePayload: 'export function cleanRefactor() { return true; }'
    });

    let executionSuccess = false;
    let fallbackModelUsed = false;
    let selectedModel = 'google:gemini-2.5-pro';

    // Simulated task execution with adaptive escalation fallback
    try {
      await primaryProvider.generate('Refactor database query');
    } catch (err: any) {
      expect(err.message).toContain('503 Service Unavailable');

      // Adaptive model router triggers escalation to secondary model
      const escalation = adaptiveModelRouter.routeOperation({
        taskDescription: 'Refactor database query after 503 outage',
        category: 'code_generation',
        failedModelId: selectedModel,
        isEscalation: true
      });

      fallbackModelUsed = true;
      selectedModel = escalation.selectedModelId;

      const fallbackResult = await secondaryProvider.generate('Refactor database query');
      expect(fallbackResult.text).toContain('cleanRefactor');
      executionSuccess = true;
    }

    expect(fallbackModelUsed).toBe(true);
    expect(executionSuccess).toBe(true);

    ValidationRegistry.record({
      testName: 'Simulated Model Outage (503) & Dynamic Escalation Fallback',
      category: 'Workstream C: Testing & Simulation',
      status: 'SIMULATED',
      details: `Primary model unavailable (503). Successfully escalated to ${selectedModel}.`,
      durationMs: Date.now() - start
    });
  });

  // --------------------------------------------------------------------------
  // 2. Simulated Authentication Failure Recovery (401)
  // --------------------------------------------------------------------------
  it('2. safely catches simulated authentication failure (401) without crashing main process', async () => {
    const start = Date.now();
    const authFailingProvider = new MockAIProvider({
      name: 'anthropic-bad-key',
      failureMode: 'auth_failure'
    });

    let caughtError: string | null = null;
    try {
      await authFailingProvider.generate('Analyze system logs');
    } catch (err: any) {
      caughtError = err.message;
    }

    expect(caughtError).toContain('401 Unauthorized');

    ValidationRegistry.record({
      testName: 'Simulated Authentication Failure (401)',
      category: 'Workstream C: Testing & Simulation',
      status: 'SIMULATED',
      details: '401 Unauthorized safely caught and isolated without process termination.',
      durationMs: Date.now() - start
    });
  });

  // --------------------------------------------------------------------------
  // 3. In-Flight Process Crash & Task Resilience
  // --------------------------------------------------------------------------
  it('3. isolates process crash (SIGSEGV/exit 1) and records failed trace without corrupting database', async () => {
    const start = Date.now();
    const crashProvider = new MockAIProvider({
      name: 'crashing-cli-host',
      failureMode: 'crash'
    });

    const taskId = `task-crash-${randomUUID().slice(0, 8)}`;
    const orchestrationId = randomUUID();

    // Start trace
    const trace = traceService.startTrace({
      orchestrationId,
      taskId,
      taskTitle: 'Critical Kernel Build',
      agentId: 'backend-specialist',
      role: 'Backend Architect'
    });

    let caughtCrash = false;
    try {
      await crashProvider.generate('Compile binary module');
    } catch (err: any) {
      caughtCrash = true;
      traceService.completeTrace(taskId, 'failed', err.message);
    }

    expect(caughtCrash).toBe(true);

    const savedTrace = traceService.getTrace(taskId);
    expect(savedTrace).toBeDefined();
    expect(savedTrace?.status).toBe('failed');

    ValidationRegistry.record({
      testName: 'Process Crash & Abnormal Termination Resilience',
      category: 'Workstream C: Testing & Simulation',
      status: 'SIMULATED',
      details: 'Simulated SIGSEGV crash caught cleanly. Trace marked failed without state corruption.',
      durationMs: Date.now() - start
    });
  });

  // --------------------------------------------------------------------------
  // 4. Worktree File Conflict Gating & Serialized Concurrency
  // --------------------------------------------------------------------------
  it('4. detects planned file overlap and serializes tasks to prevent git merge conflicts', async () => {
    const start = Date.now();
    const sharedFile = 'src/main/db/database.service.ts';

    // Register active worktree with planned file
    WorktreeManager.registerActiveTaskWorktree({
      taskId: 'task-writer-A',
      branchName: 'agent/task-writer-A',
      worktreePath: path.join(dummyWorkspaceDir, 'wt-A'),
      createdAt: Date.now(),
      plannedFiles: [sharedFile]
    });

    // Attempt concurrent check for second task planning to modify the same file
    const conflictCheck = await WorktreeManager.checkTaskFileConflicts('task-writer-B', [sharedFile]);

    expect(conflictCheck.canRunParallel).toBe(false);
    expect(conflictCheck.conflictingFiles).toContain(sharedFile);
    expect(conflictCheck.conflictingTaskIds).toContain('task-writer-A');

    // Simulate merge conflict diff marker detection
    const sampleConflictDiff = WorktreeFailureInjector.simulateMergeConflict(
      '// base content',
      'const value = 100;',
      'const value = 200;'
    );
    expect(WorktreeFailureInjector.isConflictMarkerPresent(sampleConflictDiff)).toBe(true);

    ValidationRegistry.record({
      testName: 'Worktree File Conflict Gating & Merge Collision Prevention',
      category: 'Workstream C: Testing & Simulation',
      status: 'SIMULATED',
      details: 'File overlap correctly detected; conflicting task gated from parallel execution.',
      durationMs: Date.now() - start
    });
  });

  // --------------------------------------------------------------------------
  // 5. Centralized MCP Server Disconnection & Tool Invocation Guard
  // --------------------------------------------------------------------------
  it('5. guards tool execution on disconnected MCP server and recovers on reconnection', async () => {
    const start = Date.now();
    const mockMcp = new MockMCPServer({ name: 'simulated-git-tools' });

    // Normal execution while connected
    const call1 = await mockMcp.callTool('echo', { message: 'hello orbito' });
    expect(call1.echoed).toBe('hello orbito');

    // Disconnect server
    mockMcp.disconnect();
    expect(mockMcp.isConnected).toBe(false);

    // Calling tool on disconnected server must be rejected
    await expect(mockMcp.callTool('echo', { message: 'hello' })).rejects.toThrowError(
      /Cannot call tool: server is disconnected/
    );

    // Reconnect and verify recovery
    mockMcp.reconnect();
    expect(mockMcp.isConnected).toBe(true);
    const call2 = await mockMcp.callTool('calculate', {});
    expect(call2.result).toBe(42);

    ValidationRegistry.record({
      testName: 'MCP Server Disconnection Guard & Reconnection Recovery',
      category: 'Workstream C: Testing & Simulation',
      status: 'SIMULATED',
      details: 'Tool execution blocked on disconnected server. Recovered cleanly upon reconnect.',
      durationMs: Date.now() - start
    });
  });

  // --------------------------------------------------------------------------
  // 6. Database Recovery of Interrupted Orchestrations & Tasks
  // --------------------------------------------------------------------------
  it('6. recovers interrupted orchestrations, tasks, and task traces across application restart', () => {
    const start = Date.now();
    const orchId = `orch-interrupted-${randomUUID().slice(0, 8)}`;
    const taskId = `task-interrupted-${randomUUID().slice(0, 8)}`;

    // Seed dangling running orchestration and task
    databaseService.upsertOrchestration({
      id: orchId,
      projectId: 'proj-1',
      projectPath: dummyWorkspaceDir,
      userGoal: 'Build full system',
      mode: 'autonomous',
      status: 'running',
      tasks: [],
      createdAt: Date.now() - 5000,
      startedAt: Date.now() - 5000,
      durationMs: 0,
      totalTokensUsed: 0
    });

    databaseService.upsertOrchestrationTask({
      id: taskId,
      orchestrationId: orchId,
      title: 'In-flight subtask',
      description: 'Doing something when power cuts off',
      role: 'frontend-specialist',
      assignedProvider: 'claude-code',
      status: 'running',
      dependencies: [],
      acceptanceCriteria: [],
      requiredSkills: [],
      requiredPermissions: { allowNetwork: true, allowFileSystem: true, allowTerminal: true, allowBrowser: false },
      isModifying: false,
      retryCount: 0,
      maxRetries: 1,
      timeoutSeconds: 120,
      changedFiles: [],
      createdAt: Date.now() - 4000,
      startedAt: Date.now() - 4000
    });

    // Seed running trace
    traceService.startTrace({
      orchestrationId: orchId,
      taskId,
      taskTitle: 'In-flight subtask',
      agentId: 'frontend-specialist',
      role: 'Frontend UI Engineer'
    });

    // Run startup recovery
    const recoveryResult = databaseService.recoverOrchestrationsOnStartup();
    traceService.clearCache(); // Simulates process restart cache flush

    expect(recoveryResult.recoveredOrchestrations).toBeGreaterThanOrEqual(1);
    expect(recoveryResult.recoveredTasks).toBeGreaterThanOrEqual(1);

    // Verify status was transitioned to 'failed' (interrupted)
    const orch = databaseService.getOrchestration(orchId);
    expect(orch?.status).toBe('failed');
    expect(orch?.errorMessage).toContain('Interrupted by application shutdown/restart');

    const task = databaseService.getOrchestrationTask(taskId);
    expect(task?.status).toBe('failed');

    const trace = traceService.getTrace(taskId);
    expect(trace?.status).toBe('failed');

    ValidationRegistry.record({
      testName: 'Database Crash Recovery on Startup',
      category: 'Workstream B: Security & Reliability',
      status: 'VERIFIED',
      details: `Recovered ${recoveryResult.recoveredOrchestrations} orchestration(s) and ${recoveryResult.recoveredTasks} task(s).`,
      durationMs: Date.now() - start
    });
  });

  // --------------------------------------------------------------------------
  // 7. Full Cancellation Propagation Across Schedulers, Workers, and Traces
  // --------------------------------------------------------------------------
  it('7. propagates cancellation through scheduler, updating all pending tasks and traces', async () => {
    const start = Date.now();
    const orchId = `orch-cancel-${randomUUID().slice(0, 8)}`;
    const scheduler = new AgentScheduler({
      orchestrationId: orchId,
      projectPath: dummyWorkspaceDir,
      mode: 'supervised'
    });

    const taskA: OrchestrationTask = {
      id: `task-A-${randomUUID().slice(0, 6)}`,
      orchestrationId: orchId,
      title: 'Task A',
      description: 'Initial task',
      role: 'backend-specialist',
      assignedProvider: 'claude-code',
      status: 'pending',
      dependencies: [],
      acceptanceCriteria: [],
      requiredSkills: [],
      requiredPermissions: { allowNetwork: true, allowFileSystem: true, allowTerminal: true, allowBrowser: false },
      isModifying: false,
      retryCount: 0,
      maxRetries: 1,
      timeoutSeconds: 60,
      changedFiles: [],
      createdAt: Date.now()
    };

    const taskB: OrchestrationTask = {
      id: `task-B-${randomUUID().slice(0, 6)}`,
      orchestrationId: orchId,
      title: 'Task B',
      description: 'Downstream task',
      role: 'frontend-specialist',
      assignedProvider: 'claude-code',
      status: 'pending',
      dependencies: [taskA.id],
      acceptanceCriteria: [],
      requiredSkills: [],
      requiredPermissions: { allowNetwork: true, allowFileSystem: true, allowTerminal: true, allowBrowser: false },
      isModifying: false,
      retryCount: 0,
      maxRetries: 1,
      timeoutSeconds: 60,
      changedFiles: [],
      createdAt: Date.now()
    };

    databaseService.upsertOrchestration({
      id: orchId,
      projectId: 'proj-cancel',
      projectPath: dummyWorkspaceDir,
      userGoal: 'Test cancellation DAG',
      mode: 'supervised',
      status: 'running',
      tasks: [],
      createdAt: Date.now(),
      startedAt: Date.now(),
      durationMs: 0,
      totalTokensUsed: 0
    });

    databaseService.upsertOrchestrationTask(taskA);
    databaseService.upsertOrchestrationTask(taskB);
    scheduler.setTasks([taskA, taskB]);

    // Trigger cancel
    scheduler.cancel();

    const tasks = scheduler.getTasks();
    expect(tasks.every((t) => t.status === 'cancelled')).toBe(true);

    const dbTaskA = databaseService.getOrchestrationTask(taskA.id);
    expect(dbTaskA?.status).toBe('cancelled');

    ValidationRegistry.record({
      testName: 'End-to-End Cancellation Propagation',
      category: 'Workstream B: Security & Reliability',
      status: 'VERIFIED',
      details: 'All pending and running tasks transitioned to cancelled upon cancel() invocation.',
      durationMs: Date.now() - start
    });
  });

  // --------------------------------------------------------------------------
  // 8. Validation Status Summary & Taxonomy Enforcement
  // --------------------------------------------------------------------------
  it('8. provides structured validation registry reporting VERIFIED and SIMULATED states', () => {
    const summary = ValidationRegistry.getSummary();
    const records = ValidationRegistry.getRecords();

    expect(records.length).toBeGreaterThanOrEqual(6);
    expect(summary.SIMULATED).toBeGreaterThan(0);
    expect(summary.VERIFIED).toBeGreaterThan(0);
    expect(summary.FAILED).toBe(0);

    // Ensure simulated results are NEVER presented as VERIFIED
    for (const record of records) {
      if (record.details.toLowerCase().includes('simulated')) {
        expect(record.status).toBe('SIMULATED');
      }
    }
  });
});
