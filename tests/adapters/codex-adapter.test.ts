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

  it('reports capabilities correctly (stateless, no resume)', () => {
    expect(adapter.provider).toBe('codex');
    expect(adapter.capabilities.supportsStreaming).toBe(true);
    expect(adapter.capabilities.supportsResume).toBe(false); // Official reality: stateless
    expect(adapter.capabilities.supportsHeadlessPrompt).toBe(true);
    expect(adapter.capabilities.supportsJsonOutput).toBe(true);
  });

  it('builds execution command spec with exec argument', () => {
    const cmd = adapter.buildCommand('Refactor function', 'C:/my-project');
    expect(cmd.executable).toBe('codex');
    expect(cmd.args).toEqual(['exec', 'Refactor function']);
  });

  it('detects authentication when OPENAI_API_KEY environment variable is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-proj-test-openai-key-1234567890';
    const auth = await adapter.checkAuth('codex');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.authType).toBe('api-key');
  });

  it('detects authentication when ~/.codex/config.json exists with api_key', async () => {
    delete process.env.OPENAI_API_KEY;

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ api_key: 'sk-12345' }));

    const auth = await adapter.checkAuth('codex');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.authType).toBe('api-key');
  });

  it('reports unauthenticated when neither key nor config exists', async () => {
    delete process.env.OPENAI_API_KEY;
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const auth = await adapter.checkAuth('codex');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.authType).toBe('missing');
  });
});
