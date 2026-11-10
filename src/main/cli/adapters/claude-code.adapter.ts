import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ICLIAdapter, CommandSpec, InteractiveLaunchSpec } from '../adapter.interface';
import type {
  CLIProvider,
  CLIInstallationStatus,
  CLIAuthStatus,
  CLICapabilities
} from '../../../shared/cli';
import { findExecutableOnPath, probeVersion, isVersionAtLeast } from '../detector.utils';

export class ClaudeCodeAdapter implements ICLIAdapter {
  public readonly provider: CLIProvider = 'claude';
  public readonly name: string = 'Claude Code';
  public readonly installCommand: string = 'npm install -g @anthropic-ai/claude-code';
  public readonly capabilities: CLICapabilities = {
    supportsStreaming: true,
    supportsResume: true,
    supportsContinue: true,
    supportsHeadlessPrompt: true,
    supportsJsonOutput: true
  };

  private readonly minVersion = '0.2.0';
  public readonly installGuideUrl = 'https://docs.anthropic.com/en/docs/claude-code/overview';

  public async detect(customPath?: string): Promise<CLIInstallationStatus> {
    let resolvedPath: string | null = null;

    if (customPath) {
      resolvedPath = fs.existsSync(customPath) ? path.resolve(customPath) : null;
    } else {
      resolvedPath = (await findExecutableOnPath('claude')) || (await findExecutableOnPath('claude-code'));
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
    if (!resolvedPath && !(await findExecutableOnPath('claude'))) {
      return {
        provider: this.provider,
        state: 'not_installed',
        isAuthenticated: false,
        authType: 'missing',
        details: 'Claude CLI is not installed on system PATH'
      };
    }

    // 1. Check ANTHROPIC_API_KEY environment variable
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim().length > 10) {
      return {
        provider: this.provider,
        state: 'authenticated',
        isAuthenticated: true,
        authType: 'api-key',
        details: 'ANTHROPIC_API_KEY found in process environment'
      };
    }

    // 2. Check ~/.claude.json configuration file created by claude login
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, '.claude.json');

    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        const json = JSON.parse(raw);

        // Check if file is just empty/template
        if (!json || Object.keys(json).length === 0) {
          return {
            provider: this.provider,
            state: 'configured',
            isAuthenticated: false,
            authType: 'missing',
            details: 'Config file ~/.claude.json exists but contains no active credentials'
          };
        }

        // Check expiration if session metadata has expiresAt
        if (json.oauthAccount?.expiresAt && typeof json.oauthAccount.expiresAt === 'number') {
          if (Date.now() > json.oauthAccount.expiresAt) {
            return {
              provider: this.provider,
              state: 'authentication_expired',
              isAuthenticated: false,
              authType: 'oauth',
              details: 'Claude CLI session has expired. Run "claude login" to renew.'
            };
          }
        }

        if (json.oauthAccount || json.sessionToken || json.apiKey) {
          return {
            provider: this.provider,
            state: 'authenticated',
            isAuthenticated: true,
            authType: json.apiKey ? 'api-key' : 'oauth',
            details: 'Valid Claude CLI credentials present in ~/.claude.json'
          };
        }

        return {
          provider: this.provider,
          state: 'authentication_required',
          isAuthenticated: false,
          authType: 'missing',
          details: 'Authentication required. Run "claude login" or set ANTHROPIC_API_KEY.'
        };
      } catch (err: any) {
        return {
          provider: this.provider,
          state: 'error',
          isAuthenticated: false,
          authType: 'missing',
          details: `Error reading ~/.claude.json: ${err.message}`
        };
      }
    }

    return {
      provider: this.provider,
      state: 'authentication_required',
      isAuthenticated: false,
      authType: 'missing',
      details: 'No credentials found. Run "claude login" or configure ANTHROPIC_API_KEY.'
    };
  }

  public buildCommand(prompt: string, workingDirectory: string, resumeSessionId?: string): CommandSpec {
    const args: string[] = [];

    // Use non-interactive print mode for programmatic execution
    args.push('-p', prompt);

    // Stream JSON output format (requires --verbose in Claude Code CLI)
    args.push('--output-format', 'stream-json', '--verbose');

    // Official syntax:
    // - "--continue" resumes the most recent conversation in the directory
    // - "--resume <SESSION_ID>" resumes a specific session
    if (resumeSessionId) {
      if (
        resumeSessionId === '--continue' ||
        resumeSessionId === 'continue' ||
        resumeSessionId === '--last' ||
        resumeSessionId === 'last' ||
        resumeSessionId === 'latest'
      ) {
        args.push('--continue');
      } else {
        args.push('--resume', resumeSessionId);
      }
    }

    return {
      executable: 'claude',
      args,
      env: {
        ...process.env,
        PWD: workingDirectory
      }
    };
  }

  public async getInteractiveLaunchSpec(options: {
    workingDirectory: string;
    customPath?: string;
    model?: string;
    extraArgs?: string[];
  }): Promise<{ success: true; spec: InteractiveLaunchSpec } | { success: false; error: string; installGuideUrl?: string; installCommand?: string }> {
    const installStatus = await this.detect(options.customPath);
    if (!installStatus.isInstalled || !installStatus.resolvedPath) {
      return {
        success: false,
        error: 'Claude Code CLI executable ("claude") was not found. Please install Claude Code or configure its path in Settings.',
        installGuideUrl: this.installGuideUrl,
        installCommand: this.installCommand
      };
    }

    const args: string[] = [];
    if (options.model) {
      args.push('--model', options.model);
    }
    if (options.extraArgs) {
      args.push(...options.extraArgs);
    }

    return {
      success: true,
      spec: {
        executable: installStatus.resolvedPath,
        args,
        cwd: options.workingDirectory
      }
    };
  }
}

export const claudeCodeAdapter = new ClaudeCodeAdapter();
