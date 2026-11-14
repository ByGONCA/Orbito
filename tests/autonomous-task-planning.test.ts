import { describe, it, expect } from 'vitest';
import { CoordinatorAgent } from '../src/main/agents/coordinator-agent';
import { DAGValidator } from '../src/main/agents/dag-validator';

describe('Autonomous Task Planning Engine Suite', () => {
  it('1. generates a lightweight single-step plan for simple requests without over-engineering', () => {
    const { plan, tasks } = CoordinatorAgent.createPlan({
      orchestrationId: 'orch-test-simple',
      userGoal: 'Summarize the project license and author information',
      provider: 'claude',
      mode: 'autonomous'
    });

    expect(plan).toBeDefined();
    expect(plan.complexity).toBe('simple');
    expect(tasks.length).toBe(1);
    expect(tasks[0].role).toBe('architect');
    expect(tasks[0].dependencies).toEqual([]);
    expect(plan.parallelExecutionFeasible).toBe(false);

    const validation = DAGValidator.validate(tasks);
    expect(validation.valid).toBe(true);
  });

  it('2. generates a 3-stage surgical DAG for bug fix goals', () => {
    const { plan, tasks } = CoordinatorAgent.createPlan({
      orchestrationId: 'orch-test-bug',
      userGoal: 'Fix intermittent null pointer exception when rendering terminal lines',
      provider: 'claude',
      mode: 'supervised'
    });

    expect(plan.category).toBe('bug_fix');
    expect(tasks.length).toBe(3);

    const t1 = tasks[0];
    const t2 = tasks[1];
    const t3 = tasks[2];

    expect(t1.role).toBe('architect');
    expect(t1.isModifying).toBe(false);
    expect(t1.dependencies).toEqual([]);

    expect(t2.role).toBe('backend');
    expect(t2.isModifying).toBe(true);
    expect(t2.dependencies).toEqual([t1.id]);

    expect(t3.role).toBe('testing');
    expect(t3.isModifying).toBe(true);
    expect(t3.dependencies).toEqual([t2.id]);

    const validation = DAGValidator.validate(tasks);
    expect(validation.valid).toBe(true);
  });

  it('3. generates a hardened security audit and remediation DAG for vulnerability requests', () => {
    const { plan, tasks } = CoordinatorAgent.createPlan({
      orchestrationId: 'orch-test-security',
      userGoal: 'Audit IPC channels for command injection and sanitize arguments',
      provider: 'claude',
      mode: 'supervised'
    });

    expect(plan.category).toBe('security');
    expect(plan.riskLevel).toBe('high');
    expect(plan.verificationStrategy.securityAuditRequired).toBe(true);

    const roles = tasks.map((t) => t.role);
    expect(roles).toContain('security');
    expect(roles).toContain('backend');
    expect(roles).toContain('testing');

    const validation = DAGValidator.validate(tasks);
    expect(validation.valid).toBe(true);
  });

  it('4. decomposes full-stack features into parallelizable backend and frontend tasks', () => {
    const { plan, tasks } = CoordinatorAgent.createPlan({
      orchestrationId: 'orch-test-feature',
      userGoal: 'Implement real-time agent memory view with visual graph explorer and backend IPC',
      provider: 'claude',
      mode: 'autonomous'
    });

    expect(tasks.length).toBe(4);
    const [spec, backend, frontend, testing] = tasks;

    expect(spec.role).toBe('architect');
    expect(spec.dependencies).toEqual([]);

    expect(backend.role).toBe('backend');
    expect(backend.dependencies).toEqual([spec.id]);

    expect(frontend.role).toBe('frontend');
    expect(frontend.dependencies).toEqual([spec.id]);

    // Backend and frontend can run in parallel from the spec!
    expect(plan.parallelExecutionFeasible).toBe(true);

    // Testing depends on both parallel components completing
    expect(testing.role).toBe('testing');
    expect(testing.dependencies).toContain(backend.id);
    expect(testing.dependencies).toContain(frontend.id);

    const validation = DAGValidator.validate(tasks);
    expect(validation.valid).toBe(true);
  });

  it('5. provides a structured human-readable explanation of an autonomous plan', () => {
    const { plan } = CoordinatorAgent.createPlan({
      orchestrationId: 'orch-test-explain',
      userGoal: 'Add dark mode theme toggle with persistent configuration',
      provider: 'claude'
    });

    const explanation = CoordinatorAgent.explainPlan(plan);
    expect(explanation).toContain('### Autonomous Plan:');
    expect(explanation).toContain('Subtask Schedule:');
    expect(explanation).toContain('[ARCHITECT]');
  });
});
