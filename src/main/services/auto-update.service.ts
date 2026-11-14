import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { app } from 'electron';
import type {
  ReleaseChannel,
  UpdateState,
  UpdateInfo,
  UpdateProgress,
  CheckUpdateResult,
  InstallUpdateResult
} from '../../shared/update';
import { databaseService } from '../db/database.service';
import { lifecycleCoordinatorService } from './lifecycle-coordinator.service';

export interface AutoUpdateConfig {
  channel: ReleaseChannel;
  updateUrl?: string;
  autoCheckOnStartup: boolean;
  stagingDir?: string;
}

export class AutoUpdateService {
  private state: UpdateState = 'idle';
  private config: AutoUpdateConfig;
  private currentVersion: string;
  private stagedUpdatePath: string | null = null;
  private stagedUpdateInfo: UpdateInfo | null = null;
  private progressCallback: ((progress: UpdateProgress) => void) | null = null;

  constructor(customConfig?: Partial<AutoUpdateConfig>, currentVersion?: string) {
    this.currentVersion = currentVersion || (app?.getVersion ? app.getVersion() : '0.1.0');
    this.config = {
      channel: 'stable',
      updateUrl: 'https://api.github.com/repos/orbito/orbito/releases',
      autoCheckOnStartup: false,
      ...customConfig
    };
  }

  public getState(): UpdateState {
    return this.state;
  }

  public getStagedUpdate(): { path: string | null; info: UpdateInfo | null } {
    return {
      path: this.stagedUpdatePath,
      info: this.stagedUpdateInfo
    };
  }

  public isPortable(): boolean {
    return Boolean(
      process.env.PORTABLE_EXECUTABLE_DIR ||
      process.env.PORTABLE_EXECUTABLE_FILE ||
      (process.platform === 'win32' && process.env.ORBITO_PORTABLE === '1')
    );
  }

  public getStagingDirectory(): string {
    if (this.config.stagingDir) {
      if (!fs.existsSync(this.config.stagingDir)) {
        fs.mkdirSync(this.config.stagingDir, { recursive: true });
      }
      return this.config.stagingDir;
    }

    let baseDir: string;
    try {
      baseDir = app?.getPath ? app.getPath('userData') : os.tmpdir();
    } catch {
      baseDir = os.tmpdir();
    }

    const target = path.join(baseDir, 'orbito-updates');
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    return target;
  }

  public async checkForUpdates(channel?: ReleaseChannel): Promise<CheckUpdateResult> {
    const selectedChannel = channel || this.config.channel;
    this.state = 'checking';

    // 1. Air-gap policy enforcement
    if (this.isAirGapActive()) {
      this.state = 'blocked-by-air-gap';
      return {
        available: false,
        currentVersion: this.currentVersion,
        blockedByAirGap: true,
        error: 'External network updates are blocked under active air-gap policy.'
      };
    }

    // 2. Query update endpoint
    try {
      const endpoint = this.resolveUpdateEndpoint(selectedChannel);
      const manifest = await this.fetchManifest(endpoint);

      if (!manifest || !manifest.version) {
        this.state = 'error';
        return {
          available: false,
          currentVersion: this.currentVersion,
          error: 'Invalid or malformed update manifest received from update server.'
        };
      }

      const comparison = this.compareSemver(manifest.version, this.currentVersion);
      if (comparison > 0) {
        this.state = 'available';
        const isPortableBuild = this.isPortable();
        const updateInfo: UpdateInfo = {
          version: manifest.version,
          releaseDate: manifest.releaseDate || new Date().toISOString(),
          releaseNotes: manifest.releaseNotes || `Orbito version ${manifest.version}`,
          channel: selectedChannel,
          sha256: manifest.sha256,
          downloadUrl: manifest.downloadUrl,
          fileName: manifest.fileName || `Orbito-Setup-${manifest.version}.exe`,
          fileSize: manifest.fileSize,
          isPortable: isPortableBuild
        };

        return {
          available: true,
          currentVersion: this.currentVersion,
          latestVersion: manifest.version,
          updateInfo
        };
      }

      this.state = 'not-available';
      return {
        available: false,
        currentVersion: this.currentVersion,
        latestVersion: manifest.version
      };
    } catch (err: any) {
      this.state = 'error';
      return {
        available: false,
        currentVersion: this.currentVersion,
        error: `Failed to check for updates: ${err.message || 'Network unreachable'}`
      };
    }
  }

  public async downloadUpdate(
    updateInfo: UpdateInfo,
    onProgress?: (progress: UpdateProgress) => void
  ): Promise<{ success: boolean; stagedPath?: string; error?: string }> {
    if (this.isAirGapActive()) {
      this.state = 'blocked-by-air-gap';
      return {
        success: false,
        error: 'Cannot download updates while air-gap policy is enabled.'
      };
    }

    if (!updateInfo.downloadUrl) {
      this.state = 'error';
      return {
        success: false,
        error: 'No download URL provided in update specification.'
      };
    }

    this.state = 'downloading';
    this.progressCallback = onProgress || null;

    const stagingDir = this.getStagingDirectory();
    const fileName = updateInfo.fileName || `Orbito-${updateInfo.version}-installer.exe`;
    const targetPath = path.join(stagingDir, fileName);
    const partialPath = `${targetPath}.part`;

    try {
      if (fs.existsSync(partialPath)) {
        fs.unlinkSync(partialPath);
      }

      await this.streamDownload(updateInfo.downloadUrl, partialPath, (progress) => {
        if (this.progressCallback) {
          this.progressCallback(progress);
        }
      });

      // Verify SHA256 integrity if provided
      if (updateInfo.sha256) {
        const computedHash = await this.computeFileSha256(partialPath);
        if (computedHash.toLowerCase() !== updateInfo.sha256.toLowerCase()) {
          fs.unlinkSync(partialPath);
          this.state = 'error';
          return {
            success: false,
            error: `Integrity check failed: expected ${updateInfo.sha256}, got ${computedHash}`
          };
        }
      }

      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      fs.renameSync(partialPath, targetPath);

      this.stagedUpdatePath = targetPath;
      this.stagedUpdateInfo = updateInfo;
      this.state = 'downloaded';

      return {
        success: true,
        stagedPath: targetPath
      };
    } catch (err: any) {
      this.state = 'error';
      if (fs.existsSync(partialPath)) {
        try { fs.unlinkSync(partialPath); } catch {}
      }
      return {
        success: false,
        error: `Download failed: ${err.message || 'Stream interrupted'}`
      };
    }
  }

  public async installUpdate(options: { restartImmediately?: boolean } = {}): Promise<InstallUpdateResult> {
    // Safety check: Never disrupt active AI sessions or running orchestrations
        // Enter authoritative Maintenance Gate: blocks any new operations from starting
    lifecycleCoordinatorService.enterMaintenanceMode('Orbito update installation');

    // Wait up to 8000ms for active operations to drain
    const drained = await lifecycleCoordinatorService.waitForMaintenanceGate(8000);
    const activeTasks = this.countActiveSessions() + lifecycleCoordinatorService.getMaintenanceStatus().activeOperationsCount;

    if (!drained || activeTasks > 0) {
      lifecycleCoordinatorService.exitMaintenanceMode();
      return {
        success: false,
        message: `Cannot apply update: ${activeTasks} active task(s) or orchestration(s) are currently in progress. Complete or pause active work first.`
      };
    }

    if (!this.stagedUpdatePath || !fs.existsSync(this.stagedUpdatePath)) {
      return {
        success: false,
        message: 'No verified update has been staged for installation.'
      };
    }

    const isPortableBuild = this.isPortable();

    // Portable executable handling
    if (isPortableBuild) {
      return {
        success: true,
        stagedPath: this.stagedUpdatePath,
        requiresManualRestart: true,
        message: 'Portable update ready. Replace the current executable with the downloaded file when Orbito is closed.'
      };
    }

    // Windows NSIS Installer execution
    try {
      const installerPath = this.stagedUpdatePath;
      const args = options.restartImmediately ? ['--updated', '/S'] : ['--updated'];

      const child = spawn(installerPath, args, {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();

      if (options.restartImmediately && app?.quit) {
        setTimeout(() => {
          app.quit();
        }, 1000);
      }

      return {
        success: true,
        stagedPath: installerPath,
        requiresManualRestart: !options.restartImmediately,
        message: options.restartImmediately
          ? 'Launching installer and restarting application.'
          : 'Installer launched in background.'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to spawn installer process: ${err.message}`
      };
    }
  }

  public cleanStaging(): void {
    try {
      const dir = this.getStagingDirectory();
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          try {
            fs.unlinkSync(path.join(dir, f));
          } catch {}
        }
      }
      this.stagedUpdatePath = null;
      this.stagedUpdateInfo = null;
      this.state = 'idle';
    } catch {}
  }

  private countActiveSessions(): number {
    try {
      if (!databaseService.isInitialized()) return 0;
      const running = databaseService.listOrchestrations(undefined, 50);
      return running.filter(
        (r) =>
          r.status === 'running' ||
          r.status === 'planning' ||
          r.status === 'waiting_approval' ||
          r.status === 'reviewing'
      ).length;
    } catch {
      return 0;
    }
  }

  private isAirGapActive(): boolean {
    try {
      if (databaseService.isInitialized()) {
        const config = databaseService.getAirGapConfig();
        return Boolean(config && config.enabled);
      }
    } catch {}
    return false;
  }

  private resolveUpdateEndpoint(channel: ReleaseChannel): string {
    const base = this.config.updateUrl || '';
    if (base.endsWith('/latest')) return base;
    if (channel === 'stable') {
      return base.endsWith('/') ? `${base}latest` : `${base}/latest`;
    }
    return base;
  }

  private async fetchManifest(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      const req = client.get(
        url,
        {
          headers: {
            'User-Agent': 'Orbito-AutoUpdater/0.1.0',
            Accept: 'application/vnd.github.v3+json, application/json'
          },
          timeout: 8000
        },
        (res) => {
          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            return reject(new Error(`Server returned HTTP ${res.statusCode}`));
          }
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              // Handle GitHub release JSON format if returned
              if (parsed.tag_name) {
                const version = parsed.tag_name.replace(/^v/, '');
                const asset = (parsed.assets || []).find((a: any) =>
                  a.name && (a.name.endsWith('.exe') || a.name.endsWith('.zip'))
                );
                return resolve({
                  version,
                  releaseDate: parsed.published_at,
                  releaseNotes: parsed.body,
                  downloadUrl: asset?.browser_download_url,
                  fileName: asset?.name,
                  fileSize: asset?.size
                });
              }
              resolve(parsed);
            } catch (e: any) {
              reject(new Error(`JSON parse error: ${e.message}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Update check request timed out after 8s'));
      });
      req.on('error', (err) => reject(err));
    });
  }

  private async streamDownload(
    url: string,
    destPath: string,
    onProgress: (p: UpdateProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      const file = fs.createWriteStream(destPath);
      let startTime = Date.now();
      let transferred = 0;
      let total = 0;

      const req = client.get(url, { timeout: 30000 }, (res) => {
        // Handle HTTP redirects (e.g. GitHub Releases 302 redirects to AWS S3)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          return this.streamDownload(res.headers.location, destPath, onProgress)
            .then(resolve)
            .catch(reject);
        }

        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          file.close();
          return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
        }

        total = parseInt(res.headers['content-length'] || '0', 10);

        res.on('data', (chunk) => {
          transferred += chunk.length;
          file.write(chunk);
          const elapsed = (Date.now() - startTime) / 1000;
          const bytesPerSecond = elapsed > 0 ? Math.round(transferred / elapsed) : 0;
          const percent = total > 0 ? Math.min(100, Math.round((transferred / total) * 100)) : 0;

          onProgress({
            percent,
            bytesPerSecond,
            transferred,
            total
          });
        });

        res.on('end', () => {
          file.end(() => resolve());
        });

        res.on('error', (err) => {
          file.close();
          reject(err);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        file.close();
        reject(new Error('Download connection timed out'));
      });

      req.on('error', (err) => {
        file.close();
        reject(err);
      });
    });
  }

  public computeFileSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (d) => hash.update(d));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (e) => reject(e));
    });
  }

  public compareSemver(v1: string, v2: string): number {
    const parse = (v: string) => {
      const clean = v.replace(/^v/, '').trim();
      const [main] = clean.split('-');
      const parts = main.split('.').map((n) => parseInt(n, 10) || 0);
      while (parts.length < 3) parts.push(0);
      return parts;
    };

    const p1 = parse(v1);
    const p2 = parse(v2);

    for (let i = 0; i < 3; i++) {
      if (p1[i] > p2[i]) return 1;
      if (p1[i] < p2[i]) return -1;
    }
    return 0;
  }
}

export const autoUpdateService = new AutoUpdateService();
