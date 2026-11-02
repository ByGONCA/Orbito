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

export class ClaudeCodeAdapter implements ICLIAdapter {
  public readonly provider: CLIProvider = 'claude';
  public readonly capabilities: CLICapabilities = {
    supportsStreaming: true,
    supportsResume: true,
    supportsHeadlessPrompt: true,
    supportsJsonOutput: false
  };

  private readonly minVersion = '0.2.0';
  private readonly installGuideUrl = 'https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview';

  public async detect(customPath?: string): Promise<CLIInstallationStatus> {
    let resolvedPath: string | null = null;

    if (customPath && fs.existsSync(customPath)) {
      resolvedPath = path.resolve(customPath);
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

  public async checkAuth(_resolvedPath: string): Promise<CLIAuthStatus> {
    // 1. Check ANTHROPIC_API_KEY environment variable
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim().length > 10) {
      return {
        provider: this.provider,
        isAuthenticated: true,
        authType: 'api-key',
        details: 'ANTHROPIC_API_KEY configured in environment'
      };
    }

    // 2. Check ~/.claude.json configuration file created by claude login
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, '.claude.json');

    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        const json = JSON.parse(raw);
        if (json.oauthAccount || json.sessionToken || json.apiKey || json.userID) {
          return {
            provider: this.provider,
            isAuthenticated: true,
            authType: 'oauth',
            details: 'Active Claude CLI session found in ~/.claude.json'
          };
        }
      } catch {
        // Fall through to unauthenticated
      }
    }

    return {
      provider: this.provider,
      isAuthenticated: false,
      authType: 'missing',
      details: 'Run "claude login" or set ANTHROPIC_API_KEY'
    };
  }

  public buildCommand(prompt: string, workingDirectory: string, resumeSessionId?: string): CommandSpec {
    const args: string[] = [];

    if (resumeSessionId) {
      args.push('resume', resumeSessionId);
    }

    // Use non-interactive print mode for programmatic execution
    args.push('-p', prompt);

    return {
      executable: 'claude',
      args,
      env: {
        ...process.env,
        PWD: workingDirectory
      }
    };
  }
}

export const claudeCodeAdapter = new ClaudeCodeAdapter();
