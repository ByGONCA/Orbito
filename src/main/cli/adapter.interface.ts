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

export interface ICLIAdapter {
  readonly provider: CLIProvider;
  readonly capabilities: CLICapabilities;
  detect(customPath?: string): Promise<CLIInstallationStatus>;
  checkAuth(resolvedPath: string): Promise<CLIAuthStatus>;
  buildCommand(prompt: string, workingDirectory: string, resumeSessionId?: string): CommandSpec;
}
