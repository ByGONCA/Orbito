import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../src/main/db/database.service';
import type { WorkflowRecord, WorkflowExecutionRecord, NodeExecutionRecord } from '../src/shared/workflows';

const TEST_DB_DIR = path.join(process.cwd(), '.test-wf-db-' + Date.now());

describe('Workflow Database Persistence & Crash Recovery', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DB_DIR)) {
      fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    }
    (databaseService as any).storageDir = TEST_DB_DIR;
    databaseService.initialize();
  });

  afterEach(() => {
    databaseService.close();
    try {
      fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('performs CRUD operations on workflow records', () => {
    const wf: WorkflowRecord = {
      id: 'wf-persist-1',
      projectId: 'proj-123',
      name: 'Sample Workflow',
      description: 'Test description',
      nodes: [],
      edges: [],
      variables: {},
      trigger: { type: 'manual', enabled: true, config: {} },
      status: 'ready',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    databaseService.upsertWorkflow(wf);

    const retrieved = databaseService.getWorkflow('wf-persist-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Sample Workflow');

    // Duplicate
    const duplicated = databaseService.duplicateWorkflow('wf-persist-1');
    expect(duplicated).not.toBeNull();
    expect(duplicated?.name).toContain('(Copy)');

    // List
    const list = databaseService.listWorkflows('proj-123');
    expect(list.length).toBeGreaterThanOrEqual(2);

    // Delete
    const deleted = databaseService.deleteWorkflow('wf-persist-1');
    expect(deleted).toBe(true);
    expect(databaseService.getWorkflow('wf-persist-1')).toBeNull();
  });

  it('persists execution records and node executions', () => {
    const wf: WorkflowRecord = {
      id: 'wf-exec-store',
      projectId: 'proj-123',
      name: 'Exec Store Test',
      description: '',
      nodes: [],
      edges: [],
      variables: {},
      trigger: { type: 'manual', enabled: true, config: {} },
      status: 'ready',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    databaseService.upsertWorkflow(wf);

    const execRecord: WorkflowExecutionRecord = {
      id: 'exec-101',
      workflowId: 'wf-exec-store',
      projectId: 'proj-123',
      status: 'running',
      triggerType: 'manual',
      inputs: { query: 'test' },
      outputs: {},
      variables: {},
      durationMs: 0,
      createdAt: Date.now()
    };

    databaseService.createWorkflowExecution(execRecord);

    const retrievedExec = databaseService.getWorkflowExecution('exec-101');
    expect(retrievedExec?.status).toBe('running');

    // Record node execution
    const nodeExec: NodeExecutionRecord = {
      id: 'ne-1',
      executionId: 'exec-101',
      nodeId: 'node-a',
      nodeType: 'run_tests',
      status: 'completed',
      inputs: {},
      outputs: { passed: true },
      durationMs: 1500,
      startedAt: Date.now(),
      completedAt: Date.now() + 1500
    };

    databaseService.recordNodeExecution(nodeExec);

    // Update execution status
    execRecord.status = 'completed';
    execRecord.durationMs = 2500;
    databaseService.updateWorkflowExecution(execRecord);

    const updated = databaseService.getWorkflowExecution('exec-101');
    expect(updated?.status).toBe('completed');
    expect(updated?.durationMs).toBe(2500);
  });

  it('recovers interrupted workflow executions on startup', () => {
    const wf: WorkflowRecord = {
      id: 'wf-crash',
      projectId: 'proj-123',
      name: 'Crash Test',
      description: '',
      nodes: [],
      edges: [],
      variables: {},
      trigger: { type: 'manual', enabled: true, config: {} },
      status: 'ready',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    databaseService.upsertWorkflow(wf);

    databaseService.createWorkflowExecution({
      id: 'exec-interrupted',
      workflowId: 'wf-crash',
      projectId: 'proj-123',
      status: 'running',
      triggerType: 'manual',
      inputs: {},
      outputs: {},
      variables: {},
      durationMs: 0,
      createdAt: Date.now()
    });

    const recovery = databaseService.recoverWorkflowExecutionsOnStartup();
    expect(recovery.recoveredExecutions).toBe(1);

    const afterRecovery = databaseService.getWorkflowExecution('exec-interrupted');
    expect(afterRecovery?.status).toBe('failed');
    expect(afterRecovery?.errorMessage).toContain('application restart');
  });
});
