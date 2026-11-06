import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { databaseService } from '../src/main/db/database.service';
import { executionEngine } from '../src/main/cli/execution-engine';
import { cliManager } from '../src/main/cli/cli-manager';
import { contextRetrievalService } from '../src/main/context/retrieval/context-retrieval.service';
import { skillRegistry } from '../src/main/skills/skill-registry';
import { airGapManager } from '../src/main/services/air-gap.manager';
import { ollamaAdapter } from '../src/main/cli/adapters/ollama.adapter';
import type { CLIAdapter, CLIInstallationStatus, CLIAuthStatus, CommandSpec, CLICapabilities, CLIProvider } from '../src/shared/cli';

class MockCLIAdapter implements CLIAdapter {
  public lastReceivedPrompt: string | null = null;
  public lastReceivedDir: string | null = null;

  constructor(public readonly provider: CLIProvider) {}

  public readonly capabilities: CLICapabilities = {
    supportsStreaming: true,
    supportsResume: true,
    supportsHeadlessPrompt: true,
    supportsJsonOutput: false
  };

  public async detect(): Promise<CLIInstallationStatus> {
    return {
      provider: this.provider,
      isInstalled: true,
      resolvedPath: process.execPath,
      version: '1.0.0',
      isCompatible: true,
      requiresUpdate: false,
      installGuideUrl: 'https://test.com'
    };
  }

  public async checkAuth(): Promise<CLIAuthStatus> {
    return { provider: this.provider, isAuthenticated: true, authType: 'api-key' };
  }

  public buildCommand(prompt: string, workingDirectory: string): CommandSpec {
    this.lastReceivedPrompt = prompt;
    this.lastReceivedDir = workingDirectory;
    return {
      executable: process.execPath,
      args: ['-e', 'process.stdout.write("MOCK_CLI_OUTPUT\\n"); process.exit(0);']
    };
  }
}

describe('Phase 6.1: Context Engine + Skills End-to-End Pipeline Verification Suite', () => {
  let tempBaseDir: string;
  let workspaceDir: string;
  let projectId: string;
  let mockClaude: MockCLIAdapter;
  let mockCodex: MockCLIAdapter;
  let mockGemini: MockCLIAdapter;
  let mockOllama: MockCLIAdapter;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-skills-pipeline-'));
    workspaceDir = path.join(tempBaseDir, 'project-workspace');
    fs.mkdirSync(workspaceDir, { recursive: true });

    databaseService.initialize(tempBaseDir);
    skillRegistry.initialize();

    // Register mock CLI adapters
    mockClaude = new MockCLIAdapter('claude');
    mockCodex = new MockCLIAdapter('codex');
    mockGemini = new MockCLIAdapter('gemini');
    mockOllama = new MockCLIAdapter('ollama');

    cliManager.registerAdapter(mockClaude);
    cliManager.registerAdapter(mockCodex);
    cliManager.registerAdapter(mockGemini);
    cliManager.registerAdapter(mockOllama);

    // Create a mock project in SQLite
    projectId = 'proj-e2e-test-1';
    databaseService.recordProjectOpen({
      id: projectId,
      name: 'E2E Test Project',
      path: workspaceDir,
      lastOpenedAt: Date.now(),
      isGitRepo: false,
      permissionLevel: 'standard',
      settings: {
        gitAutoFetch: false,
        envVars: {
          CUSTOM_PROJECT_VAR: 'project_scoped_secret_value'
        }
      }
    });

    airGapManager.updateConfig({ enabled: false });
  });

  afterEach(async () => {
    airGapManager.updateConfig({ enabled: false });
    const active = (executionEngine as any).activeSessions;
    if (active) {
      for (const id of active.keys()) {
        try {
          await executionEngine.terminateSession(id);
        } catch {}
      }
    }
    databaseService.close();

    if (fs.existsSync(tempBaseDir)) {
      try {
        fs.rmSync(tempBaseDir, { recursive: true, force: true });
      } catch {
        // Windows file lock resilience
      }
    }
  });

  describe('1. Full Pipeline: Retrieval, Assembly, Skills, Prompt Construction & DB Persistence', () => {
    it('executes the full pipeline with both Context and Skills enabled', async () => {
      const authFile = path.join(workspaceDir, 'src', 'auth.ts');
      fs.mkdirSync(path.dirname(authFile), { recursive: true });
      fs.writeFileSync(authFile, 'export function authenticateUser(token: string): boolean { return token.length > 10; }');

      databaseService.upsertFileIndex(
        authFile,
        'hash1',
        100,
        Date.now(),
        'typescript',
        [
          {
            id: 'sym-1',
            filePath: authFile,
            name: 'authenticateUser',
            kind: 'function',
            line: 1,
            character: 0
          }
        ],
        [
          {
            id: 'chunk-1',
            filePath: authFile,
            startLine: 1,
            endLine: 25,
            content: 'export function authenticateUser(token: string): boolean { return token.length > 10; }',
            symbolName: 'authenticateUser'
          }
        ]
      );

      const sessionId = 'session-e2e-both-enabled';
      const prompt = 'Please perform a code review and check for vulnerabilities in authenticateUser';

      await executionEngine.execute({
        sessionId,
        provider: 'claude',
        prompt,
        workingDirectory: workspaceDir,
        projectId,
        enableContext: true,
        enableSkills: true,
        maxContextTokens: 2000
      });

      // Allow async CLI spawn to start
      await new Promise((r) => setTimeout(r, 400));

      // 1. Verify prompt enrichment delivered to adapter
      expect(mockClaude.lastReceivedPrompt).toBeDefined();
      expect(mockClaude.lastReceivedPrompt).toContain('--- USER PROMPT ---');
      expect(mockClaude.lastReceivedPrompt).toContain(prompt);

      // 2. Verify Skills were resolved, loaded and injected
      expect(mockClaude.lastReceivedPrompt).toContain('--- SKILL INSTRUCTIONS ---');
      expect(mockClaude.lastReceivedPrompt).toMatch(/Skill: (Security Review|Code Review)/i);

      // 3. Verify Context was retrieved and injected
      expect(mockClaude.lastReceivedPrompt).toContain('--- PROJECT CONTEXT ---');
      expect(mockClaude.lastReceivedPrompt).toContain('authenticateUser');

      // 4. Verify Context and Skills status was persisted in SQLite
      const messages = databaseService.getCLISessionMessages(sessionId);
      expect(messages.length).toBeGreaterThanOrEqual(2);

      const sysMsg = messages.find((m) => m.role === 'system');
      expect(sysMsg).toBeDefined();
      expect(sysMsg?.content).toContain('[Context & Skills]');
      expect(sysMsg?.content).toContain('Context:');
      expect(sysMsg?.content).toContain('Skills:');
    });

    it('bypasses Context retrieval when enableContext is false', async () => {
      const sessionId = 'session-e2e-no-context';
      const prompt = 'Please perform a code review on this feature';

      await executionEngine.execute({
        sessionId,
        provider: 'claude',
        prompt,
        workingDirectory: workspaceDir,
        projectId,
        enableContext: false,
        enableSkills: true
      });

      await new Promise((r) => setTimeout(r, 400));

      expect(mockClaude.lastReceivedPrompt).toBeDefined();
      expect(mockClaude.lastReceivedPrompt).toContain('--- USER PROMPT ---');
      expect(mockClaude.lastReceivedPrompt).toContain('--- SKILL INSTRUCTIONS ---');
      expect(mockClaude.lastReceivedPrompt).not.toContain('--- PROJECT CONTEXT ---');
    });

    it('bypasses Skills resolution when enableSkills is false', async () => {
      const versionFile = path.join(workspaceDir, 'version.ts');
      fs.writeFileSync(versionFile, 'export const appVersion = "1.0.0";');

      databaseService.upsertFileIndex(
        versionFile,
        'hash2',
        50,
        Date.now(),
        'typescript',
        [],
        [
          {
            id: 'chunk-2',
            filePath: versionFile,
            startLine: 1,
            endLine: 5,
            content: 'export const appVersion = "1.0.0";'
          }
        ]
      );

      const sessionId = 'session-e2e-no-skills';
      const prompt = 'appVersion check';

      await executionEngine.execute({
        sessionId,
        provider: 'gemini',
        prompt,
        workingDirectory: workspaceDir,
        projectId,
        enableContext: true,
        enableSkills: false
      });

      await new Promise((r) => setTimeout(r, 400));

      expect(mockGemini.lastReceivedPrompt).toBeDefined();
      expect(mockGemini.lastReceivedPrompt).not.toContain('--- SKILL INSTRUCTIONS ---');
    });

    it('proceeds with raw prompt when both Context and Skills are disabled', async () => {
      const sessionId = 'session-e2e-none';
      const prompt = 'Hello assistant!';

      await executionEngine.execute({
        sessionId,
        provider: 'codex',
        prompt,
        workingDirectory: workspaceDir,
        projectId,
        enableContext: false,
        enableSkills: false
      });

      await new Promise((r) => setTimeout(r, 400));

      expect(mockCodex.lastReceivedPrompt).toBe(prompt);
    });
  });

  describe('2. Edge Cases: Empty Index, No Skills, Missing Project, Retrieval Errors & Token Budgets', () => {
    it('handles empty project index gracefully without throwing', async () => {
      const sessionId = 'session-e2e-empty-index';
      const prompt = 'Explain obscureNonExistentFeature';

      await executionEngine.execute({
        sessionId,
        provider: 'claude',
        prompt,
        workingDirectory: workspaceDir,
        projectId,
        enableContext: true,
        enableSkills: true
      });

      await new Promise((r) => setTimeout(r, 400));

      expect(mockClaude.lastReceivedPrompt).toBeDefined();
      expect(mockClaude.lastReceivedPrompt).not.toContain('--- PROJECT CONTEXT ---');
    });

    it('handles missing project ID gracefully by resolving from workingDirectory', async () => {
      const sessionId = 'session-e2e-missing-project-id';
      const prompt = 'Check workspace status';

      await executionEngine.execute({
        sessionId,
        provider: 'codex',
        prompt,
        workingDirectory: workspaceDir,
        // Omit projectId
        enableContext: false,
        enableSkills: false
      });

      await new Promise((r) => setTimeout(r, 400));

      expect(mockCodex.lastReceivedPrompt).toBe(prompt);

      const session = databaseService.getCLISession(sessionId);
      expect(session).toBeDefined();
      expect(['running', 'completed']).toContain(session?.status);
    });

    it('falls back to raw prompt if context retrieval throws an error', async () => {
      const sessionId = 'session-e2e-retrieval-error';
      const prompt = 'Trigger retrieval error test';

      vi.spyOn(contextRetrievalService, 'retrieve').mockRejectedValueOnce(new Error('Simulated DB Retrieval Crash'));

      await executionEngine.execute({
        sessionId,
        provider: 'claude',
        prompt,
        workingDirectory: workspaceDir,
        projectId,
        enableContext: true,
        enableSkills: false
      });

      await new Promise((r) => setTimeout(r, 400));

      expect(mockClaude.lastReceivedPrompt).toBe(prompt);
      vi.restoreAllMocks();
    });

    it('enforces token budget limits during context assembly', async () => {
      const largeContent = Array.from({ length: 300 }, (_, i) => `const var_${i} = ${i};`).join('\n');
      const largeFile = path.join(workspaceDir, 'large.ts');
      fs.writeFileSync(largeFile, largeContent);

      databaseService.upsertFileIndex(
        largeFile,
        'hash-large',
        largeContent.length,
        Date.now(),
        'typescript',
        [],
        [
          {
            id: 'chunk-large',
            filePath: largeFile,
            startLine: 1,
            endLine: 300,
            content: largeContent
          }
        ]
      );

      const sessionId = 'session-e2e-token-limit';
      const prompt = 'var_10 check';

      await executionEngine.execute({
        sessionId,
        provider: 'claude',
        prompt,
        workingDirectory: workspaceDir,
        projectId,
        enableContext: true,
        enableSkills: false,
        maxContextTokens: 100 // Very tight token budget
      });

      await new Promise((r) => setTimeout(r, 400));

      expect(mockClaude.lastReceivedPrompt).toBeDefined();
      expect(mockClaude.lastReceivedPrompt!.length).toBeLessThan(largeContent.length);
    });
  });

  describe('3. Multi-Provider & Ollama Routing', () => {
    it('routes requests to Ollama when Air-Gap is active regardless of requested provider', async () => {
      airGapManager.updateConfig({ enabled: true });

      // Mock ollamaAdapter canExecute to use CLI mock
      vi.spyOn(ollamaAdapter, 'canExecute').mockResolvedValue({
        provider: 'ollama',
        isInstalled: true,
        canExecute: true,
        mode: 'cli',
        resolvedPath: process.execPath
      });

      const sessionId = 'session-e2e-airgap-routing';
      const prompt = 'Local air gap prompt';

      await executionEngine.execute({
        sessionId,
        provider: 'claude', // Cloud provider requested
        prompt,
        workingDirectory: workspaceDir,
        projectId,
        enableContext: false,
        enableSkills: false
      });

      await new Promise((r) => setTimeout(r, 400));

      // Ollama adapter was invoked due to air-gap routing
      expect(mockOllama.lastReceivedPrompt).toBe(prompt);
    });
  });
});
