import type { AirGapConfig } from '../../shared/analytics';
import type { CLIProvider } from '../../shared/cli';
import { databaseService } from '../db/database.service';
import { auditService } from './audit.service';

export class AirGapViolationException extends Error {
  constructor(message: string) {
    super(`[AirGapViolation] ${message}`);
    this.name = 'AirGapViolationException';
  }
}

export class AirGapManager {
  private config: AirGapConfig;

  constructor() {
    this.config = {
      enabled: false,
      allowedHosts: ['127.0.0.1', 'localhost', '::1'],
      blockExternalNetwork: true,
      enforceLocalModels: true,
      defaultLocalModel: 'llama3:latest',
      localOllamaUrl: 'http://127.0.0.1:11434'
    };
    if (databaseService.isInitialized()) {
      try {
        this.config = databaseService.getAirGapConfig();
      } catch {
        // Safe default
      }
    }
  }

  public getConfig(): AirGapConfig {
    if (databaseService.isInitialized()) {
      try {
        this.config = databaseService.getAirGapConfig();
      } catch {
        // Fallback to in-memory config
      }
    }
    return { ...this.config };
  }

  public isAirGapEnabled(): boolean {
    return this.config.enabled;
  }

  public updateConfig(updates: Partial<AirGapConfig>): AirGapConfig {
    const prevEnabled = this.config.enabled;
    this.config = {
      ...this.config,
      ...updates
    };

    if (databaseService.isInitialized()) {
      try {
        databaseService.setAirGapConfig(this.config);
      } catch {
        // Ignored
      }
    }

    if (prevEnabled !== this.config.enabled) {
      auditService.log({
        eventType: 'airgap_state_changed',
        severity: 'info',
        actor: 'user',
        action: this.config.enabled ? 'enable_airgap' : 'disable_airgap',
        details: { config: this.config }
      });
    }

    return this.getConfig();
  }

  /**
   * Asserts whether a network destination is permitted.
   * If Air-Gap mode is enabled, outbound egress outside allowed local hosts is rejected.
   */
  public assertNetworkAllowed(targetUrl: string, actor: string = 'system'): void {
    if (!this.config.enabled) {
      return;
    }

    let hostname = '';
    try {
      const parsed = new URL(targetUrl.includes('://') ? targetUrl : `http://${targetUrl}`);
      hostname = parsed.hostname;
    } catch {
      hostname = targetUrl;
    }

    // Strip IPv6 brackets if present e.g. [::1] -> ::1
    const cleanHost = hostname.replace(/^\[|\]$/g, '').toLowerCase();

    // Check against allowed loopback addresses or custom allowed hosts
    const isLoopback =
      cleanHost === 'localhost' ||
      cleanHost === '127.0.0.1' ||
      cleanHost.startsWith('127.') ||
      cleanHost === '::1' ||
      cleanHost === '0:0:0:0:0:0:0:1' ||
      cleanHost === '0.0.0.0';

    const isAllowed =
      isLoopback ||
      this.config.allowedHosts.some((h) => {
        const cleanAllowed = h.replace(/^\[|\]$/g, '').toLowerCase();
        return cleanAllowed === cleanHost;
      });

    if (!isAllowed) {
      const err = `Outbound network egress to '${cleanHost}' rejected: Air-Gap isolation mode is active.`;
      auditService.logSecurityViolation(actor, 'network_egress_blocked', err, targetUrl, undefined, {
        hostname: cleanHost,
        targetUrl
      });
      throw new AirGapViolationException(err);
    }
  }

  /**
   * Provides hardened environment variables for child processes when Air-Gap is active.
   * Sets dead-end localhost proxies and offline flags to prevent tools/CLIs from egressing.
   */
  public getChildProcessEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    if (!this.config.enabled) {
      return { ...baseEnv };
    }

    return {
      ...baseEnv,
      HTTP_PROXY: 'http://127.0.0.1:0',
      HTTPS_PROXY: 'http://127.0.0.1:0',
      ALL_PROXY: 'http://127.0.0.1:0',
      http_proxy: 'http://127.0.0.1:0',
      https_proxy: 'http://127.0.0.1:0',
      all_proxy: 'http://127.0.0.1:0',
      NO_PROXY: 'localhost,127.0.0.1,::1',
      no_proxy: 'localhost,127.0.0.1,::1',
      npm_config_offline: 'true',
      PIP_NO_INDEX: 'true',
      AIR_GAP_MODE: 'true'
    };
  }

  /**
   * Resolves the provider to use.
   * If Air-Gap is active and a cloud provider is requested:
   * - If enforceLocalModels is active, seamlessly routes to 'ollama'.
   * - Otherwise throws AirGapViolationException.
   */
  public resolveProvider(requestedProvider: CLIProvider): CLIProvider {
    if (!this.config.enabled) {
      return requestedProvider;
    }

    if (requestedProvider === 'ollama') {
      return 'ollama';
    }

    if (this.config.enforceLocalModels) {
      auditService.log({
        eventType: 'airgap_provider_rerouted',
        severity: 'info',
        actor: 'airgap_engine',
        action: 'reroute_to_local_model',
        details: {
          originalProvider: requestedProvider,
          resolvedProvider: 'ollama',
          model: this.config.defaultLocalModel
        }
      });
      return 'ollama';
    }

    const err = `Cloud CLI provider '${requestedProvider}' cannot be invoked while Air-Gap mode is enabled.`;
    auditService.logSecurityViolation('airgap_engine', 'cloud_provider_blocked', err);
    throw new AirGapViolationException(err);
  }
}

export const airGapManager = new AirGapManager();
