import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { WorkflowEngine } from '../src/main/workflows/workflow-engine';
import { createNodeData } from '../src/main/workflows/node-registry';
import { databaseService } from '../src/main/db/database.service';
import type { WorkflowRecord, FlowNode, FlowEdge } from '../src/shared/workflows';

const TEST_STORAGE = path.join(process.cwd(), '.test-wf-engine-' + Date.now());

describe('WorkflowEngine (DAG Execution & Branching)', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    if (!fs.existsSync(TEST_STORAGE)) {
      fs.mkdirSync(TEST_STORAGE, { recursive: true });
    }
    (databaseService as any).storageDir = TEST_STORAGE;
    databaseService.initialize();
    engine = new WorkflowEngine();
  });

  afterEach(() => {
    databaseService.close();
    try {
      fs.rmSync(TEST_STORAGE, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('executes a linear dataflow DAG with text input and output', async () => {
    const nodes: FlowNode[] = [
      { id: 't1', type: 'customNode', position: { x: 0, y: 0 }, data: createNodeData('text_input', { config: { text: 'Hello Workflow' } }) },
      { id: 'o1', type: 'customNode', position: { x: 200, y: 0 }, data: createNodeData('output', { config: { title: 'Result' } }) }
    ];

    const edges: FlowEdge[] = [
      { id: 'e1', source: 't1', target: 'o1', sourceHandle: 'text', targetHandle: 'value' }
    ];

    const wf: WorkflowRecord = {
      id: 'wf-linear-test',
      projectId: 'test-project',
      name: 'Linear Test',
      description: 'Tests linear output mapping',
      nodes,
      edges,
      variables: {},
      trigger: { type: 'manual', enabled: true, config: {} },
      status: 'ready',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    databaseService.upsertWorkflow(wf);

    const exec = await engine.executeWorkflow(wf, {}, process.cwd());
    expect(exec.status).toBe('completed');
    expect(exec.outputs['o1']).toBe('Hello Workflow');
  });

  it('routes execution conditionally and skips false branch', async () => {
    const nodes: FlowNode[] = [
      { id: 't1', type: 'customNode', position: { x: 0, y: 0 }, data: createNodeData('text_input', { config: { text: 'pass' } }) },
      { id: 'cond', type: 'customNode', position: { x: 150, y: 0 }, data: createNodeData('condition', { config: { expression: "value == 'pass'" } }) },
      { id: 'true_out', type: 'customNode', position: { x: 300, y: -50 }, data: createNodeData('output', { config: { title: 'True Output' } }) },
      { id: 'false_out', type: 'customNode', position: { x: 300, y: 50 }, data: createNodeData('output', { config: { title: 'False Output' } }) }
    ];

    const edges: FlowEdge[] = [
      { id: 'e1', source: 't1', target: 'cond', sourceHandle: 'text', targetHandle: 'value' },
      { id: 'e2', source: 'cond', target: 'true_out', sourceHandle: 'true', targetHandle: 'value' },
      { id: 'e3', source: 'cond', target: 'false_out', sourceHandle: 'false', targetHandle: 'value' }
    ];

    const wf: WorkflowRecord = {
      id: 'wf-cond-test',
      projectId: 'test-project',
      name: 'Condition Test',
      description: 'Tests branch skipping',
      nodes,
      edges,
      variables: {},
      trigger: { type: 'manual', enabled: true, config: {} },
      status: 'ready',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    databaseService.upsertWorkflow(wf);

    const exec = await engine.executeWorkflow(wf, {}, process.cwd());
    expect(exec.status).toBe('completed');
    expect(exec.outputs['true_out']).toBe('pass');
    expect(exec.outputs['false_out']).toBeUndefined();
  });

  it('reads and mutates workflow variables across nodes', async () => {
    const nodes: FlowNode[] = [
      { id: 'v_set', type: 'customNode', position: { x: 0, y: 0 }, data: createNodeData('variable', { config: { varName: 'counter', operation: 'set' } }) },
      { id: 'v_get', type: 'customNode', position: { x: 200, y: 0 }, data: createNodeData('variable', { config: { varName: 'counter', operation: 'get' } }) },
      { id: 'out', type: 'customNode', position: { x: 400, y: 0 }, data: createNodeData('output') }
    ];

    const edges: FlowEdge[] = [
      { id: 'e1', source: 'v_set', target: 'v_get' },
      { id: 'e2', source: 'v_get', target: 'out', sourceHandle: 'value', targetHandle: 'value' }
    ];

    const wf: WorkflowRecord = {
      id: 'wf-var-test',
      projectId: 'test-project',
      name: 'Variable Test',
      description: 'Tests variable get/set',
      nodes,
      edges,
      variables: {
        counter: { name: 'counter', type: 'number', value: 42 }
      },
      trigger: { type: 'manual', enabled: true, config: {} },
      status: 'ready',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    databaseService.upsertWorkflow(wf);

    const exec = await engine.executeWorkflow(wf, { newValue: 100 }, process.cwd());
    expect(exec.status).toBe('completed');
    expect(exec.variables['counter']).toBe(100);
    expect(exec.outputs['out']).toBe(100);
  });
});
