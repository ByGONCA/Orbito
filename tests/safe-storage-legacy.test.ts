import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('electron', () => {
  return {
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((str: string) => Buffer.from(`mock_enc_${str}`)),
      decryptString: vi.fn((buf: Buffer) => buf.toString('utf8').replace('mock_enc_', ''))
    }
  };
});

import { databaseService } from '../src/main/db/database.service';
import { safeStorageService } from '../src/main/services/safe-storage.service';
import { safeStorage } from 'electron';

describe('Phase 6.1: SafeStorage Legacy Credential & Migration Verification Suite', () => {
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-storage-test-'));
    databaseService.initialize(tempBaseDir);
  });

  afterEach(() => {
    databaseService.close();
    vi.restoreAllMocks();

    if (fs.existsSync(tempBaseDir)) {
      try {
        fs.rmSync(tempBaseDir, { recursive: true, force: true });
      } catch {
        // Windows file lock resilience
      }
    }
  });

  describe('1. Insecure Credential Prevention & Fail-Closed Policy', () => {
    it('refuses to store new credentials when OS encryption is unavailable (fails closed)', () => {
      vi.spyOn(safeStorageService, 'isEncryptionAvailable').mockReturnValue(false);

      expect(() => {
        safeStorageService.storeSecret('new_api_key', 'sk-test-secret-value');
      }).toThrow(/OS keychain encryption is unavailable/i);

      // Verify no record was inserted
      const stored = databaseService.getEncryptedSecret('new_api_key');
      expect(stored).toBeNull();
    });

    it('never creates new plaintext or "unencrypted:" prefixes in storeSecret', () => {
      vi.spyOn(safeStorageService, 'isEncryptionAvailable').mockReturnValue(true);

      const res = safeStorageService.storeSecret('production_claude_key', 'sk-ant-test-token');
      expect(res.success).toBe(true);

      const stored = databaseService.getEncryptedSecret('production_claude_key');
      expect(stored).toBeDefined();
      expect(stored?.startsWith('unencrypted:')).toBe(false);
      expect(stored).not.toContain('sk-ant-test-token');
    });
  });

  describe('2. Legacy Credential Discovery & Identification', () => {
    it('identifies and catalogs existing legacy unencrypted credentials without exposing secrets', () => {
      // Insert legacy unencrypted secrets into secrets_store table
      databaseService.saveEncryptedSecret('legacy_gemini_key', 'unencrypted:' + Buffer.from('legacy-secret-gemini-123').toString('base64'));
      databaseService.saveEncryptedSecret('legacy_openai_key', 'unencrypted:' + Buffer.from('legacy-secret-openai-456').toString('base64'));
      databaseService.saveEncryptedSecret('modern_encrypted_key', 'os_encrypted_base64_payload');

      const insecureKeys = safeStorageService.identifyInsecureCredentials();

      // Must list both keys that have the unencrypted prefix
      expect(insecureKeys).toContain('legacy_gemini_key');
      expect(insecureKeys).toContain('legacy_openai_key');
      expect(insecureKeys).not.toContain('modern_encrypted_key');

      // Check isInsecureCredential
      expect(safeStorageService.isInsecureCredential('legacy_gemini_key')).toBe(true);
      expect(safeStorageService.isInsecureCredential('modern_encrypted_key')).toBe(false);
    });

    it('reads legacy unencrypted credentials with a security warning to preserve backward compatibility', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      databaseService.saveEncryptedSecret('legacy_provider_key', 'unencrypted:' + Buffer.from('secret-payload-999').toString('base64'));

      const decrypted = safeStorageService.getSecret('legacy_provider_key');
      expect(decrypted).toBe('secret-payload-999');

      // Verify a security warning was logged
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Security Warning: Reading legacy unencrypted credential'));
    });
  });

  describe('3. Safe Migration Path', () => {
    it('migrates legacy credentials to OS safeStorage when encryption becomes available without deleting data', () => {
      databaseService.saveEncryptedSecret('migratable_key_1', 'unencrypted:' + Buffer.from('token_alpha').toString('base64'));
      databaseService.saveEncryptedSecret('migratable_key_2', 'unencrypted:' + Buffer.from('token_beta').toString('base64'));

      vi.spyOn(safeStorageService, 'isEncryptionAvailable').mockReturnValue(true);

      const migrationResult = safeStorageService.migrateInsecureCredentials();

      expect(migrationResult.migrated).toContain('migratable_key_1');
      expect(migrationResult.migrated).toContain('migratable_key_2');
      expect(migrationResult.remainingInsecure).toBe(0);

      // Verify records in DB are no longer unencrypted
      const updated1 = databaseService.getEncryptedSecret('migratable_key_1');
      const updated2 = databaseService.getEncryptedSecret('migratable_key_2');

      expect(updated1?.startsWith('unencrypted:')).toBe(false);
      expect(updated2?.startsWith('unencrypted:')).toBe(false);
    });

    it('fails closed and preserves data without deletion if encryption is unavailable during migration', () => {
      databaseService.saveEncryptedSecret('unmigrated_key', 'unencrypted:' + Buffer.from('important_key').toString('base64'));

      vi.spyOn(safeStorageService, 'isEncryptionAvailable').mockReturnValue(false);

      const migrationResult = safeStorageService.migrateInsecureCredentials();

      expect(migrationResult.migrated.length).toBe(0);
      expect(migrationResult.failed).toContain('unmigrated_key');
      expect(migrationResult.remainingInsecure).toBe(1);

      // The original secret must still be preserved in the DB
      const stored = databaseService.getEncryptedSecret('unmigrated_key');
      expect(stored).toBe('unencrypted:' + Buffer.from('important_key').toString('base64'));
    });
  });
});
