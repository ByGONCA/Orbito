import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import * as pty from 'node-pty';
import { cliManager } from '../cli/cli-manager';
import { buildSanitizedCLIEnv } from '../cli/execution-engine';
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

  public async createSession(params: CreateTerminalParams): Promise<CreateTerminalResult> {
    const { terminalId, provider, model, customPath } = params;

    // If session is already running for this ID, reuse it seamlessly without killing or restarting
    const existing = this.sessions.get(terminalId);
    if (existing) {
      if (params.cols && params.rows && params.cols > 10 && params.rows > 4) {
        try {
          existing.ptyProcess.resize(params.cols, params.rows);
        } catch {}
      }
      return {
        success: true,
        pid: existing.ptyProcess.pid,
        isExisting: true
      };
    }

    const workingDirectory =
      params.workingDirectory && fs.existsSync(params.workingDirectory)
        ? path.resolve(params.workingDirectory)
        : process.cwd();

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
            error: `CLI provider '${provider}' is not available on this system. ${err.message || ''}`,
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

    const cols = params.cols && params.cols > 10 ? params.cols : 80;
    const rows = params.rows && params.rows > 4 ? params.rows : 24;

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

    // Forward output events
    ptyProcess.onData((data: string) => {
      this.emit('data', { terminalId, data });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.sessions.delete(terminalId);
      this.emit('exit', { terminalId, exitCode, signal });
    });

    return {
      success: true,
      pid: ptyProcess.pid
    };
  }

  public write(terminalId: string, data: string): void {
    const session = this.sessions.get(terminalId);
    if (session) {
      try {
        session.ptyProcess.write(data);
      } catch (err) {
        // Process might be exiting
      }
    }
  }

  public resize(terminalId: string, cols: number, rows: number): void {
    const session = this.sessions.get(terminalId);
    if (session && cols > 0 && rows > 0) {
      try {
        session.ptyProcess.resize(cols, rows);
      } catch (err) {
        // Process might be exiting
      }
    }
  }

  public kill(terminalId: string): boolean {
    const session = this.sessions.get(terminalId);
    if (session) {
      this.sessions.delete(terminalId);
      try {
        session.ptyProcess.kill();
        return true;
      } catch (err) {
        return false;
      }
    }
    return false;
  }

  public killAll(): void {
    for (const [id, session] of this.sessions.entries()) {
      try {
        session.ptyProcess.kill();
      } catch {
        // Ignore
      }
    }
    this.sessions.clear();
  }
}

export const ptyService = new PtyService();
