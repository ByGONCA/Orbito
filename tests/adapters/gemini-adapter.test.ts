import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { GeminiAdapter } from '../../src/main/cli/adapters/gemini.adapter';

describe('GeminiAdapter Unit Tests (Mocked)', () => {
  let adapter: GeminiAdapter;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    adapter = new GeminiAdapter();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('reports capabilities correctly', () => {
    expect(adapter.provider).toBe('gemini');
    expect(adapter.capabilities.supportsStreaming).toBe(true);
    expect(adapter.capabilities.supportsResume).toBe(false);
    expect(adapter.capabilities.supportsHeadlessPrompt).toBe(true);
  });

  it('builds execution command spec with prompt argument', () => {
    const cmd = adapter.buildCommand('Analyze database model', 'C:/my-project');
    expect(cmd.executable).toBe('gemini');
    expect(cmd.args).toEqual(['prompt', 'Analyze database model']);
  });

  it('detects authentication when GEMINI_API_KEY environment variable is set', async () => {
    process.env.GEMINI_API_KEY = 'AIzaSyTestGeminiKey1234567890';
    const auth = await adapter.checkAuth('gemini');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.authType).toBe('api-key');
  });

  it('detects authentication when Google ADC file is present', async () => {
    delete process.env.GEMINI_API_KEY;

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const auth = await adapter.checkAuth('gemini');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.authType).toBe('adc');
  });

  it('reports unauthenticated when neither API key nor ADC exists', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const auth = await adapter.checkAuth('gemini');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.authType).toBe('missing');
  });
});
