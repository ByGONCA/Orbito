import type { WorkflowRecord, FlowNode, FlowEdge } from '../../shared/workflows';
import { createNodeData } from './node-registry';

function buildTemplate(
  id: string,
  name: string,
  description: string,
  nodesSpec: Array<{ id: string; type: any; x: number; y: number; config?: Record<string, any>; label?: string }>,
  edgesSpec: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; label?: string }>
): WorkflowRecord {
  const nodes: FlowNode[] = nodesSpec.map((spec) => ({
    id: spec.id,
    type: 'customNode',
    position: { x: spec.x, y: spec.y },
    data: createNodeData(spec.type, {
      label: spec.label || undefined,
      config: spec.config || {}
    })
  }));

  const edges: FlowEdge[] = edgesSpec.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label,
    animated: true
  }));

  return {
    id,
    projectId: 'default',
    name,
    description,
    nodes,
    edges,
    variables: {},
    trigger: { type: 'manual', enabled: true, config: {} },
    status: 'ready',
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export const WORKFLOW_TEMPLATES: WorkflowRecord[] = [
  // 1. Project Security Audit
  buildTemplate(
    'template-security-audit',
    'Project Security Audit',
    'Audits project files, evaluates permissions, and generates a security vulnerability report.',
    [
      { id: 'trigger', type: 'manual_trigger', x: 50, y: 150, label: 'Manual Launch' },
      { id: 'info', type: 'get_project_info', x: 280, y: 150, label: 'Project Info' },
      { id: 'search', type: 'search_workspace', x: 520, y: 150, config: { query: 'security token secret auth eval' }, label: 'Search Sensitive Tokens' },
      { id: 'agent', type: 'ai_agent', x: 780, y: 150, config: { role: 'security', taskPrompt: 'Audit potential vulnerabilities and security risks.' }, label: 'Security Specialist' },
      { id: 'output', type: 'output', x: 1040, y: 150, label: 'Security Report' }
    ],
    [
      { id: 'e1', source: 'trigger', target: 'info', sourceHandle: 'trigger', targetHandle: 'trigger' },
      { id: 'e2', source: 'info', target: 'search', sourceHandle: 'projectPath', targetHandle: 'query' },
      { id: 'e3', source: 'search', target: 'agent', sourceHandle: 'formatted', targetHandle: 'context' },
      { id: 'e4', source: 'agent', target: 'output', sourceHandle: 'result', targetHandle: 'value' }
    ]
  ),

  // 2. Automatic Code Review
  buildTemplate(
    'template-code-review',
    'Automatic Code Review',
    'Inspects local git diff, runs automated review, and flags defects before committing.',
    [
      { id: 'trigger', type: 'manual_trigger', x: 50, y: 150 },
      { id: 'diff', type: 'git_diff', x: 260, y: 150, label: 'Inspect Git Diff' },
      { id: 'condition', type: 'condition', x: 480, y: 150, config: { expression: 'hasChanges == true' }, label: 'Has Changes?' },
      { id: 'review', type: 'ai_review', x: 740, y: 100, label: 'Adversarial Code Review' },
      { id: 'notify', type: 'notification', x: 740, y: 260, config: { message: 'No uncommitted changes detected.' }, label: 'No Changes Notice' },
      { id: 'output', type: 'output', x: 1000, y: 100, label: 'Review Verdict' }
    ],
    [
      { id: 'e1', source: 'trigger', target: 'diff', sourceHandle: 'trigger', targetHandle: 'trigger' },
      { id: 'e2', source: 'diff', target: 'condition', sourceHandle: 'hasChanges', targetHandle: 'value' },
      { id: 'e3', source: 'condition', target: 'review', sourceHandle: 'true', targetHandle: 'content' },
      { id: 'e4', source: 'condition', target: 'notify', sourceHandle: 'false', targetHandle: 'message' },
      { id: 'e5', source: 'review', target: 'output', sourceHandle: 'feedback', targetHandle: 'value' }
    ]
  ),

  // 3. Generate Project Documentation
  buildTemplate(
    'template-project-docs',
    'Generate Project Documentation',
    'Scans project architecture and builds structured API and architecture guides.',
    [
      { id: 'trigger', type: 'manual_trigger', x: 50, y: 150 },
      { id: 'info', type: 'get_project_info', x: 260, y: 150 },
      { id: 'ctx', type: 'build_context', x: 480, y: 150, config: { maxTokens: 8000 }, label: 'Assemble Architecture Context' },
      { id: 'agent', type: 'ai_agent', x: 740, y: 150, config: { role: 'documentation', taskPrompt: 'Generate a comprehensive project documentation and API overview.' }, label: 'Docs Specialist' },
      { id: 'output', type: 'output', x: 1000, y: 150, label: 'Documentation Markdown' }
    ],
    [
      { id: 'e1', source: 'trigger', target: 'info', sourceHandle: 'trigger', targetHandle: 'trigger' },
      { id: 'e2', source: 'info', target: 'ctx', sourceHandle: 'name', targetHandle: 'taskQuery' },
      { id: 'e3', source: 'ctx', target: 'agent', sourceHandle: 'assembledPrompt', targetHandle: 'context' },
      { id: 'e4', source: 'agent', target: 'output', sourceHandle: 'result', targetHandle: 'value' }
    ]
  ),

  // 4. Run Tests and Analyze Failures
  buildTemplate(
    'template-test-analysis',
    'Run Tests and Analyze Failures',
    'Executes the test suite and, if failures occur, triggers an AI investigator to explain the root cause.',
    [
      { id: 'trigger', type: 'manual_trigger', x: 50, y: 150 },
      { id: 'tests', type: 'run_tests', x: 260, y: 150, label: 'Run Test Suite' },
      { id: 'condition', type: 'condition', x: 480, y: 150, config: { expression: 'passed == false' }, label: 'Did Tests Fail?' },
      { id: 'agent', type: 'ai_agent', x: 740, y: 100, config: { role: 'testing', taskPrompt: 'Diagnose the test failure from the output and provide the fix.' }, label: 'Failure Diagnostician' },
      { id: 'notify', type: 'notification', x: 740, y: 260, config: { message: 'All tests passed cleanly.' }, label: 'Clean Pass Notice' },
      { id: 'output', type: 'output', x: 1000, y: 100, label: 'Failure Diagnosis' }
    ],
    [
      { id: 'e1', source: 'trigger', target: 'tests', sourceHandle: 'trigger', targetHandle: 'trigger' },
      { id: 'e2', source: 'tests', target: 'condition', sourceHandle: 'passed', targetHandle: 'value' },
      { id: 'e3', source: 'condition', target: 'agent', sourceHandle: 'true', targetHandle: 'prompt' },
      { id: 'e4', source: 'condition', target: 'notify', sourceHandle: 'false', targetHandle: 'message' },
      { id: 'e5', source: 'agent', target: 'output', sourceHandle: 'result', targetHandle: 'value' }
    ]
  ),

  // 5. New Project Analysis
  buildTemplate(
    'template-new-project-analysis',
    'New Project Analysis',
    'Discovers dependencies, language patterns, and constructs a holistic project summary for developers.',
    [
      { id: 'trigger', type: 'manual_trigger', x: 50, y: 150 },
      { id: 'info', type: 'get_project_info', x: 260, y: 150 },
      { id: 'files', type: 'search_files', x: 480, y: 150, config: { pattern: '*' }, label: 'Discover File Tree' },
      { id: 'prompt', type: 'ai_prompt', x: 740, y: 150, config: { template: 'Analyze this new codebase and provide a roadmap: {{input}}' }, label: 'Synthesize Roadmap' },
      { id: 'output', type: 'output', x: 1000, y: 150, label: 'Onboarding Brief' }
    ],
    [
      { id: 'e1', source: 'trigger', target: 'info', sourceHandle: 'trigger', targetHandle: 'trigger' },
      { id: 'e2', source: 'info', target: 'files', sourceHandle: 'projectPath', targetHandle: 'pattern' },
      { id: 'e3', source: 'files', target: 'prompt', sourceHandle: 'count', targetHandle: 'input' },
      { id: 'e4', source: 'prompt', target: 'output', sourceHandle: 'output', targetHandle: 'value' }
    ]
  ),

  // 6. Dependency and Package Audit
  buildTemplate(
    'template-dependency-audit',
    'Dependency and Package Audit',
    'Reads package.json, checks for outdated or deprecated packages, and provides upgrade recommendations.',
    [
      { id: 'trigger', type: 'manual_trigger', x: 50, y: 150 },
      { id: 'read', type: 'read_file', x: 260, y: 150, config: { filePath: 'package.json' }, label: 'Read package.json' },
      { id: 'agent', type: 'ai_agent', x: 520, y: 150, config: { role: 'architect', taskPrompt: 'Audit dependencies for security risks and deprecations.' }, label: 'Dependency Auditor' },
      { id: 'output', type: 'output', x: 800, y: 150, label: 'Dependency Audit Report' }
    ],
    [
      { id: 'e1', source: 'trigger', target: 'read', sourceHandle: 'trigger', targetHandle: 'filePath' },
      { id: 'e2', source: 'read', target: 'agent', sourceHandle: 'content', targetHandle: 'context' },
      { id: 'e3', source: 'agent', target: 'output', sourceHandle: 'result', targetHandle: 'value' }
    ]
  ),

  // 7. AI-Assisted Refactoring
  buildTemplate(
    'template-ai-refactor',
    'AI-Assisted Refactoring',
    'Multi-agent workflow that inspects a module, builds tests, and executes verified refactoring.',
    [
      { id: 'trigger', type: 'manual_trigger', x: 50, y: 150 },
      { id: 'multi', type: 'multi_agent_task', x: 280, y: 150, config: { goal: 'Refactor complex functions for clean code and high performance.', mode: 'supervised' }, label: 'Multi-Agent Refactor' },
      { id: 'tests', type: 'run_tests', x: 560, y: 150, label: 'Verify Test Suite' },
      { id: 'output', type: 'output', x: 820, y: 150, label: 'Refactoring Summary' }
    ],
    [
      { id: 'e1', source: 'trigger', target: 'multi', sourceHandle: 'trigger', targetHandle: 'goal' },
      { id: 'e2', source: 'multi', target: 'tests', sourceHandle: 'success', targetHandle: 'trigger' },
      { id: 'e3', source: 'tests', target: 'output', sourceHandle: 'output', targetHandle: 'value' }
    ]
  ),

  // 8. Pull Request Preparation
  buildTemplate(
    'template-pr-prep',
    'Pull Request Preparation',
    'Verifies typechecking, runs test suite, checks git diff, and drafts PR title and description.',
    [
      { id: 'trigger', type: 'manual_trigger', x: 50, y: 150 },
      { id: 'types', type: 'run_typecheck', x: 260, y: 150, label: 'Typecheck Gate' },
      { id: 'diff', type: 'git_diff', x: 480, y: 150, label: 'Inspect Diff' },
      { id: 'agent', type: 'ai_agent', x: 720, y: 150, config: { role: 'documentation', taskPrompt: 'Generate a GitHub Pull Request description with summary, changes, and test instructions.' }, label: 'PR Writer' },
      { id: 'output', type: 'output', x: 980, y: 150, label: 'Draft PR Description' }
    ],
    [
      { id: 'e1', source: 'trigger', target: 'types', sourceHandle: 'trigger', targetHandle: 'trigger' },
      { id: 'e2', source: 'types', target: 'diff', sourceHandle: 'clean', targetHandle: 'trigger' },
      { id: 'e3', source: 'diff', target: 'agent', sourceHandle: 'diff', targetHandle: 'context' },
      { id: 'e4', source: 'agent', target: 'output', sourceHandle: 'result', targetHandle: 'value' }
    ]
  ),

  // 9. Codebase Onboarding
  buildTemplate(
    'template-codebase-onboarding',
    'Codebase Onboarding Guide',
    'Creates a fast-start onboarding guide explaining architecture, entry points, and dev workflows.',
    [
      { id: 'trigger', type: 'manual_trigger', x: 50, y: 150 },
      { id: 'info', type: 'get_project_info', x: 260, y: 150 },
      { id: 'search', type: 'search_workspace', x: 480, y: 150, config: { query: 'main setup start dev script README' }, label: 'Find Entrypoints' },
      { id: 'agent', type: 'ai_agent', x: 720, y: 150, config: { role: 'architect', taskPrompt: 'Create a developer onboarding guide for this repository.' }, label: 'Architect Onboarding' },
      { id: 'output', type: 'output', x: 960, y: 150, label: 'Onboarding Guide' }
    ],
    [
      { id: 'e1', source: 'trigger', target: 'info', sourceHandle: 'trigger', targetHandle: 'trigger' },
      { id: 'e2', source: 'info', target: 'search', sourceHandle: 'projectPath', targetHandle: 'query' },
      { id: 'e3', source: 'search', target: 'agent', sourceHandle: 'formatted', targetHandle: 'context' },
      { id: 'e4', source: 'agent', target: 'output', sourceHandle: 'result', targetHandle: 'value' }
    ]
  ),

  // 10. Performance Analysis
  buildTemplate(
    'template-performance-analysis',
    'Performance & Hotpath Analysis',
    'Scans for heavy loops, non-indexed queries, and async bottlenecks across workspace modules.',
    [
      { id: 'trigger', type: 'manual_trigger', x: 50, y: 150 },
      { id: 'search', type: 'search_workspace', x: 260, y: 150, config: { query: 'for while map query await synchronous readFileSync' }, label: 'Scan Hotpath Symbols' },
      { id: 'agent', type: 'ai_agent', x: 520, y: 150, config: { role: 'backend', taskPrompt: 'Analyze identified code patterns for potential latency and memory bottlenecks.' }, label: 'Performance Advisor' },
      { id: 'output', type: 'output', x: 780, y: 150, label: 'Optimization Suggestions' }
    ],
    [
      { id: 'e1', source: 'trigger', target: 'search', sourceHandle: 'trigger', targetHandle: 'query' },
      { id: 'e2', source: 'search', target: 'agent', sourceHandle: 'formatted', targetHandle: 'context' },
      { id: 'e3', source: 'agent', target: 'output', sourceHandle: 'result', targetHandle: 'value' }
    ]
  )
];
