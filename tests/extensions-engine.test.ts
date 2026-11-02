import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ExtensionManifestSchema } from '../src/shared/extensions';
import { ExtensionLoader } from '../src/main/extensions/extension-loader';
import { ExtensionRegistry } from '../src/main/extensions/extension-registry';
import { NODE_REGISTRY } from '../src/shared/node-registry';
import { airGapManager } from '../src/main/services/air-gap.manager';

describe('Custom Extension SDK & Lifecycle Engine Tests', () => {
  let tempBaseDir: string;
  let extensionDir: string;
  let registry: ExtensionRegistry;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-test-base-'));
    extensionDir = path.join(tempBaseDir, 'sample-extension');
    fs.mkdirSync(extensionDir, { recursive: true });
    registry = new ExtensionRegistry(tempBaseDir);

    airGapManager.updateConfig({ enabled: false });
  });

  afterEach(() => {
    airGapManager.updateConfig({ enabled: false });
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  describe('ExtensionManifestSchema Validation', () => {
    it('validates a compliant extension manifest', () => {
      const valid = {
        id: 'sample-ext',
        name: 'Sample Extension',
        version: '1.0.0',
        description: 'Test extension',
        author: 'Developer',
        permissions: {
          filesystem: { read: true, write: false },
          terminal: { execute: false },
          network: { allowExternal: false }
        },
        contributes: {
          skills: [
            {
              id: 'custom-skill',
              name: 'Custom Skill',
              version: '1.0.0',
              description: 'Custom domain skill'
            }
          ]
        }
      };

      const parsed = ExtensionManifestSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.id).toBe('sample-ext');
        expect(parsed.data.version).toBe('1.0.0');
      }
    });

    it('rejects invalid extension IDs or missing versions', () => {
      const invalidId = {
        id: 'Invalid ID with Spaces!',
        name: 'Invalid Extension',
        version: '1.0.0'
      };
      expect(ExtensionManifestSchema.safeParse(invalidId).success).toBe(false);

      const missingVersion = {
        id: 'valid-id',
        name: 'Valid Name'
      };
      expect(ExtensionManifestSchema.safeParse(missingVersion).success).toBe(false);
    });
  });

  describe('ExtensionLoader & Directory Discovery', () => {
    it('returns error when extension.json is missing', async () => {
      const res = await ExtensionLoader.loadFromDirectory(extensionDir);
      expect(res.error).toBeDefined();
      expect(res.error).toContain("Manifest file 'extension.json' not found");
    });

    it('returns error when extension.json contains invalid JSON', async () => {
      fs.writeFileSync(path.join(extensionDir, 'extension.json'), '{ invalid json }');
      const res = await ExtensionLoader.loadFromDirectory(extensionDir);
      expect(res.error).toBeDefined();
      expect(res.error).toContain("Invalid JSON in 'extension.json'");
    });

    it('computes deterministic SHA-256 checksum across directory files', () => {
      const manifest = JSON.stringify({ id: 'test-ext', name: 'Test', version: '1.0.0' });
      fs.writeFileSync(path.join(extensionDir, 'extension.json'), manifest);
      fs.writeFileSync(path.join(extensionDir, 'README.md'), '# Documentation');

      const sum1 = ExtensionLoader.computeChecksum(extensionDir, manifest);
      const sum2 = ExtensionLoader.computeChecksum(extensionDir, manifest);
      expect(sum1).toBe(sum2);
      expect(sum1).toHaveLength(64); // Hex SHA-256
    });

    it('loads a valid extension and returns complete ExtensionRecord', async () => {
      const manifest = {
        id: 'unit-test-ext',
        name: 'Unit Test Extension',
        version: '1.2.3',
        description: 'For automated tests',
        author: 'QA',
        contributes: {
          nodes: [
            {
              type: 'custom_test_node',
              category: 'dev',
              name: 'Custom Test Node',
              description: 'Contributed by extension',
              icon: 'Box',
              inputs: [{ id: 'in', name: 'Input', type: 'string' }],
              outputs: [{ id: 'out', name: 'Output', type: 'string' }],
              defaultData: {}
            }
          ]
        }
      };

      fs.writeFileSync(path.join(extensionDir, 'extension.json'), JSON.stringify(manifest, null, 2));

      const { record, error } = await ExtensionLoader.loadFromDirectory(extensionDir);
      expect(error).toBeUndefined();
      expect(record).toBeDefined();
      expect(record?.id).toBe('unit-test-ext');
      expect(record?.version).toBe('1.2.3');
      expect(record?.manifest.contributes?.nodes).toHaveLength(1);
    });

    it('enforces Air-Gap isolation by rejecting extensions requiring external network when Air-Gap is active', async () => {
      airGapManager.updateConfig({ enabled: true });

      const manifest = {
        id: 'cloud-sync-ext',
        name: 'Cloud Sync',
        version: '1.0.0',
        permissions: {
          network: { allowExternal: true }
        }
      };

      fs.writeFileSync(path.join(extensionDir, 'extension.json'), JSON.stringify(manifest, null, 2));

      const { record, error } = await ExtensionLoader.loadFromDirectory(extensionDir);
      expect(record).toBeUndefined();
      expect(error).toBeDefined();
      expect(error).toContain('Air-Gap isolation mode');
    });
  });

  describe('Extension Contribution & Activation', () => {
    it('registers contributed custom nodes in React Flow NODE_REGISTRY upon activation', async () => {
      const manifest = {
        id: 'node-ext',
        name: 'Node Contributor',
        version: '1.0.0',
        contributes: {
          nodes: [
            {
              type: 'ext_sample_formatter',
              category: 'logic',
              name: 'Sample Formatter',
              description: 'Formats strings dynamically',
              icon: 'Code',
              inputs: [{ id: 'input', name: 'In', type: 'string' }],
              outputs: [{ id: 'output', name: 'Out', type: 'string' }],
              defaultData: {}
            }
          ]
        }
      };

      fs.writeFileSync(path.join(extensionDir, 'extension.json'), JSON.stringify(manifest, null, 2));
      const { record } = await ExtensionLoader.loadFromDirectory(extensionDir);
      expect(record).toBeDefined();

      if (record) {
        expect(NODE_REGISTRY['ext_sample_formatter' as any]).toBeUndefined();
        await ExtensionLoader.activateExtension(record);
        expect(NODE_REGISTRY['ext_sample_formatter' as any]).toBeDefined();
        expect(NODE_REGISTRY['ext_sample_formatter' as any].name).toBe('Sample Formatter');

        await ExtensionLoader.deactivateExtension(record);
        expect(NODE_REGISTRY['ext_sample_formatter' as any]).toBeUndefined();
      }
    });
  });
});
