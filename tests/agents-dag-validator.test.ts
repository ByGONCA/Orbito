import { describe, it, expect } from 'vitest';
import { DAGValidator } from '../src/main/agents/dag-validator';
import type { OrchestrationTask } from '../src/shared/agents';

describe('DAG Validator & Topological Scheduler (Cycle Detection & Dependency Integrity)', () => {
  const createMockTask = (id: string, dependencies: string[]): OrchestrationTask => ({
    id,
    orchestrationId: 'orch-test-1',
    title: `Task ${id}`,
    description: `Description for ${id}`,
    acceptanceCriteria: ['Pass test criteria'],
    role: 'backend',
    assignedProvider: 'claude',
    dependencies,
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
    timeoutSeconds: 180,
    createdAt: Date.now(),
    changedFiles: []
  });

  it('validates a linear dependency graph successfully', () => {
    const tasks = [
      createMockTask('task-1', []),
      createMockTask('task-2', ['task-1']),
      createMockTask('task-3', ['task-2'])
    ];

    const res = DAGValidator.validate(tasks);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
    expect(res.topologicalOrder).toEqual(['task-1', 'task-2', 'task-3']);
    expect(res.levels?.length).toBe(3);
    expect(res.levels?.[0]).toEqual(['task-1']);
    expect(res.levels?.[1]).toEqual(['task-2']);
    expect(res.levels?.[2]).toEqual(['task-3']);
  });

  it('computes parallel execution lanes for diamond dependency graph', () => {
    // task-1 -> (task-2, task-3 in parallel) -> task-4
    const tasks = [
      createMockTask('task-1', []),
      createMockTask('task-2', ['task-1']),
      createMockTask('task-3', ['task-1']),
      createMockTask('task-4', ['task-2', 'task-3'])
    ];

    const res = DAGValidator.validate(tasks);
    expect(res.valid).toBe(true);
    expect(res.levels?.length).toBe(3);
    expect(res.levels?.[0]).toEqual(['task-1']);
    expect(res.levels?.[1].sort()).toEqual(['task-2', 'task-3'].sort());
    expect(res.levels?.[2]).toEqual(['task-4']);
  });

  it('detects circular dependency (cycle) and rejects DAG', () => {
    // task-1 -> task-2 -> task-3 -> task-1 (cycle!)
    const tasks = [
      createMockTask('task-1', ['task-3']),
      createMockTask('task-2', ['task-1']),
      createMockTask('task-3', ['task-2'])
    ];

    const res = DAGValidator.validate(tasks);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('Circular dependency'))).toBe(true);
  });

  it('detects missing dependency reference', () => {
    const tasks = [
      createMockTask('task-1', ['task-ghost-nonexistent'])
    ];

    const res = DAGValidator.validate(tasks);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('non-existent'))).toBe(true);
  });

  it('detects self-dependency', () => {
    const tasks = [
      createMockTask('task-1', ['task-1'])
    ];

    const res = DAGValidator.validate(tasks);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('self-dependency'))).toBe(true);
  });

  it('validates allowed status transitions', () => {
    expect(DAGValidator.isValidTransition('pending', 'ready')).toBe(true);
    expect(DAGValidator.isValidTransition('ready', 'running')).toBe(true);
    expect(DAGValidator.isValidTransition('running', 'waiting_approval')).toBe(true);
    expect(DAGValidator.isValidTransition('running', 'reviewing')).toBe(true);
    expect(DAGValidator.isValidTransition('reviewing', 'completed')).toBe(true);
    expect(DAGValidator.isValidTransition('completed', 'running')).toBe(false); // Finished task cannot run again without retry
  });
});
