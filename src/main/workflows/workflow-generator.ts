import type {
  NLWorkflowPromptRequest,
  NLWorkflowGenerationResult,
  FlowNode,
  FlowEdge,
  FlowNodeType
} from '../../shared/workflows';
import type { SkillPermissions } from '../../shared/skills';
import { createNodeData, NODE_REGISTRY } from './node-registry';
import { WorkflowValidator } from './workflow-validator';

export class WorkflowGenerator {
  /**
   * Generates a validated workflow DAG from a natural language prompt.
   * Analyzes intent and constructs the appropriate sequence of real nodes.
   */
  public static async generateFromPrompt(
    request: NLWorkflowPromptRequest
  ): Promise<NLWorkflowGenerationResult> {
    const promptLower = request.prompt.toLowerCase();

    // Intent analysis rules
    const hasSecurity = promptLower.includes('security') || promptLower.includes('vulnerability') || promptLower.includes('audit');
    const hasTests = promptLower.includes('test') || promptLower.includes('failure') || promptLower.includes('bug');
    const hasReview = promptLower.includes('review') || promptLower.includes('diff') || promptLower.includes('pr');
    const hasDocs = promptLower.includes('doc') || promptLower.includes('readme') || promptLower.includes('guide');
    const hasRefactor = promptLower.includes('refactor') || promptLower.includes('clean') || promptLower.includes('optimize');

    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    let name = 'Automated Workflow';
    let description = request.prompt;
    let explanation = '';

    // Always start with Manual Trigger
    nodes.push({
      id: 'trigger',
      type: 'customNode',
      position: { x: 50, y: 150 },
      data: createNodeData('manual_trigger', { label: 'Manual Trigger' })
    });

    let currentX = 280;
    let lastNodeId = 'trigger';
    let lastOutputHandle = 'trigger';

    const addStep = (
      id: string,
      type: FlowNodeType,
      label: string,
      targetHandle: string,
      nextOutputHandle: string,
      configOverrides: Record<string, any> = {}
    ) => {
      nodes.push({
        id,
        type: 'customNode',
        position: { x: currentX, y: 150 },
        data: createNodeData(type, { label, config: configOverrides })
      });

      edges.push({
        id: `e-${lastNodeId}-${id}`,
        source: lastNodeId,
        target: id,
        sourceHandle: lastOutputHandle,
        targetHandle,
        animated: true
      });

      lastNodeId = id;
      lastOutputHandle = nextOutputHandle;
      currentX += 260;
    };

    if (hasSecurity) {
      name = 'Automated Security Assessment';
      explanation = 'Workflow retrieves project structure, executes full-text search for sensitive credentials and vulnerabilities, and tasks a Security Specialist agent with producing a remediation report.';
      addStep('info', 'get_project_info', 'Get Project Info', 'trigger', 'projectPath');
      addStep('search', 'search_workspace', 'Scan Sensitive Tokens', 'query', 'formatted', { query: 'password token api_key secret auth' });
      addStep('agent', 'ai_agent', 'Security Analyst', 'context', 'result', { role: 'security', taskPrompt: 'Audit code for potential vulnerabilities and unencrypted secrets.' });
    } else if (hasTests) {
      name = 'Test & Failure Diagnostic Automation';
      explanation = 'Runs the project test suite, detects exit code failures, and invokes an AI testing agent to diagnose and suggest remediation code.';
      addStep('tests', 'run_tests', 'Run Test Suite', 'trigger', 'output');
      addStep('agent', 'ai_agent', 'Failure Investigator', 'prompt', 'result', { role: 'testing', taskPrompt: 'Diagnose any failing test cases and explain the root cause.' });
    } else if (hasReview) {
      name = 'Pre-Commit Code Review Flow';
      explanation = 'Inspects local git diff, verifies TypeScript types, and executes an independent review agent before producing a summary.';
      addStep('types', 'run_typecheck', 'Typecheck Gate', 'trigger', 'output');
      addStep('diff', 'git_diff', 'Inspect Git Diff', 'trigger', 'diff');
      addStep('review', 'ai_review', 'Adversarial Review', 'content', 'feedback', { criteria: 'Review modified code for correctness, security, and edge cases.' });
    } else if (hasDocs) {
      name = 'Documentation Generator Workflow';
      explanation = 'Assembles architecture context from codebase AST and invokes the Documentation specialist agent to draft guides.';
      addStep('info', 'get_project_info', 'Project Metadata', 'trigger', 'name');
      addStep('context', 'build_context', 'Assemble Code Context', 'taskQuery', 'assembledPrompt', { maxTokens: 8000 });
      addStep('agent', 'ai_agent', 'Docs Specialist', 'context', 'result', { role: 'documentation', taskPrompt: 'Generate comprehensive project documentation and API specification.' });
    } else if (hasRefactor) {
      name = 'Verified Code Refactoring';
      explanation = 'Delegates clean-up task to a multi-agent orchestration session and verifies stability by running tests.';
      addStep('multi', 'multi_agent_task', 'Orchestrated Refactoring', 'goal', 'summary', { goal: request.prompt, mode: 'supervised' });
      addStep('tests', 'run_tests', 'Verify Test Suite', 'trigger', 'output');
    } else {
      // General Task Workflow
      name = 'AI Workspace Automation';
      explanation = 'Assembles project context and executes an AI Agent task based on your specific requirements.';
      addStep('info', 'get_project_info', 'Project Metadata', 'trigger', 'name');
      addStep('context', 'build_context', 'Assemble Context', 'taskQuery', 'assembledPrompt', { maxTokens: 8000 });
      addStep('agent', 'ai_agent', 'AI Specialist', 'context', 'result', { role: 'backend', taskPrompt: request.prompt });
    }

    // Always terminate with Output Node
    nodes.push({
      id: 'output',
      type: 'customNode',
      position: { x: currentX, y: 150 },
      data: createNodeData('output', { label: 'Final Output' })
    });

    edges.push({
      id: `e-${lastNodeId}-output`,
      source: lastNodeId,
      target: 'output',
      sourceHandle: lastOutputHandle,
      targetHandle: 'value',
      animated: true
    });

    // Validate the generated DAG
    const validation = WorkflowValidator.validate(nodes, edges);

    // Compute aggregate estimated permissions
    const permissions: SkillPermissions = {
      filesystem: { read: false, write: false },
      terminal: { execute: false },
      network: { allowed: false }
    };

    for (const node of nodes) {
      const def = NODE_REGISTRY[node.data.nodeType];
      if (def?.requiredPermissions) {
        if (def.requiredPermissions.filesystem.read) permissions.filesystem.read = true;
        if (def.requiredPermissions.filesystem.write) permissions.filesystem.write = true;
        if (def.requiredPermissions.terminal.execute) permissions.terminal.execute = true;
        if (def.requiredPermissions.network.allowed) permissions.network.allowed = true;
      }
    }

    return {
      name,
      description,
      nodes,
      edges,
      variables: {},
      trigger: { type: 'manual', enabled: true, config: {} },
      explanation,
      estimatedPermissions: permissions,
      validationErrors: validation.errors.length > 0 ? validation.errors : undefined
    };
  }
}
