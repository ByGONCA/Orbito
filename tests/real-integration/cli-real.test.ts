import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { claudeCodeAdapter } from '../../src/main/cli/adapters/claude-code.adapter';
import { codexAdapter } from '../../src/main/cli/adapters/codex.adapter';
import { geminiAdapter } from '../../src/main/cli/adapters/gemini.adapter';
import { executionEngine } from '../../src/main/cli/execution-engine';
import { databaseService } from '../../src/main/db/database.service';

const TEST_DIR = path.join(process.cwd(), '.test-real-integration-dir');

describe('Real CLI Live Integration Tests (Optional / Environment-Aware)', () => {
  beforeAll(async () => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });

    databaseService.initialize();
  });

  afterAll(async () => {
    databaseService.close();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('Claude Code CLI: live execution and streaming if installed and authenticated', async (ctx) => {
    const detect = await claudeCodeAdapter.detect();
    const auth = await claudeCodeAdapter.checkAuth(detect.resolvedPath);

    if (!detect.isInstalled || !auth.isAuthenticated) {
      console.log(`[REAL TEST SKIPPED] Claude Code not ready (installed: ${detect.isInstalled}, auth: ${auth.state})`);
      ctx.skip();
      return;
    }

    const sessionId = `live-claude-${Date.now()}`;
    const events: any[] = [];
    const streamListener = (ev: any) => {
      if (ev.sessionId === sessionId) events.push(ev);
    };
    executionEngine.on('stream', streamListener);

    try {
      await executionEngine.execute({
        sessionId,
        provider: 'claude',
        prompt: 'Say HELLO and nothing else.',
        workingDirectory: TEST_DIR,
        projectId: 'live-test-project'
      });

      // Wait for process completion (up to 30s)
      const start = Date.now();
      while (Date.now() - start < 30000) {
        const exitEvent = events.find((e) => e.type === 'exit');
        if (exitEvent) break;
        await new Promise((r) => setTimeout(r, 500));
      }

      const exitEvent = events.find((e) => e.type === 'exit');
      if (exitEvent && exitEvent.exitCode !== 0) {
        console.error('Claude CLI error events:', events);
      }
      expect(exitEvent).toBeDefined();
      expect(exitEvent?.exitCode).toBe(0);

      const stdoutEvents = events.filter((e) => e.type === 'stdout');
      expect(stdoutEvents.length).toBeGreaterThan(0);

      // Verify SQLite persistence
      const session = databaseService.getCLISession(sessionId);
      expect(session).toBeDefined();
      expect(session?.status).toBe('completed');
      expect(session?.exitCode).toBe(0);

      const messages = databaseService.getCLISessionMessages(sessionId);
      expect(messages.length).toBeGreaterThanOrEqual(2);
    } finally {
      executionEngine.off('stream', streamListener);
    }
  }, 40000);

  it('OpenAI Codex CLI: live execution and streaming if installed and authenticated', async (ctx) => {
    const detect = await codexAdapter.detect();
    const auth = await codexAdapter.checkAuth(detect.resolvedPath);

    if (!detect.isInstalled || !auth.isAuthenticated) {
      console.log(`[REAL TEST SKIPPED] Codex CLI not ready (installed: ${detect.isInstalled}, auth: ${auth.state})`);
      ctx.skip();
      return;
    }

    const sessionId = `live-codex-${Date.now()}`;
    const events: any[] = [];
    const streamListener = (ev: any) => {
      if (ev.sessionId === sessionId) events.push(ev);
    };
    executionEngine.on('stream', streamListener);

    try {
      await executionEngine.execute({
        sessionId,
        provider: 'codex',
        prompt: 'Say HELLO and nothing else.',
        workingDirectory: TEST_DIR,
        projectId: 'live-test-project'
      });

      const start = Date.now();
      while (Date.now() - start < 30000) {
        const exitEvent = events.find((e) => e.type === 'exit');
        if (exitEvent) break;
        await new Promise((r) => setTimeout(r, 500));
      }

      const exitEvent = events.find((e) => e.type === 'exit');
      if (exitEvent && exitEvent.exitCode !== 0) {
        console.error('Claude CLI error events:', events);
      }
      expect(exitEvent).toBeDefined();
      expect(exitEvent?.exitCode).toBe(0);

      const stdoutEvents = events.filter((e) => e.type === 'stdout');
      expect(stdoutEvents.length).toBeGreaterThan(0);

      const session = databaseService.getCLISession(sessionId);
      expect(session?.status).toBe('completed');
      expect(session?.exitCode).toBe(0);
    } finally {
      executionEngine.off('stream', streamListener);
    }
  }, 40000);

  it('Google Gemini CLI: live execution and streaming if installed and authenticated', async (ctx) => {
    const detect = await geminiAdapter.detect();
    const auth = await geminiAdapter.checkAuth(detect.resolvedPath);

    if (!detect.isInstalled || !auth.isAuthenticated) {
      console.log(`[REAL TEST SKIPPED] Gemini CLI not ready (installed: ${detect.isInstalled}, auth: ${auth.state})`);
      ctx.skip();
      return;
    }

    const sessionId = `live-gemini-${Date.now()}`;
    const events: any[] = [];
    const streamListener = (ev: any) => {
      if (ev.sessionId === sessionId) events.push(ev);
    };
    executionEngine.on('stream', streamListener);

    try {
      await executionEngine.execute({
        sessionId,
        provider: 'gemini',
        prompt: 'Say HELLO and nothing else.',
        workingDirectory: TEST_DIR,
        projectId: 'live-test-project'
      });

      const start = Date.now();
      while (Date.now() - start < 30000) {
        const exitEvent = events.find((e) => e.type === 'exit');
        if (exitEvent) break;
        await new Promise((r) => setTimeout(r, 500));
      }

      const exitEvent = events.find((e) => e.type === 'exit');
      if (exitEvent && exitEvent.exitCode !== 0) {
        console.error('Claude CLI error events:', events);
      }
      expect(exitEvent).toBeDefined();
      expect(exitEvent?.exitCode).toBe(0);

      const stdoutEvents = events.filter((e) => e.type === 'stdout');
      expect(stdoutEvents.length).toBeGreaterThan(0);

      const session = databaseService.getCLISession(sessionId);
      expect(session?.status).toBe('completed');
      expect(session?.exitCode).toBe(0);
    } finally {
      executionEngine.off('stream', streamListener);
    }
  }, 40000);

  it('Live Process Cancellation: cancels a real running CLI session if any CLI is authenticated', async (ctx) => {
    const providers = [
      { adapter: claudeCodeAdapter, name: 'claude' as const },
      { adapter: codexAdapter, name: 'codex' as const },
      { adapter: geminiAdapter, name: 'gemini' as const }
    ];

    let chosenProvider: 'claude' | 'codex' | 'gemini' | null = null;
    for (const p of providers) {
      const d = await p.adapter.detect();
      const a = await p.adapter.checkAuth(d.resolvedPath);
      if (d.isInstalled && a.isAuthenticated) {
        chosenProvider = p.name;
        break;
      }
    }

    if (!chosenProvider) {
      console.log('[REAL TEST SKIPPED] No CLI is authenticated to test live cancellation.');
      ctx.skip();
      return;
    }

    const sessionId = `live-cancel-${Date.now()}`;
    await executionEngine.execute({
      sessionId,
      provider: chosenProvider,
      prompt: 'Write a comprehensive 2000-word essay about the evolution of compiler theory.',
      workingDirectory: TEST_DIR,
      projectId: 'live-test-project'
    });

    // Wait a brief moment for the process to spawn
    await new Promise((r) => setTimeout(r, 400));

    const cancelled = await executionEngine.cancel(sessionId);
    expect(cancelled).toBe(true);

    const session = databaseService.getCLISession(sessionId);
    expect(session?.status).toBe('cancelled');
  }, 20000);
});
