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

export class GeminiAdapter implements ICLIAdapter {
  public readonly provider: CLIProvider = 'gemini';
  public readonly capabilities: CLICapabilities = {
    supportsStreaming: true,
    supportsResume: false,
    supportsHeadlessPrompt: true,
    supportsJsonOutput: false
  };

  private readonly minVersion = '0.1.0';
  private readonly installGuideUrl = 'https://ai.google.dev/gemini-api/docs';

  public async detect(customPath?: string): Promise<CLIInstallationStatus> {
    let resolvedPath: string | null = null;

    if (customPath && fs.existsSync(customPath)) {
      resolvedPath = path.resolve(customPath);
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

  public async checkAuth(_resolvedPath: string): Promise<CLIAuthStatus> {
    // 1. Check GEMINI_API_KEY
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10) {
      return {
        provider: this.provider,
        isAuthenticated: true,
        authType: 'api-key',
        details: 'GEMINI_API_KEY configured in environment'
      };
    }

    // 2. Check Google Application Default Credentials (ADC)
    const adcPath =
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      (process.platform === 'win32'
        ? path.join(process.env.APPDATA || '', 'gcloud', 'application_default_credentials.json')
        : path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json'));

    if (fs.existsSync(adcPath)) {
      return {
        provider: this.provider,
        isAuthenticated: true,
        authType: 'adc',
        details: 'Google Application Default Credentials (ADC) found'
      };
    }

    return {
      provider: this.provider,
      isAuthenticated: false,
      authType: 'missing',
      details: 'Set GEMINI_API_KEY or authenticate via "gcloud auth application-default login"'
    };
  }

  public buildCommand(prompt: string, workingDirectory: string): CommandSpec {
    return {
      executable: 'gemini',
      args: ['prompt', prompt],
      env: {
        ...process.env,
        PWD: workingDirectory
      }
    };
  }
}

export const geminiAdapter = new GeminiAdapter();
