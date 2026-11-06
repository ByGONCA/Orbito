import { safeStorage } from 'electron';
import { databaseService } from '../db/database.service';

export class SafeStorageService {
  /**
   * Checks whether the underlying operating system keychain is available for encryption.
   */
  public isEncryptionAvailable(): boolean {
    try {
      return Boolean(safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable());
    } catch {
      return false;
    }
  }

  /**
   * Encrypts and stores a secret string (e.g. API key) using OS-level encryption.
   * Fails closed if OS-level encryption is not available to prevent plaintext leaks.
   */
  public storeSecret(key: string, plaintext: string): { success: boolean } {
    if (!this.isEncryptionAvailable()) {
      throw new Error(
        'OS keychain encryption is unavailable. Refusing to store sensitive credentials in unencrypted plaintext.'
      );
    }

    const buffer = safeStorage.encryptString(plaintext);
    const encryptedBase64 = buffer.toString('base64');

    databaseService.saveEncryptedSecret(key, encryptedBase64);
    return { success: true };
  }

  /**
   * Retrieves and decrypts a secret string using OS-level encryption.
   * Preserves backward compatibility by reading legacy unencrypted credentials with a security warning.
   */
  public getSecret(key: string): string | null {
    const encryptedBase64 = databaseService.getEncryptedSecret(key);
    if (!encryptedBase64) return null;

    if (encryptedBase64.startsWith('unencrypted:')) {
      console.warn(
        `[SafeStorageService] Security Warning: Reading legacy unencrypted credential for key "${key}". Re-save this secret once OS keychain is available.`
      );
      const b64 = encryptedBase64.replace('unencrypted:', '');
      return Buffer.from(b64, 'base64').toString('utf8');
    }

    if (this.isEncryptionAvailable()) {
      const buffer = Buffer.from(encryptedBase64, 'base64');
      return safeStorage.decryptString(buffer);
    }

    return null;
  }
}

export const safeStorageService = new SafeStorageService();

