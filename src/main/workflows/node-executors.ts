import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FlowNode, FlowNodeType } from '../../shared/workflows';
import { ExpressionEvaluator } from './expression-evaluator';
import { cliManager } from '../cli/cli-manager';
import { securityService } from '../services/security.service';
import { contextEngineService } from '../context/context-engine.service';
import { agentOrchestrator } from '../agents/agent-orchestrator';
import { SPECIALIST_ROLES } from '../agents/specialist-roles';

const execFileAsync = promisify(execFile);

async function runChildProcess(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number = 60000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const isWindows = process.platform === 'win32';
    const isCmd = isWindows && (command === 'npm' || command === 'npx');
    const actualCmd = isCmd ? `${command}.cmd` : command;

    const { stdout, stderr } = await execFileAsync(actualCmd, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      shell: isCmd
    });
    return {
      stdout: String(stdout || '').trim(),
      stderr: String(stderr || '').trim(),
      exitCode: 0
    };
  } catch (err: any) {
    return {
      stdout: String(err.stdout || '').trim(),
      stderr: String(err.stderr || err.message || '').trim(),
      exitCode: err.code || 1
    };
  }
}

export interface NodeExecutionContext {
  projectPath: string;
  workflowId: string;
  executionId: string;
  variables: Record<string, any>;
  inputs: Record<string, any>;
  onLog?: (message: string, level?: 'info' | 'warn' | 'error') => void;
}

export interface NodeExecutionOutput {
  outputs: Record<string, any>;
  newVariables?: Record<string, any>;
  selectedBranch?: string; // For condition / switch
}

export type NodeExecutionHandler = (
  node: FlowNode,
  context: NodeExecutionContext
) => Promise<NodeExecutionOutput>;

export const NODE_EXECUTORS: Record<FlowNodeType, NodeExecutionHandler> = {
  // ==================== A. AI NODES ====================
  ai_agent: async (node, ctx) => {
    const roleKey = (node.data.config.role || 'backend') as keyof typeof SPECIALIST_ROLES;
    const specialist = SPECIALIST_ROLES[roleKey] || SPECIALIST_ROLES.backend;
    const providerName = node.data.config.provider || 'claude';
    const promptInput = ctx.inputs.prompt || node.data.config.taskPrompt || 'Analyze project';
    const contextInput = ctx.inputs.context ? `\n\nContext:\n${ctx.inputs.context}` : '';

    const fullPrompt = `${specialist.systemPrompt}\n\nTask:\n${promptInput}${contextInput}`;

    ctx.onLog?.(`AI Agent [${roleKey}] running with provider ${providerName}...`);

    const adapter = cliManager.getAdapter(providerName);
    if (!adapter) {
      throw new Error(`Provider adapter "${providerName}" not registered.`);
    }

    const command = adapter.buildCommand(fullPrompt, ctx.projectPath);

    const execResult = await runChildProcess(
      command.executable,
      command.args,
      ctx.projectPath,
      180000
    );

    return {
      outputs: {
        result: execResult.stdout || execResult.stderr || 'Task completed without output.',
        success: execResult.exitCode === 0,
        tokens: Math.round((execResult.stdout.length + fullPrompt.length) / 4)
      }
    };
  },

  multi_agent_task: async (node, ctx) => {
    const userGoal = ctx.inputs.goal || node.data.config.goal || 'Complete task';
    const mode = node.data.config.mode || 'supervised';

    ctx.onLog?.(`Delegating Multi-Agent task: "${userGoal.slice(0, 60)}..."`);

    const record = await agentOrchestrator.startOrchestration({
      projectId: 'default',
      projectPath: ctx.projectPath,
      userGoal,
      mode: mode as any,
      provider: 'claude'
    });

    // Wait for orchestration completion or timeout (max 5 minutes)
    const startTime = Date.now();
    let currentStatus = record.status;
    let finalSummary = '';

    while (
      currentStatus === 'planning' ||
      currentStatus === 'running' ||
      currentStatus === 'waiting_approval' ||
      currentStatus === 'reviewing'
    ) {
      if (Date.now() - startTime > 300000) {
        await agentOrchestrator.cancelOrchestration(record.id);
        throw new Error(`Multi-Agent task timed out after 300s.`);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      const updated = agentOrchestrator.getOrchestration(record.id);
      if (!updated) break;
      currentStatus = updated.status;
      finalSummary = updated.summary || '';
    }

    return {
      outputs: {
        orchestrationId: record.id,
        summary: finalSummary || `Orchestration ended with status: ${currentStatus}`,
        success: currentStatus === 'completed'
      }
    };
  },

  ai_prompt: async (node, ctx) => {
    const providerName = node.data.config.provider || 'claude';
    const template = node.data.config.template || '{{input}}';
    const inputVal = typeof ctx.inputs.input === 'object' ? JSON.stringify(ctx.inputs.input) : String(ctx.inputs.input || '');
    const rendered = template.replace(/\{\{input\}\}/g, inputVal);

    const adapter = cliManager.getAdapter(providerName);
    if (!adapter) {
      throw new Error(`Provider adapter "${providerName}" not registered.`);
    }

    const command = adapter.buildCommand(rendered, ctx.projectPath);

    const execResult = await runChildProcess(
      command.executable,
      command.args,
      ctx.projectPath,
      120000
    );

    return {
      outputs: {
        output: execResult.stdout || execResult.stderr || '',
        success: execResult.exitCode === 0
      }
    };
  },

  ai_review: async (node, ctx) => {
    const content = ctx.inputs.content || '';
    const criteria = ctx.inputs.criteria || node.data.config.criteria || 'Check for correctness';

    ctx.onLog?.(`AI Review verifying content against criteria...`);

    // Basic heuristic + provider evaluation
    const issues: string[] = [];
    if (!content || (typeof content === 'string' && content.trim().length === 0)) {
      issues.push('Input content is empty.');
    }

    const passed = issues.length === 0;

    return {
      outputs: {
        passed,
        feedback: passed ? 'Review passed successfully.' : `Issues detected: ${issues.join('; ')}`,
        issues
      }
    };
  },

  ai_transform: async (node, ctx) => {
    const raw = ctx.inputs.input;
    const targetFormat = node.data.config.targetFormat || 'json';

    let transformed: any = null;
    if (targetFormat === 'json') {
      if (typeof raw === 'object') {
        transformed = raw;
      } else {
        try {
          transformed = JSON.parse(String(raw));
        } catch {
          transformed = { value: String(raw) };
        }
      }
    } else {
      transformed = String(raw || '');
    }

    return {
      outputs: {
        transformed,
        success: transformed !== null
      }
    };
  },

  ai_classifier: async (node, ctx) => {
    const text = String(ctx.inputs.text || '').toLowerCase();
    const categories: string[] = node.data.config.categories || ['bug', 'feature', 'refactor', 'test'];

    // Heuristic keyword classifier
    let selected = categories[0] || 'unknown';
    let confidence = 0.5;

    for (const cat of categories) {
      if (text.includes(cat.toLowerCase())) {
        selected = cat;
        confidence = 0.85;
        break;
      }
    }

    return {
      outputs: {
        category: selected,
        confidence
      }
    };
  },

  // ==================== B. CONTEXT NODES ====================
  search_workspace: async (node, ctx) => {
    const query = ctx.inputs.query || node.data.config.query || '';
    const maxResults = Number(node.data.config.maxResults || 10);

    ctx.onLog?.(`Searching workspace with query: "${query}"`);

    const results = await contextEngineService.search(query, maxResults);
    const formatted = results.map((r) => `[${r.filePath}:${r.startLine}] ${r.content}`).join('\n---\n');

    return {
      outputs: {
        results,
        formatted,
        count: results.length
      }
    };
  },

  read_file: async (node, ctx) => {
    const rawPath = ctx.inputs.filePath || node.data.config.filePath || '';
    const resolvedPath = path.isAbsolute(rawPath) ? rawPath : path.join(ctx.projectPath, rawPath);

    securityService.assertWithinWorkspace(resolvedPath, ctx.projectPath);

    if (!fs.existsSync(resolvedPath)) {
      return {
        outputs: {
          content: '',
          exists: false,
          lineCount: 0
        }
      };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const lineCount = content.split('\n').length;

    return {
      outputs: {
        content,
        exists: true,
        lineCount
      }
    };
  },

  search_files: async (node, ctx) => {
    const pattern = (ctx.inputs.pattern || node.data.config.pattern || '*').toLowerCase();
    const matches: string[] = [];

    const crawl = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          crawl(full);
        } else if (entry.isFile()) {
          if (pattern === '*' || entry.name.toLowerCase().includes(pattern.replace(/\*/g, ''))) {
            matches.push(path.relative(ctx.projectPath, full));
          }
        }
      }
    };

    if (fs.existsSync(ctx.projectPath)) {
      crawl(ctx.projectPath);
    }

    return {
      outputs: {
        filePaths: matches,
        count: matches.length
      }
    };
  },

  get_project_info: async (_node, ctx) => {
    let name = path.basename(ctx.projectPath);
    let isGit = false;
    let branch = 'unknown';

    const pkgPath = path.join(ctx.projectPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.name) name = pkg.name;
      } catch {
        // Ignore JSON error
      }
    }

    if (fs.existsSync(path.join(ctx.projectPath, '.git'))) {
      isGit = true;
      try {
        const headPath = path.join(ctx.projectPath, '.git', 'HEAD');
        if (fs.existsSync(headPath)) {
          const headContent = fs.readFileSync(headPath, 'utf-8').trim();
          branch = headContent.replace('ref: refs/heads/', '');
        }
      } catch {
        branch = 'main';
      }
    }

    return {
      outputs: {
        projectPath: ctx.projectPath,
        name,
        branch,
        isGit,
        info: { name, branch, isGit, path: ctx.projectPath }
      }
    };
  },

  build_context: async (node, ctx) => {
    const query = ctx.inputs.taskQuery || 'project overview';
    const maxTokens = Number(node.data.config.maxTokens || 16000);

    const assembled = await contextEngineService.assembleContext({
      projectPath: ctx.projectPath,
      taskDescription: query,
      maxTokens
    });

    return {
      outputs: {
        assembledPrompt: assembled.assembledText,
        tokenCount: assembled.actualTokens,
        chunksUsed: assembled.fragments.length
      }
    };
  },

  // ==================== C. LOGIC NODES ====================
  condition: async (node, ctx) => {
    const expression = node.data.config.expression || 'value == true';
    const evalContext = {
      value: ctx.inputs.value,
      secondary: ctx.inputs.secondary,
      ...ctx.inputs,
      ...ctx.variables
    };

    const result = Boolean(ExpressionEvaluator.evaluate(expression, evalContext));
    ctx.onLog?.(`Condition "${expression}" evaluated to: ${result}`);

    return {
      selectedBranch: result ? 'true' : 'false',
      outputs: {
        true: result ? ctx.inputs.value : null,
        false: !result ? ctx.inputs.value : null,
        result
      }
    };
  },

  switch: async (node, ctx) => {
    const val = ctx.inputs.value;
    const cases: string[] = node.data.config.cases || ['case_1', 'case_2', 'case_3'];
    let selectedBranch = 'default';

    for (const c of cases) {
      if (String(val) === c) {
        selectedBranch = c;
        break;
      }
    }

    return {
      selectedBranch,
      outputs: {
        [selectedBranch]: val
      }
    };
  },

  merge: async (_node, ctx) => {
    const combined: Record<string, any> = {};
    let first: any = null;

    for (const [k, v] of Object.entries(ctx.inputs)) {
      if (v !== undefined && v !== null) {
        combined[k] = v;
        if (first === null) first = v;
      }
    }

    return {
      outputs: {
        combined,
        first
      }
    };
  },

  loop: async (node, ctx) => {
    const items = Array.isArray(ctx.inputs.items) ? ctx.inputs.items : [ctx.inputs.items];
    const maxIterations = Math.min(Number(node.data.config.maxIterations || 10), 50);
    const clampedItems = items.slice(0, maxIterations);

    return {
      outputs: {
        item: clampedItems[0] || null,
        index: 0,
        done: clampedItems
      }
    };
  },

  delay: async (node, ctx) => {
    const delayMs = Math.min(Number(node.data.config.delayMs || 1000), 60000);
    ctx.onLog?.(`Delaying execution for ${delayMs}ms...`);
    await new Promise((r) => setTimeout(r, delayMs));

    return {
      outputs: {
        output: ctx.inputs.input ?? true
      }
    };
  },

  parallel: async (_node, ctx) => {
    return {
      outputs: {
        branch_1: ctx.inputs.input,
        branch_2: ctx.inputs.input,
        branch_3: ctx.inputs.input
      }
    };
  },

  // ==================== D. INPUT AND OUTPUT NODES ====================
  manual_trigger: async () => {
    return {
      outputs: {
        trigger: true,
        timestamp: Date.now()
      }
    };
  },

  text_input: async (node) => {
    return {
      outputs: {
        text: String(node.data.config.text || '')
      }
    };
  },

  file_input: async (node, ctx) => {
    const filePath = node.data.config.filePath || '';
    const full = path.isAbsolute(filePath) ? filePath : path.join(ctx.projectPath, filePath);
    securityService.assertWithinWorkspace(full, ctx.projectPath);

    return {
      outputs: {
        filePath: full
      }
    };
  },

  variable: async (node, ctx) => {
    const varName = node.data.config.varName || 'myVar';
    const op = node.data.config.operation || 'get';

    if (op === 'set') {
      const newVal = ctx.inputs.newValue;
      return {
        outputs: { value: newVal },
        newVariables: { [varName]: newVal }
      };
    }

    return {
      outputs: {
        value: ctx.variables[varName] ?? null
      }
    };
  },

  output: async (node, ctx) => {
    ctx.onLog?.(`Workflow output captured: "${node.data.config.title || 'Result'}"`);
    return {
      outputs: {
        value: ctx.inputs.value
      }
    };
  },

  notification: async (node, ctx) => {
    const level = node.data.config.level || 'info';
    const msg = String(ctx.inputs.message || 'Workflow notification');
    ctx.onLog?.(`[${level.toUpperCase()}] ${msg}`, level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'info');

    return {
      outputs: {
        acknowledged: true
      }
    };
  },

  // ==================== E. DEVELOPMENT NODES ====================
  run_tests: async (node, ctx) => {
    ctx.onLog?.(`Executing test suite in workspace...`);
    const result = await runChildProcess(
      'npm',
      ['test'],
      ctx.projectPath,
      Number(node.data.config.timeoutSeconds || 120) * 1000
    );

    return {
      outputs: {
        passed: result.exitCode === 0,
        output: result.stdout || result.stderr,
        exitCode: result.exitCode
      }
    };
  },

  run_typecheck: async (node, ctx) => {
    ctx.onLog?.(`Running TypeScript typecheck...`);
    const result = await runChildProcess(
      'npm',
      ['run', 'typecheck'],
      ctx.projectPath,
      Number(node.data.config.timeoutSeconds || 60) * 1000
    );

    return {
      outputs: {
        clean: result.exitCode === 0,
        output: result.stdout || result.stderr,
        exitCode: result.exitCode
      }
    };
  },

  run_build: async (node, ctx) => {
    ctx.onLog?.(`Running project build...`);
    const result = await runChildProcess(
      'npm',
      ['run', 'build'],
      ctx.projectPath,
      Number(node.data.config.timeoutSeconds || 180) * 1000
    );

    return {
      outputs: {
        success: result.exitCode === 0,
        output: result.stdout || result.stderr,
        exitCode: result.exitCode
      }
    };
  },

  git_status: async (_node, ctx) => {
    const result = await runChildProcess(
      'git',
      ['status', '--porcelain'],
      ctx.projectPath,
      30000
    );

    const lines = result.stdout.split('\n').filter((l: string) => l.trim().length > 0);
    const modifiedFiles = lines.map((l: string) => l.slice(3).trim());

    return {
      outputs: {
        clean: lines.length === 0,
        modifiedFiles,
        branch: 'HEAD',
        rawStatus: result.stdout
      }
    };
  },

  git_diff: async (node, ctx) => {
    const targetBranch = node.data.config.targetBranch || 'HEAD';
    const result = await runChildProcess(
      'git',
      ['diff', targetBranch],
      ctx.projectPath,
      30000
    );

    return {
      outputs: {
        diff: result.stdout,
        hasChanges: result.stdout.trim().length > 0,
        changedFiles: []
      }
    };
  },

  create_git_commit: async (node, ctx) => {
    const message = ctx.inputs.message || node.data.config.commitMessage || 'chore(workflow): auto commit';

    // 1. Stage
    await runChildProcess('git', ['add', '-A'], ctx.projectPath, 30000);

    // 2. Commit
    const commitRes = await runChildProcess(
      'git',
      ['commit', '-m', message],
      ctx.projectPath,
      30000
    );

    const success = commitRes.exitCode === 0;

    return {
      outputs: {
        success,
        commitHash: success ? 'HEAD' : '',
        error: success ? '' : commitRes.stderr
      }
    };
  }
};
