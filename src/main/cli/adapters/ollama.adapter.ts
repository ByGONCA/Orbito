import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import type { ICLIAdapter, CommandSpec } from '../adapter.interface';
import type {
  CLIProvider,
  CLIInstallationStatus,
  CLIAuthStatus,
  CLICapabilities
} from '../../../shared/cli';
import { findExecutableOnPath, probeVersion, isVersionAtLeast } from '../detector.utils';

export class OllamaAdapter implements ICLIAdapter {
  public readonly provider: CLIProvider = 'ollama';
  public readonly capabilities: CLICapabilities = {
    supportsStreaming: true,
    supportsResume: false,
    supportsContinue: false,
    supportsListSessions: false,
    supportsHeadlessPrompt: true,
    supportsJsonOutput: true
  };

  private readonly minVersion = '0.1.20';
  private readonly installGuideUrl = 'https://ollama.com/download';
  private activeModel = 'llama3:latest';
  private defaultHost = '127.0.0.1';
  private defaultPort = 11434;

  public setModel(model: string): void {
    if (model && model.trim()) {
      this.activeModel = model.trim();
    }
  }

  public getModel(): string {
    return this.activeModel;
  }

  public async detect(customPath?: string): Promise<CLIInstallationStatus> {
    let resolvedPath: string | null = null;

    if (customPath && fs.existsSync(customPath)) {
      resolvedPath = path.resolve(customPath);
    } else {
      resolvedPath = await findExecutableOnPath('ollama');
    }

    if (!resolvedPath) {
      // Check if REST API is responsive even if CLI binary is not directly on PATH
      const isDaemonAlive = await this.pingDaemon();
      if (isDaemonAlive) {
        return {
          provider: this.provider,
          isInstalled: true,
          resolvedPath: undefined, // Binary does not exist on PATH; HTTP API fallback is used
          version: 'daemon-active',
          isCompatible: true,
          requiresUpdate: false,
          installGuideUrl: this.installGuideUrl
        };
      }

      return {
        provider: this.provider,
        isInstalled: false,
        isCompatible: false,
        requiresUpdate: false,
        installGuideUrl: this.installGuideUrl
      };
    }

    const version = await probeVersion(resolvedPath);
    const isCompatible = version ? isVersionAtLeast(version, this.minVersion) : true;
    const requiresUpdate = !isCompatible;

    return {
      provider: this.provider,
      isInstalled: true,
      resolvedPath,
      version: version || 'unknown',
      isCompatible,
      requiresUpdate,
      installGuideUrl: this.installGuideUrl
    };
  }

  public async checkAuth(resolvedPath?: string): Promise<CLIAuthStatus> {
    const isAlive = await this.pingDaemon();
    if (!isAlive) {
      const hasBinary = resolvedPath || (await findExecutableOnPath('ollama'));
      if (hasBinary) {
        return {
          provider: this.provider,
          state: 'installed',
          isAuthenticated: false,
          authType: 'missing',
          details: 'Ollama binary detected, but local daemon (http://127.0.0.1:11434) is not responding. Start with "ollama serve".'
        };
      }
      return {
        provider: this.provider,
        state: 'not_installed',
        isAuthenticated: false,
        authType: 'missing',
        details: 'Ollama is not installed or running locally.'
      };
    }

    // Daemon is running; query installed models
    try {
      const models = await this.listLocalModels();
      if (models.length > 0) {
        return {
          provider: this.provider,
          state: 'authenticated',
          isAuthenticated: true,
          authType: 'api-key', // Local air-gapped authentication granted
          details: `Local Ollama daemon running with ${models.length} model(s): ${models.slice(0, 3).join(', ')}${models.length > 3 ? '...' : ''}`
        };
      } else {
        return {
          provider: this.provider,
          state: 'configured',
          isAuthenticated: true,
          authType: 'missing',
          details: 'Ollama daemon is running, but no models have been pulled yet. Run "ollama pull llama3".'
        };
      }
    } catch {
      return {
        provider: this.provider,
        state: 'configured',
        isAuthenticated: true,
        authType: 'missing',
        details: 'Ollama daemon responding locally.'
      };
    }
  }

  /**
   * Evaluates how Ollama can execute: via binary CLI or HTTP REST API.
   */
  public async canExecute(customPath?: string): Promise<{
    canExecute: boolean;
    mode: 'cli' | 'http' | 'none';
    resolvedPath?: string;
    error?: string;
  }> {
    const status = await this.detect(customPath);
    if (status.resolvedPath) {
      return { canExecute: true, mode: 'cli', resolvedPath: status.resolvedPath };
    }
    const isDaemonAlive = await this.pingDaemon();
    if (isDaemonAlive) {
      return { canExecute: true, mode: 'http' };
    }
    return {
      canExecute: false,
      mode: 'none',
      error:
        "Cannot execute: Ollama CLI binary is not installed on PATH and local daemon is not running (http://127.0.0.1:11434). Start with 'ollama serve' or install from https://ollama.com/download."
    };
  }

  /**
   * Executes prompt via Ollama's local HTTP REST API (/api/generate) with real-time JSON streaming.
   * Completely avoids child_process.spawn() when the CLI binary is not installed.
   */
  public executeHttpStream(params: {
    prompt: string;
    model?: string;
    timeoutSeconds?: number;
    onChunk: (delta: string) => void;
    onError: (errorMessage: string) => void;
    onDone: (exitCode: number) => void;
  }): { abort: () => void } {
    const modelToUse = params.model || this.activeModel;
    const timeoutMs = (params.timeoutSeconds || 120) * 1000;

    const postData = JSON.stringify({
      model: modelToUse,
      prompt: params.prompt,
      stream: true
    });

    let isCompleted = false;
    let timeoutTimer: NodeJS.Timeout | null = null;

    const req = http.request(
      {
        hostname: this.defaultHost,
        port: this.defaultPort,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          let errBody = '';
          res.on('data', (c) => (errBody += c));
          res.on('end', () => {
            if (isCompleted) return;
            isCompleted = true;
            if (timeoutTimer) clearTimeout(timeoutTimer);
            try {
              const parsed = JSON.parse(errBody);
              params.onError(parsed.error || `Ollama API error (HTTP ${res.statusCode})`);
            } catch {
              params.onError(`Ollama API error: HTTP ${res.statusCode} - ${errBody}`);
            }
            params.onDone(1);
          });
          return;
        }

        let buffer = '';
        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.response) {
                params.onChunk(parsed.response);
              }
              if (parsed.done) {
                if (isCompleted) return;
                isCompleted = true;
                if (timeoutTimer) clearTimeout(timeoutTimer);
                params.onDone(0);
                return;
              }
            } catch {
              // Ignore non-json chunks
            }
          }
        });

        res.on('end', () => {
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer);
              if (parsed.response) params.onChunk(parsed.response);
            } catch {}
          }
          if (!isCompleted) {
            isCompleted = true;
            if (timeoutTimer) clearTimeout(timeoutTimer);
            params.onDone(0);
          }
        });
      }
    );

    timeoutTimer = setTimeout(() => {
      if (!isCompleted) {
        isCompleted = true;
        req.destroy(new Error('Ollama execution timeout exceeded.'));
        params.onError('Ollama execution timed out.');
        params.onDone(124);
      }
    }, timeoutMs);

    req.on('error', (err: any) => {
      if (isCompleted) return;
      isCompleted = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      params.onError(`Ollama connection error: ${err.message || 'Daemon unreachable'}`);
      params.onDone(1);
    });

    req.write(postData);
    req.end();

    return {
      abort: () => {
        if (!isCompleted) {
          isCompleted = true;
          if (timeoutTimer) clearTimeout(timeoutTimer);
          req.destroy();
          params.onDone(130);
        }
      }
    };
  }

  public buildCommand(prompt: string, _workingDirectory: string, _resumeSessionId?: string): CommandSpec {
    return {
      executable: 'ollama',
      args: ['run', this.activeModel, '--nowordwrap', prompt],
      env: {
        OLLAMA_HOST: '127.0.0.1:11434'
      }
    };
  }

  public async pingDaemon(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(
        {
          host: this.defaultHost,
          port: this.defaultPort,
          path: '/api/tags',
          timeout: 1500
        },
        (res) => {
          resolve(res.statusCode === 200);
        }
      );

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  public async listLocalModels(): Promise<string[]> {
    return new Promise((resolve) => {
      const req = http.get(
        {
          host: this.defaultHost,
          port: this.defaultPort,
          path: '/api/tags',
          timeout: 2500
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed && Array.isArray(parsed.models)) {
                const names = parsed.models.map((m: { name: string }) => m.name);
                resolve(names);
                return;
              }
              resolve([]);
            } catch {
              resolve([]);
            }
          });
        }
      );

      req.on('error', () => resolve([]));
      req.on('timeout', () => {
        req.destroy();
        resolve([]);
      });
    });
  }
}

export const ollamaAdapter = new OllamaAdapter();
