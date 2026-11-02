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
          resolvedPath: 'http://127.0.0.1:11434',
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
