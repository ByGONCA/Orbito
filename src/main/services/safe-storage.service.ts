import { safeStorage } from 'electron';
import { databaseService } from '../db/database.service';

export class SafeStorageService {
  /**
   * Encrypts and stores a secret string (e.g. API key) using OS-level encryption.
   */
  public storeSecret(key: string, plaintext: string): { success: boolean } {
    let encryptedBase64: string;

    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const buffer = safeStorage.encryptString(plaintext);
      encryptedBase64 = buffer.toString('base64');
    } else {
      // Fallback for dev/headless environments without desktop keychain
      const mockCipher = Buffer.from(plaintext).toString('base64');
      encryptedBase64 = `unencrypted:${mockCipher}`;
    }

    databaseService.saveEncryptedSecret(key, encryptedBase64);
    return { success: true };
  }

  /**
   * Retrieves and decrypts a secret string using OS-level encryption.
   */
  public getSecret(key: string): string | null {
    const encryptedBase64 = databaseService.getEncryptedSecret(key);
    if (!encryptedBase64) return null;

    if (encryptedBase64.startsWith('unencrypted:')) {
      const b64 = encryptedBase64.replace('unencrypted:', '');
      return Buffer.from(b64, 'base64').toString('utf8');
    }

    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encryptedBase64, 'base64');
      return safeStorage.decryptString(buffer);
    }

    return null;
  }
}

export const safeStorageService = new SafeStorageService();
