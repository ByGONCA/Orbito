import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { databaseService } from '../src/main/db/database.service';
import { ExtensionLoader } from '../src/main/extensions/extension-loader';
import { ExtensionRegistry } from '../src/main/extensions/extension-registry';
import { extensionHostManager } from '../src/main/extensions/extension-host-manager';
import { auditService } from '../src/main/services/audit.service';
import { airGapManager } from '../src/main/services/air-gap.manager';
import type { ExtensionRecord } from '../src/shared/extensions';

describe('Extension Security & Process-Level Isolation Adversarial Suite', () => {
  let tempBaseDir: string;
  let workspaceDir: string;
  let registry: ExtensionRegistry;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-sec-test-'));
    workspaceDir = path.join(tempBaseDir, 'workspace');
    fs.mkdirSync(workspaceDir, { recursive: true });

    databaseService.initialize(tempBaseDir);
    auditService.clear();

    // Seed a dummy workspace file and sensitive file outside workspace
    fs.writeFileSync(path.join(workspaceDir, 'app.ts'), 'export const clean = true;');
    fs.writeFileSync(path.join(tempBaseDir, 'super-secret.key'), 'MASTER_ENCRYPTION_KEY_12345');

    registry = new ExtensionRegistry(tempBaseDir);
    airGapManager.updateConfig({ enabled: false });

    // Set a dummy secret in main process environment to test sanitization
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-secret-key-do-not-leak';
    process.env.DATABASE_PASSWORD = 'super-secret-db-password';
  });

  afterEach(async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.DATABASE_PASSWORD;
    airGapManager.updateConfig({ enabled: false });

    await extensionHostManager.terminateAll();
    databaseService.close();

    if (fs.existsSync(tempBaseDir)) {
      try {
        fs.rmSync(tempBaseDir, { recursive: true, force: true });
      } catch {
        // Ignore busy lock cleanup on Windows
      }
    }
  });

  function createExtension(
    id: string,
    scriptContent: string,
    permissions: any = {},
    mainFileName: string = 'index.js'
  ): { dir: string; record: ExtensionRecord } {
    const extDir = path.join(tempBaseDir, 'extensions', id);
    fs.mkdirSync(extDir, { recursive: true });

    const manifest = {
      id,
      name: `Extension ${id}`,
      version: '1.0.0',
      description: 'Security test extension',
      author: 'Adversary',
      main: mainFileName,
      permissions
    };

    fs.writeFileSync(path.join(extDir, 'extension.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(extDir, mainFileName), scriptContent);

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
      checksum: 'sha256-test',
      manifest: manifest as any,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    return { dir: extDir, record };
  }

  describe('1. Process-Level Isolation & Memory Boundary', () => {
    it('prevents extension code from polluting Main Electron process globals or modifying process properties', async () => {
      // In node:vm, an extension could escape via prototype traversal and corrupt process or globals in Main.
      // In our process-level isolation, the extension runs in a separate child process.
      const maliciousScript = `
        module.exports = {
          activate: (context) => {
            // Attempt to pollute global state and tamper with process
            global.MAIN_PROCESS_COMPROMISED = true;
            process.TAMPERED_FLAG = 'hacked';
          }
        };
      `;

      const { record } = createExtension('prototype-polluter', maliciousScript);
      await ExtensionLoader.activateExtension(record);

      // Verify Main process was NOT polluted
      expect((global as any).MAIN_PROCESS_COMPROMISED).toBeUndefined();
      expect((process as any).TAMPERED_FLAG).toBeUndefined();
      expect(extensionHostManager.isHostActive('prototype-polluter')).toBe(true);

      await ExtensionLoader.deactivateExtension(record);
    });
  });

  describe('2. Environment Secret Sanitization', () => {
    it('completely strips API keys, tokens, and passwords from the extension host environment', () => {
      const sanitized = extensionHostManager.buildSanitizedEnv('test-ext', 'C:/test');

      // Main process has the sensitive keys
      expect(process.env.ANTHROPIC_API_KEY).toBeDefined();
      expect(process.env.DATABASE_PASSWORD).toBeDefined();

      // Sanitized environment passed to child process must NOT contain any secrets
      expect(sanitized.ANTHROPIC_API_KEY).toBeUndefined();
      expect(sanitized.DATABASE_PASSWORD).toBeUndefined();
      expect(sanitized.AI_WORKSPACE_EXTENSION_ISOLATED).toBe('true');
      expect(sanitized.AI_WORKSPACE_EXTENSION_ID).toBe('test-ext');
      // Essential system variables are preserved
      expect(sanitized.PATH || sanitized.Path).toBeDefined();
    });
  });

  describe('3. Workspace Boundary & Path Traversal Containment', () => {
    it('blocks path traversal attempts to read files outside the active workspace directory', async () => {
      let trappedError = '';
      const traversalScript = `
        module.exports = {
          activate: async (context) => {
            try {
              // Attempt to escape workspace and read parent directory secret
              await context.workspace.readFile('../super-secret.key');
            } catch (err) {
              context.log('TRAVERSAL_FAILED: ' + err.message, 'error');
            }
          }
        };
      `;

      const { record } = createExtension(
        'path-traversal-reader',
        traversalScript,
        { filesystem: { read: true } }
      );

      // Activate bound to the workspace directory
      await extensionHostManager.activateInHost(record, workspaceDir);

      // Verify audit service trapped the traversal attempt
      const logs = auditService.queryLogs({ limit: 10 });
      const violation = logs.find((l) => l.action === 'extension_traversal_blocked' || l.action === 'path_traversal_blocked');
      expect(violation).toBeDefined();

      await extensionHostManager.terminateHost('path-traversal-reader');
    });

    it('successfully reads authorized files located strictly inside the workspace boundary', async () => {
      const benignScript = `
        module.exports = {
          activate: async (context) => {
            const res = await context.workspace.readFile('app.ts');
            if (res.content.includes('clean = true')) {
              await context.storage.set('read_status', 'SUCCESS');
            }
          }
        };
      `;

      const { record } = createExtension(
        'benign-reader',
        benignScript,
        { filesystem: { read: true } }
      );

      await extensionHostManager.activateInHost(record, workspaceDir);

      // Allow async RPC to complete
      await new Promise((r) => setTimeout(r, 600));

      // Verify that isolated storage recorded the success
      const storageFile = path.join(record.installPath, '.storage', 'read_status.json');
      expect(fs.existsSync(storageFile)).toBe(true);
      const stored = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
      expect(stored).toBe('SUCCESS');

      await extensionHostManager.terminateHost('benign-reader');
    });
  });

  describe('4. Capability Permission Enforcement', () => {
    it('rejects workspace file writes when filesystem.write permission is not granted', async () => {
      const unauthorizedWriterScript = `
        module.exports = {
          activate: async (context) => {
            try {
              await context.workspace.writeFile('malicious.ts', 'evil()');
            } catch (err) {
              context.log('WRITE_BLOCKED: ' + err.message, 'error');
            }
          }
        };
      `;

      const { record } = createExtension(
        'unauthorized-writer',
        unauthorizedWriterScript,
        { filesystem: { read: true, write: false } } // Read only!
      );

      await extensionHostManager.activateInHost(record, workspaceDir);
      await new Promise((r) => setTimeout(r, 600));

      // Verify malicious file was NOT created
      expect(fs.existsSync(path.join(workspaceDir, 'malicious.ts'))).toBe(false);

      await extensionHostManager.terminateHost('unauthorized-writer');
    });

    it('rejects node registration requiring terminal execution if shell permission is absent', async () => {
      const escalatingScript = `
        module.exports = {
          activate: async (context) => {
            try {
              context.registerNode({
                type: 'evil_shell_node',
                category: 'dev',
                name: 'Evil Node',
                description: 'Tries to run shell commands',
                icon: 'Terminal',
                inputs: [],
                outputs: [],
                defaultData: {},
                data: {
                  requiredPermissions: { terminal: { execute: true } }
                }
              });
            } catch (err) {
              context.log('ESCALATION_BLOCKED: ' + err.message, 'error');
            }
          }
        };
      `;

      const { record } = createExtension('escalator-ext', escalatingScript, { shell: false });
      await extensionHostManager.activateInHost(record, workspaceDir);
      await new Promise((r) => setTimeout(r, 600));

      const logs = auditService.queryLogs({ limit: 10 });
      const escalationLog = logs.find((l) => l.action === 'node_permission_escalation');
      expect(escalationLog).toBeDefined();

      await extensionHostManager.terminateHost('escalator-ext');
    });
  });

  describe('5. Extension Crash Resilience & DoS Protection', () => {
    it('survives an extension process crash without crashing the Main Electron application', async () => {
      const crasherScript = `
        module.exports = {
          activate: (context) => {
            // Hard exit of the child process
            setTimeout(() => {
              process.exit(1);
            }, 100);
          }
        };
      `;

      const { record } = createExtension('crashing-ext', crasherScript);
      await extensionHostManager.activateInHost(record, workspaceDir);

      // Wait for child process to crash
      await new Promise((r) => setTimeout(r, 500));

      // Main process continues running
      expect(record.status).toBe('error');
      expect(record.errorMessage).toContain('Host process crashed');
      expect(extensionHostManager.isHostActive('crashing-ext')).toBe(false);
    });

    it('times out and force-terminates an extension hanging in an infinite loop during activation', async () => {
      const infiniteLoopScript = `
        module.exports = {
          activate: async (context) => {
            // Infinite asynchronous loop that hangs activation
            await new Promise(() => {});
          }
        };
      `;

      const { record } = createExtension('hang-ext', infiniteLoopScript);

      // Attempt activation with short 1000ms timeout
      await expect(
        extensionHostManager.activateInHost(record, workspaceDir, 1000)
      ).rejects.toThrow(/timed out/);

      expect(extensionHostManager.isHostActive('hang-ext')).toBe(false);
    });
  });

  describe('6. Custom Node Execution inside Isolated Host', () => {
    it('executes custom workflow node logic inside the worker process and returns structured outputs', async () => {
      const nodeWorkerScript = `
        module.exports = {
          activate: (context) => {
            context.log('Node executor ready');
          },
          executeNode: async (nodeType, inputs, config) => {
            if (nodeType === 'math_multiplier') {
              return {
                result: (inputs.a || 0) * (inputs.b || 0)
              };
            }
            throw new Error('Unknown nodeType ' + nodeType);
          }
        };
      `;

      const { record } = createExtension('custom-node-host', nodeWorkerScript);
      await extensionHostManager.activateInHost(record, workspaceDir);

      const outputs = await extensionHostManager.executeCustomNode(
        'custom-node-host',
        'math_multiplier',
        { a: 6, b: 7 }
      );

      expect(outputs).toEqual({ result: 42 });

      await extensionHostManager.terminateHost('custom-node-host');
    });
  });
});
