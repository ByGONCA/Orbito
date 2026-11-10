import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { ExecutionEngine } from '../src/main/cli/execution-engine';
import { cliManager } from '../src/main/cli/cli-manager';
import { databaseService } from '../src/main/db/database.service';
import type { ICLIAdapter, CommandSpec } from '../src/main/cli/adapter.interface';
import type { CLIProvider, CLIInstallationStatus, CLIAuthStatus, CLICapabilities } from '../src/shared/cli';

const TEST_DIR = path.join(process.cwd(), '.test-exec-working-dir');

// Mock adapter using node child process to simulate real CLI streaming
class MockStreamingAdapter implements ICLIAdapter {
  public readonly provider: CLIProvider = 'claude';
  public readonly capabilities: CLICapabilities = {
    supportsStreaming: true,
    supportsResume: true,
    supportsHeadlessPrompt: true,
    supportsJsonOutput: false
  };

  public async detect(): Promise<CLIInstallationStatus> {
    return {
      provider: 'claude',
      isInstalled: true,
      resolvedPath: process.execPath, // Use current node executable
      version: '1.0.0',
      isCompatible: true,
      requiresUpdate: false,
      installGuideUrl: 'https://test.com'
    };
  }

  public async checkAuth(): Promise<CLIAuthStatus> {
    return { provider: 'claude', isAuthenticated: true, authType: 'api-key' };
  }

  public buildCommand(prompt: string): CommandSpec {
    // Run an inline node script that prints stdout, stderr and exits
    const script = `
      console.log('START: ' + process.argv[1]);
      console.error('DIAGNOSTIC: ready');
      console.log('COMPLETE: done');
    `;
    return {
      executable: process.execPath,
      args: ['-e', script, prompt]
    };
  }
}

describe('ExecutionEngine Integration Tests (Controlled Subprocesses)', () => {
  let engine: ExecutionEngine;

  beforeEach(() => {
    try {
      if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    } catch {
      // Ignore initial cleanup lock
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });

    databaseService.initialize();
    databaseService.getAppDb().prepare('DELETE FROM cli_session_messages').run();
    databaseService.getAppDb().prepare('DELETE FROM cli_sessions').run();

    engine = new ExecutionEngine();
    cliManager.registerAdapter(new MockStreamingAdapter());
  });

  afterEach(() => {
    databaseService.close();
    try {
      if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    } catch {
      // Ignore residual Windows process unlock latency
    }
  });

  it('spawns child process, streams stdout and stderr, and exits with code 0', async () => {
    const events: any[] = [];
    engine.on('stream', (ev) => events.push(ev));

    const sessionId = `test-sess-${Date.now()}`;
    await engine.execute({
      sessionId,
      provider: 'claude',
      prompt: 'Test Prompt Input',
      workingDirectory: TEST_DIR,
      projectId: 'proj-123'
    });

    // Wait for process to exit cleanly
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Verify stream events
    const stdoutEvents = events.filter((e) => e.type === 'stdout');
    const stderrEvents = events.filter((e) => e.type === 'stderr');
    const exitEvents = events.filter((e) => e.type === 'exit');

    expect(stdoutEvents.length).toBeGreaterThan(0);
    expect(stdoutEvents.map((e) => e.content).join('')).toContain('START: Test Prompt Input');
    expect(stderrEvents.map((e) => e.content).join('')).toContain('DIAGNOSTIC: ready');
    expect(exitEvents.length).toBe(1);
    expect(exitEvents[0].exitCode).toBe(0);

    // Verify SQLite session record
    const sessions = databaseService.listCLISessions('proj-123');
    expect(sessions.length).toBe(1);
    expect(sessions[0].status).toBe('completed');
    expect(sessions[0].exitCode).toBe(0);

    // Verify messages persisted
    const messages = databaseService.getCLISessionMessages(sessionId);
    expect(messages.length).toBeGreaterThanOrEqual(3); // user prompt + stdout + stderr
  });

  it('cancels active process cleanly and records cancelled status', async () => {
    // Adapter that runs a long-running process
    class LongRunningAdapter extends MockStreamingAdapter {
      public buildCommand(): CommandSpec {
        return {
          executable: process.execPath,
          args: ['-e', 'setTimeout(() => {}, 30000);']
        };
      }
    }
    cliManager.registerAdapter(new LongRunningAdapter());

    const sessionId = `test-cancel-${Date.now()}`;
    await engine.execute({
      sessionId,
      provider: 'claude',
      prompt: 'Long running task',
      workingDirectory: TEST_DIR
    });

    // Cancel after 100ms
    await new Promise((resolve) => setTimeout(resolve, 100));
    const cancelled = await engine.cancel(sessionId);
    expect(cancelled).toBe(true);

    const sessions = databaseService.listCLISessions();
    const target = sessions.find((s) => s.id === sessionId);
    expect(target).toBeDefined();
    expect(target?.status).toBe('cancelled');
    expect(target?.exitCode).toBe(130);
  });
});
