import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { databaseService } from '../src/main/db/database.service';
import { ExtensionLoader } from '../src/main/extensions/extension-loader';
import { extensionHostManager } from '../src/main/extensions/extension-host-manager';
import { osSandboxPolicy } from '../src/main/extensions/sandbox/os-sandbox-policy';
import { auditService } from '../src/main/services/audit.service';
import { airGapManager } from '../src/main/services/air-gap.manager';
import type { ExtensionRecord } from '../src/shared/extensions';

describe('Extension Security 2.0: OS-Level Sandboxing Adversarial Suite', () => {
  let tempBaseDir: string;
  let workspaceDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-os-sandbox-test-'));
    workspaceDir = path.join(tempBaseDir, 'workspace');
    fs.mkdirSync(workspaceDir, { recursive: true });

    databaseService.initialize(tempBaseDir);
    auditService.clear();

    // Create a sensitive file outside the extension and outside the workspace
    fs.writeFileSync(path.join(tempBaseDir, 'sensitive-app.db'), 'SQLITE_CREDENTIALS_AND_KEYS_SECRET');
    fs.writeFileSync(path.join(workspaceDir, 'allowed-code.ts'), 'export const ready = true;');

    airGapManager.updateConfig({ enabled: false });
    process.env.TEST_MAIN_SECRET_KEY = 'super-secret-production-token-12345';
  });

  afterEach(async () => {
    delete process.env.TEST_MAIN_SECRET_KEY;
    airGapManager.updateConfig({ enabled: false });
    osSandboxPolicy.setAllowUnsandboxedOverride(false);

    await extensionHostManager.terminateAll();
    databaseService.close();

    if (fs.existsSync(tempBaseDir)) {
      try {
        fs.rmSync(tempBaseDir, { recursive: true, force: true });
      } catch {
        // Ignore busy file locks on Windows
      }
    }
  });

  function createExtension(
    id: string,
    scriptContent: string,
    permissions: any = {},
    isBuiltIn: boolean = false
  ): { dir: string; record: ExtensionRecord } {
    const extDir = path.join(tempBaseDir, 'extensions', id);
    fs.mkdirSync(extDir, { recursive: true });

    const manifest = {
      id,
      name: `Extension ${id}`,
      version: '1.0.0',
      description: 'OS Sandboxing Test Extension',
      author: 'Adversary',
      main: 'index.js',
      permissions
    };

    fs.writeFileSync(path.join(extDir, 'extension.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(extDir, 'index.js'), scriptContent);

    const record: ExtensionRecord = {
      id,
      name: manifest.name,
      displayName: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      enabled: true,
      status: 'active',
      installPath: extDir,
      checksum: 'test-checksum',
      manifest: manifest as any,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isBuiltIn
    };

    return { dir: extDir, record };
  }

  describe('1. Subprocess & Worker Thread OS Mitigation', () => {
    it('denies direct require("child_process") and subprocess execution at the OS/runtime level', async () => {
      // Adversarial script attempts to import child_process and spawn a shell command
      const script = `
        module.exports = {
          activate: async (context) => {
            let errorCaptured = null;
            try {
              const cp = require('node:child_process');
              cp.execSync('echo pwned');
            } catch (err) {
              errorCaptured = { code: err.code, message: err.message };
            }
            await context.storage.set('cp_attempt', errorCaptured);
          }
        };
      `;

      const { record } = createExtension('adv-child-process', script);
      await extensionHostManager.activateInHost(record, workspaceDir);

      // Wait for execution
      await new Promise((r) => setTimeout(r, 600));

      const storageFile = path.join(record.installPath, '.storage', 'cp_attempt.json');
      expect(fs.existsSync(storageFile)).toBe(true);

      const result = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
      expect(result).toBeDefined();
      expect(result.code).toBe('ERR_ACCESS_DENIED');
      expect(result.message).toContain('Access to this API has been restricted');
    });

    it('denies direct require("worker_threads") spawning at the OS/runtime level', async () => {
      const script = `
        module.exports = {
          activate: async (context) => {
            let errorCaptured = null;
            try {
              const wt = require('node:worker_threads');
              new wt.Worker('console.log("thread");', { eval: true });
            } catch (err) {
              errorCaptured = { code: err.code, message: err.message };
            }
            await context.storage.set('wt_attempt', errorCaptured);
          }
        };
      `;

      const { record } = createExtension('adv-worker-threads', script);
      await extensionHostManager.activateInHost(record, workspaceDir);

      await new Promise((r) => setTimeout(r, 600));

      const storageFile = path.join(record.installPath, '.storage', 'wt_attempt.json');
      expect(fs.existsSync(storageFile)).toBe(true);

      const result = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
      expect(result).toBeDefined();
      expect(result.code).toBe('ERR_ACCESS_DENIED');
    });
  });

  describe('2. Direct Filesystem Access OS Restriction', () => {
    it('denies direct require("fs").readFileSync() on sensitive paths outside the extension install boundary', async () => {
      const sensitivePath = path.join(tempBaseDir, 'sensitive-app.db').replace(/\\/g, '\\\\');

      const script = `
        module.exports = {
          activate: async (context) => {
            let errorCaptured = null;
            try {
              const fs = require('node:fs');
              fs.readFileSync('${sensitivePath}', 'utf8');
            } catch (err) {
              errorCaptured = { code: err.code, message: err.message };
            }
            await context.storage.set('fs_read_attempt', errorCaptured);
          }
        };
      `;

      const { record } = createExtension('adv-fs-read-outside', script);
      await extensionHostManager.activateInHost(record, workspaceDir);

      await new Promise((r) => setTimeout(r, 600));

      const storageFile = path.join(record.installPath, '.storage', 'fs_read_attempt.json');
      expect(fs.existsSync(storageFile)).toBe(true);

      const result = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
      expect(result).toBeDefined();
      expect(result.code).toBe('ERR_ACCESS_DENIED');
      expect(result.message).toContain('--allow-fs-read');
    });

    it('denies direct require("fs").writeFileSync() attempting to write outside authorized storage', async () => {
      const unauthorizedTarget = path.join(tempBaseDir, 'hacked-file.txt').replace(/\\/g, '\\\\');

      const script = `
        module.exports = {
          activate: async (context) => {
            let errorCaptured = null;
            try {
              const fs = require('node:fs');
              fs.writeFileSync('${unauthorizedTarget}', 'MALICIOUS_PAYLOAD', 'utf8');
            } catch (err) {
              errorCaptured = { code: err.code, message: err.message };
            }
            await context.storage.set('fs_write_attempt', errorCaptured);
          }
        };
      `;

      const { record } = createExtension('adv-fs-write-outside', script);
      await extensionHostManager.activateInHost(record, workspaceDir);

      await new Promise((r) => setTimeout(r, 600));

      // Assert unauthorized file was NOT created on disk
      expect(fs.existsSync(path.join(tempBaseDir, 'hacked-file.txt'))).toBe(false);

      const storageFile = path.join(record.installPath, '.storage', 'fs_write_attempt.json');
      expect(fs.existsSync(storageFile)).toBe(true);

      const result = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
      expect(result).toBeDefined();
      expect(result.code).toBe('ERR_ACCESS_DENIED');
      expect(result.message).toContain('--allow-fs-write');
    });
  });

  describe('3. Network Isolation & Air-Gap Enforcement', () => {
    it('denies outbound TCP connection when extension manifest has not granted network permissions', async () => {
      const script = `
        module.exports = {
          activate: async (context) => {
            let errorCaptured = null;
            try {
              const net = require('node:net');
              const socket = net.createConnection({ host: '93.184.216.34', port: 80 });
            } catch (err) {
              errorCaptured = { code: err.code, message: err.message };
            }
            await context.storage.set('net_attempt', errorCaptured);
          }
        };
      `;

      const { record } = createExtension('adv-network-unpermitted', script, {
        network: { allowExternal: false }
      });
      await extensionHostManager.activateInHost(record, workspaceDir);

      await new Promise((r) => setTimeout(r, 600));

      const storageFile = path.join(record.installPath, '.storage', 'net_attempt.json');
      expect(fs.existsSync(storageFile)).toBe(true);

      const result = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
      expect(result).toBeDefined();
      expect(result.code).toBe('ERR_ACCESS_DENIED');
      expect(result.message).toContain('Network access has not been granted');
    });

    it('denies connections to local loopback and private subnets even when external network is permitted', async () => {
      const script = `
        module.exports = {
          activate: async (context) => {
            let errorCaptured = null;
            try {
              const net = require('node:net');
              // Attempt to probe local loopback / Ollama port
              const socket = net.createConnection({ host: '127.0.0.1', port: 11434 });
            } catch (err) {
              errorCaptured = { code: err.code, message: err.message };
            }
            await context.storage.set('loopback_attempt', errorCaptured);
          }
        };
      `;

      const { record } = createExtension('adv-network-loopback-probe', script, {
        network: { allowExternal: true }
      });
      await extensionHostManager.activateInHost(record, workspaceDir);

      await new Promise((r) => setTimeout(r, 600));

      const storageFile = path.join(record.installPath, '.storage', 'loopback_attempt.json');
      expect(fs.existsSync(storageFile)).toBe(true);

      const result = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
      expect(result).toBeDefined();
      expect(result.code).toBe('ERR_ACCESS_DENIED');
      expect(result.message).toContain('local/private network target');
    });

    it('unconditionally blocks all network calls under active Air-Gap Mode even if manifest permitted network', async () => {
      airGapManager.updateConfig({ enabled: true });

      const script = `
        module.exports = {
          activate: async (context) => {
            let errorCaptured = null;
            try {
              const net = require('node:net');
              net.createConnection({ host: 'example.com', port: 443 });
            } catch (err) {
              errorCaptured = { code: err.code, message: err.message };
            }
            await context.storage.set('airgap_net_attempt', errorCaptured);
          }
        };
      `;

      const { record } = createExtension('adv-airgap-bypass', script, {
        network: { allowExternal: true }
      });
      await extensionHostManager.activateInHost(record, workspaceDir);

      await new Promise((r) => setTimeout(r, 600));

      const storageFile = path.join(record.installPath, '.storage', 'airgap_net_attempt.json');
      expect(fs.existsSync(storageFile)).toBe(true);

      const result = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
      expect(result).toBeDefined();
      expect(result.code).toBe('ERR_ACCESS_DENIED');
      expect(result.message).toContain('Air-Gap isolation mode');
    });
  });

  describe('4. Resource Limits & Process Tree Lifecycle', () => {
    it('enforces concurrent extension host process limits (max 5)', async () => {
      const dummyScript = `
        module.exports = {
          activate: () => {}
        };
      `;

      const records: ExtensionRecord[] = [];
      for (let i = 0; i < 5; i++) {
        const { record } = createExtension(`concurrent-ext-${i}`, dummyScript);
        records.push(record);
        await extensionHostManager.activateInHost(record, workspaceDir);
      }

      // Attempting to spawn a 6th host process must be rejected
      const { record: sixthRecord } = createExtension('concurrent-ext-6', dummyScript);
      await expect(
        extensionHostManager.activateInHost(sixthRecord, workspaceDir)
      ).rejects.toThrowError(/Maximum concurrent extension host limit reached/);

      // Clean up
      for (const rec of records) {
        await extensionHostManager.terminateHost(rec.id);
      }
    });

    it('cleanly terminates process tree without leaving orphaned processes', async () => {
      const script = `
        module.exports = {
          activate: () => {}
        };
      `;

      const { record } = createExtension('terminable-ext', script);
      await extensionHostManager.activateInHost(record, workspaceDir);

      expect(extensionHostManager.isHostActive('terminable-ext')).toBe(true);

      await extensionHostManager.terminateHost('terminable-ext', true);

      expect(extensionHostManager.isHostActive('terminable-ext')).toBe(false);
    });
  });

  describe('5. Graceful Degradation & Untrusted Third-Party Gating', () => {
    const mockUnsandboxedCaps = {
      platform: 'linux' as const,
      sandboxMode: 'unsupported' as const,
      hasNodePermissionModel: false,
      hasBubblewrap: false,
      hasSandboxExec: false,
      memoryQuotaEnforced: true,
      networkIsolationEnforced: false,
      processTreeCleanupEnforced: true
    };

    it('blocks untrusted third-party extensions when sandboxing is unavailable', () => {
      const script = `module.exports = { activate: () => {} };`;
      const { record } = createExtension('untrusted-user-ext', script, {}, false);

      const check = osSandboxPolicy.evaluateUntrustedExecution(record, mockUnsandboxedCaps, false);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('sandboxing is unavailable');
    });

    it('allows built-in extensions to execute even if third-party untrusted extensions are restricted', () => {
      const script = `module.exports = { activate: () => {} };`;
      const { record } = createExtension('builtin-sys-ext', script, {}, true);

      const check = osSandboxPolicy.evaluateUntrustedExecution(record, mockUnsandboxedCaps, false);
      expect(check.allowed).toBe(true);
      expect(check.sandboxMode).toBe('trusted_builtin');
    });

    it('allows untrusted execution on unsandboxed hosts only when explicit user override is configured', () => {
      const script = `module.exports = { activate: () => {} };`;
      const { record } = createExtension('untrusted-user-ext', script, {}, false);

      const check = osSandboxPolicy.evaluateUntrustedExecution(record, mockUnsandboxedCaps, true);
      expect(check.allowed).toBe(true);
      expect(check.warning).toBeDefined();
      expect(check.sandboxMode).toBe('unsandboxed_override_warning');
    });

    it('produces a transparent platform security comparison report', () => {
      const report = osSandboxPolicy.getPlatformSecurityReport();
      expect(report.currentPlatform).toBe(process.platform);
      expect(report.guarantees.process_isolation).toBeDefined();
      expect(report.guarantees.filesystem_isolation).toBeDefined();
      expect(report.guarantees.subprocess_prohibition).toBeDefined();
      expect(report.residualRisks).toBeDefined();
    });
  });
});
