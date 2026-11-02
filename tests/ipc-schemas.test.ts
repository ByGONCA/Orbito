import { describe, it, expect } from 'vitest';
import {
  OpenDirectorySchema,
  ListFilesSchema,
  ReadFileSchema,
  UpdateSettingsSchema,
  StoreSecretSchema,
  SaveMemorySchema
} from '../src/shared/ipc';

describe('IPC Zod Schemas Validation Tests', () => {
  it('validates OpenDirectorySchema parameters', () => {
    expect(() => OpenDirectorySchema.parse({})).not.toThrow();
    expect(() => OpenDirectorySchema.parse({ targetPath: 'C:/projects/app' })).not.toThrow();
  });

  it('validates ListFilesSchema and enforces limits', () => {
    // Valid
    const valid = ListFilesSchema.parse({ projectPath: 'C:/valid', maxDepth: 4 });
    expect(valid.maxDepth).toBe(4);

    // Default depth
    const withDefault = ListFilesSchema.parse({ projectPath: 'C:/valid' });
    expect(withDefault.maxDepth).toBe(8);

    // Invalid: empty projectPath
    expect(() => ListFilesSchema.parse({ projectPath: '' })).toThrow();

    // Invalid: depth out of range
    expect(() => ListFilesSchema.parse({ projectPath: 'C:/valid', maxDepth: 100 })).toThrow();
  });

  it('validates ReadFileSchema', () => {
    expect(() =>
      ReadFileSchema.parse({ filePath: 'src/main.ts', projectPath: 'C:/my-project' })
    ).not.toThrow();

    expect(() => ReadFileSchema.parse({ filePath: '', projectPath: 'C:/my-project' })).toThrow();
  });

  it('validates UpdateSettingsSchema enum bounds', () => {
    expect(() => UpdateSettingsSchema.parse({ uiMode: 'simple', theme: 'dark' })).not.toThrow();
    expect(() => UpdateSettingsSchema.parse({ uiMode: 'advanced', theme: 'system' })).not.toThrow();

    // Invalid enum value
    expect(() => UpdateSettingsSchema.parse({ uiMode: 'invalid-mode' as any })).toThrow();
    expect(() => UpdateSettingsSchema.parse({ theme: 'neon-color' as any })).toThrow();
  });

  it('validates StoreSecretSchema key limits', () => {
    expect(() => StoreSecretSchema.parse({ key: 'anthropic_key', value: 'sk-ant-123' })).not.toThrow();

    // Key too long (> 128 chars)
    expect(() =>
      StoreSecretSchema.parse({
        key: 'a'.repeat(200),
        value: 'test'
      })
    ).toThrow();

    // Empty key
    expect(() => StoreSecretSchema.parse({ key: '', value: 'test' })).toThrow();
  });

  it('validates SaveMemorySchema tier constraint', () => {
    expect(() =>
      SaveMemorySchema.parse({
        tier: 'project',
        entityKey: 'architecture',
        content: 'Local-first architecture'
      })
    ).not.toThrow();

    expect(() =>
      SaveMemorySchema.parse({
        tier: 'unsupported-tier' as any,
        entityKey: 'arch',
        content: 'content'
      })
    ).toThrow();
  });
});
