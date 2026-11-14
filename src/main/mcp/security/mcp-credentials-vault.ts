import { safeStorageService } from '../../services/safe-storage.service';
import { databaseService } from '../../db/database.service';
import { SecretRedactor } from './secret-redactor';

export class MCPCredentialsVault {
  private static makeEnvKey(serverId: string, varName: string): string {
    return `mcp:env:${serverId}:${varName}`;
  }

  private static makeAuthKey(serverId: string): string {
    return `mcp:auth:${serverId}:token`;
  }

  /**
   * Stores environment variables for a given MCP server.
   * If OS encryption is available, stores encrypted; otherwise fails closed to prevent leaks.
   */
  public storeServerEnv(serverId: string, env: Record<string, string>): void {
    if (!env || typeof env !== 'object') return;

    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string' && value.length > 0) {
        const vaultKey = MCPCredentialsVault.makeEnvKey(serverId, key);
        safeStorageService.storeSecret(vaultKey, value);
        SecretRedactor.registerSecret(value);
      }
    }
  }

  /**
   * Retrieves and decrypts the environment variables for an MCP server.
   */
  public getServerEnv(serverId: string): Record<string, string> {
    const envKeys = databaseService.getMCPServerEnvKeys(serverId);
    const result: Record<string, string> = {};

    for (const key of envKeys) {
      const vaultKey = MCPCredentialsVault.makeEnvKey(serverId, key);
      const secret = safeStorageService.getSecret(vaultKey);
      if (secret !== null) {
        result[key] = secret;
      }
    }

    return result;
  }

  /**
   * Stores an authentication token (API key, bearer token, etc.) for a server.
   */
  public storeAuthToken(serverId: string, token: string): void {
    if (!token || typeof token !== 'string') return;
    const vaultKey = MCPCredentialsVault.makeAuthKey(serverId);
    safeStorageService.storeSecret(vaultKey, token);
    SecretRedactor.registerSecret(token);
  }

  /**
   * Retrieves the decrypted authentication token for a server.
   */
  public getAuthToken(serverId: string): string | null {
    const vaultKey = MCPCredentialsVault.makeAuthKey(serverId);
    return safeStorageService.getSecret(vaultKey);
  }

  /**
   * Checks if an authentication token exists for a server.
   */
  public hasAuthToken(serverId: string): boolean {
    const vaultKey = MCPCredentialsVault.makeAuthKey(serverId);
    return safeStorageService.hasSecret(vaultKey);
  }

  /**
   * Removes all credentials associated with a server when it is deleted.
   */
  public deleteServerCredentials(serverId: string): void {
    const envKeys = databaseService.getMCPServerEnvKeys(serverId);
    for (const key of envKeys) {
      const vaultKey = MCPCredentialsVault.makeEnvKey(serverId, key);
      try {
        const secret = safeStorageService.getSecret(vaultKey);
        if (secret) SecretRedactor.unregisterSecret(secret);
        databaseService.deleteSecret(vaultKey);
      } catch {}
    }

    const authKey = MCPCredentialsVault.makeAuthKey(serverId);
    try {
      const token = safeStorageService.getSecret(authKey);
      if (token) SecretRedactor.unregisterSecret(token);
      databaseService.deleteSecret(authKey);
    } catch {}
  }
}

export const mcpCredentialsVault = new MCPCredentialsVault();
