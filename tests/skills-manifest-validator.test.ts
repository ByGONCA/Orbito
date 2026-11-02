import { describe, it, expect } from 'vitest';
import { ManifestValidator } from '../src/main/skills/manifest-validator';

describe('Skills Manifest Validator (Zod Schema & Integrity Checksums)', () => {
  it('validates a complete, compliant skill manifest successfully', () => {
    const validManifest = {
      id: 'custom-linter',
      name: 'Custom Linter Tool',
      description: 'Performs linting and code hygiene checks.',
      version: '1.2.0',
      author: 'Jane Doe',
      category: 'quality',
      tags: ['linter', 'hygiene'],
      supportedProviders: ['claude', 'gemini'],
      requiredCapabilities: ['context-retrieval'],
      requiredPermissions: {
        filesystem: { read: true, write: false },
        terminal: { execute: false },
        network: { allowed: false }
      },
      contextRequirements: {
        indexingNeeded: true,
        maxContextTokens: 8000
      },
      executionConstraints: {
        timeoutMs: 60000,
        maxRetries: 1
      }
    };

    const res = ManifestValidator.validate(validManifest);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
    expect(res.manifest?.id).toBe('custom-linter');
    expect(res.checksum).toBeDefined();
    expect(res.checksum.length).toBe(64); // SHA-256 hex string
  });

  it('rejects manifests with invalid semver format', () => {
    const invalidVersion = {
      id: 'test-skill',
      name: 'Test Skill',
      description: 'A test skill description that is long enough.',
      version: 'v1.0-beta', // not strict semver
      author: 'Tester',
      category: 'testing',
      supportedProviders: ['claude'],
      requiredPermissions: {
        filesystem: { read: true, write: false },
        terminal: { execute: false },
        network: { allowed: false }
      }
    };

    const res = ManifestValidator.validate(invalidVersion);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('version'))).toBe(true);
  });

  it('rejects manifests with invalid categories or uppercase IDs', () => {
    const invalidCategoryAndId = {
      id: 'Test_Skill_Invalid', // contains uppercase
      name: 'Test Skill',
      description: 'A test skill description that is long enough.',
      version: '1.0.0',
      author: 'Tester',
      category: 'crypto-mining', // not an allowed category
      supportedProviders: ['claude'],
      requiredPermissions: {
        filesystem: { read: true, write: false },
        terminal: { execute: false },
        network: { allowed: false }
      }
    };

    const res = ManifestValidator.validate(invalidCategoryAndId);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('id'))).toBe(true);
    expect(res.errors.some((e) => e.includes('category'))).toBe(true);
  });

  it('calculates deterministic SHA-256 checksums', () => {
    const textA = 'Sample manifest text';
    const textB = 'Sample manifest text';
    const textC = 'Different text';

    const hashA = ManifestValidator.calculateChecksum(textA);
    const hashB = ManifestValidator.calculateChecksum(textB);
    const hashC = ManifestValidator.calculateChecksum(textC);

    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });
});
