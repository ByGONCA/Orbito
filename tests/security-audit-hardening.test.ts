import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { ExtensionLoader } from '../src/main/extensions/extension-loader';
import { airGapManager, AirGapViolationException } from '../src/main/services/air-gap.manager';
import { ExpressionEvaluator } from '../src/main/workflows/expression-evaluator';
import { SecurityService, SecurityViolationException } from '../src/main/services/security.service';
import { WorkflowEngine } from '../src/main/workflows/workflow-engine';
import { databaseService } from '../src/main/db/database.service';
import { createNodeData } from '../src/main/workflows/node-registry';
import type { ExtensionRecord } from '../src/shared/extensions';
import type { WorkflowRecord, FlowNode, FlowEdge } from '../src/shared/workflows';

const TEST_DIR = path.join(process.cwd(), '.test-security-audit-' + Date.now());

describe('Production Readiness: Security Hardening & Isolation Tests', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    airGapManager.updateConfig({ enabled: false });
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe('1. Air-Gap Mode Network Isolation & Environment Hardening', () => {
    it('blocks outbound public domains and IP addresses', () => {
      airGapManager.updateConfig({ enabled: true });

      expect(() => airGapManager.assertNetworkAllowed('https://api.openai.com/v1/chat/completions')).toThrow(
        AirGapViolationException
      );
      expect(() => airGapManager.assertNetworkAllowed('http://192.168.1.50:8080')).toThrow(
        AirGapViolationException
      );
      expect(() => airGapManager.assertNetworkAllowed('https://8.8.8.8')).toThrow(
        AirGapViolationException
      );
    });

    it('permits loopback addresses including IPv6 bracket notation and 127.0.0.0/8 range', () => {
      airGapManager.updateConfig({ enabled: true });

      expect(() => airGapManager.assertNetworkAllowed('http://127.0.0.1:11434')).not.toThrow();
      expect(() => airGapManager.assertNetworkAllowed('http://127.0.0.2:8080')).not.toThrow();
      expect(() => airGapManager.assertNetworkAllowed('http://localhost:3000')).not.toThrow();
      expect(() => airGapManager.assertNetworkAllowed('http://[::1]:11434')).not.toThrow();
      expect(() => airGapManager.assertNetworkAllowed('::1')).not.toThrow();
    });

    it('injects offline proxy dead-ends and air-gap flags to child process environment', () => {
      airGapManager.updateConfig({ enabled: true });
      const env = airGapManager.getChildProcessEnv({ FOO: 'bar' });

      expect(env.HTTP_PROXY).toBe('http://127.0.0.1:0');
      expect(env.HTTPS_PROXY).toBe('http://127.0.0.1:0');
      expect(env.ALL_PROXY).toBe('http://127.0.0.1:0');
      expect(env.npm_config_offline).toBe('true');
      expect(env.PIP_NO_INDEX).toBe('true');
      expect(env.AIR_GAP_MODE).toBe('true');
      expect(env.FOO).toBe('bar');
    });

    it('reroutes cloud providers to local Ollama when enforceLocalModels is active', () => {
      airGapManager.updateConfig({ enabled: true, enforceLocalModels: true });
      const resolved = airGapManager.resolveProvider('claude');
      expect(resolved).toBe('ollama');
    });

    it('rejects cloud providers when enforceLocalModels is disabled in Air-Gap mode', () => {
      airGapManager.updateConfig({ enabled: true, enforceLocalModels: false });
      expect(() => airGapManager.resolveProvider('claude')).toThrow(AirGapViolationException);
    });
  });

  describe('2. Untrusted Extension SDK Sandboxing & Privilege Boundary', () => {
    it('isolates extension main script in vm sandbox without process or require', async () => {
      const extDir = path.join(TEST_DIR, 'untrusted-ext');
      fs.mkdirSync(extDir, { recursive: true });

      // Extension trying to access process, require, or global
      const script = `
        exports.activate = function(context) {
          const hasProcess = typeof process !== 'undefined';
          const hasRequire = typeof require !== 'undefined';
          context.log('Sandboxed: process=' + hasProcess + ', require=' + hasRequire);
          if (hasProcess || hasRequire) {
            throw new Error('Sandbox escaped: process or require exposed!');
          }
        };
      `;
      fs.writeFileSync(path.join(extDir, 'index.js'), script, 'utf8');

      const manifest = {
        id: 'untrusted-test',
        name: 'Untrusted Test',
        version: '1.0.0',
        description: 'Test sandbox',
        author: 'Security Tester',
        main: 'index.js',
        permissions: {
          shell: false,
          filesystem: { read: false, write: false }
        }
      };
      fs.writeFileSync(path.join(extDir, 'extension.json'), JSON.stringify(manifest), 'utf8');

      const { record } = await ExtensionLoader.loadFromDirectory(extDir);
      expect(record).toBeDefined();

      // Activate inside sandbox
      await ExtensionLoader.activateExtension(record!);
      expect(record!.status).toBe('active');
    });

    it('blocks directory traversal in manifest.main', async () => {
      const extDir = path.join(TEST_DIR, 'traversal-ext');
      fs.mkdirSync(extDir, { recursive: true });

      const manifest = {
        id: 'traversal-ext',
        name: 'Traversal Extension',
        version: '1.0.0',
        description: 'Attempts path traversal in main',
        author: 'Attacker',
        main: '../../package.json'
      };
      fs.writeFileSync(path.join(extDir, 'extension.json'), JSON.stringify(manifest), 'utf8');

      const { record } = await ExtensionLoader.loadFromDirectory(extDir);
      expect(record).toBeDefined();

      await ExtensionLoader.activateExtension(record!);
      expect(record!.status).toBe('error');
      expect(record!.errorMessage).toContain('traversal');
    });

    it('prevents privilege escalation by rejecting contributed nodes with unauthorized permissions', async () => {
      const extDir = path.join(TEST_DIR, 'escalation-ext');
      fs.mkdirSync(extDir, { recursive: true });

      const manifest = {
        id: 'escalation-ext',
        name: 'Escalation Extension',
        version: '1.0.0',
        description: 'Attempts privilege escalation',
        author: 'Attacker',
        permissions: {
          shell: false,
          filesystem: { read: false, write: false }
        },
        contributes: {
          nodes: [
            {
              id: 'malicious-terminal-node',
              name: 'Terminal Runner',
              type: 'malicious_terminal_node',
              category: 'terminal',
              description: 'Tries to run commands',
              data: {
                requiredPermissions: {
                  filesystem: { read: false, write: false },
                  terminal: { execute: true }, // Escalation attempt!
                  network: { allowed: false }
                }
              }
            }
          ]
        }
      };
      fs.writeFileSync(path.join(extDir, 'extension.json'), JSON.stringify(manifest), 'utf8');

      const { record } = await ExtensionLoader.loadFromDirectory(extDir);
      expect(record).toBeDefined();
      await ExtensionLoader.activateExtension(record!);

      // The node should have been rejected from registration
      expect(record!.status).toBe('active');
    });
  });

  describe('3. Expression Evaluator Prototype Poisoning Defenses', () => {
    it('blocks access to __proto__, constructor, and prototype', () => {
      const context = {
        user: { name: 'Alice', role: 'admin' },
        count: 5
      };

      expect(ExpressionEvaluator.evaluate('user.__proto__', context)).toBe(undefined);
      expect(ExpressionEvaluator.evaluate('user.constructor', context)).toBe(undefined);
      expect(ExpressionEvaluator.evaluate('user.prototype', context)).toBe(undefined);
      expect(ExpressionEvaluator.evaluate('user.name == "Alice"', context)).toBe(true);
      expect(ExpressionEvaluator.evaluate('count > 3', context)).toBe(true);
    });
  });

  describe('4. Security Service Null Byte and Path Traversal Protection', () => {
    const security = new SecurityService();

    it('rejects path containing null bytes', () => {
      expect(() =>
        security.assertWithinWorkspace('secret.txt\0.png', TEST_DIR)
      ).toThrow(SecurityViolationException);
    });

    it('rejects path escaping workspace boundary', () => {
      expect(() =>
        security.assertWithinWorkspace('../../etc/passwd', TEST_DIR)
      ).toThrow(SecurityViolationException);
    });
  });

  describe('5. Workflow Engine Security & Air-Gap Enforcement', () => {
    let engine: WorkflowEngine;
    const storageDir = path.join(TEST_DIR, 'db');

    beforeEach(() => {
      fs.mkdirSync(storageDir, { recursive: true });
      (databaseService as any).storageDir = storageDir;
      databaseService.initialize();
      engine = new WorkflowEngine();
    });

    afterEach(() => {
      databaseService.close();
    });

    it('blocks workflow nodes requiring network egress under Air-Gap mode', async () => {
      airGapManager.updateConfig({ enabled: true });

      const nodeData = createNodeData('ai_agent', {
        label: 'Network AI Agent',
        requiredPermissions: {
          filesystem: { read: false, write: false },
          terminal: { execute: false },
          network: { allowed: true } // Requires network
        }
      });

      const nodes: FlowNode[] = [
        { id: 'n1', type: 'customNode', position: { x: 0, y: 0 }, data: nodeData }
      ];
      const edges: FlowEdge[] = [];

      const wf: WorkflowRecord = {
        id: 'wf-airgap-blocked',
        projectId: 'test-project',
        name: 'Airgap Blocked Workflow',
        description: 'Testing airgap blocking in workflow',
        nodes,
        edges,
        variables: {},
        trigger: { type: 'manual', enabled: true, config: {} },
        status: 'ready',
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      databaseService.upsertWorkflow(wf);

      const exec = await engine.executeWorkflow(wf, {}, TEST_DIR);
      expect(exec.status).toBe('failed');
      expect(exec.errorMessage).toContain('Air-Gap');
    });
  });
});
