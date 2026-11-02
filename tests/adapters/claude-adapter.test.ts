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

  it('reports capabilities correctly (streaming, resume, headless prompt, json output)', () => {
    expect(adapter.provider).toBe('claude');
    expect(adapter.capabilities.supportsStreaming).toBe(true);
    expect(adapter.capabilities.supportsResume).toBe(true);
    expect(adapter.capabilities.supportsHeadlessPrompt).toBe(true);
    expect(adapter.capabilities.supportsJsonOutput).toBe(true);
  });

  it('builds standard non-interactive command spec with -p flag and stream-json format', () => {
    const cmd = adapter.buildCommand('Explain architecture', 'C:/my-project');
    expect(cmd.executable).toBe('claude');
    expect(cmd.args).toEqual(['-p', 'Explain architecture', '--output-format', 'stream-json', '--verbose']);
  });

  it('builds resume command spec when resumeSessionId is supplied', () => {
    const cmd = adapter.buildCommand('Follow-up message', 'C:/my-project', 'session-xyz-123');
    expect(cmd.executable).toBe('claude');
    expect(cmd.args).toEqual([
      '-p',
      'Follow-up message',
      '--output-format',
      'stream-json',
      '--verbose',
      '--resume',
      'session-xyz-123'
    ]);
  });

  it('builds resume command spec with --resume when resumeSessionId is --last', () => {
    const cmd = adapter.buildCommand('Follow-up message', 'C:/my-project', '--last');
    expect(cmd.args).toEqual([
      '-p',
      'Follow-up message',
      '--output-format',
      'stream-json',
      '--verbose',
      '--resume'
    ]);
  });

  it('detects authentication when ANTHROPIC_API_KEY environment variable is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-valid-test-key-1234567890';
    const auth = await adapter.checkAuth('claude');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.state).toBe('authenticated');
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
    expect(auth.state).toBe('authenticated');
    expect(auth.authType).toBe('oauth');
  });

  it('detects authentication_expired when session expiresAt is in the past', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ oauthAccount: { email: 'dev@test.com', expiresAt: Date.now() - 60000 } })
    );

    const auth = await adapter.checkAuth('claude');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.state).toBe('authentication_expired');
  });

  it('detects configured when config file exists but is empty', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({}));

    const auth = await adapter.checkAuth('claude');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.state).toBe('configured');
  });

  it('detects authentication_required when no credentials or config exists', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const auth = await adapter.checkAuth('claude');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.state).toBe('authentication_required');
    expect(auth.authType).toBe('missing');
  });

  it('detects error state if ~/.claude.json is corrupted', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{ corrupt json invalid syntax');

    const auth = await adapter.checkAuth('claude');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.state).toBe('error');
    expect(auth.details).toContain('Error reading ~/.claude.json');
  });

  it('detects custom executable path if provided and exists on disk', async () => {
    const customBin = path.join(os.tmpdir(), 'mock-claude.exe');
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === customBin);

    const status = await adapter.detect(customBin);
    expect(status.isInstalled).toBe(true);
    expect(status.resolvedPath).toBe(path.resolve(customBin));
  });
});
