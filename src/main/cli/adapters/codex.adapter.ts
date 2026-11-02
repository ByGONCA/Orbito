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
    supportsResume: true, // Official support via "codex exec resume <ID>"
    supportsContinue: true, // Official support via "codex exec resume --last"
    supportsHeadlessPrompt: true,
    supportsJsonOutput: true // Official support via "--json"
  };

  private readonly minVersion = '0.1.0';
  private readonly installGuideUrl = 'https://learn.chatgpt.com/docs/cli/reference';

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

  public async checkAuth(resolvedPath?: string): Promise<CLIAuthStatus> {
    if (!resolvedPath && !(await findExecutableOnPath('codex'))) {
      return {
        provider: this.provider,
        state: 'not_installed',
        isAuthenticated: false,
        authType: 'missing',
        details: 'Codex CLI is not installed on system PATH'
      };
    }

    // 1. Check OPENAI_API_KEY environment variable
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 10) {
      return {
        provider: this.provider,
        state: 'authenticated',
        isAuthenticated: true,
        authType: 'api-key',
        details: 'OPENAI_API_KEY found in process environment'
      };
    }

    // 2. Check ~/.codex/config.json
    const configPath = path.join(os.homedir(), '.codex', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        const json = JSON.parse(raw);

        if (!json || Object.keys(json).length === 0) {
          return {
            provider: this.provider,
            state: 'configured',
            isAuthenticated: false,
            authType: 'missing',
            details: 'Config file ~/.codex/config.json exists but contains no credentials'
          };
        }

        // Check expiration if session token metadata has expires_at
        if (json.expires_at && typeof json.expires_at === 'number' && Date.now() > json.expires_at) {
          return {
            provider: this.provider,
            state: 'authentication_expired',
            isAuthenticated: false,
            authType: 'api-key',
            details: 'Codex session has expired. Re-authenticate in Codex CLI.'
          };
        }

        if (json.api_key || json.apiKey || json.token) {
          return {
            provider: this.provider,
            state: 'authenticated',
            isAuthenticated: true,
            authType: 'api-key',
            details: 'API key found in ~/.codex/config.json'
          };
        }

        return {
          provider: this.provider,
          state: 'authentication_required',
          isAuthenticated: false,
          authType: 'missing',
          details: 'Authentication required. Set OPENAI_API_KEY or configure ~/.codex/config.json.'
        };
      } catch (err: any) {
        return {
          provider: this.provider,
          state: 'error',
          isAuthenticated: false,
          authType: 'missing',
          details: `Error reading ~/.codex/config.json: ${err.message}`
        };
      }
    }

    return {
      provider: this.provider,
      state: 'authentication_required',
      isAuthenticated: false,
      authType: 'missing',
      details: 'Set OPENAI_API_KEY or configure ~/.codex/config.json'
    };
  }

  public buildCommand(prompt: string, workingDirectory: string, resumeSessionId?: string): CommandSpec {
    const args: string[] = ['exec'];

    if (resumeSessionId) {
      args.push('resume');
      if (resumeSessionId === '--last' || resumeSessionId === 'last') {
        args.push('--last');
      } else {
        args.push(resumeSessionId);
      }
    }

    // Pass prompt and enable JSONL streaming output
    args.push(prompt, '--json');

    return {
      executable: 'codex',
      args,
      env: {
        ...process.env,
        PWD: workingDirectory
      }
    };
  }
}

export const codexAdapter = new CodexAdapter();
