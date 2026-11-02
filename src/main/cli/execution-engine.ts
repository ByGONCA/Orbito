import { spawn, type ChildProcess, exec } from 'node:child_process';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type {
  CLIProvider,
  CLISessionRecord,
  CLISessionStatus,
  CLIStreamEvent
} from '../../shared/cli';
import { cliManager } from './cli-manager';
import { databaseService } from '../db/database.service';
import { securityService } from '../services/security.service';

interface ActiveSession {
  id: string;
  provider: CLIProvider;
  process: ChildProcess;
  timeoutTimer: NodeJS.Timeout;
  startTime: number;
}

export class ExecutionEngine extends EventEmitter {
  private activeSessions: Map<string, ActiveSession> = new Map();

  /**
   * Spawns a CLI process with isolated environment, timeout guard, and stream listeners.
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
  }): Promise<{ sessionId: string }> {
    const {
      sessionId,
      provider,
      prompt,
      workingDirectory,
      projectId,
      customPath,
      timeoutSeconds = 120,
      resumeSessionId
    } = params;

    // 1. Security path validation
    const canonicalWorkDir = securityService.assertWithinWorkspace(workingDirectory, workingDirectory);

    // 2. Resolve adapter & binary
    const adapter = cliManager.getAdapter(provider);
    const detection = await adapter.detect(customPath);

    if (!detection.isInstalled || !detection.resolvedPath) {
      throw new Error(`Cannot execute: ${provider} CLI is not installed on this system.`);
    }

    // 3. Build command spec
    const cmdSpec = adapter.buildCommand(prompt, canonicalWorkDir, resumeSessionId);
    const executable = detection.resolvedPath || cmdSpec.executable;

    // 4. Record session in SQLite
    const now = Date.now();
    const sessionRecord: CLISessionRecord = {
      id: sessionId,
      provider,
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

    // 5. Spawn child process (strict shell: false for process isolation)
    const child = spawn(executable, cmdSpec.args, {
      cwd: canonicalWorkDir,
      env: cmdSpec.env || process.env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // 6. Timeout guard
    const timeoutTimer = setTimeout(() => {
      this.handleTimeout(sessionId);
    }, timeoutSeconds * 1000);

    const activeSession: ActiveSession = {
      id: sessionId,
      provider,
      process: child,
      timeoutTimer,
      startTime: now
    };
    this.activeSessions.set(sessionId, activeSession);

    this.emitEvent({
      sessionId,
      type: 'status',
      content: 'running',
      timestamp: Date.now()
    });

    // 7. Handle stdout streaming (with JSONL and raw text parsing)
    child.stdout?.on('data', (chunk: Buffer) => {
      const rawText = chunk.toString('utf8');
      const lines = rawText.split(/\r?\n/);
      let parsedDisplay = '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line.trim());
          // Extract session ID if reported by CLI JSON stream
          if (parsed.session_id || parsed.sessionId || (parsed.type === 'session' && parsed.id)) {
            const providerSessionId = parsed.session_id || parsed.sessionId || parsed.id;
            databaseService.updateCLISession(sessionId, 'running', undefined, undefined);
          }

          // Extract message text from Claude stream-json, Codex --json or Gemini stream-json
          if (parsed.delta?.text) {
            parsedDisplay += parsed.delta.text;
          } else if (parsed.content && typeof parsed.content === 'string') {
            parsedDisplay += parsed.content;
          } else if (parsed.response && typeof parsed.response === 'string') {
            parsedDisplay += parsed.response;
          } else if (parsed.message?.content) {
            parsedDisplay += parsed.message.content;
          } else if (parsed.type === 'error' || parsed.error) {
            parsedDisplay += `\n[Error] ${JSON.stringify(parsed.error || parsed)}\n`;
          } else {
            parsedDisplay += `${line}\n`;
          }
        } catch {
          // Plain text line
          parsedDisplay += `${line}\n`;
        }
      }

      const textToEmit = parsedDisplay || rawText;

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
    });

    // 8. Handle stderr streaming
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

    // 9. Handle process exit
    child.on('close', (exitCode) => {
      this.handleProcessExit(sessionId, exitCode !== null ? exitCode : 0);
    });

    child.on('error', (err) => {
      this.handleProcessError(sessionId, err);
    });

    return { sessionId };
  }

  private emitEvent(event: CLIStreamEvent): void {
    this.emit('stream', event);
  }

  /**
   * Terminates the entire process tree recursively to avoid orphaned child processes.
   */
  public async cancel(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    clearTimeout(session.timeoutTimer);
    const pid = session.process.pid;

    if (pid) {
      await this.killProcessTree(pid);
    }

    const duration = Date.now() - session.startTime;
    databaseService.updateCLISession(sessionId, 'cancelled', 130, duration);
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
        // Windows: taskkill terminates process tree (/T) forcefully (/F)
        exec(`taskkill /pid ${pid} /T /F`, () => {
          resolve();
        });
      } else {
        // POSIX: kill process group
        try {
          process.kill(-pid, 'SIGTERM');
          setTimeout(() => {
            try {
              process.kill(-pid, 'SIGKILL');
            } catch {
              // Ignore if already dead
            }
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

    clearTimeout(session.timeoutTimer);
    const duration = Date.now() - session.startTime;
    const finalStatus: CLISessionStatus = exitCode === 0 ? 'completed' : 'failed';

    databaseService.updateCLISession(sessionId, finalStatus, exitCode, duration);
    this.activeSessions.delete(sessionId);

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

    clearTimeout(session.timeoutTimer);
    databaseService.updateCLISession(sessionId, 'failed', 1, Date.now() - session.startTime);
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
