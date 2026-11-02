import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ICLIAdapter, CommandSpec } from '../adapter.interface';
import type {
  CLIProvider,
  CLIInstallationStatus,
  CLIAuthStatus,
  CLICapabilities
} from '../../../shared/cli';
import { findExecutableOnPath, probeVersion, isVersionAtLeast } from '../detector.utils';

export class CodexAdapter implements ICLIAdapter {
  public readonly provider: CLIProvider = 'codex';
  public readonly capabilities: CLICapabilities = {
    supportsStreaming: true,
    supportsResume: false, // OpenAI CLI is stateless per command
    supportsHeadlessPrompt: true,
    supportsJsonOutput: true
  };

  private readonly minVersion = '0.1.0';
  private readonly installGuideUrl = 'https://github.com/openai/openai-python';

  public async detect(customPath?: string): Promise<CLIInstallationStatus> {
    let resolvedPath: string | null = null;

    if (customPath && fs.existsSync(customPath)) {
      resolvedPath = path.resolve(customPath);
    } else {
      resolvedPath = (await findExecutableOnPath('codex')) || (await findExecutableOnPath('openai'));
    }

    if (!resolvedPath) {
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

  public async checkAuth(_resolvedPath: string): Promise<CLIAuthStatus> {
    // 1. Check OPENAI_API_KEY
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 10) {
      return {
        provider: this.provider,
        isAuthenticated: true,
        authType: 'api-key',
        details: 'OPENAI_API_KEY configured in environment'
      };
    }

    // 2. Check ~/.codex/config.json
    const configPath = path.join(os.homedir(), '.codex', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        const json = JSON.parse(raw);
        if (json.api_key || json.apiKey || json.token) {
          return {
            provider: this.provider,
            isAuthenticated: true,
            authType: 'api-key',
            details: 'Configured API key found in ~/.codex/config.json'
          };
        }
      } catch {
        // Fall through
      }
    }

    return {
      provider: this.provider,
      isAuthenticated: false,
      authType: 'missing',
      details: 'Set OPENAI_API_KEY or configure ~/.codex/config.json'
    };
  }

  public buildCommand(prompt: string, workingDirectory: string): CommandSpec {
    return {
      executable: 'codex',
      args: ['exec', prompt],
      env: {
        ...process.env,
        PWD: workingDirectory
      }
    };
  }
}

export const codexAdapter = new CodexAdapter();
