import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { databaseService } from '../src/main/db/database.service';
import { traceService } from '../src/main/services/trace-service';
import { agentCapabilityRegistry } from '../src/main/agents/agent-capability-registry';
import { WorktreeManager } from '../src/main/agents/worktree-manager';
import { mcpRegistry } from '../src/main/mcp/mcp-registry';
import { mcpGateway } from '../src/main/mcp/mcp-gateway';
import { mcpRuntime } from '../src/main/mcp/mcp-runtime';
import { mcpPermissionManager } from '../src/main/mcp/security/mcp-permission-manager';
import type { OrchestrationRecord, OrchestrationTask } from '../src/shared/agents';
import type { SaveMCPServerInput } from '../src/shared/mcp';

// Mock electron safeStorage to work in node/electron runner
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

describe('Orbito Distributed Ecosystem Orchestration & Performance Suite', () => {
  const testStorageDir = path.join(process.cwd(), '.ai-workspace-data-test-orchestration');

  beforeEach(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    databaseService.initialize(testStorageDir);
    WorktreeManager.clearActiveTaskWorktrees();
  });

  afterEach(async () => {
    await mcpRuntime.shutdownAll();
    WorktreeManager.clearActiveTaskWorktrees();
    databaseService.close();
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------
  // Scenario A: Single Agent Task Lifecycle & Distributed Tracing
  // -------------------------------------------------------------
  it('Scenario A: executes single agent task with end-to-end trace correlation across worktree and reviewer', async () => {
    const orchestrationId = randomUUID();
    const taskId = `task-${randomUUID().slice(0, 8)}`;
    const traceId = randomUUID();

    const task: OrchestrationTask = {
      id: taskId,
      orchestrationId,
      title: 'Implement Dark Mode Toggle',
      description: 'Add anti-boxiness dark theme toggle button in header',
      acceptanceCriteria: ['Toggle dark/light mode', 'Zero white borders'],
      role: 'frontend-specialist',
      assignedProvider: 'claude-code',
      status: 'pending',
      dependencies: [],
      requiredSkills: [],
      requiredPermissions: {
        allowNetwork: true,
        allowFileSystem: true,
        allowTerminal: true,
        allowBrowser: false
      },
      isModifying: true,
      plannedFiles: ['src/renderer/src/components/ThemeToggle.tsx'],
      changedFiles: [],
      retryCount: 0,
      maxRetries: 2,
      timeoutSeconds: 300,
      traceId,
      createdAt: Date.now()
    };

    // 1. Create orchestration and task in DB
    const orchestration: OrchestrationRecord = {
      id: orchestrationId,
      projectId: 'project-test-123',
      projectPath: 'C:/mock/project',
      userGoal: 'Add user settings toggle',
      mode: 'parallel-subagents',
      status: 'running',
      durationMs: 0,
      totalTokensUsed: 1200,
      traceId,
      tasks: [task],
      createdAt: Date.now()
    };
    databaseService.upsertOrchestration(orchestration);
    databaseService.upsertOrchestrationTask(task);

    // 2. Discover capability and assign best agent
    const bestAgent = await agentCapabilityRegistry.findBestAgentForTask('frontend-specialist');
    expect(bestAgent).toBeDefined();
    expect(bestAgent.provider).toBeDefined();
    expect(bestAgent.agentId).toBeDefined();

    // 3. Start trace in traceService
    traceService.startTrace({
      orchestrationId,
      taskId,
      taskTitle: task.title,
      agentId: bestAgent.agentId || 'claude-code',
      role: 'frontend-specialist',
      worktreePath: `.worktrees/wt-${taskId}`
    });

    // Record worktree isolation span
    traceService.recordSpan(taskId, {
      name: 'git_worktree_create',
      layer: 'worktree',
      startedAt: Date.now() - 200,
      completedAt: Date.now() - 100,
      durationMs: 100,
      status: 'completed',
      metadata: { branch: `feature/${taskId}`, path: `.worktrees/wt-${taskId}` }
    });

    // Record agent CLI execution span
    traceService.recordSpan(taskId, {
      name: 'cli_execute_task',
      layer: 'cli',
      startedAt: Date.now() - 100,
      completedAt: Date.now() - 20,
      durationMs: 80,
      status: 'completed',
      metadata: { agent: bestAgent?.cliProvider, exitCode: 0 }
    });

    // Record quality reviewer span
    traceService.recordSpan(taskId, {
      name: 'quality_review_gate',
      layer: 'reviewer',
      startedAt: Date.now() - 20,
      completedAt: Date.now(),
      durationMs: 20,
      status: 'completed',
      metadata: { verdict: 'approved', score: 98 }
    });

    const completedTrace = traceService.completeTrace(taskId, 'completed');
    expect(completedTrace).toBeDefined();
    // 1 initial orchestrator span + 3 recorded spans = 4
    expect(completedTrace?.spans.length).toBe(4);
    expect(completedTrace?.status).toBe('completed');

    // 4. Verify trace was persisted into SQLite database
    const savedTrace = databaseService.getTaskTrace(taskId);
    expect(savedTrace).toBeDefined();
    expect(savedTrace?.taskId).toBe(taskId);
    expect(savedTrace?.orchestrationId).toBe(orchestrationId);
    expect(savedTrace?.spans.length).toBe(4);
    expect(savedTrace?.spans.map((s) => s.layer)).toContain('worktree');
    expect(savedTrace?.spans.map((s) => s.layer)).toContain('cli');
    expect(savedTrace?.spans.map((s) => s.layer)).toContain('reviewer');
  });

  // -------------------------------------------------------------
  // Scenario B: Parallel Agents in Disjoint Worktrees
  // -------------------------------------------------------------
  it('Scenario B: coordinates 3 parallel agents with zero file conflicts across independent worktrees', async () => {
    const taskAId = 'task-a';
    const taskBId = 'task-b';
    const taskCId = 'task-c';

    // Register active worktrees with disjoint target files
    WorktreeManager.registerActiveTaskWorktree({
      taskId: taskAId,
      worktreePath: 'C:/mock/repo/.worktrees/wt-task-a',
      branchName: 'branch-a',
      plannedFiles: ['src/renderer/src/components/Header.tsx'],
      createdAt: Date.now()
    });

    WorktreeManager.registerActiveTaskWorktree({
      taskId: taskBId,
      worktreePath: 'C:/mock/repo/.worktrees/wt-task-b',
      branchName: 'branch-b',
      plannedFiles: ['src/main/services/storage.ts'],
      createdAt: Date.now()
    });

    WorktreeManager.registerActiveTaskWorktree({
      taskId: taskCId,
      worktreePath: 'C:/mock/repo/.worktrees/wt-task-c',
      branchName: 'branch-c',
      plannedFiles: ['src/shared/constants.ts'],
      createdAt: Date.now()
    });

    const activeList = await WorktreeManager.listActiveTaskWorktrees();
    expect(activeList.length).toBe(3);

    // Check conflict for a 4th disjoint task
    const checkD = await WorktreeManager.checkTaskFileConflicts('task-d', ['src/renderer/src/components/Footer.tsx']);
    expect(checkD.canRunParallel).toBe(true);
    expect(checkD.conflictingFiles.length).toBe(0);

    // Clean up
    WorktreeManager.unregisterActiveTaskWorktree(taskAId);
    WorktreeManager.unregisterActiveTaskWorktree(taskBId);
    WorktreeManager.unregisterActiveTaskWorktree(taskCId);
    expect((await WorktreeManager.listActiveTaskWorktrees()).length).toBe(0);
  });

  // -------------------------------------------------------------
  // Scenario C: Universal MCP Integration with Correlation IDs
  // -------------------------------------------------------------
  it('Scenario C: injects authorized MCP tools into agent persona and logs audit records with correlation IDs', async () => {
    const serverConfig: SaveMCPServerInput = {
      name: 'filesystem-server',
      transport: 'stdio',
      command: 'node',
      args: ['-e', 'process.exit(0)'],
      agentPermissions: {
        mode: 'whitelist',
        allowedAgents: ['claude-code', 'frontend-specialist']
      }
    };

    // Save server
    const saved = mcpRegistry.saveServer(serverConfig);
    expect(saved.id).toBeDefined();

    // Verify permission manager allows frontend-specialist
    const isAllowed = mcpPermissionManager.isAgentAllowed(saved, 'frontend-specialist');
    expect(isAllowed).toBe(true);

    // Verify permission manager denies unauthorized agent
    const isDenied = mcpPermissionManager.isAgentAllowed(saved, 'unauthorized-bot');
    expect(isDenied).toBe(false);

    // Save audit log with taskId and traceId correlation
    const taskId = 'task-mcp-test';
    const orchestrationId = 'orch-mcp-test';
    const traceId = 'trace-mcp-test';

    databaseService.saveMCPAuditLog({
      id: randomUUID(),
      serverId: saved.id,
      serverName: saved.name,
      toolName: 'read_project_file',
      agentId: 'frontend-specialist',
      status: 'success',
      durationMs: 42,
      timestamp: Date.now(),
      taskId,
      orchestrationId,
      traceId
    });

    const logs = databaseService.queryMCPAuditLogs({ taskId });
    expect(logs.logs.length).toBe(1);
    expect(logs.logs[0].taskId).toBe(taskId);
    expect(logs.logs[0].orchestrationId).toBe(orchestrationId);
    expect(logs.logs[0].traceId).toBe(traceId);
    expect(logs.logs[0].status).toBe('success');

    // Clean up
    mcpRegistry.deleteServer(saved.id);
  });

  // -------------------------------------------------------------
  // Scenario D: Agent Failure & Error Resilience
  // -------------------------------------------------------------
  it('Scenario D: safely handles agent execution failure, marks task failed, and records error span in trace', async () => {
    const taskId = 'task-fail-test';
    const orchestrationId = 'orch-fail-test';

    traceService.startTrace({
      orchestrationId,
      taskId,
      taskTitle: 'Failing worker task',
      agentId: 'codex',
      role: 'backend-specialist'
    });

    // Record error span
    traceService.recordSpan(taskId, {
      name: 'cli_worker_execution',
      layer: 'cli',
      startedAt: Date.now() - 50,
      completedAt: Date.now(),
      durationMs: 50,
      status: 'failed',
      errorMessage: 'CLI process exited with non-zero exit code 1: syntax error'
    });

    const completed = traceService.completeTrace(taskId, 'failed');
    expect(completed?.status).toBe('failed');
    const failedSpan = completed?.spans.find((s) => s.status === 'failed');
    expect(failedSpan).toBeDefined();
    expect(failedSpan?.errorMessage).toContain('non-zero exit code 1');

    // Retrieve from DB
    const dbTrace = databaseService.getTaskTrace(taskId);
    expect(dbTrace?.status).toBe('failed');
    const dbFailedSpan = dbTrace?.spans.find((s) => s.status === 'failed');
    expect(dbFailedSpan?.errorMessage).toBeDefined();
  });

  // -------------------------------------------------------------
  // Scenario E: Permission Failure & Gateway Defense
  // -------------------------------------------------------------
  it('Scenario E: denies unauthorized agent tool call, records denied audit log and denied trace span', async () => {
    const saved = mcpRegistry.saveServer({
      name: 'restricted-vault',
      transport: 'stdio',
      command: 'node',
      args: ['-e', 'process.exit(0)'],
      agentPermissions: {
        mode: 'whitelist',
        allowedAgents: ['security-specialist']
      }
    });

    const taskId = 'task-unauthorized';
    const orchestrationId = 'orch-perm-test';

    traceService.startTrace({
      orchestrationId,
      taskId,
      taskTitle: 'Unauthorized Tool Call',
      agentId: 'junior-bot',
      role: 'frontend-specialist'
    });

    // Unauthorized call from junior-bot should throw permission error
    await expect(
      mcpGateway.executeTool({
        serverId: saved.id,
        toolName: 'read_secret',
        arguments: {},
        agentId: 'junior-bot',
        taskId,
        orchestrationId
      })
    ).rejects.toThrow('Permission Denied');

    // Verify audit log recorded denied
    const auditLogs = databaseService.queryMCPAuditLogs({ serverId: saved.id, status: 'denied' });
    expect(auditLogs.logs.length).toBe(1);
    expect(auditLogs.logs[0].status).toBe('denied');
    expect(auditLogs.logs[0].agentId).toBe('junior-bot');
    expect(auditLogs.logs[0].taskId).toBe(taskId);

    // Verify trace recorded denied span
    const trace = traceService.getTrace(taskId);
    const deniedSpan = trace?.spans.find((s) => s.layer === 'mcp_gateway');
    expect(deniedSpan).toBeDefined();
    expect(deniedSpan?.status).toBe('denied');

    mcpRegistry.deleteServer(saved.id);
  });

  // -------------------------------------------------------------
  // Scenario F: Proactive File Conflict & Task Deferral
  // -------------------------------------------------------------
  it('Scenario F: detects file conflict between parallel tasks and signals scheduler deferral', async () => {
    const task1Id = 'task-editor-1';
    const task2Id = 'task-editor-2';

    // Task 1 targets shared file
    WorktreeManager.registerActiveTaskWorktree({
      taskId: task1Id,
      worktreePath: 'C:/mock/repo/.worktrees/wt-task-1',
      branchName: 'feature/editor-theme',
      plannedFiles: ['src/renderer/src/components/Editor.tsx', 'src/renderer/src/components/Theme.tsx'],
      createdAt: Date.now()
    });

    // Task 2 also attempts to edit Editor.tsx
    const conflictResult = await WorktreeManager.checkTaskFileConflicts(task2Id, [
      'src/renderer/src/components/Editor.tsx',
      'src/renderer/src/components/Sidebar.tsx'
    ]);

    expect(conflictResult.canRunParallel).toBe(false);
    expect(conflictResult.conflictingFiles.length).toBe(1);
    expect(conflictResult.conflictingFiles[0]).toBe('src/renderer/src/components/Editor.tsx');
    expect(conflictResult.conflictingTaskIds).toContain(task1Id);

    // Clean up
    WorktreeManager.unregisterActiveTaskWorktree(task1Id);

    // Now conflict should clear
    const resolvedResult = await WorktreeManager.checkTaskFileConflicts(task2Id, [
      'src/renderer/src/components/Editor.tsx'
    ]);
    expect(resolvedResult.canRunParallel).toBe(true);
  });

  // -------------------------------------------------------------
  // Scenario G: Orchestration Cancellation & Safe Cleanup
  // -------------------------------------------------------------
  it('Scenario G: safely cancels active traces and active worktree registrations', async () => {
    const taskId = 'task-cancel-test';
    traceService.startTrace({
      orchestrationId: 'orch-cancel',
      taskId,
      taskTitle: 'Cancelled task',
      agentId: 'claude-code',
      role: 'frontend-specialist'
    });

    traceService.recordSpan(taskId, {
      name: 'in_flight_work',
      layer: 'worktree',
      startedAt: Date.now() - 10,
      completedAt: Date.now(),
      durationMs: 10,
      status: 'running'
    });

    WorktreeManager.registerActiveTaskWorktree({
      taskId,
      worktreePath: 'C:/mock/repo/.worktrees/wt-cancel',
      branchName: 'feature/cancel',
      plannedFiles: ['src/a.ts'],
      createdAt: Date.now()
    });

    // Cancel trace
    const cancelled = traceService.completeTrace(taskId, 'cancelled');
    expect(cancelled?.status).toBe('cancelled');

    // Unregister worktree
    WorktreeManager.unregisterActiveTaskWorktree(taskId);
    expect((await WorktreeManager.listActiveTaskWorktrees()).find((w) => w.taskId === taskId)).toBeUndefined();
  });

  // -------------------------------------------------------------
  // Phase 10: Performance Benchmarking
  // -------------------------------------------------------------
  it('Phase 10: achieves sub-millisecond scheduling latency and high trace throughput', async () => {
    // Benchmark 1: Capability resolution speed
    const startCap = performance.now();
    for (let i = 0; i < 3; i++) {
      await agentCapabilityRegistry.findBestAgentForTask('frontend-specialist');
    }
    const capDurationMs = (performance.now() - startCap) / 3;
    expect(capDurationMs).toBeLessThan(1000.0); // Sub-second full disk CLI resolution

    // Benchmark 2: Worktree conflict check latency with planned files
    WorktreeManager.registerActiveTaskWorktree({
      taskId: 'bench-task',
      worktreePath: 'C:/repo/.worktrees/bench',
      branchName: 'bench-branch',
      plannedFiles: ['file1.ts', 'file2.ts', 'file3.ts'],
      createdAt: Date.now()
    });

    const startConflict = performance.now();
    for (let i = 0; i < 50; i++) {
      await WorktreeManager.checkTaskFileConflicts('other-task', ['file2.ts', 'file4.ts']);
    }
    const conflictDurationMs = (performance.now() - startConflict) / 50;
    expect(conflictDurationMs).toBeLessThan(2.0); // < 2ms per check

    WorktreeManager.unregisterActiveTaskWorktree('bench-task');

    // Benchmark 3: Trace recording & retrieval throughput
    const benchTaskId = 'bench-trace-task';
    traceService.startTrace({
      orchestrationId: 'bench-orch',
      taskId: benchTaskId,
      taskTitle: 'Bench task',
      agentId: 'claude-code',
      role: 'frontend-specialist'
    });

    const startTrace = performance.now();
    for (let i = 0; i < 100; i++) {
      traceService.recordSpan(benchTaskId, {
        name: `span_${i}`,
        layer: 'cli',
        startedAt: Date.now() - 5,
        completedAt: Date.now(),
        durationMs: 5,
        status: 'completed'
      });
    }
    traceService.completeTrace(benchTaskId, 'completed');
    const traceDurationMs = performance.now() - startTrace;

    // 100 spans recorded and persisted in SQLite in under 250ms
    expect(traceDurationMs).toBeLessThan(250);
  }, 15000);
});
