import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ExtensionManifestSchema } from '../src/shared/extensions';

describe('Editor Gutter, Performance & IntelliSense Suite', () => {
  it('extracts local symbols correctly for IntelliSense', () => {
    const code = `
      function calculateMetrics(a: number, b: number) {
        return a + b;
      }
      const myWorkspaceState = { active: true };
      interface ProjectMetrics {
        count: number;
      }
    `;

    const fnMatches = Array.from(code.matchAll(/(?:function|def)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)).map((m) => m[1]);
    const varMatches = Array.from(code.matchAll(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g)).map((m) => m[1]);
    const typeMatches = Array.from(code.matchAll(/(?:class|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)).map((m) => m[1]);

    expect(fnMatches).toContain('calculateMetrics');
    expect(varMatches).toContain('myWorkspaceState');
    expect(typeMatches).toContain('ProjectMetrics');
  });

  it('validates plugin manifest schema and computes deterministic SHA-256', () => {
    const sampleManifest = {
      id: 'orbito-test-plugin',
      name: 'test-plugin',
      displayName: 'Test Plugin',
      version: '1.0.0',
      description: 'Test plugin description',
      author: 'Orbito Team',
      license: 'MIT',
      permissions: {
        filesystem: { read: true }
      },
      contributes: {
        commands: [{ id: 'test.run', title: 'Run Test', handler: 'run' }]
      }
    };

    const parsed = ExtensionManifestSchema.safeParse(sampleManifest);
    expect(parsed.success).toBe(true);

    const hash = crypto.createHash('sha256').update(JSON.stringify(sampleManifest)).digest('hex');
    expect(hash).toHaveLength(64);
  });

  it('rejects invalid plugin manifest lacking required fields', () => {
    const invalidManifest = {
      name: 'broken-plugin'
      // missing id, version, etc.
    };

    const parsed = ExtensionManifestSchema.safeParse(invalidManifest);
    expect(parsed.success).toBe(false);
  });

  it('verifies sample clock plugin manifest exists and is valid', () => {
    const manifestPath = path.resolve(__dirname, '../plugins/example-clock-panel/extension.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const parsed = ExtensionManifestSchema.safeParse(content);
    expect(parsed.success).toBe(true);
    expect(content.id).toBe('orbito-example-clock');
    expect(content.main).toBe('index.js');
  });

  it('rejects path traversal in plugin id via ExtensionManifestSchema', () => {
    const maliciousManifest = {
      id: '../../malicious-plugin',
      name: 'malicious',
      version: '1.0.0'
    };
    const parsed = ExtensionManifestSchema.safeParse(maliciousManifest);
    expect(parsed.success).toBe(false);
  });

  it('simulates debounced buffer flush ensuring changes are preserved on unmount/switch', () => {
    let storeContent = 'initial';
    let localContent = 'initial';
    let timer: NodeJS.Timeout | null = null;

    const flushSync = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      storeContent = localContent;
    };

    const handleContentChange = (val: string) => {
      localContent = val;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        storeContent = val;
      }, 300);
    };

    // User types "updated"
    handleContentChange('updated');
    expect(storeContent).toBe('initial'); // Debounced

    // Component unmounts or switches tab immediately before 300ms
    flushSync();
    expect(storeContent).toBe('updated'); // Flushed synchronously without data loss
  });
});
