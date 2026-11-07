import type {
  CLIProvider,
  CLIInstallationStatus,
  CLIAuthStatus
} from '../../shared/cli';
import type { ICLIAdapter } from './adapter.interface';
import {
  claudeCodeAdapter,
  codexAdapter,
  geminiAdapter,
  ollamaAdapter,
  antigravityAdapter,
  aiderAdapter,
  ampAdapter,
  anteAdapter,
  auggieAdapter,
  clineAdapter,
  codebuddyAdapter,
  codebuffAdapter,
  continueAdapter,
  crushAdapter,
  cursorAdapter,
  devinAdapter,
  droidAdapter,
  copilotAdapter,
  gooseAdapter,
  hermesAdapter,
  kilocodeAdapter,
  kimiAdapter,
  kiroAdapter,
  vibeAdapter,
  opencodeAdapter,
  openhandsAdapter,
  piAdapter,
  qwenAdapter,
  roocodeAdapter,
  rovoAdapter,
  traeAdapter,
  zedAdapter
} from './adapters';

export class CLIManager {
  private adapters: Map<CLIProvider, ICLIAdapter> = new Map();

  constructor() {
    // 1. Existing baseline adapters
    this.registerAdapter(claudeCodeAdapter);
    this.registerAdapter(codexAdapter);
    this.registerAdapter(geminiAdapter);
    this.registerAdapter(ollamaAdapter);

    // 2. Full 30 Integration Targets
    this.registerAdapter(aiderAdapter);
    this.registerAdapter(ampAdapter);
    this.registerAdapter(anteAdapter);
    this.registerAdapter(auggieAdapter);
    this.registerAdapter(clineAdapter);
    this.registerAdapter(codebuddyAdapter);
    this.registerAdapter(codebuffAdapter);
    this.registerAdapter(continueAdapter);
    this.registerAdapter(crushAdapter);
    this.registerAdapter(cursorAdapter);
    this.registerAdapter(devinAdapter);
    this.registerAdapter(droidAdapter);
    this.registerAdapter(copilotAdapter);
    this.registerAdapter(gooseAdapter);
    this.registerAdapter(hermesAdapter);
    this.registerAdapter(kilocodeAdapter);
    this.registerAdapter(kimiAdapter);
    this.registerAdapter(kiroAdapter);
    this.registerAdapter(vibeAdapter);
    this.registerAdapter(opencodeAdapter);
    this.registerAdapter(openhandsAdapter);
    this.registerAdapter(piAdapter);
    this.registerAdapter(qwenAdapter);
    this.registerAdapter(roocodeAdapter);
    this.registerAdapter(rovoAdapter);
    this.registerAdapter(traeAdapter);
    this.registerAdapter(zedAdapter);
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

  public getAllAdapters(): ICLIAdapter[] {
    return Array.from(this.adapters.values());
  }

  public listAllProviders(): CLIProvider[] {
    return Array.from(this.adapters.keys());
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
        details: `${provider} CLI binary is not installed`
      };
    }

    return await adapter.checkAuth(detection.resolvedPath);
  }
}

export const cliManager = new CLIManager();
