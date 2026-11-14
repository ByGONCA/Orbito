import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type {
  AppLifecycleState,
  LifecycleHealthStatus,
  CrashReport,
  RecoveryIncident
} from '../../shared/lifecycle';
import { SecretRedactor } from '../mcp/security/secret-redactor';

export class LifecycleCoordinatorService extends EventEmitter {
  private state: AppLifecycleState = 'initializing';
  private bootTimestamp: number = Date.now();
  private lastCleanShutdownAt: number | null = null;
  private degradedReason?: string;
  private storageDir: string = path.join(process.cwd(), '.ai-workspace-data');
  private crashLogPath: string = '';
  private cleanShutdownMarkerPath: string = '';
  private shutdownCallbacks: Array<() => Promise<void> | void> = [];
  private recentCrashes: CrashReport[] = [];
  private activeTaskCount: number = 0;
  private isShuttingDown: boolean = false;
  // Authoritative Atomic Maintenance Gate
  private isMaintenanceMode: boolean = false;
  private maintenanceReason?: string;
  private maintenanceStartedAt?: number;
  private activeOperations: Map<string, { type: string; id: string; startedAt: number }> = new Map();

  private incidents: Map<string, RecoveryIncident> = new Map();

  constructor() {
    super();
  }

  public initialize(storageDir?: string): LifecycleHealthStatus & { recoveryRequired: boolean } {
    if (storageDir) {
      this.storageDir = storageDir;
    }
    const logsDir = path.join(this.storageDir, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.crashLogPath = path.join(logsDir, 'crash.log');
    this.cleanShutdownMarkerPath = path.join(this.storageDir, '.clean_shutdown');

    // 1. Inspect previous shutdown state
    const cleanShutdownExists = fs.existsSync(this.cleanShutdownMarkerPath);
    let recoveryRequired = false;

    if (cleanShutdownExists) {
      try {
        const content = fs.readFileSync(this.cleanShutdownMarkerPath, 'utf8');
        const parsed = JSON.parse(content);
        this.lastCleanShutdownAt = parsed.timestamp || null;
        fs.unlinkSync(this.cleanShutdownMarkerPath);
      } catch {
        this.lastCleanShutdownAt = Date.now() - 3600000;
      }
    } else {
      // Unclean shutdown detected from previous run
      this.lastCleanShutdownAt = null;
      recoveryRequired = true;
      const incidentId = `unclean-shutdown-${Date.now()}`;
      this.incidents.set(incidentId, {
        id: incidentId,
        type: 'unclean_shutdown',
        title: 'Unclean Application Shutdown Detected',
        description: 'Orbito was terminated unexpectedly without running the graceful shutdown lifecycle.',
        severity: 'medium',
        timestamp: Date.now(),
        suggestedAction: 'Dismiss incident if projects and worktrees are consistent.',
        isDestructive: false
      });
      this.recordCrash({
        timestamp: Date.now(),
        reason: 'Application terminated unexpectedly or ungracefully in previous session.',
        source: 'main',
        recovered: false
      });
    }

    this.loadRecentCrashes();

    this.state = recoveryRequired ? 'ready' : 'initializing';
    this.emit('stateChanged', this.state);

    return {
      ...this.getHealthStatus(),
      recoveryRequired
    };
  }

  // ==========================================
  // Maintenance Gate API
  // ==========================================

  public enterMaintenanceMode(reason: string): void {
    this.isMaintenanceMode = true;
    this.maintenanceReason = reason;
    this.maintenanceStartedAt = Date.now();
    this.emit('maintenanceModeChanged', { isMaintenanceMode: true, reason });
  }

  public exitMaintenanceMode(): void {
    this.isMaintenanceMode = false;
    this.maintenanceReason = undefined;
    this.maintenanceStartedAt = undefined;
    this.emit('maintenanceModeChanged', { isMaintenanceMode: false });
  }

  public isMaintenanceActive(): boolean {
    return this.isMaintenanceMode;
  }

  public getMaintenanceStatus(): {
    isMaintenanceMode: boolean;
    maintenanceReason?: string;
    maintenanceStartedAt?: number;
    activeOperationsCount: number;
    canProceed: boolean;
  } {
    return {
      isMaintenanceMode: this.isMaintenanceMode,
      maintenanceReason: this.maintenanceReason,
      maintenanceStartedAt: this.maintenanceStartedAt,
      activeOperationsCount: this.activeOperations.size,
      canProceed: this.isMaintenanceMode && this.activeOperations.size === 0
    };
  }

  public trackOperationStart(type: string, id: string): void {
    if (this.isMaintenanceMode) {
      throw new Error(
        `Operation [${type}:${id}] rejected: Application is currently in maintenance mode (${this.maintenanceReason || 'system update in progress'}).`
      );
    }
    this.activeOperations.set(id, { type, id, startedAt: Date.now() });
    this.activeTaskCount = this.activeOperations.size;
  }

  public trackOperationEnd(id: string): void {
    this.activeOperations.delete(id);
    this.activeTaskCount = this.activeOperations.size;
  }

  public async waitForMaintenanceGate(timeoutMs = 15000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (this.activeOperations.size === 0) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return this.activeOperations.size === 0;
  }

  public setReady(): void {
    if (this.state === 'shutting_down' || this.state === 'terminated') return;
    this.state = 'ready';
    this.degradedReason = undefined;
    this.emit('stateChanged', this.state);
  }

  public setDegraded(reason: string): void {
    if (this.state === 'shutting_down' || this.state === 'terminated') return;
    this.state = 'degraded';
    this.degradedReason = reason;
    this.emit('stateChanged', this.state);
  }

  public getState(): AppLifecycleState {
    return this.state;
  }

  public isAcceptingWork(): boolean {
    return this.state === 'ready' || this.state === 'degraded';
  }

  public trackTaskStart(): void {
    this.activeTaskCount++;
  }

  public trackTaskEnd(): void {
    if (this.activeTaskCount > 0) this.activeTaskCount--;
  }

  public registerShutdownCallback(cb: () => Promise<void> | void): void {
    this.shutdownCallbacks.push(cb);
  }

  /**
   * Records a crash safely to disk with secret redaction.
   */
  public recordCrash(report: CrashReport): void {
    const redactedReason = SecretRedactor.redactText(report.reason || '');
    const redactedDetails = report.details ? SecretRedactor.redactText(report.details) : undefined;
    const entry: CrashReport = {
      ...report,
      reason: redactedReason,
      details: redactedDetails
    };

    this.recentCrashes.unshift(entry);
    if (this.recentCrashes.length > 20) {
      this.recentCrashes.pop();
    }

    try {
      if (this.crashLogPath) {
        fs.appendFileSync(this.crashLogPath, JSON.stringify(entry) + '\n', 'utf8');
      }
    } catch {}

    this.emit('crashRecorded', entry);
  }

  private loadRecentCrashes(): void {
    if (!this.crashLogPath || !fs.existsSync(this.crashLogPath)) return;
    try {
      const lines = fs.readFileSync(this.crashLogPath, 'utf8').split('\n').filter(Boolean);
      for (const line of lines.slice(-20)) {
        try {
          this.recentCrashes.push(JSON.parse(line));
        } catch {}
      }
      this.recentCrashes.reverse();
    } catch {}
  }

  public recordGracefulShutdown(): void {
    try {
      if (this.cleanShutdownMarkerPath) {
        fs.writeFileSync(
          this.cleanShutdownMarkerPath,
          JSON.stringify({ timestamp: Date.now(), version: '0.1.0' }),
          'utf8'
        );
      }
    } catch {}
    this.state = 'terminated';
    this.emit('stateChanged', this.state);
  }

  /**
   * Executes bounded graceful shutdown sequence.
   */
  public async executeGracefulShutdown(
    timeoutMs = 5000,
    extraCallbacks?: Array<() => Promise<void> | void>
  ): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    this.state = 'shutting_down';
    this.emit('stateChanged', this.state);

    const allCallbacks = [...this.shutdownCallbacks, ...(extraCallbacks || [])];

    const shutdownPromise = (async () => {
      for (const cb of allCallbacks) {
        try {
          await cb();
        } catch (err: any) {
          console.error('[LifecycleCoordinator] Error during shutdown callback:', err?.message || err);
        }
      }
    })();

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.warn(`[LifecycleCoordinator] Graceful shutdown exceeded ${timeoutMs}ms timeout. Forcing termination.`);
        resolve();
      }, timeoutMs);
    });

    await Promise.race([shutdownPromise, timeoutPromise]);

    this.recordGracefulShutdown();
  }

  public getStatus(): LifecycleHealthStatus {
    return this.getHealthStatus();
  }

  public getIncidents(): RecoveryIncident[] {
    return Array.from(this.incidents.values());
  }

  public registerIncident(incident: RecoveryIncident): void {
    this.incidents.set(incident.id, incident);
    this.emit('incidentRegistered', incident);
  }

  public resolveIncident(incidentId: string, action: string, confirmed = false): { success: boolean; result?: string } {
    if (!this.incidents.has(incidentId)) {
      return { success: false, result: 'Incident not found' };
    }
    this.incidents.delete(incidentId);
    return { success: true, result: `Incident ${incidentId} resolved via ${action}` };
  }

  public getHealthStatus(): LifecycleHealthStatus {
    return {
      state: this.state,
      uptimeSeconds: Math.round((Date.now() - this.bootTimestamp) / 1000),
      bootTimestamp: this.bootTimestamp,
      lastCleanShutdownAt: this.lastCleanShutdownAt,
      degradedReason: this.degradedReason,
      activeTasksCount: this.activeTaskCount,
      recentCrashes: this.recentCrashes.slice(0, 5),
      isRecoveryRequired: this.state === 'recovery_required'
    };
  }
}

export const lifecycleCoordinatorService = new LifecycleCoordinatorService();
