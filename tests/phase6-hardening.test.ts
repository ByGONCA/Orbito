import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { securityService } from '../src/main/services/security.service';
import { databaseService } from '../src/main/db/database.service';
import { ollamaAdapter } from '../src/main/cli/adapters/ollama.adapter';
import * as detectorUtils from '../src/main/cli/detector.utils';
import { buildSanitizedCLIEnv } from '../src/main/cli/execution-engine';
import { workspaceService } from '../src/main/services/workspace.service';
import { safeStorageService } from '../src/main/services/safe-storage.service';
import { skillRegistry } from '../src/main/skills/skill-registry';

describe('Phase 6: System Hardening & Integration Wiring', () => {
  let testDir: string;
  let dbPath: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orc-phase6-test-'));
    dbPath = path.join(testDir, 'test.sqlite');
    databaseService.initialize(dbPath);
  });

  afterEach(() => {
    databaseService.close();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('P0 (SEC-01): Shell Permission Tiers Enforcement', () => {
    it('restricted mode blocks destructive / write shell commands', () => {
      const destructiveCommands = [
        'rm -rf src',
        'del /f /q *.*',
        'rmdir /s /q node_modules',
        'npm install malicious-pkg',
        'format C:',
        'touch file.txt',
        'mkdir new-folder'
      ];

      for (const cmd of destructiveCommands) {
        expect(() => {
          securityService.validateCommandSafety(cmd, 'restricted', { allowReadOnly: true });
        }).toThrow(/forbidden under 'restricted' permission tier|Command execution rejected/);
      }
    });

    it('restricted mode permits legitimate read-only commands', () => {
      const readOnlyCommands = [
        'git status',
        'git log',
        'git diff',
        'git branch',
        'dir',
        'ls',
        'pwd',
        'cat package.json',
        'echo "hello world"',
        'node --version',
        'npm --version'
      ];

      for (const cmd of readOnlyCommands) {
        expect(() => {
          securityService.validateCommandSafety(cmd, 'restricted', { allowReadOnly: true });
        }).not.toThrow();
      }
    });

    it('restricted mode rejects chaining or redirection even with read-only commands', () => {
      const chained = [
        'git status && del file.txt',
        'ls | grep test',
        'dir > output.txt',
        'git log; rm test.js'
      ];

      for (const cmd of chained) {
        expect(() => {
          securityService.validateCommandSafety(cmd, 'restricted', { allowReadOnly: true });
        }).toThrow(/forbidden under 'restricted' permission tier|Command execution rejected/);
      }
    });

    it('standard mode rejects chained commands and subshells', () => {
      expect(() => {
        securityService.validateCommandSafety('npm test && rm -rf dist', 'standard');
      }).toThrow(/dangerous shell operator characters|Full Access permission tier required/);

      expect(() => {
        securityService.validateCommandSafety('echo $(whoami)', 'standard');
      }).toThrow(/dangerous shell operator characters|Full Access permission tier required/);
    });

    it('full mode permits standard operations', () => {
      expect(() => {
        securityService.validateCommandSafety('npm install', 'full');
      }).not.toThrow();
      expect(() => {
        securityService.validateCommandSafety('git commit -m "feat: phase 6"', 'full');
      }).not.toThrow();
    });
  });

  describe('P0 (CRIT-01): Ollama Execution & Detection', () => {
    it('detect returns resolvedPath undefined when only daemon is running without CLI binary', async () => {
      vi.spyOn(ollamaAdapter as any, 'pingDaemon').mockResolvedValue(true);
      vi.spyOn(detectorUtils, 'findExecutableOnPath').mockResolvedValue(null);

      const detection = await ollamaAdapter.detect();
      expect(detection.isInstalled).toBe(true);
      expect(detection.resolvedPath).toBeUndefined();
      expect(detection.resolvedPath).not.toBe('http://127.0.0.1:11434');

      vi.restoreAllMocks();
    });

    it('canExecute selects http mode when only daemon is running', async () => {
      vi.spyOn(ollamaAdapter as any, 'pingDaemon').mockResolvedValue(true);
      vi.spyOn(detectorUtils, 'findExecutableOnPath').mockResolvedValue(null);

      const canExec = await ollamaAdapter.canExecute();
      expect(canExec.canExecute).toBe(true);
      expect(canExec.mode).toBe('http');

      vi.restoreAllMocks();
    });

    it('canExecute fails cleanly when neither daemon nor CLI binary is available', async () => {
      vi.spyOn(ollamaAdapter as any, 'pingDaemon').mockResolvedValue(false);
      vi.spyOn(detectorUtils, 'findExecutableOnPath').mockResolvedValue(null);

      const canExec = await ollamaAdapter.canExecute();
      expect(canExec.canExecute).toBe(false);
      expect(canExec.mode).toBe('none');
      expect(canExec.error).toBeDefined();

      vi.restoreAllMocks();
    });
  });

  describe('P1 (CRIT-04): CLI Session Recovery on Startup', () => {
    it('marks running CLI sessions as failed on restart and appends system notice', () => {
      const now = Date.now() - 10000;
      const runId = `session-running-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const compId = `session-completed-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      databaseService.createCLISession({
        id: runId,
        provider: 'claude',
        status: 'running',
        prompt: 'Implement feature X',
        createdAt: now,
        updatedAt: now
      });

      databaseService.createCLISession({
        id: compId,
        provider: 'claude',
        status: 'completed',
        prompt: 'Build done',
        exitCode: 0,
        createdAt: now,
        updatedAt: now
      });

      const recovery = databaseService.recoverCLISessionsOnStartup();
      expect(recovery.recoveredSessions).toBeGreaterThanOrEqual(1);

      const recovered = databaseService.getCLISession(runId);
      expect(recovered?.status).toBe('failed');
      expect(recovered?.exitCode).toBe(130);

      const messages = databaseService.getCLISessionMessages(runId);
      const notice = messages.find((m) => m.role === 'system');
      expect(notice?.content).toContain('interrupted by application restart');

      const completed = databaseService.getCLISession(compId);
      expect(completed?.status).toBe('completed');
    });
  });

  describe('P1 (SEC-02): Atomic File Operations & TOCTOU Protection', () => {
    it('createFile uses atomic exclusive creation to prevent overwrite race conditions', () => {
      const filePath = path.join(testDir, 'atomic.txt');

      const res1 = workspaceService.createFile(filePath, testDir, 'Initial content');
      expect(res1.success).toBe(true);
      expect(fs.readFileSync(filePath, 'utf8')).toBe('Initial content');

      // Attempting to create same file again fails with collision error
      expect(() => {
        workspaceService.createFile(filePath, testDir, 'Overwritten content');
      }).toThrow(/already exists/);

      // Verify content was not modified
      expect(fs.readFileSync(filePath, 'utf8')).toBe('Initial content');
    });

    it('saveFileContent safely writes via temporary file and re-verifies path', () => {
      const filePath = path.join(testDir, 'safe-save.txt');
      fs.writeFileSync(filePath, 'Original', 'utf8');

      const success = workspaceService.saveFileContent(filePath, testDir, 'Updated Content');
      expect(success).toBe(true);
      expect(fs.readFileSync(filePath, 'utf8')).toBe('Updated Content');

      // Ensure no dangling .tmp files in testDir
      const files = fs.readdirSync(testDir);
      const tempFiles = files.filter((f) => f.startsWith('.tmp-'));
      expect(tempFiles.length).toBe(0);
    });

    it('saveFileContent rejects writes attempting directory traversal', () => {
      const outsidePath = path.join(testDir, '..', 'escape.txt');
      expect(() => {
        workspaceService.saveFileContent(outsidePath, testDir, 'malicious');
      }).toThrow(/Path traversal attempt rejected/);
    });
  });

  describe('CRIT-07: Project Graph Real State', () => {
    it('does not invent synthetic agent roles or core skills when none exist', async () => {
      const graph = await workspaceService.getProjectGraph(testDir);

      // No orchestrations have run for testDir, so totalAgents should be 0
      expect(graph.stats.totalAgents).toBe(0);
      const agentNodes = graph.nodes.filter((n) => n.category === 'agent');
      expect(agentNodes.length).toBe(0);

      // Total skills matches real enabled skills from registry
      const enabledSkillsCount = skillRegistry.listSkills().filter((s) => s.enabled).length;
      expect(graph.stats.totalSkills).toBe(enabledSkillsCount);
    });
  });

  describe('SEC-03: SafeStorage Fail-Closed Security', () => {
    it('refuses to store new credentials in plaintext when OS encryption is unavailable', () => {
      vi.spyOn(safeStorageService, 'isEncryptionAvailable').mockReturnValue(false);

      expect(() => {
        safeStorageService.storeSecret('API_KEY', 'sk-ant-123456');
      }).toThrow(/OS keychain encryption is unavailable/);

      vi.restoreAllMocks();
    });

    it('reads legacy unencrypted credentials with backward compatibility and logs security warning', () => {
      const secretKey = 'LEGACY_KEY';
      const plaintext = 'sk-secret-legacy-val';
      const b64 = Buffer.from(plaintext).toString('base64');
      databaseService.saveEncryptedSecret(secretKey, `unencrypted:${b64}`);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const retrieved = safeStorageService.getSecret(secretKey);

      expect(retrieved).toBe(plaintext);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Security Warning: Reading legacy unencrypted credential')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('SEC-04: Environment Isolation for CLI Processes', () => {
    it('buildSanitizedCLIEnv allowlists essential system vars and strips electron internals', () => {
      process.env.ELECTRON_RUN_AS_NODE = '1';
      process.env.ELECTRON_NO_ASAR = '1';
      process.env.NODE_OPTIONS = '--inspect';
      process.env.AWS_SECRET_ACCESS_KEY = 'AKIA_LEAKED_SECRET';

      const env = buildSanitizedCLIEnv('claude', testDir);

      // Essential system vars preserved
      expect(env.PATH !== undefined || env.Path !== undefined).toBe(true);

      // Stripped variables
      expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined();
      expect(env.ELECTRON_NO_ASAR).toBeUndefined();
      expect(env.NODE_OPTIONS).toBeUndefined();
      expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    });
  });
});
