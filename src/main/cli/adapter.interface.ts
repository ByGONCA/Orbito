import type {
  CLIProvider,
  CLIInstallationStatus,
  CLIAuthStatus,
  CLICapabilities
} from '../../shared/cli';

export interface CommandSpec {
  executable: string;
  args: string[];
  env?: Record<string, string>;
}

export interface InteractiveLaunchSpec {
  executable: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface ICLIAdapter {
  readonly provider: CLIProvider;
  readonly capabilities: CLICapabilities;
  readonly name: string;
  readonly installGuideUrl: string;
  readonly installCommand?: string;
  detect(customPath?: string): Promise<CLIInstallationStatus>;
  checkAuth(resolvedPath: string): Promise<CLIAuthStatus>;
  buildCommand(prompt: string, workingDirectory: string, resumeSessionId?: string): CommandSpec;
  getInteractiveLaunchSpec?(options: {
    workingDirectory: string;
    customPath?: string;
    model?: string;
    extraArgs?: string[];
  }): Promise<{ success: true; spec: InteractiveLaunchSpec } | { success: false; error: string; installGuideUrl?: string; installCommand?: string }>;
}
