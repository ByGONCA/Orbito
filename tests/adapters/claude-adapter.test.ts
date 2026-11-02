import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { ClaudeCodeAdapter } from '../../src/main/cli/adapters/claude-code.adapter';

describe('ClaudeCodeAdapter Unit Tests (Mocked)', () => {
  let adapter: ClaudeCodeAdapter;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    adapter = new ClaudeCodeAdapter();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('reports capabilities correctly', () => {
    expect(adapter.provider).toBe('claude');
    expect(adapter.capabilities.supportsStreaming).toBe(true);
    expect(adapter.capabilities.supportsResume).toBe(true);
    expect(adapter.capabilities.supportsHeadlessPrompt).toBe(true);
    expect(adapter.capabilities.supportsJsonOutput).toBe(false);
  });

  it('builds standard non-interactive command spec with -p flag', () => {
    const cmd = adapter.buildCommand('Explain architecture', 'C:/my-project');
    expect(cmd.executable).toBe('claude');
    expect(cmd.args).toContain('-p');
    expect(cmd.args).toContain('Explain architecture');
  });

  it('builds resume command spec when resumeSessionId is supplied', () => {
    const cmd = adapter.buildCommand('Follow-up message', 'C:/my-project', 'session-xyz-123');
    expect(cmd.args).toContain('resume');
    expect(cmd.args).toContain('session-xyz-123');
    expect(cmd.args).toContain('-p');
    expect(cmd.args).toContain('Follow-up message');
  });

  it('detects authentication when ANTHROPIC_API_KEY environment variable is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-valid-test-key-1234567890';
    const auth = await adapter.checkAuth('claude');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.authType).toBe('api-key');
  });

  it('detects authentication when ~/.claude.json contains valid session', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ oauthAccount: { email: 'dev@test.com' }, sessionToken: 'tok-123' })
    );

    const auth = await adapter.checkAuth('claude');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.authType).toBe('oauth');
  });

  it('reports unauthenticated when no key or config exists', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const auth = await adapter.checkAuth('claude');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.authType).toBe('missing');
  });

  it('detects custom executable path if provided and exists on disk', async () => {
    const customBin = path.join(os.tmpdir(), 'mock-claude.exe');
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === customBin);

    const status = await adapter.detect(customBin);
    expect(status.isInstalled).toBe(true);
    expect(status.resolvedPath).toBe(path.resolve(customBin));
  });
});
