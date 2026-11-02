import type {
  FlowNodeType,
  NodeCategory,
  NodePortSchema,
  FlowNodeData
} from './workflows';
import type { SkillPermissions } from './skills';

export interface NodeDefinition {
  type: FlowNodeType;
  category: NodeCategory;
  name: string;
  description: string;
  defaultConfig: Record<string, any>;
  inputs: NodePortSchema[];
  outputs: NodePortSchema[];
  requiredPermissions: SkillPermissions;
  version: string;
}

export const NODE_REGISTRY: Record<FlowNodeType, NodeDefinition> = {
  // ==================== A. AI NODES ====================
  ai_agent: {
    type: 'ai_agent',
    category: 'ai',
    name: 'AI Agent',
    description: 'Execute an AI agent task with selected role and provider',
    defaultConfig: {
      role: 'backend',
      provider: 'claude',
      model: '',
      taskPrompt: '',
      systemPrompt: ''
    },
    inputs: [
      { id: 'trigger', name: 'Trigger', type: 'any', required: false },
      { id: 'prompt', name: 'Task Prompt', type: 'string', required: true },
      { id: 'context', name: 'Context', type: 'string', required: false }
    ],
    outputs: [
      { id: 'result', name: 'Result', type: 'string' },
      { id: 'success', name: 'Success', type: 'boolean' },
      { id: 'tokens', name: 'Tokens Used', type: 'number' }
    ],
    requiredPermissions: { filesystem: { read: true, write: true }, terminal: { execute: true }, network: { allowed: true } },
    version: '1.0.0'
  },

  multi_agent_task: {
    type: 'multi_agent_task',
    category: 'ai',
    name: 'Multi-Agent Task',
    description: 'Delegate an epic or high-level goal to the Multi-Agent Orchestrator (Phase 5 DAG)',
    defaultConfig: {
      goal: '',
      mode: 'supervised'
    },
    inputs: [
      { id: 'trigger', name: 'Trigger', type: 'any', required: false },
      { id: 'goal', name: 'User Goal', type: 'string', required: true }
    ],
    outputs: [
      { id: 'orchestrationId', name: 'Orchestration ID', type: 'string' },
      { id: 'summary', name: 'Summary', type: 'string' },
      { id: 'success', name: 'Success', type: 'boolean' }
    ],
    requiredPermissions: { filesystem: { read: true, write: true }, terminal: { execute: true }, network: { allowed: true } },
    version: '1.0.0'
  },

  ai_prompt: {
    type: 'ai_prompt',
    category: 'ai',
    name: 'AI Prompt',
    description: 'Execute a single, configurable LLM prompt template via the CLI Engine',
    defaultConfig: {
      provider: 'claude',
      template: 'Please summarize the following: {{input}}'
    },
    inputs: [
      { id: 'input', name: 'Input', type: 'any', required: true },
      { id: 'system', name: 'System Context', type: 'string', required: false }
    ],
    outputs: [
      { id: 'output', name: 'Generated Text', type: 'string' },
      { id: 'success', name: 'Success', type: 'boolean' }
    ],
    requiredPermissions: { filesystem: { read: true, write: false }, terminal: { execute: false }, network: { allowed: true } },
    version: '1.0.0'
  },

  ai_review: {
    type: 'ai_review',
    category: 'ai',
    name: 'AI Review',
    description: 'Independently inspect and review code or generated output against quality criteria',
    defaultConfig: {
      criteria: 'Check for security, correctness, and clean coding standards',
      strictMode: true
    },
    inputs: [
      { id: 'content', name: 'Content / Code', type: 'string', required: true },
      { id: 'criteria', name: 'Review Criteria', type: 'string', required: false }
    ],
    outputs: [
      { id: 'passed', name: 'Passed', type: 'boolean' },
      { id: 'feedback', name: 'Feedback', type: 'string' },
      { id: 'issues', name: 'Issues List', type: 'array' }
    ],
    requiredPermissions: { filesystem: { read: true, write: false }, terminal: { execute: false }, network: { allowed: true } },
    version: '1.0.0'
  },

  ai_transform: {
    type: 'ai_transform',
    category: 'ai',
    name: 'AI Transform',
    description: 'Transform structured or unstructured text data into JSON, Markdown, or tables',
    defaultConfig: {
      targetFormat: 'json',
      schemaDescription: 'JSON object with key properties'
    },
    inputs: [
      { id: 'input', name: 'Raw Input', type: 'any', required: true }
    ],
    outputs: [
      { id: 'transformed', name: 'Transformed Data', type: 'json' },
      { id: 'success', name: 'Success', type: 'boolean' }
    ],
    requiredPermissions: { filesystem: { read: false, write: false }, terminal: { execute: false }, network: { allowed: true } },
    version: '1.0.0'
  },

  ai_classifier: {
    type: 'ai_classifier',
    category: 'ai',
    name: 'AI Classifier',
    description: 'Classify text or intent into one of a discrete set of predefined categories',
    defaultConfig: {
      categories: ['bug', 'feature', 'refactor', 'documentation', 'test']
    },
    inputs: [
      { id: 'text', name: 'Input Text', type: 'string', required: true }
    ],
    outputs: [
      { id: 'category', name: 'Selected Category', type: 'string' },
      { id: 'confidence', name: 'Confidence Score', type: 'number' }
    ],
    requiredPermissions: { filesystem: { read: false, write: false }, terminal: { execute: false }, network: { allowed: true } },
    version: '1.0.0'
  },

  // ==================== B. CONTEXT NODES ====================
  search_workspace: {
    type: 'search_workspace',
    category: 'context',
    name: 'Search Workspace',
    description: 'Lexical full-text search across the workspace using SQLite FTS5 BM25',
    defaultConfig: {
      query: '',
      maxResults: 10
    },
    inputs: [
      { id: 'query', name: 'Query String', type: 'string', required: false }
    ],
    outputs: [
      { id: 'results', name: 'Search Results', type: 'array' },
      { id: 'formatted', name: 'Formatted Snippets', type: 'string' },
      { id: 'count', name: 'Result Count', type: 'number' }
    ],
    requiredPermissions: { filesystem: { read: true, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  read_file: {
    type: 'read_file',
    category: 'context',
    name: 'Read File',
    description: 'Read the contents of a selected file safely within the workspace sandbox',
    defaultConfig: {
      filePath: ''
    },
    inputs: [
      { id: 'filePath', name: 'File Path', type: 'string', required: false }
    ],
    outputs: [
      { id: 'content', name: 'File Content', type: 'string' },
      { id: 'exists', name: 'Exists', type: 'boolean' },
      { id: 'lineCount', name: 'Line Count', type: 'number' }
    ],
    requiredPermissions: { filesystem: { read: true, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  search_files: {
    type: 'search_files',
    category: 'context',
    name: 'Search Files',
    description: 'Locate files in the project workspace by filename pattern or extension',
    defaultConfig: {
      pattern: '*.ts'
    },
    inputs: [
      { id: 'pattern', name: 'Glob Pattern', type: 'string', required: false }
    ],
    outputs: [
      { id: 'filePaths', name: 'Matching File Paths', type: 'array' },
      { id: 'count', name: 'Match Count', type: 'number' }
    ],
    requiredPermissions: { filesystem: { read: true, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  get_project_info: {
    type: 'get_project_info',
    category: 'context',
    name: 'Get Project Information',
    description: 'Retrieve metadata about the active workspace (package.json, git branch, stats)',
    defaultConfig: {},
    inputs: [
      { id: 'trigger', name: 'Trigger', type: 'any', required: false }
    ],
    outputs: [
      { id: 'projectPath', name: 'Project Path', type: 'string' },
      { id: 'name', name: 'Project Name', type: 'string' },
      { id: 'branch', name: 'Git Branch', type: 'string' },
      { id: 'isGit', name: 'Is Git Repo', type: 'boolean' },
      { id: 'info', name: 'Summary Object', type: 'object' }
    ],
    requiredPermissions: { filesystem: { read: true, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  build_context: {
    type: 'build_context',
    category: 'context',
    name: 'Build Context',
    description: 'Assemble optimized multi-tier context with token budgeting for a given task',
    defaultConfig: {
      maxTokens: 16000,
      includeSymbols: true
    },
    inputs: [
      { id: 'taskQuery', name: 'Task Query', type: 'string', required: true },
      { id: 'targetFiles', name: 'Target Files', type: 'array', required: false }
    ],
    outputs: [
      { id: 'assembledPrompt', name: 'Assembled Context', type: 'string' },
      { id: 'tokenCount', name: 'Estimated Tokens', type: 'number' },
      { id: 'chunksUsed', name: 'Chunks Used', type: 'number' }
    ],
    requiredPermissions: { filesystem: { read: true, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  // ==================== C. LOGIC NODES ====================
  condition: {
    type: 'condition',
    category: 'logic',
    name: 'Condition',
    description: 'Evaluate a safe boolean expression and route to the True or False branch',
    defaultConfig: {
      expression: 'value == true'
    },
    inputs: [
      { id: 'value', name: 'Input Value', type: 'any', required: false },
      { id: 'secondary', name: 'Secondary Value', type: 'any', required: false }
    ],
    outputs: [
      { id: 'true', name: 'True Branch', type: 'any' },
      { id: 'false', name: 'False Branch', type: 'any' },
      { id: 'result', name: 'Evaluation Result', type: 'boolean' }
    ],
    requiredPermissions: { filesystem: { read: false, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  switch: {
    type: 'switch',
    category: 'logic',
    name: 'Switch',
    description: 'Route execution to different branches based on matching values or cases',
    defaultConfig: {
      cases: ['case_1', 'case_2', 'case_3']
    },
    inputs: [
      { id: 'value', name: 'Switch Value', type: 'any', required: true }
    ],
    outputs: [
      { id: 'case_1', name: 'Case 1', type: 'any' },
      { id: 'case_2', name: 'Case 2', type: 'any' },
      { id: 'case_3', name: 'Case 3', type: 'any' },
      { id: 'default', name: 'Default', type: 'any' }
    ],
    requiredPermissions: { filesystem: { read: false, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  merge: {
    type: 'merge',
    category: 'logic',
    name: 'Merge',
    description: 'Wait for and combine outputs from multiple incoming parallel branches',
    defaultConfig: {
      mode: 'all'
    },
    inputs: [
      { id: 'in_1', name: 'Input 1', type: 'any', required: false },
      { id: 'in_2', name: 'Input 2', type: 'any', required: false },
      { id: 'in_3', name: 'Input 3', type: 'any', required: false }
    ],
    outputs: [
      { id: 'combined', name: 'Combined Output', type: 'object' },
      { id: 'first', name: 'First Completed', type: 'any' }
    ],
    requiredPermissions: { filesystem: { read: false, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  loop: {
    type: 'loop',
    category: 'logic',
    name: 'Loop',
    description: 'Iterate over an array or repeat execution with strict iteration bounds (max 50)',
    defaultConfig: {
      maxIterations: 10
    },
    inputs: [
      { id: 'items', name: 'Array of Items', type: 'array', required: true }
    ],
    outputs: [
      { id: 'item', name: 'Current Item', type: 'any' },
      { id: 'index', name: 'Current Index', type: 'number' },
      { id: 'done', name: 'Done (All Processed)', type: 'array' }
    ],
    requiredPermissions: { filesystem: { read: false, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  delay: {
    type: 'delay',
    category: 'logic',
    name: 'Delay',
    description: 'Pause execution for a configured duration (in milliseconds, max 60000)',
    defaultConfig: {
      delayMs: 1000
    },
    inputs: [
      { id: 'input', name: 'Input Value', type: 'any', required: false }
    ],
    outputs: [
      { id: 'output', name: 'Passed Value', type: 'any' }
    ],
    requiredPermissions: { filesystem: { read: false, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  parallel: {
    type: 'parallel',
    category: 'logic',
    name: 'Parallel Fork',
    description: 'Fork execution to run multiple independent branches concurrently',
    defaultConfig: {},
    inputs: [
      { id: 'input', name: 'Input Value', type: 'any', required: false }
    ],
    outputs: [
      { id: 'branch_1', name: 'Branch 1', type: 'any' },
      { id: 'branch_2', name: 'Branch 2', type: 'any' },
      { id: 'branch_3', name: 'Branch 3', type: 'any' }
    ],
    requiredPermissions: { filesystem: { read: false, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  // ==================== D. INPUT AND OUTPUT NODES ====================
  manual_trigger: {
    type: 'manual_trigger',
    category: 'io',
    name: 'Manual Trigger',
    description: 'Start the workflow on demand with optional manual launch parameters',
    defaultConfig: {
      notes: 'Click Run to trigger workflow'
    },
    inputs: [],
    outputs: [
      { id: 'trigger', name: 'Trigger Out', type: 'any' },
      { id: 'timestamp', name: 'Trigger Timestamp', type: 'number' }
    ],
    requiredPermissions: { filesystem: { read: false, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  text_input: {
    type: 'text_input',
    category: 'io',
    name: 'Text Input',
    description: 'Supply static or user-configurable text value into the workflow',
    defaultConfig: {
      text: ''
    },
    inputs: [],
    outputs: [
      { id: 'text', name: 'Text Value', type: 'string' }
    ],
    requiredPermissions: { filesystem: { read: false, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  file_input: {
    type: 'file_input',
    category: 'io',
    name: 'File Input',
    description: 'Select a project file or path to supply as an input parameter',
    defaultConfig: {
      filePath: ''
    },
    inputs: [],
    outputs: [
      { id: 'filePath', name: 'File Path', type: 'file_ref' }
    ],
    requiredPermissions: { filesystem: { read: true, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  variable: {
    type: 'variable',
    category: 'io',
    name: 'Variable',
    description: 'Read or update a global workflow variable',
    defaultConfig: {
      varName: 'myVar',
      operation: 'get'
    },
    inputs: [
      { id: 'newValue', name: 'New Value (if set)', type: 'any', required: false }
    ],
    outputs: [
      { id: 'value', name: 'Variable Value', type: 'any' }
    ],
    requiredPermissions: { filesystem: { read: false, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  output: {
    type: 'output',
    category: 'io',
    name: 'Workflow Output',
    description: 'Capture the final result, report, or artifact of the workflow',
    defaultConfig: {
      title: 'Final Workflow Output'
    },
    inputs: [
      { id: 'value', name: 'Result Value', type: 'any', required: true }
    ],
    outputs: [
      { id: 'value', name: 'Captured Value', type: 'any' }
    ],
    requiredPermissions: { filesystem: { read: false, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  notification: {
    type: 'notification',
    category: 'io',
    name: 'Notification',
    description: 'Log an informational message or prompt in the application activity stream',
    defaultConfig: {
      level: 'info',
      messageTemplate: 'Notification: {{message}}'
    },
    inputs: [
      { id: 'message', name: 'Message', type: 'any', required: true }
    ],
    outputs: [
      { id: 'acknowledged', name: 'Logged', type: 'boolean' }
    ],
    requiredPermissions: { filesystem: { read: false, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  // ==================== E. DEVELOPMENT NODES ====================
  run_tests: {
    type: 'run_tests',
    category: 'dev',
    name: 'Run Tests',
    description: 'Execute the project test suite safely using existing ExecutionEngine',
    defaultConfig: {
      testCommand: 'npm test',
      timeoutSeconds: 120
    },
    inputs: [
      { id: 'trigger', name: 'Trigger', type: 'any', required: false }
    ],
    outputs: [
      { id: 'passed', name: 'All Tests Passed', type: 'boolean' },
      { id: 'output', name: 'Test Output', type: 'string' },
      { id: 'exitCode', name: 'Exit Code', type: 'number' }
    ],
    requiredPermissions: { filesystem: { read: true, write: false }, terminal: { execute: true }, network: { allowed: false } },
    version: '1.0.0'
  },

  run_typecheck: {
    type: 'run_typecheck',
    category: 'dev',
    name: 'Run Typecheck',
    description: 'Run TypeScript compiler in typecheck mode (tsc --noEmit)',
    defaultConfig: {
      command: 'npm run typecheck',
      timeoutSeconds: 60
    },
    inputs: [
      { id: 'trigger', name: 'Trigger', type: 'any', required: false }
    ],
    outputs: [
      { id: 'clean', name: 'Zero Type Errors', type: 'boolean' },
      { id: 'output', name: 'Compiler Output', type: 'string' },
      { id: 'exitCode', name: 'Exit Code', type: 'number' }
    ],
    requiredPermissions: { filesystem: { read: true, write: false }, terminal: { execute: true }, network: { allowed: false } },
    version: '1.0.0'
  },

  run_build: {
    type: 'run_build',
    category: 'dev',
    name: 'Run Build',
    description: 'Execute project build step to verify clean packaging',
    defaultConfig: {
      command: 'npm run build',
      timeoutSeconds: 180
    },
    inputs: [
      { id: 'trigger', name: 'Trigger', type: 'any', required: false }
    ],
    outputs: [
      { id: 'success', name: 'Build Success', type: 'boolean' },
      { id: 'output', name: 'Build Output', type: 'string' },
      { id: 'exitCode', name: 'Exit Code', type: 'number' }
    ],
    requiredPermissions: { filesystem: { read: true, write: true }, terminal: { execute: true }, network: { allowed: false } },
    version: '1.0.0'
  },

  git_status: {
    type: 'git_status',
    category: 'dev',
    name: 'Git Status',
    description: 'Inspect modified, untracked, and staged files in the local Git repository',
    defaultConfig: {},
    inputs: [
      { id: 'trigger', name: 'Trigger', type: 'any', required: false }
    ],
    outputs: [
      { id: 'clean', name: 'Is Working Tree Clean', type: 'boolean' },
      { id: 'modifiedFiles', name: 'Modified Files List', type: 'array' },
      { id: 'branch', name: 'Current Branch', type: 'string' },
      { id: 'rawStatus', name: 'Raw Status Output', type: 'string' }
    ],
    requiredPermissions: { filesystem: { read: true, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  git_diff: {
    type: 'git_diff',
    category: 'dev',
    name: 'Git Diff',
    description: 'Retrieve the working tree diff or branch comparison',
    defaultConfig: {
      targetBranch: 'HEAD'
    },
    inputs: [
      { id: 'trigger', name: 'Trigger', type: 'any', required: false }
    ],
    outputs: [
      { id: 'diff', name: 'Diff Content', type: 'string' },
      { id: 'hasChanges', name: 'Has Changes', type: 'boolean' },
      { id: 'changedFiles', name: 'Changed Files List', type: 'array' }
    ],
    requiredPermissions: { filesystem: { read: true, write: false }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  },

  create_git_commit: {
    type: 'create_git_commit',
    category: 'dev',
    name: 'Create Git Commit',
    description: 'Stage changes and create a local Git commit with a descriptive message',
    defaultConfig: {
      commitMessage: 'chore(workflow): automated workflow commit',
      stageAll: true
    },
    inputs: [
      { id: 'message', name: 'Commit Message', type: 'string', required: false },
      { id: 'trigger', name: 'Trigger', type: 'any', required: false }
    ],
    outputs: [
      { id: 'success', name: 'Success', type: 'boolean' },
      { id: 'commitHash', name: 'Commit Hash', type: 'string' },
      { id: 'error', name: 'Error Message', type: 'string' }
    ],
    requiredPermissions: { filesystem: { read: true, write: true }, terminal: { execute: false }, network: { allowed: false } },
    version: '1.0.0'
  }
};

export function createNodeData(
  type: FlowNodeType,
  overrides?: Partial<FlowNodeData>
): FlowNodeData {
  const def = NODE_REGISTRY[type];
  if (!def) {
    throw new Error(`Unknown node type: ${type}`);
  }

  return {
    nodeType: def.type,
    category: def.category,
    label: def.name,
    description: def.description,
    config: { ...def.defaultConfig, ...(overrides?.config || {}) },
    inputs: [...def.inputs],
    outputs: [...def.outputs],
    requiredPermissions: { ...def.requiredPermissions, ...(overrides?.requiredPermissions || {}) },
    status: 'pending',
    version: def.version,
    ...overrides
  };
}

export function registerCustomNode(node: NodeDefinition): void {
  NODE_REGISTRY[node.type] = node;
}

export function unregisterCustomNode(type: FlowNodeType): boolean {
  if (NODE_REGISTRY[type]) {
    delete NODE_REGISTRY[type];
    return true;
  }
  return false;
}
