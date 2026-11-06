import type {
  CLIProvider,
  CLIInstallationStatus,
  CLIAuthStatus
} from '../../shared/cli';
import type { ICLIAdapter } from './adapter.interface';
import { claudeCodeAdapter } from './adapters/claude-code.adapter';
import { codexAdapter } from './adapters/codex.adapter';
import { geminiAdapter } from './adapters/gemini.adapter';
import { ollamaAdapter } from './adapters/ollama.adapter';

export class CLIManager {
  private adapters: Map<CLIProvider, ICLIAdapter> = new Map();

  constructor() {
    this.registerAdapter(claudeCodeAdapter);
    this.registerAdapter(codexAdapter);
    this.registerAdapter(geminiAdapter);
    this.registerAdapter(ollamaAdapter);
  }

  public registerAdapter(adapter: ICLIAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  public getAdapter(provider: CLIProvider): ICLIAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Unsupported or unregistered CLI provider: '${provider}'`);
    }
    return adapter;
  }

  public async detectAll(customPaths?: Record<string, string>): Promise<Record<CLIProvider, CLIInstallationStatus>> {
    const results = {} as Record<CLIProvider, CLIInstallationStatus>;

    for (const [provider, adapter] of this.adapters.entries()) {
      const customPath = customPaths ? customPaths[provider] : undefined;
      results[provider] = await adapter.detect(customPath);
    }

    return results;
  }

  public async checkAuth(provider: CLIProvider, customPath?: string): Promise<CLIAuthStatus> {
    if (['powershell', 'cmd', 'bash'].includes(provider)) {
      return {
        provider,
        state: 'authenticated',
        isAuthenticated: true,
        authType: 'oauth',
        details: 'Native system shell ready'
      };
    }

    const adapter = this.getAdapter(provider);
    const detection = await adapter.detect(customPath);

    if (!detection.isInstalled || !detection.resolvedPath) {
      return {
        provider,
        state: 'not_installed',
        isAuthenticated: false,
        authType: 'missing',
        details: 'CLI binary is not installed'
      };
    }

    return await adapter.checkAuth(detection.resolvedPath);
  }
}

export const cliManager = new CLIManager();
