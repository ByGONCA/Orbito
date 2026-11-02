import { describe, it, expect } from 'vitest';
import { WORKFLOW_TEMPLATES } from '../src/main/workflows/workflow-templates';
import { WorkflowValidator } from '../src/main/workflows/workflow-validator';
import { WorkflowGenerator } from '../src/main/workflows/workflow-generator';
import { NODE_REGISTRY } from '../src/main/workflows/node-registry';

describe('Workflow Templates & Natural Language Generation', () => {
  it('validates that all 10 built-in templates are structurally sound DAGs', () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(10);

    for (const template of WORKFLOW_TEMPLATES) {
      const result = WorkflowValidator.validate(template.nodes, template.edges);
      expect(result.valid, `Template "${template.name}" failed validation: ${result.errors.join('; ')}`).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.topologicalOrder).toBeDefined();
      expect(result.levels).toBeDefined();
      expect(template.nodes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('generates a valid security audit workflow from natural language', async () => {
    const res = await WorkflowGenerator.generateFromPrompt({
      prompt: 'Scan the codebase for security flaws and API tokens',
      projectPath: process.cwd()
    });

    expect(res.name).toContain('Security');
    expect(res.nodes.length).toBeGreaterThanOrEqual(4);
    expect(res.validationErrors).toBeUndefined();

    const nodeTypes = res.nodes.map((n) => n.data.nodeType);
    expect(nodeTypes).toContain('manual_trigger');
    expect(nodeTypes).toContain('ai_agent');
    expect(nodeTypes).toContain('output');

    // Permissions check
    expect(res.estimatedPermissions.filesystem.read).toBe(true);
  });

  it('generates a valid test diagnostics workflow from natural language', async () => {
    const res = await WorkflowGenerator.generateFromPrompt({
      prompt: 'Run the tests and analyze why any test cases failed',
      projectPath: process.cwd()
    });

    expect(res.name).toContain('Test');
    const nodeTypes = res.nodes.map((n) => n.data.nodeType);
    expect(nodeTypes).toContain('run_tests');
    expect(nodeTypes).toContain('ai_agent');
    expect(res.estimatedPermissions.terminal.execute).toBe(true);
  });

  it('ensures all 29 node types in NODE_REGISTRY have full definitions', () => {
    const types = Object.keys(NODE_REGISTRY);
    expect(types.length).toBe(29);

    for (const key of types) {
      const def = NODE_REGISTRY[key as keyof typeof NODE_REGISTRY];
      expect(def.name).toBeDefined();
      expect(def.category).toBeDefined();
      expect(def.inputs).toBeDefined();
      expect(def.outputs).toBeDefined();
      expect(def.requiredPermissions).toBeDefined();
      expect(def.version).toBe('1.0.0');
    }
  });
});
