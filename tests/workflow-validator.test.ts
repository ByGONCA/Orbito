import { describe, it, expect } from 'vitest';
import { WorkflowValidator } from '../src/main/workflows/workflow-validator';
import { createNodeData } from '../src/main/workflows/node-registry';
import type { FlowNode, FlowEdge } from '../src/shared/workflows';

describe('WorkflowValidator (DAG & Topological Scheduling)', () => {
  it('validates a simple valid sequential workflow DAG', () => {
    const nodes: FlowNode[] = [
      { id: 'n1', type: 'customNode', position: { x: 0, y: 0 }, data: createNodeData('manual_trigger') },
      { id: 'n2', type: 'customNode', position: { x: 200, y: 0 }, data: createNodeData('get_project_info') },
      { id: 'n3', type: 'customNode', position: { x: 400, y: 0 }, data: createNodeData('output') }
    ];

    const edges: FlowEdge[] = [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'trigger', targetHandle: 'trigger' },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'name', targetHandle: 'value' }
    ];

    const res = WorkflowValidator.validate(nodes, edges);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.topologicalOrder).toEqual(['n1', 'n2', 'n3']);
    expect(res.levels).toEqual([['n1'], ['n2'], ['n3']]);
  });

  it('detects and flags cycles using Kahn algorithm', () => {
    const nodes: FlowNode[] = [
      { id: 'a', type: 'customNode', position: { x: 0, y: 0 }, data: createNodeData('manual_trigger') },
      { id: 'b', type: 'customNode', position: { x: 100, y: 0 }, data: createNodeData('condition') },
      { id: 'c', type: 'customNode', position: { x: 200, y: 0 }, data: createNodeData('output') }
    ];

    // a -> b -> c -> a (Cycle)
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
      { id: 'e3', source: 'c', target: 'a' }
    ];

    const res = WorkflowValidator.validate(nodes, edges);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('Cyclic dependency detected'))).toBe(true);
  });

  it('detects self-referencing loop connections', () => {
    const nodes: FlowNode[] = [
      { id: 'n1', type: 'customNode', position: { x: 0, y: 0 }, data: createNodeData('condition') }
    ];

    const edges: FlowEdge[] = [
      { id: 'e1', source: 'n1', target: 'n1' }
    ];

    const res = WorkflowValidator.validate(nodes, edges);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('Self-referencing loop'))).toBe(true);
  });

  it('computes parallel execution levels for fork-join topology', () => {
    const nodes: FlowNode[] = [
      { id: 'start', type: 'customNode', position: { x: 0, y: 0 }, data: createNodeData('manual_trigger') },
      { id: 'fork1', type: 'customNode', position: { x: 200, y: -50 }, data: createNodeData('run_typecheck') },
      { id: 'fork2', type: 'customNode', position: { x: 200, y: 50 }, data: createNodeData('run_tests') },
      { id: 'join', type: 'customNode', position: { x: 400, y: 0 }, data: createNodeData('merge') }
    ];

    const edges: FlowEdge[] = [
      { id: 'e1', source: 'start', target: 'fork1' },
      { id: 'e2', source: 'start', target: 'fork2' },
      { id: 'e3', source: 'fork1', target: 'join' },
      { id: 'e4', source: 'fork2', target: 'join' }
    ];

    const res = WorkflowValidator.validate(nodes, edges);
    expect(res.valid).toBe(true);
    expect(res.levels).toHaveLength(3);
    expect(res.levels![0]).toEqual(['start']);
    expect(res.levels![1].sort()).toEqual(['fork1', 'fork2']);
    expect(res.levels![2]).toEqual(['join']);
  });

  it('rejects workflows with missing nodes or dangling edge references', () => {
    const nodes: FlowNode[] = [
      { id: 'valid_node', type: 'customNode', position: { x: 0, y: 0 }, data: createNodeData('manual_trigger') }
    ];

    const edges: FlowEdge[] = [
      { id: 'e1', source: 'valid_node', target: 'non_existent_node' }
    ];

    const res = WorkflowValidator.validate(nodes, edges);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('missing target node'))).toBe(true);
  });
});
