import { spawn, type ChildProcess, exec } from 'node:child_process';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type {
  CLIProvider,
  CLISessionRecord,
  CLISessionStatus,
  CLIStreamEvent
} from '../../shared/cli';
import type { PermissionLevel } from '../../shared/types';
import { cliManager } from './cli-manager';
import { ollamaAdapter } from './adapters/ollama.adapter';
import { databaseService } from '../db/database.service';
import { securityService } from '../services/security.service';
import { airGapManager } from '../services/air-gap.manager';
import { auditService } from '../services/audit.service';
import { analyticsService } from '../services/analytics.service';
import { contextRetrievalService } from '../context/retrieval/context-retrieval.service';
import { contextAssemblyService } from '../context/assembly/context-assembly.service';
import { skillRegistry } from '../skills/skill-registry';
import { SkillResolver } from '../skills/skill-resolver';
import { SkillLoader } from '../skills/skill-loader';
import { createStreamParser } from './parsers';
import { projectExecutionService } from '../services/project-execution.service';

interface ActiveSession {
  id: string;
  provider: CLIProvider;
  process?: ChildProcess;
  httpAbort?: () => void;
  timeoutTimer?: NodeJS.Timeout;
  startTime: number;
  prompt: string;
  outputLength: number;
}

/**
 * Builds an isolated, sanitized process environment allowlisting essential system
 * and provider variables while stripping host credentials and Electron internal flags.
 */
export function buildSanitizedCLIEnv(
  provider: CLIProvider,
  workingDirectory: string,
  projectId?: string
): NodeJS.ProcessEnv {
  const allowedSystemVars = [
    'PATH',
    'PATHEXT',
    'SYSTEMROOT',
    'COMSPEC',
    'TEMP',
    'TMP',
    'USERPROFILE',
    'HOME',
    'APPDATA',
    'LOCALAPPDATA',
    'LANG',
    'LC_ALL',
    'TERM',
    'SHELL',
    'HOMEDRIVE',
    'HOMEPATH',
    'WINDIR',
    'PROCESSOR_ARCHITECTURE',
    'NUMBER_OF_PROCESSORS',
    'OS'
  ];

  const allowedAuthVars = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'GEMINI_API_KEY',
    'OLLAMA_HOST',
    'OPENROUTER_API_KEY',
    'DEEPSEEK_API_KEY',
    'MISTRAL_API_KEY',
    'CODESTRAL_API_KEY',
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'COPILOT_API_KEY',
    'DASHSCOPE_API_KEY',
    'QWEN_API_KEY',
    'MOONSHOT_API_KEY',
    'KIMI_API_KEY',
    'DEVIN_API_KEY',
    'COGNITION_API_KEY',
    'FACTORY_API_KEY',
    'DROID_TOKEN',
    'AUGMENT_API_KEY',
    'AUGGIE_TOKEN',
    'AMP_API_KEY',
    'AMP_TOKEN',
    'ANTE_API_KEY',
    'ALL_HANDS_API_KEY',
    'PI_API_KEY',
    'INFLECTION_API_KEY',
    'HERMES_API_KEY',
    'KILO_API_KEY',
    'KIRO_API_KEY',
    'KIRO_TOKEN',
    'ATLASSIAN_API_TOKEN',
    'ROVO_API_KEY',
    'TRAE_API_KEY',
    'TRAE_TOKEN',
    'ZED_TOKEN',
    'CODEBUFF_API_KEY',
    'CODEBUDDY_API_KEY',
    'CONTINUE_API_KEY',
    'CRUSH_API_KEY',
    'CURSOR_API_KEY',
    'CURSOR_TOKEN'
  ];

  const sanitized: NodeJS.ProcessEnv = {};

  for (const key of allowedSystemVars) {
    if (process.env[key] !== undefined) {
      sanitized[key] = process.env[key];
    }
  }

  for (const key of allowedAuthVars) {
    if (process.env[key] !== undefined) {
      sanitized[key] = process.env[key];
    }
  }

  // Load project-specific environment variables if configured
  try {
    const project = projectId
      ? databaseService.getProject(projectId)
      : databaseService.getProjectByPath(workingDirectory);
    if (project?.settings?.envVars) {
      for (const [k, v] of Object.entries(project.settings.envVars)) {
        if (!k.startsWith('ELECTRON_') && !k.startsWith('NODE_OPTIONS')) {
          sanitized[k] = v;
        }
      }
    }
  } catch {
    // Non-fatal if project resolution fails
  }

  // Explicitly strip internal Electron execution overrides
  delete sanitized['ELECTRON_RUN_AS_NODE'];
  delete sanitized['ELECTRON_NO_ASAR'];
  delete sanitized['NODE_OPTIONS'];

  return sanitized;
}

export class ExecutionEngine extends EventEmitter {
  private activeSessions: Map<string, ActiveSession> = new Map();

  /**
   * Spawns a CLI process or starts an HTTP stream with isolated environment,
   * timeout guard, permission enforcement, context enrichment, and stream listeners.
   */
  public async execute(params: {
    sessionId: string;
    provider: CLIProvider;
    prompt: string;
    workingDirectory: string;
    projectId?: string;
    customPath?: string;
    timeoutSeconds?: number;
    resumeSessionId?: string;
    enableContext?: boolean;
    enableSkills?: boolean;
    maxContextTokens?: number;
  }): Promise<{ sessionId: string }> {
    const {
      sessionId,
      provider,
      prompt,
      workingDirectory,
      projectId,
      customPath,
      timeoutSeconds = 120,
      resumeSessionId,
      enableContext = true,
      enableSkills = true,
      maxContextTokens = 4000
    } = params;

    // 0. Air-gap provider routing
    const effectiveProvider = airGapManager.resolveProvider(provider);

    // 1. Security path validation
    const canonicalWorkDir = securityService.assertWithinWorkspace(workingDirectory, workingDirectory);

    // Resolve effective project permission tier
    let effectivePermission: PermissionLevel = 'standard';
    try {
      const project = projectId
        ? databaseService.getProject(projectId)
        : databaseService.getProjectByPath(canonicalWorkDir);
      if (project?.permissionLevel) {
        effectivePermission = project.permissionLevel;
      }
    } catch {
      // Default to standard
    }

    const isShell = ['powershell', 'cmd', 'bash'].includes(effectiveProvider);

    if (isShell) {
      // SEC-01: Enforce project permission tiers on shell execution in main process
      securityService.validateCommandSafety(prompt, effectivePermission, { allowReadOnly: true });
    }

    // 2. Interactive AI Context & Skills Enrichment (CRIT-03)
    let finalPrompt = prompt;
    let contextNotice: string | null = null;

    if (!isShell && (enableContext || enableSkills)) {
      try {
        let assembledText = '';
        let fileCount = 0;
        let tokenEstimate = 0;

        // Context Retrieval
        if (enableContext) {
          const fragments = await contextRetrievalService.retrieve({
            taskDescription: prompt,
            maxCandidates: 10
          });

          if (fragments.length > 0) {
            const assembly = await contextAssemblyService.assemble({
              projectPath: canonicalWorkDir,
              fragments,
              maxTokens: maxContextTokens,
              modelTarget: effectiveProvider
            });
            assembledText = assembly.assembledText;
            fileCount = new Set(assembly.fragments.map((f) => f.filePath)).size;
            tokenEstimate = assembly.actualTokens || assembly.estimatedTokens;
          }
        }

        // Skills Resolution
        const skillInstructions: string[] = [];
        const skillNames: string[] = [];

        if (enableSkills) {
          const skillCandidates = SkillResolver.resolve(prompt, effectiveProvider);
          const matchedSkills = skillCandidates.filter((s) => s.confidence >= 0.5);

          for (const match of matchedSkills) {
            const skillMeta = match.skill;
            if (skillMeta && skillMeta.enabled) {
              const details = SkillLoader.loadDetails(skillMeta);
              if (details.instructions) {
                skillInstructions.push(`### Skill: ${details.name}\n${details.instructions}`);
                skillNames.push(details.name);
              }
            }
          }
        }

        if (assembledText || skillInstructions.length > 0) {
          const sections: string[] = [];
          if (skillInstructions.length > 0) {
            sections.push(`--- SKILL INSTRUCTIONS ---\n${skillInstructions.join('\n\n')}`);
          }
          if (assembledText) {
            sections.push(`--- PROJECT CONTEXT ---\n${assembledText}`);
          }
          sections.push(`--- USER PROMPT ---\n${prompt}`);
          finalPrompt = sections.join('\n\n');

          const contextPart = fileCount > 0 ? `${fileCount} files, ~${tokenEstimate} tokens` : 'none';
          const skillPart = skillNames.length > 0 ? skillNames.join(', ') : 'none';
          contextNotice = `[Context & Skills] Context: ${contextPart} | Skills: ${skillPart}`;
        }
      } catch (err) {
        console.warn('[ExecutionEngine] Context & Skills enrichment failed, proceeding with raw prompt:', err);
      }
    }

    // 3. Record session in SQLite
    const now = Date.now();
    const sessionRecord: CLISessionRecord = {
      id: sessionId,
      provider: effectiveProvider,
      projectId,
      status: 'running',
      prompt,
      createdAt: now,
      updatedAt: now
    };
    databaseService.createCLISession(sessionRecord);
    databaseService.addCLISessionMessage({
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-user`,
      sessionId,
      role: 'user',
      content: prompt,
      timestamp: now
    });

    if (contextNotice) {
      databaseService.addCLISessionMessage({
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-sys`,
        sessionId,
        role: 'system',
        content: contextNotice,
        timestamp: now
      });
      this.emitEvent({
        sessionId,
        type: 'status',
        content: contextNotice,
        timestamp: Date.now()
      });
    }

    auditService.logAccess('execution_engine', 'cli_execute_start', workingDirectory, projectId, 'info', {
      sessionId,
      provider: effectiveProvider,
      promptLength: prompt.length
    });

    // Capture pre-execution workspace state snapshot for prompt-based change attribution
    projectExecutionService.beforeExecution({
      sessionId,
      projectId,
      projectPath: canonicalWorkDir,
      prompt,
      provider: effectiveProvider
    }).catch((err) => console.warn('[ExecutionEngine] Snapshot before execution warning:', err));

    // 4. Ollama HTTP Daemon vs CLI Execution (CRIT-01)
    if (effectiveProvider === 'ollama') {
      const canExec = await ollamaAdapter.canExecute(customPath);
      if (!canExec.canExecute) {
        const errorMsg = canExec.error || 'Neither Ollama CLI binary nor HTTP daemon (http://127.0.0.1:11434) is available.';
        databaseService.updateCLISession(sessionId, 'failed', 1, 0);
        this.emitEvent({
          sessionId,
          type: 'stderr',
          content: errorMsg,
          timestamp: Date.now(),
          exitCode: 1
        });
        throw new Error(`Cannot execute Ollama: ${errorMsg}`);
      }

      if (canExec.mode === 'http') {
        return this.executeOllamaHttp({
          sessionId,
          prompt: finalPrompt,
          canonicalWorkDir,
          projectId,
          timeoutSeconds,
          effectiveProvider,
          now
        });
      }
    }

    // 5. Standard Spawn Execution Path
    let executable: string;
    let args: string[];
    const env = buildSanitizedCLIEnv(effectiveProvider, canonicalWorkDir, projectId);

    if (isShell) {
      if (effectiveProvider === 'powershell') {
        executable = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
        args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', prompt];
      } else if (effectiveProvider === 'cmd') {
        executable = process.env.COMSPEC || 'cmd.exe';
        args = ['/D', '/Q', '/C', prompt];
      } else {
        executable = process.platform === 'win32' ? 'bash.exe' : '/bin/bash';
        args = ['-c', prompt];
      }
    } else {
      const adapter = cliManager.getAdapter(effectiveProvider);
      const detection = await adapter.detect(customPath);

      if (!detection.isInstalled || !detection.resolvedPath) {
        throw new Error(`Cannot execute: ${effectiveProvider} CLI is not installed on this system.`);
      }

      const cmdSpec = adapter.buildCommand(finalPrompt, canonicalWorkDir, resumeSessionId);
      executable = detection.resolvedPath || cmdSpec.executable;
      args = cmdSpec.args;
      if (cmdSpec.env) {
        Object.assign(env, cmdSpec.env);
      }
    }

    // If the target executable is Electron (e.g. test harness using process.execPath),
    // preserve ELECTRON_RUN_AS_NODE so Electron runs as a node CLI rather than opening a GUI window
    if (path.basename(executable).toLowerCase().includes('electron') && process.env.ELECTRON_RUN_AS_NODE) {
      env['ELECTRON_RUN_AS_NODE'] = '1';
    }

    // Spawn child process with isolated environment
    const child = spawn(executable, args, {
      cwd: canonicalWorkDir,
      env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timeoutTimer = setTimeout(() => {
      this.handleTimeout(sessionId);
    }, timeoutSeconds * 1000);

    const activeSession: ActiveSession = {
      id: sessionId,
      provider: effectiveProvider,
      process: child,
      timeoutTimer,
      startTime: now,
      prompt,
      outputLength: 0
    };
    this.activeSessions.set(sessionId, activeSession);

    this.emitEvent({
      sessionId,
      type: 'status',
      content: 'running',
      timestamp: Date.now()
    });

    if (isShell) {
      child.stdout?.on('data', (chunk: Buffer) => {
        const rawText = chunk.toString('utf8');
        activeSession.outputLength += rawText.length;
        databaseService.addCLISessionMessage({
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-ast`,
          sessionId,
          role: 'assistant',
          content: rawText,
          timestamp: Date.now()
        });

        this.emitEvent({
          sessionId,
          type: 'stdout',
          content: rawText,
          timestamp: Date.now()
        });
      });
    } else {
      const parser = createStreamParser(effectiveProvider);

      child.stdout?.on('data', (chunk: Buffer) => {
        const rawText = chunk.toString('utf8');
        activeSession.outputLength += rawText.length;
        const lines = rawText.split(/\r?\n/);
        let textToEmit = '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = parser.parseLine(line);
          if (!parsed) continue;

          if (parsed.sessionId) {
            databaseService.updateCLISession(sessionId, 'running', undefined, undefined, parsed.sessionId);
          }

          if (parsed.isError) {
            const errText = parsed.errorMessage || 'CLI Stream Error';
            databaseService.addCLISessionMessage({
              id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-err`,
              sessionId,
              role: 'error',
              content: errText,
              timestamp: Date.now()
            });
            this.emitEvent({
              sessionId,
              type: 'stderr',
              content: errText,
              timestamp: Date.now()
            });
          }

          if (parsed.textDelta) {
            textToEmit += parsed.textDelta;
          }
        }

        if (textToEmit) {
          databaseService.addCLISessionMessage({
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-ast`,
            sessionId,
            role: 'assistant',
            content: textToEmit,
            timestamp: Date.now()
          });

          this.emitEvent({
            sessionId,
            type: 'stdout',
            content: textToEmit,
            timestamp: Date.now()
          });
        }
      });
    }

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      databaseService.addCLISessionMessage({
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-err`,
        sessionId,
        role: 'error',
        content: text,
        timestamp: Date.now()
      });

      this.emitEvent({
        sessionId,
        type: 'stderr',
        content: text,
        timestamp: Date.now()
      });
    });

    child.on('close', (exitCode) => {
      this.handleProcessExit(sessionId, exitCode !== null ? exitCode : 0);
    });

    child.on('error', (err) => {
      this.handleProcessError(sessionId, err);
    });

    return { sessionId };
  }

  /**
   * Dedicated execution path for Ollama using its local HTTP streaming API.
   * Eliminates child process spawn when the CLI binary is absent.
   */
  private async executeOllamaHttp(params: {
    sessionId: string;
    prompt: string;
    canonicalWorkDir: string;
    projectId?: string;
    timeoutSeconds: number;
    effectiveProvider: CLIProvider;
    now: number;
  }): Promise<{ sessionId: string }> {
    const { sessionId, prompt, timeoutSeconds, effectiveProvider, now } = params;

    const activeSession: ActiveSession = {
      id: sessionId,
      provider: effectiveProvider,
      startTime: now,
      prompt,
      outputLength: 0
    };
    this.activeSessions.set(sessionId, activeSession);

    this.emitEvent({
      sessionId,
      type: 'status',
      content: 'running',
      timestamp: Date.now()
    });

    const httpHandle = ollamaAdapter.executeHttpStream({
      prompt,
      model: ollamaAdapter.getModel(),
      timeoutSeconds,
      onChunk: (chunk: string) => {
        activeSession.outputLength += chunk.length;
        databaseService.addCLISessionMessage({
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-ast`,
          sessionId,
          role: 'assistant',
          content: chunk,
          timestamp: Date.now()
        });
        this.emitEvent({
          sessionId,
          type: 'stdout',
          content: chunk,
          timestamp: Date.now()
        });
      },
      onError: (errMsg: string) => {
        databaseService.addCLISessionMessage({
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-err`,
          sessionId,
          role: 'error',
          content: errMsg,
          timestamp: Date.now()
        });
        this.emitEvent({
          sessionId,
          type: 'stderr',
          content: errMsg,
          timestamp: Date.now()
        });
      },
      onDone: (exitCode: number) => {
        this.handleProcessExit(sessionId, exitCode);
      }
    });

    activeSession.httpAbort = () => httpHandle.abort();
    return { sessionId };
  }

  private emitEvent(event: CLIStreamEvent): void {
    this.emit('stream', event);
  }

  /**
   * Terminates the session, aborting HTTP streams or recursively killing process trees.
   */
  public async cancel(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    if (session.timeoutTimer) {
      clearTimeout(session.timeoutTimer);
    }

    if (session.httpAbort) {
      session.httpAbort();
    }

    const pid = session.process?.pid;
    if (pid) {
      await this.killProcessTree(pid);
    }

    const duration = Date.now() - session.startTime;
    databaseService.updateCLISession(sessionId, 'cancelled', 130, duration);
    projectExecutionService.afterExecution({ sessionId, status: 'cancelled' }).catch(() => {});
    this.activeSessions.delete(sessionId);

    this.emitEvent({
      sessionId,
      type: 'status',
      content: 'cancelled',
      timestamp: Date.now(),
      exitCode: 130
    });

    return true;
  }

  private async killProcessTree(pid: number): Promise<void> {
    return new Promise((resolve) => {
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${pid} /T /F`, () => {
          resolve();
        });
      } else {
        try {
          process.kill(-pid, 'SIGTERM');
          setTimeout(() => {
            try {
              process.kill(-pid, 'SIGKILL');
            } catch {}
            resolve();
          }, 1500);
        } catch {
          resolve();
        }
      }
    });
  }

  private handleTimeout(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    this.emitEvent({
      sessionId,
      type: 'stderr',
      content: `[ExecutionEngine] Execution timed out. Terminating process.`,
      timestamp: Date.now()
    });

    this.cancel(sessionId);
    databaseService.updateCLISession(sessionId, 'failed', 124, Date.now() - session.startTime);
  }

  private handleProcessExit(sessionId: string, exitCode: number): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    if (session.timeoutTimer) {
      clearTimeout(session.timeoutTimer);
    }
    const duration = Date.now() - session.startTime;
    const finalStatus: CLISessionStatus = exitCode === 0 ? 'completed' : 'failed';

    databaseService.updateCLISession(sessionId, finalStatus, exitCode, duration);
    projectExecutionService.afterExecution({ sessionId, status: finalStatus }).catch(() => {});
    this.activeSessions.delete(sessionId);

    analyticsService.recordEvent({
      provider: session.provider,
      model: session.provider === 'ollama' ? ollamaAdapter.getModel() : `${session.provider}-cli`,
      tokensIn: Math.ceil(session.prompt.length / 4),
      tokensOut: Math.max(1, Math.ceil(session.outputLength / 4)),
      durationMs: duration,
      status: finalStatus === 'completed' ? 'success' : 'failure',
      feature: 'cli',
      details: { sessionId, exitCode }
    });

    auditService.logAccess(
      'execution_engine',
      'cli_execute_exit',
      sessionId,
      undefined,
      finalStatus === 'completed' ? 'info' : 'warning',
      {
        provider: session.provider,
        durationMs: duration,
        exitCode
      }
    );

    this.emitEvent({
      sessionId,
      type: 'exit',
      content: `Process exited with code ${exitCode}`,
      timestamp: Date.now(),
      exitCode
    });
  }

  private handleProcessError(sessionId: string, err: Error): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    if (session.timeoutTimer) {
      clearTimeout(session.timeoutTimer);
    }
    databaseService.updateCLISession(sessionId, 'failed', 1, Date.now() - session.startTime);
    projectExecutionService.afterExecution({ sessionId, status: 'failed' }).catch(() => {});
    this.activeSessions.delete(sessionId);

    this.emitEvent({
      sessionId,
      type: 'stderr',
      content: `[Process Error] ${err.message}`,
      timestamp: Date.now(),
      exitCode: 1
    });
  }
}

export const executionEngine = new ExecutionEngine();
