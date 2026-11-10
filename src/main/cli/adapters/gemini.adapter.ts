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

export class GeminiAdapter implements ICLIAdapter {
  public readonly provider: CLIProvider = 'gemini';
  public readonly name: string = 'Gemini CLI';
  public readonly installCommand: string = 'npm install -g @google/gemini-cli';
  public readonly capabilities: CLICapabilities = {
    supportsStreaming: true,
    supportsResume: true, // Official support via --resume
    supportsContinue: true, // Official support via --resume latest
    supportsListSessions: true, // Official support via --list-sessions
    supportsHeadlessPrompt: true,
    supportsJsonOutput: true // Official support via "--output-format stream-json"
  };

  private readonly minVersion = '0.1.0';
  public readonly installGuideUrl = 'https://ai.google.dev/gemini-api/docs';

  public async detect(customPath?: string): Promise<CLIInstallationStatus> {
    let resolvedPath: string | null = null;

    if (customPath) {
      resolvedPath = fs.existsSync(customPath) ? path.resolve(customPath) : null;
    } else {
      resolvedPath = (await findExecutableOnPath('gemini')) || (await findExecutableOnPath('google-genai'));
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
    if (!resolvedPath && !(await findExecutableOnPath('gemini'))) {
      return {
        provider: this.provider,
        state: 'not_installed',
        isAuthenticated: false,
        authType: 'missing',
        details: 'Gemini CLI is not installed on system PATH'
      };
    }

    // 1. Check GEMINI_API_KEY environment variable
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10) {
      return {
        provider: this.provider,
        state: 'authenticated',
        isAuthenticated: true,
        authType: 'api-key',
        details: 'GEMINI_API_KEY found in process environment'
      };
    }

    // 2. Check Google Application Default Credentials (ADC)
    const adcPath =
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      (process.platform === 'win32'
        ? path.join(process.env.APPDATA || '', 'gcloud', 'application_default_credentials.json')
        : path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json'));

    if (fs.existsSync(adcPath)) {
      try {
        const raw = fs.readFileSync(adcPath, 'utf8');
        const json = JSON.parse(raw);

        if (!json || Object.keys(json).length === 0) {
          return {
            provider: this.provider,
            state: 'configured',
            isAuthenticated: false,
            authType: 'missing',
            details: 'ADC credentials file exists but is empty'
          };
        }

        // Check if token has an expiration timestamp
        if (json.expiry && typeof json.expiry === 'string') {
          const expiryDate = new Date(json.expiry).getTime();
          if (!isNaN(expiryDate) && Date.now() > expiryDate && !json.refresh_token) {
            return {
              provider: this.provider,
              state: 'authentication_expired',
              isAuthenticated: false,
              authType: 'adc',
              details: 'Google ADC token has expired. Run "gcloud auth application-default login".'
            };
          }
        }

        return {
          provider: this.provider,
          state: 'authenticated',
          isAuthenticated: true,
          authType: 'adc',
          details: 'Google Application Default Credentials (ADC) active'
        };
      } catch (err: any) {
        return {
          provider: this.provider,
          state: 'error',
          isAuthenticated: false,
          authType: 'missing',
          details: `Error reading ADC credentials: ${err.message}`
        };
      }
    }

    return {
      provider: this.provider,
      state: 'authentication_required',
      isAuthenticated: false,
      authType: 'missing',
      details: 'Set GEMINI_API_KEY or authenticate via "gcloud auth application-default login"'
    };
  }

  public buildCommand(prompt: string, workingDirectory: string, resumeSessionId?: string): CommandSpec {
    // Correct official syntax: gemini -p "<prompt>" --output-format stream-json
    const args: string[] = ['-p', prompt, '--output-format', 'stream-json'];

    // Official resume syntax: --resume latest or --resume <SESSION_ID/INDEX>
    if (resumeSessionId) {
      if (
        resumeSessionId === '--last' ||
        resumeSessionId === 'latest' ||
        resumeSessionId === 'last' ||
        resumeSessionId === '--resume' ||
        resumeSessionId === '--continue'
      ) {
        args.push('--resume', 'latest');
      } else {
        args.push('--resume', resumeSessionId);
      }
    }

    return {
      executable: 'gemini',
      args,
      env: {
        ...process.env,
        PWD: workingDirectory
      }
    };
  }

  public buildListSessionsCommand(workingDirectory: string): CommandSpec {
    return {
      executable: 'gemini',
      args: ['--list-sessions'],
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
        error: 'Gemini CLI executable ("gemini") was not found. Please install Gemini CLI or configure its path in Settings.',
        installGuideUrl: this.installGuideUrl,
        installCommand: this.installCommand
      };
    }

    const args: string[] = [];
    if (options.model) {
      args.push('-m', options.model);
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

export const geminiAdapter = new GeminiAdapter();
