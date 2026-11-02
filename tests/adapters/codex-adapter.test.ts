import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { CodexAdapter } from '../../src/main/cli/adapters/codex.adapter';

describe('CodexAdapter Unit Tests (Mocked)', () => {
  let adapter: CodexAdapter;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    adapter = new CodexAdapter();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('reports capabilities correctly (streaming, resume, headless prompt, json output)', () => {
    expect(adapter.provider).toBe('codex');
    expect(adapter.capabilities.supportsStreaming).toBe(true);
    expect(adapter.capabilities.supportsResume).toBe(true);
    expect(adapter.capabilities.supportsHeadlessPrompt).toBe(true);
    expect(adapter.capabilities.supportsJsonOutput).toBe(true);
  });

  it('builds execution command spec with exec argument and --json output', () => {
    const cmd = adapter.buildCommand('Refactor function', 'C:/my-project');
    expect(cmd.executable).toBe('codex');
    expect(cmd.args).toEqual(['exec', 'Refactor function', '--json']);
  });

  it('builds execution command with resume session ID and --json', () => {
    const cmd = adapter.buildCommand('Continue refactoring', 'C:/my-project', 'sess-abc-789');
    expect(cmd.executable).toBe('codex');
    expect(cmd.args).toEqual(['exec', 'resume', 'sess-abc-789', 'Continue refactoring', '--json']);
  });

  it('builds execution command with resume --last and --json', () => {
    const cmd = adapter.buildCommand('Continue refactoring', 'C:/my-project', '--last');
    expect(cmd.executable).toBe('codex');
    expect(cmd.args).toEqual(['exec', 'resume', '--last', 'Continue refactoring', '--json']);
  });

  it('detects authentication when OPENAI_API_KEY environment variable is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-proj-test-openai-key-1234567890';
    const auth = await adapter.checkAuth('codex');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.state).toBe('authenticated');
    expect(auth.authType).toBe('api-key');
  });

  it('detects authentication when ~/.codex/config.json exists with api_key', async () => {
    delete process.env.OPENAI_API_KEY;

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ api_key: 'sk-12345' }));

    const auth = await adapter.checkAuth('codex');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.state).toBe('authenticated');
    expect(auth.authType).toBe('api-key');
  });

  it('detects authentication_expired when config token has expired', async () => {
    delete process.env.OPENAI_API_KEY;

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ expires_at: Date.now() - 3600000 }));

    const auth = await adapter.checkAuth('codex');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.state).toBe('authentication_expired');
  });

  it('detects configured when config file exists but is empty', async () => {
    delete process.env.OPENAI_API_KEY;

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({}));

    const auth = await adapter.checkAuth('codex');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.state).toBe('configured');
  });

  it('reports authentication_required when neither key nor config exists', async () => {
    delete process.env.OPENAI_API_KEY;
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const auth = await adapter.checkAuth('codex');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.state).toBe('authentication_required');
    expect(auth.authType).toBe('missing');
  });

  it('reports error when config file has invalid JSON', async () => {
    delete process.env.OPENAI_API_KEY;
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{ broken json');

    const auth = await adapter.checkAuth('codex');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.state).toBe('error');
  });
});
