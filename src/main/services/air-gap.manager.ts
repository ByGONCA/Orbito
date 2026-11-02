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
      hostname = parsed.hostname.toLowerCase();
    } catch {
      hostname = targetUrl.toLowerCase();
    }

    const isAllowed = this.config.allowedHosts.some(
      (h) => h.toLowerCase() === hostname || hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1'
    );

    if (!isAllowed) {
      const err = `Outbound network egress to '${hostname}' rejected: Air-Gap isolation mode is active.`;
      auditService.logSecurityViolation(actor, 'network_egress_blocked', err, targetUrl, undefined, {
        hostname,
        targetUrl
      });
      throw new AirGapViolationException(err);
    }
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
