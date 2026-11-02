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

  it('reports capabilities correctly (streaming, headless prompt, json output; no resume)', () => {
    expect(adapter.provider).toBe('gemini');
    expect(adapter.capabilities.supportsStreaming).toBe(true);
    expect(adapter.capabilities.supportsResume).toBe(false);
    expect(adapter.capabilities.supportsHeadlessPrompt).toBe(true);
    expect(adapter.capabilities.supportsJsonOutput).toBe(true);
  });

  it('builds execution command spec with official -p argument and stream-json format', () => {
    const cmd = adapter.buildCommand('Analyze database model', 'C:/my-project');
    expect(cmd.executable).toBe('gemini');
    expect(cmd.args).toEqual(['-p', 'Analyze database model', '--output-format', 'stream-json']);
  });

  it('detects authentication when GEMINI_API_KEY environment variable is set', async () => {
    process.env.GEMINI_API_KEY = 'AIzaSyTestGeminiKey1234567890';
    const auth = await adapter.checkAuth('gemini');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.state).toBe('authenticated');
    expect(auth.authType).toBe('api-key');
  });

  it('detects authentication when Google ADC file is present and valid', async () => {
    delete process.env.GEMINI_API_KEY;

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        client_id: 'mock-client.apps.googleusercontent.com',
        client_secret: 'mock-secret',
        refresh_token: 'mock-refresh-token',
        type: 'authorized_user'
      })
    );

    const auth = await adapter.checkAuth('gemini');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.state).toBe('authenticated');
    expect(auth.authType).toBe('adc');
  });

  it('detects authentication_expired when Google ADC file is expired without refresh token', async () => {
    delete process.env.GEMINI_API_KEY;

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        type: 'authorized_user',
        expiry: new Date(Date.now() - 3600000).toISOString()
      })
    );

    const auth = await adapter.checkAuth('gemini');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.state).toBe('authentication_expired');
  });

  it('detects configured when ADC file exists but is empty', async () => {
    delete process.env.GEMINI_API_KEY;

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({}));

    const auth = await adapter.checkAuth('gemini');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.state).toBe('configured');
  });

  it('reports authentication_required when neither API key nor ADC exists', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const auth = await adapter.checkAuth('gemini');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.state).toBe('authentication_required');
    expect(auth.authType).toBe('missing');
  });

  it('reports error when ADC file contains invalid JSON', async () => {
    delete process.env.GEMINI_API_KEY;
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{ broken json');

    const auth = await adapter.checkAuth('gemini');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.state).toBe('error');
  });
});
