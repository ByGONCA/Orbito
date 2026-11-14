import { EventEmitter } from 'node:events';
import os from 'node:os';

export interface ResourcePressureSnapshot {
  heapUsedMb: number;
  heapTotalMb: number;
  heapLimitMb: number;
  systemFreeMemoryMb: number;
  systemTotalMemoryMb: number;
  memoryPressureRatio: number;
  isUnderPressure: boolean;
  activeBackgroundTasks: number;
  timestamp: number;
}

export class ResourceGovernorService extends EventEmitter {
  private isUnderPressure = false;
  private activeBackgroundTasks = 0;
  private maxConcurrentBackgroundTasks = 2;
  private memoryPressureThreshold = 0.85; // 85% heap usage triggers throttling
  private recoveryThreshold = 0.75; // 75% heap usage restores normal operation
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  public initialize(checkIntervalMs = 5000): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    this.monitorInterval = setInterval(() => {
      this.evaluateResourcePressure();
    }, checkIntervalMs);
  }

  public shutdown(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  public evaluateResourcePressure(): ResourcePressureSnapshot {
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / (1024 * 1024));
    const heapTotalMb = Math.round(mem.heapTotal / (1024 * 1024));
    // Default V8 heap limit is typically around 2GB or 4GB on 64-bit
    const heapLimitMb = Math.round((mem as any).heapLimit ? (mem as any).heapLimit / (1024 * 1024) : heapTotalMb * 1.5);
    const systemFreeMemoryMb = Math.round(os.freemem() / (1024 * 1024));
    const systemTotalMemoryMb = Math.round(os.totalmem() / (1024 * 1024));

    const memoryPressureRatio = heapTotalMb > 0 ? heapUsedMb / heapTotalMb : 0;
    const previouslyUnderPressure = this.isUnderPressure;

    if (memoryPressureRatio >= this.memoryPressureThreshold || systemFreeMemoryMb < 256) {
      this.isUnderPressure = true;
      if (!previouslyUnderPressure) {
        this.emit('pressure', {
          reason: `High memory pressure (${Math.round(memoryPressureRatio * 100)}% heap used, ${systemFreeMemoryMb}MB system RAM free). Background analysis throttled.`,
          snapshot: { heapUsedMb, memoryPressureRatio }
        });
      }
    } else if (memoryPressureRatio <= this.recoveryThreshold && systemFreeMemoryMb > 512) {
      this.isUnderPressure = false;
      if (previouslyUnderPressure) {
        this.emit('recovered', {
          reason: `Resource pressure relieved (${Math.round(memoryPressureRatio * 100)}% heap used). Normal scheduling resumed.`,
          snapshot: { heapUsedMb, memoryPressureRatio }
        });
      }
    }

    return {
      heapUsedMb,
      heapTotalMb,
      heapLimitMb,
      systemFreeMemoryMb,
      systemTotalMemoryMb,
      memoryPressureRatio: Math.round(memoryPressureRatio * 100) / 100,
      isUnderPressure: this.isUnderPressure,
      activeBackgroundTasks: this.activeBackgroundTasks,
      timestamp: Date.now()
    };
  }

  public shouldAcceptBackgroundWork(): boolean {
    if (this.isUnderPressure) return false;
    return this.activeBackgroundTasks < this.maxConcurrentBackgroundTasks;
  }

  public acquireBackgroundTaskSlot(): boolean {
    if (!this.shouldAcceptBackgroundWork()) return false;
    this.activeBackgroundTasks++;
    return true;
  }

  public releaseBackgroundTaskSlot(): void {
    if (this.activeBackgroundTasks > 0) {
      this.activeBackgroundTasks--;
    }
  }

  public setSimulatedPressure(underPressure: boolean): void {
    this.isUnderPressure = underPressure;
    if (underPressure) {
      this.emit('pressure', { reason: 'Simulated resource pressure trigger' });
    } else {
      this.emit('recovered', { reason: 'Simulated resource pressure cleared' });
    }
  }

  public getMemorySnapshot(): ResourcePressureSnapshot & { isUnderMemoryPressure: boolean } {
    const snap = this.evaluateResourcePressure();
    return {
      ...snap,
      isUnderMemoryPressure: snap.isUnderPressure
    };
  }

  public getConfig(): { memoryHighWatermarkRatio: number; memoryRecoveryWatermarkRatio: number; maxConcurrentBackgroundTasks: number } {
    return {
      memoryHighWatermarkRatio: this.memoryPressureThreshold,
      memoryRecoveryWatermarkRatio: this.recoveryThreshold,
      maxConcurrentBackgroundTasks: this.maxConcurrentBackgroundTasks
    };
  }
}

export const resourceGovernorService = new ResourceGovernorService();
