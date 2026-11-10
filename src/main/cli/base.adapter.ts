import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ICLIAdapter, CommandSpec, InteractiveLaunchSpec } from './adapter.interface';
import type {
  CLIProvider,
  CLIInstallationStatus,
  CLIAuthStatus,
  CLICapabilities,
  AuthType
} from '../../shared/cli';
import { findExecutableOnPath, probeVersion, isVersionAtLeast } from './detector.utils';

export interface BaseAdapterConfig {
  provider: CLIProvider;
  name: string;
  vendor: string;
  tagline: string;
  description: string;
  executableNames: string[];
  supportedPlatforms?: NodeJS.Platform[];
  minVersion?: string;
  installCommand?: string;
  installGuideUrl: string;
  authCommand?: string;
  authType?: AuthType;
  envAuthKeys?: string[];
  configAuthPaths?: string[]; // relative to os.homedir()
  capabilities?: Partial<CLICapabilities>;
  defaultArgs?: string[];
  formatPromptArgs?: (prompt: string, resumeSessionId?: string) => string[];
  integrationAvailability?: 'standalone_cli' | 'sdk' | 'extension' | 'hosted_service' | 'desktop_app';
}

export class BaseCLIAdapter implements ICLIAdapter {
  public readonly provider: CLIProvider;
  public readonly name: string;
  public readonly vendor: string;
  public readonly tagline: string;
  public readonly description: string;
  public readonly executableNames: string[];
  public readonly supportedPlatforms: NodeJS.Platform[];
  public readonly minVersion?: string;
  public readonly installCommand?: string;
  public readonly installGuideUrl: string;
  public readonly authCommand?: string;
  public readonly authType: AuthType;
  public readonly envAuthKeys: string[];
  public readonly configAuthPaths: string[];
  public readonly capabilities: CLICapabilities;
  public readonly defaultArgs: string[];
  public readonly integrationAvailability: 'standalone_cli' | 'sdk' | 'extension' | 'hosted_service' | 'desktop_app';
  private readonly formatPromptArgs?: (prompt: string, resumeSessionId?: string) => string[];

  constructor(config: BaseAdapterConfig) {
    this.provider = config.provider;
    this.name = config.name;
    this.vendor = config.vendor;
    this.tagline = config.tagline;
    this.description = config.description;
    this.executableNames = config.executableNames;
    this.supportedPlatforms = config.supportedPlatforms || ['win32', 'darwin', 'linux'];
    this.minVersion = config.minVersion;
    this.installCommand = config.installCommand;
    this.installGuideUrl = config.installGuideUrl;
    this.authCommand = config.authCommand;
    this.authType = config.authType || 'api-key';
    this.envAuthKeys = config.envAuthKeys || [];
    this.configAuthPaths = config.configAuthPaths || [];
    this.capabilities = {
      supportsStreaming: true,
      supportsResume: false,
      supportsHeadlessPrompt: true,
      supportsJsonOutput: false,
      ...config.capabilities
    };
    this.defaultArgs = config.defaultArgs || [];
    this.formatPromptArgs = config.formatPromptArgs;
    this.integrationAvailability = config.integrationAvailability || 'standalone_cli';
  }

  public isPlatformSupported(): boolean {
    return this.supportedPlatforms.includes(process.platform);
  }

  public async detect(customPath?: string): Promise<CLIInstallationStatus> {
    if (!this.isPlatformSupported()) {
      return {
        provider: this.provider,
        isInstalled: false,
        isCompatible: false,
        requiresUpdate: false,
        installGuideUrl: this.installGuideUrl
      };
    }

    let resolvedPath: string | null = null;

    if (customPath) {
      resolvedPath = fs.existsSync(customPath) ? path.resolve(customPath) : null;
    } else {
      for (const exeName of this.executableNames) {
        const found = await findExecutableOnPath(exeName);
        if (found) {
          resolvedPath = found;
          break;
        }
      }
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
    const isCompatible = version && this.minVersion ? isVersionAtLeast(version, this.minVersion) : true;
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
    if (!this.isPlatformSupported()) {
      return {
        provider: this.provider,
        state: 'unsupported_platform',
        isAuthenticated: false,
        authType: 'missing',
        details: `${this.name} is not officially supported on ${process.platform}`
      };
    }

    if (!resolvedPath) {
      const detected = await this.detect();
      if (!detected.isInstalled || !detected.resolvedPath) {
        return {
          provider: this.provider,
          state: 'not_installed',
          isAuthenticated: false,
          authType: 'missing',
          details: `${this.name} executable is not installed`
        };
      }
      resolvedPath = detected.resolvedPath;
    }

    // 1. Check if auth is not required
    if (this.authType === 'none') {
      return {
        provider: this.provider,
        state: 'authenticated',
        isAuthenticated: true,
        authType: 'none',
        details: 'No authentication required'
      };
    }

    // 2. Check environment variables
    for (const envKey of this.envAuthKeys) {
      const val = process.env[envKey];
      if (val && val.trim().length > 0) {
        return {
          provider: this.provider,
          state: 'authenticated',
          isAuthenticated: true,
          authType: 'api-key',
          details: `${envKey} found in environment`
        };
      }
    }

    // 3. Check configuration files
    const homeDir = os.homedir();
    for (const relConfig of this.configAuthPaths) {
      const fullPath = path.isAbsolute(relConfig) ? relConfig : path.join(homeDir, relConfig);
      if (fs.existsSync(fullPath)) {
        try {
          const stats = fs.statSync(fullPath);
          if (stats.size > 2) {
            return {
              provider: this.provider,
              state: 'authenticated',
              isAuthenticated: true,
              authType: this.authType,
              details: `Active credentials found in ~/${relConfig}`
            };
          }
        } catch {
          // ignore read error
        }
      }
    }

    return {
      provider: this.provider,
      state: 'authentication_required',
      isAuthenticated: false,
      authType: this.authType,
      details: `Authentication required via ${this.authCommand || 'environment variable or login command'}`
    };
  }

  public buildCommand(prompt: string, workingDirectory: string, resumeSessionId?: string): CommandSpec {
    let args: string[] = [...this.defaultArgs];

    if (this.formatPromptArgs) {
      args.push(...this.formatPromptArgs(prompt, resumeSessionId));
    } else {
      args.push(prompt);
    }

    return {
      executable: this.executableNames[0],
      args
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
        error: `CLI executable for ${this.name} was not found. Please install ${this.name} or set its custom path in Settings.`,
        installGuideUrl: this.installGuideUrl,
        installCommand: this.installCommand
      };
    }

    const args = [...this.defaultArgs];
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
