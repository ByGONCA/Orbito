import { describe, it, expect, vi } from 'vitest';
import { cliManager } from '../../src/main/cli/cli-manager';
import type { CLIProvider } from '../../src/shared/cli';

const REQUIRED_30_AGENTS: CLIProvider[] = [
  'aider',
  'amp',
  'ante',
  'auggie',
  'claude',
  'cline',
  'codex',
  'codebuddy',
  'codebuff',
  'continue',
  'crush',
  'cursor',
  'devin',
  'droid',
  'gemini',
  'copilot',
  'goose',
  'hermes',
  'kilocode',
  'kimi',
  'kiro',
  'vibe',
  'opencode',
  'openhands',
  'pi',
  'qwen',
  'roocode',
  'rovo',
  'trae',
  'zed'
];

describe('Orbito — Complete AI CLI Agent Integration System (30 Agents)', () => {
  it('registers all 30 required AI CLI agents with zero duplicates', () => {
    const allProviders = cliManager.listAllProviders();
    const uniqueProviders = new Set(allProviders);

    expect(uniqueProviders.size).toBe(allProviders.length);

    for (const required of REQUIRED_30_AGENTS) {
      expect(allProviders).toContain(required);
      const adapter = cliManager.getAdapter(required);
      expect(adapter).toBeDefined();
      expect(adapter.provider).toBe(required);
      expect(adapter.capabilities).toBeDefined();
      expect(typeof adapter.capabilities.supportsStreaming).toBe('boolean');
    }
  });

  it('verifies that each adapter builds safe, valid command specifications', () => {
    for (const provider of REQUIRED_30_AGENTS) {
      const adapter = cliManager.getAdapter(provider);
      const spec = adapter.buildCommand('Explain this code', '/workspace/test-project');

      expect(spec.executable).toBeDefined();
      expect(spec.executable.length).toBeGreaterThan(0);
      expect(Array.isArray(spec.args)).toBe(true);
      expect(spec.args.length).toBeGreaterThan(0);
    }
  });

  it('correctly handles detection for missing binaries without throwing errors', async () => {
    // Test detection with a non-existent path
    const sample = REQUIRED_30_AGENTS.slice(0, 5);
    for (const provider of sample) {
      const adapter = cliManager.getAdapter(provider);
      const result = await adapter.detect('/non/existent/path/binary');

      expect(result).toBeDefined();
      expect(result.provider).toBe(provider);
      expect(typeof result.isInstalled).toBe('boolean');
      expect(result.installGuideUrl).toBeDefined();
      expect(result.installGuideUrl.startsWith('http')).toBe(true);
    }
  }, 30000);

  it('correctly validates authentication states', async () => {
    const sample = REQUIRED_30_AGENTS.slice(0, 5);
    for (const provider of sample) {
      const auth = await cliManager.checkAuth(provider);
      expect(auth).toBeDefined();
      expect(auth.provider).toBe(provider);
      expect(['not_installed', 'installed', 'configured', 'authenticated', 'authentication_required', 'unsupported_platform', 'error']).toContain(auth.state);
      expect(typeof auth.isAuthenticated).toBe('boolean');
    }
  }, 30000);
});
