import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { exec } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as pty from 'node-pty';
import { cliManager } from '../cli/cli-manager';
import { findExecutableOnPath } from '../cli/detector.utils';
import type { CLIProvider } from '../../shared/cli';

export interface PtySession {
  id: string;
  provider: CLIProvider;
  workingDirectory: string;
  ptyProcess: pty.IPty;
  createdAt: number;
}

export interface CreateTerminalParams {
  terminalId: string;
  provider: CLIProvider;
  workingDirectory?: string;
  customPath?: string;
  model?: string;
  cols?: number;
  rows?: number;
}

export interface CreateTerminalResult {
  success: boolean;
  pid?: number;
  error?: string;
  installCommand?: string;
  installGuideUrl?: string;
  isExisting?: boolean;
}

export class PtyService extends EventEmitter {
  private sessions: Map<string, PtySession> = new Map();

  constructor() {
    super();
  }

  public getSession(id: string): PtySession | undefined {
    return this.sessions.get(id);
  }

  public hasSession(id: string): boolean {
    return this.sessions.has(id);
  }

  public isSessionAlive(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session || !session.ptyProcess || !session.ptyProcess.pid) return false;
    try {
      // Sending signal 0 verifies process existence without killing it
      process.kill(session.ptyProcess.pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  public listSessions(): Array<{
    id: string;
    provider: CLIProvider;
    pid: number;
    createdAt: number;
    workingDirectory: string;
  }> {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      provider: s.provider,
      pid: s.ptyProcess.pid,
      createdAt: s.createdAt,
      workingDirectory: s.workingDirectory
    }));
  }

  /**
   * Recursively terminates the process tree spawned by a PTY to ensure zero orphaned
   * processes (e.g. child commands, ConPTY helpers, node servers) linger after exit or kill.
   */
  public async cleanUpProcessTree(pid?: number): Promise<void> {
    if (!pid || pid <= 0 || pid === process.pid) return;

    return new Promise((resolve) => {
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${pid} /T /F`, { windowsHide: true }, () => {
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
          }, 300);
        } catch {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {}
          resolve();
        }
      }
    });
  }

  public async createSession(params: CreateTerminalParams): Promise<CreateTerminalResult> {
    const { terminalId, provider, model, customPath } = params;

    if (!terminalId || typeof terminalId !== 'string') {
      return {
        success: false,
        error: 'Invalid or missing terminalId.'
      };
    }

    // If session is already running for this ID, check if alive and reuse it seamlessly
    const existing = this.sessions.get(terminalId);
    if (existing) {
      if (this.isSessionAlive(terminalId)) {
        if (params.cols && params.rows && params.cols > 0 && params.rows > 0) {
          try {
            const safeCols = Math.min(Math.max(Math.floor(params.cols), 1), 1000);
            const safeRows = Math.min(Math.max(Math.floor(params.rows), 1), 500);
            existing.ptyProcess.resize(safeCols, safeRows);
          } catch {}
        }
        return {
          success: true,
          pid: existing.ptyProcess.pid,
          isExisting: true
        };
      } else {
        // Clean up dead session before spawning fresh replacement
        this.kill(terminalId);
      }
    }

    // Safely canonicalize and validate working directory
    let workingDirectory = process.cwd();
    if (params.workingDirectory && typeof params.workingDirectory === 'string') {
      try {
        const resolved = path.resolve(params.workingDirectory);
        if (fs.existsSync(resolved)) {
          const stat = fs.statSync(resolved);
          workingDirectory = stat.isDirectory() ? resolved : path.dirname(resolved);
        }
      } catch {
        workingDirectory = process.cwd();
      }
    }

    const isWin = process.platform === 'win32';
    let executable: string | null = null;
    let args: string[] = [];
    let installCommand: string | undefined;
    let installGuideUrl: string | undefined;

    // 1. Resolve Shells
    if (provider === 'powershell') {
      if (isWin) {
        const sysRoot = process.env.SystemRoot || 'C:\\Windows';
        executable = path.join(sysRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
        if (!fs.existsSync(executable)) {
          executable = 'powershell.exe';
        }
      } else {
        executable = 'pwsh';
      }
      args = ['-NoExit'];
    } else if (provider === 'cmd') {
      executable = process.env.COMSPEC || (isWin ? 'cmd.exe' : '/bin/sh');
      args = [];
    } else if (provider === 'bash') {
      if (isWin) {
        const gitBashPaths = [
          'C:\\Program Files\\Git\\bin\\bash.exe',
          'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
          path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Git', 'bin', 'bash.exe')
        ];
        executable = gitBashPaths.find((p) => fs.existsSync(p)) || 'bash.exe';
      } else {
        executable = process.env.SHELL || '/bin/bash';
      }
      args = ['--login'];
    } else {
      // 2. Resolve Agent CLI via Adapter
      try {
        const adapter = cliManager.getAdapter(provider);
        installCommand = adapter.installCommand;
        installGuideUrl = adapter.installGuideUrl;

        if (adapter.getInteractiveLaunchSpec) {
          const specResult = await adapter.getInteractiveLaunchSpec({
            workingDirectory,
            customPath,
            model
          });
          if (!specResult.success) {
            return {
              success: false,
              error: specResult.error,
              installCommand: specResult.installCommand || installCommand,
              installGuideUrl: specResult.installGuideUrl || installGuideUrl
            };
          }
          executable = specResult.spec.executable;
          args = specResult.spec.args;
        } else {
          const detectStatus = await adapter.detect(customPath);
          if (!detectStatus.isInstalled || !detectStatus.resolvedPath) {
            return {
              success: false,
              error: `CLI executable for '${adapter.name}' was not found. Please install ${adapter.name} or set its path in Settings.`,
              installCommand,
              installGuideUrl
            };
          }
          executable = detectStatus.resolvedPath;
          args = [];
        }
      } catch (err: any) {
        // Fallback detection
        const probeName = provider === 'antigravity' ? 'agy' : provider === 'claude' ? 'claude' : provider;
        executable = (await findExecutableOnPath(probeName)) || customPath || null;
        if (!executable) {
          return {
            success: false,
            error: `CLI provider '${provider}' is not available on this system. ${err?.message || ''}`,
            installCommand,
            installGuideUrl
          };
        }
      }
    }

    if (!executable) {
      return {
        success: false,
        error: `Could not resolve executable for provider '${provider}'.`,
        installCommand,
        installGuideUrl
      };
    }

    // On Windows, if executable is a batch script (.cmd or .bat), wrap with cmd.exe /c
    // so ConPTY/WinPTY native CreateProcess does not fail with invalid Win32 application error
    if (isWin && /\.(cmd|bat)$/i.test(executable)) {
      const comspec = process.env.COMSPEC || 'cmd.exe';
      args = ['/c', executable, ...args];
      executable = comspec;
    }

    // 3. Prepare Environment
    // Provide full user environment for interactive PTY while stripping internal Electron overrides
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '3',
      TERM_PROGRAM: 'Orbito',
      TERM_PROGRAM_VERSION: '0.1.0'
    };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.ELECTRON_NO_ASAR;
    delete env.NODE_OPTIONS;

    const cols = params.cols && params.cols > 0 ? Math.min(Math.max(Math.floor(params.cols), 1), 1000) : 80;
    const rows = params.rows && params.rows > 0 ? Math.min(Math.max(Math.floor(params.rows), 1), 500) : 24;

    // 4. Spawn Native PTY (prefer ConPTY on Windows for full VT/TUI support)
    let ptyProcess: pty.IPty;
    try {
      ptyProcess = pty.spawn(executable, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: workingDirectory,
        env,
        useConpty: isWin
      });
    } catch (spawnErr: any) {
      // If ConPTY failed on Windows, retry with winpty
      if (isWin) {
        try {
          ptyProcess = pty.spawn(executable, args, {
            name: 'xterm-256color',
            cols,
            rows,
            cwd: workingDirectory,
            env,
            useConpty: false
          });
        } catch (retryErr: any) {
          return {
            success: false,
            error: `Failed to spawn pseudo-terminal for '${executable}': ${retryErr.message}`,
            installCommand,
            installGuideUrl
          };
        }
      } else {
        return {
          success: false,
          error: `Failed to spawn pseudo-terminal for '${executable}': ${spawnErr.message}`,
          installCommand,
          installGuideUrl
        };
      }
    }

    const session: PtySession = {
      id: terminalId,
      provider,
      workingDirectory,
      ptyProcess,
      createdAt: Date.now()
    };

    this.sessions.set(terminalId, session);

    // Forward output events safely with error boundary
    ptyProcess.onData((data: string) => {
      try {
        this.emit('data', { terminalId, data });
      } catch {}
    });

    // Handle clean process exit and clean up child process tree
    ptyProcess.onExit(({ exitCode, signal }) => {
      const current = this.sessions.get(terminalId);
      this.sessions.delete(terminalId);
      if (current?.ptyProcess?.pid) {
        this.cleanUpProcessTree(current.ptyProcess.pid).catch(() => {});
      }
      try {
        this.emit('exit', { terminalId, exitCode, signal });
      } catch {}
    });

    return {
      success: true,
      pid: ptyProcess.pid
    };
  }

  public write(terminalId: string, data: string): boolean {
    if (typeof data !== 'string' || data.length === 0) return false;
    const session = this.sessions.get(terminalId);
    if (session) {
      try {
        session.ptyProcess.write(data);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  public resize(terminalId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(terminalId);
    if (!session) return false;

    const safeCols = Math.min(Math.max(Math.floor(cols) || 80, 1), 1000);
    const safeRows = Math.min(Math.max(Math.floor(rows) || 24, 1), 500);

    try {
      session.ptyProcess.resize(safeCols, safeRows);
      return true;
    } catch {
      return false;
    }
  }

  public sendSignal(terminalId: string, signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL' | string = 'SIGINT'): boolean {
    const session = this.sessions.get(terminalId);
    if (!session) return false;

    try {
      if (signal === 'SIGINT' || signal === 'INT') {
        // In interactive PTY, sending ASCII ETX (\x03) sends Ctrl+C to the running foreground process
        session.ptyProcess.write('\x03');
        return true;
      }

      if (process.platform !== 'win32') {
        session.ptyProcess.kill(signal);
        return true;
      } else {
        // On Windows, if SIGKILL/SIGTERM requested, clean up process tree
        if (signal === 'SIGKILL' || signal === 'SIGTERM') {
          return this.kill(terminalId);
        }
        session.ptyProcess.write('\x03');
        return true;
      }
    } catch {
      return false;
    }
  }

  public kill(terminalId: string): boolean {
    const session = this.sessions.get(terminalId);
    if (session) {
      this.sessions.delete(terminalId);
      const pid = session.ptyProcess?.pid;
      try {
        session.ptyProcess.kill();
      } catch {}
      if (pid && pid > 0) {
        this.cleanUpProcessTree(pid).catch(() => {});
      }
      return true;
    }
    return false;
  }

  public async killAsync(terminalId: string): Promise<boolean> {
    const session = this.sessions.get(terminalId);
    if (session) {
      this.sessions.delete(terminalId);
      const pid = session.ptyProcess?.pid;
      try {
        session.ptyProcess.kill();
      } catch {}
      if (pid && pid > 0) {
        await this.cleanUpProcessTree(pid);
      }
      return true;
    }
    return false;
  }

  public killAll(): void {
    const pids: number[] = [];
    for (const [, session] of this.sessions.entries()) {
      if (session.ptyProcess?.pid) {
        pids.push(session.ptyProcess.pid);
      }
      try {
        session.ptyProcess.kill();
      } catch {}
    }
    this.sessions.clear();
    for (const pid of pids) {
      this.cleanUpProcessTree(pid).catch(() => {});
    }
  }

  public async killAllAsync(): Promise<void> {
    const pids: number[] = [];
    for (const [, session] of this.sessions.entries()) {
      if (session.ptyProcess?.pid) {
        pids.push(session.ptyProcess.pid);
      }
      try {
        session.ptyProcess.kill();
      } catch {}
    }
    this.sessions.clear();
    await Promise.allSettled(pids.map((pid) => this.cleanUpProcessTree(pid)));
  }
}

export const ptyService = new PtyService();
