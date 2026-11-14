import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import { AutoUpdateService } from '../src/main/services/auto-update.service';
import { databaseService } from '../src/main/db/database.service';

describe('AutoUpdateService Quality & Security Suite', () => {
  let testDir: string;
  let mockServer: http.Server | null = null;
  let mockServerPort = 0;
  let mockManifestPayload: any = null;
  let mockDownloadPayload: Buffer | null = null;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbito-autoupdate-test-'));
    databaseService.initialize(testDir);

    // Setup local mock HTTP server for reproducible offline testing
    await new Promise<void>((resolve) => {
      mockServer = http.createServer((req, res) => {
        if (req.url === '/releases/latest') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(mockManifestPayload));
        } else if (req.url?.startsWith('/download/')) {
          if (!mockDownloadPayload) {
            res.writeHead(404);
            res.end();
            return;
          }
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': mockDownloadPayload.length
          });
          res.end(mockDownloadPayload);
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      mockServer.listen(0, '127.0.0.1', () => {
        const addr = mockServer?.address() as any;
        mockServerPort = addr.port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    databaseService.close();
    if (mockServer) {
      await new Promise<void>((resolve) => mockServer!.close(() => resolve()));
    }
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. correctly compares semantic versions across channels and prefixes', () => {
    const service = new AutoUpdateService({}, '0.1.0');

    expect(service.compareSemver('0.1.1', '0.1.0')).toBe(1);
    expect(service.compareSemver('0.2.0', '0.1.0')).toBe(1);
    expect(service.compareSemver('1.0.0', '0.9.9')).toBe(1);
    expect(service.compareSemver('v0.1.0', '0.1.0')).toBe(0);
    expect(service.compareSemver('0.1.0', '0.2.0')).toBe(-1);
    expect(service.compareSemver('0.0.9', '0.1.0')).toBe(-1);
  });

  it('2. blocks update checking when air-gap security policy is enabled', async () => {
    databaseService.setAirGapConfig({
      enabled: true,
      allowedHosts: ['127.0.0.1'],
      blockExternalNetwork: true,
      enforceLocalModels: true,
      defaultLocalModel: 'llama3',
      localOllamaUrl: 'http://127.0.0.1:11434'
    });

    const service = new AutoUpdateService({
      updateUrl: `http://127.0.0.1:${mockServerPort}/releases/latest`,
      stagingDir: path.join(testDir, 'staging')
    }, '0.1.0');

    const result = await service.checkForUpdates();
    expect(result.available).toBe(false);
    expect(result.blockedByAirGap).toBe(true);
    expect(service.getState()).toBe('blocked-by-air-gap');
  });

  it('3. identifies available update and populates verified metadata', async () => {
    mockDownloadPayload = Buffer.from('MZ-SIMULATED-EXE-BINARY-CONTENT-ORBITO');
    const binaryHash = crypto.createHash('sha256').update(mockDownloadPayload).digest('hex');

    mockManifestPayload = {
      tag_name: 'v0.2.0',
      published_at: '2026-11-14T00:00:00Z',
      body: 'Orbito v0.2.0 release notes with major performance improvements.',
      assets: [
        {
          name: 'Orbito-Setup-0.2.0.exe',
          browser_download_url: `http://127.0.0.1:${mockServerPort}/download/Orbito-Setup-0.2.0.exe`,
          size: mockDownloadPayload.length
        }
      ]
    };

    const service = new AutoUpdateService({
      updateUrl: `http://127.0.0.1:${mockServerPort}/releases`,
      stagingDir: path.join(testDir, 'staging')
    }, '0.1.0');

    const check = await service.checkForUpdates();
    expect(check.available).toBe(true);
    expect(check.latestVersion).toBe('0.2.0');
    expect(check.updateInfo).toBeDefined();
    expect(check.updateInfo?.downloadUrl).toContain('/download/Orbito-Setup-0.2.0.exe');
    expect(check.updateInfo?.fileName).toBe('Orbito-Setup-0.2.0.exe');
  });

  it('4. downloads update, tracks progress and verifies SHA-256 integrity', async () => {
    mockDownloadPayload = Buffer.from('VALID-ORBITO-INSTALLER-BINARY-CONTENT-PAYLOAD');
    const validHash = crypto.createHash('sha256').update(mockDownloadPayload).digest('hex');

    const stagingDir = path.join(testDir, 'staging');
    const service = new AutoUpdateService({ stagingDir }, '0.1.0');

    const progressReports: number[] = [];
    const downloadResult = await service.downloadUpdate(
      {
        version: '0.2.0',
        channel: 'stable',
        downloadUrl: `http://127.0.0.1:${mockServerPort}/download/valid.exe`,
        fileName: 'Orbito-Setup-0.2.0.exe',
        sha256: validHash
      },
      (p) => progressReports.push(p.percent)
    );

    expect(downloadResult.success).toBe(true);
    expect(downloadResult.stagedPath).toBeDefined();
    expect(fs.existsSync(downloadResult.stagedPath!)).toBe(true);
    expect(service.getState()).toBe('downloaded');
    expect(progressReports.length).toBeGreaterThan(0);
    expect(progressReports[progressReports.length - 1]).toBe(100);
  });

  it('5. rejects corrupted download with SHA-256 mismatch and purges staged file', async () => {
    mockDownloadPayload = Buffer.from('TAMPERED-OR-CORRUPTED-EXE-DATA');
    const expectedLegitHash = '0000000000000000000000000000000000000000000000000000000000000000';

    const stagingDir = path.join(testDir, 'staging');
    const service = new AutoUpdateService({ stagingDir }, '0.1.0');

    const downloadResult = await service.downloadUpdate({
      version: '0.2.0',
      channel: 'stable',
      downloadUrl: `http://127.0.0.1:${mockServerPort}/download/tampered.exe`,
      fileName: 'Orbito-Tampered.exe',
      sha256: expectedLegitHash
    });

    expect(downloadResult.success).toBe(false);
    expect(downloadResult.error).toContain('Integrity check failed');
    expect(service.getState()).toBe('error');
    // Verify bad staged file was deleted
    expect(fs.existsSync(path.join(stagingDir, 'Orbito-Tampered.exe'))).toBe(false);
  });

  it('6. prevents installUpdate if active orchestration session is in progress', async () => {
    // Stage a dummy downloaded installer
    const stagingDir = path.join(testDir, 'staging');
    fs.mkdirSync(stagingDir, { recursive: true });
    const stagedFile = path.join(stagingDir, 'Orbito-Setup-0.2.0.exe');
    fs.writeFileSync(stagedFile, 'STAGED-BINARY');

    const service = new AutoUpdateService({ stagingDir }, '0.1.0');
    // Artificially inject staged path
    (service as any).stagedUpdatePath = stagedFile;
    (service as any).state = 'downloaded';

    // Insert an active running orchestration in the DB
    databaseService.upsertOrchestration({
      id: 'active-orch-1',
      projectId: 'proj-1',
      projectPath: testDir,
      userGoal: 'Generating secure architecture',
      mode: 'autonomous',
      status: 'running',
      tasks: [],
      totalTokensUsed: 0,
      durationMs: 100,
      createdAt: Date.now()
    });

    const installResult = await service.installUpdate();
    expect(installResult.success).toBe(false);
    expect(installResult.message).toContain('active task(s) or orchestration(s) are currently in progress');
  });

  it('7. handles portable mode gracefully with user instructions and staging persistence', async () => {
    const stagingDir = path.join(testDir, 'staging');
    fs.mkdirSync(stagingDir, { recursive: true });
    const stagedFile = path.join(stagingDir, 'Orbito-Portable-0.2.0.exe');
    fs.writeFileSync(stagedFile, 'PORTABLE-BINARY');

    // Simulate portable runtime environment
    process.env.ORBITO_PORTABLE = '1';

    try {
      const service = new AutoUpdateService({ stagingDir }, '0.1.0');
      (service as any).stagedUpdatePath = stagedFile;
      (service as any).state = 'downloaded';

      expect(service.isPortable()).toBe(true);

      const installResult = await service.installUpdate();
      expect(installResult.success).toBe(true);
      expect(installResult.requiresManualRestart).toBe(true);
      expect(installResult.message).toContain('Portable update ready');
    } finally {
      delete process.env.ORBITO_PORTABLE;
    }
  });

  it('8. cleans staging directory on request', () => {
    const stagingDir = path.join(testDir, 'staging');
    fs.mkdirSync(stagingDir, { recursive: true });
    fs.writeFileSync(path.join(stagingDir, 'temp1.exe'), 'TEMP');

    const service = new AutoUpdateService({ stagingDir }, '0.1.0');
    (service as any).stagedUpdatePath = path.join(stagingDir, 'temp1.exe');

    service.cleanStaging();
    expect(fs.readdirSync(stagingDir).length).toBe(0);
    expect(service.getStagedUpdate().path).toBeNull();
    expect(service.getState()).toBe('idle');
  });
});
