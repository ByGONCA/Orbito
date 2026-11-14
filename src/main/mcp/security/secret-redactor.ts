/**
 * Secret Redactor Utility
 * Scrub known secrets, environment tokens, and bearer credentials from strings and JSON objects
 * before logging, emitting over IPC, or sending to AI models.
 */

const KNOWN_SECRET_PATTERNS = [
  /Bearer\s+([a-zA-Z0-9_\-\.\~]{8,})/gi,
  /(sk-[a-zA-Z0-9_-]{20,})/gi,
  /(ghp_[a-zA-Z0-9]{20,})/gi,
  /(gho_[a-zA-Z0-9]{20,})/gi,
  /(xox[baprs]-[a-zA-Z0-9-]{10,})/gi,
  /(anthropic-api-key\s*[:=]\s*)([a-zA-Z0-9_-]{20,})/gi,
  /(["']?password["']?\s*[:=]\s*["'])([^"']+)(["'])/gi,
  /(["']?api[_-]?key["']?\s*[:=]\s*["'])([^"']+)(["'])/gi,
  /(["']?secret["']?\s*[:=]\s*["'])([^"']+)(["'])/gi
];

export class SecretRedactor {
  private static registeredSecrets: Set<string> = new Set();

  /**
   * Registers a specific plaintext secret value so that it can be explicitly scrubbed wherever it appears.
   */
  public static registerSecret(secret: string): void {
    if (secret && typeof secret === 'string' && secret.trim().length >= 4) {
      this.registeredSecrets.add(secret.trim());
    }
  }

  /**
   * Unregisters a secret when removed or revoked.
   */
  public static unregisterSecret(secret: string): void {
    if (secret) {
      this.registeredSecrets.delete(secret.trim());
    }
  }

  /**
   * Redacts sensitive patterns and registered secret strings from text.
   */
  public static redactText(text: string): string {
    if (!text || typeof text !== 'string') return text;

    let scrubbed = text;

    // 1. Scrub explicitly registered secrets
    for (const secret of this.registeredSecrets) {
      if (scrubbed.includes(secret)) {
        scrubbed = scrubbed.split(secret).join('••••••••');
      }
    }

    // 2. Scrub regex patterns
    scrubbed = scrubbed.replace(
      /Bearer\s+([a-zA-Z0-9_\-\.\~]{8,})/gi,
      'Bearer ••••••••'
    );
    scrubbed = scrubbed.replace(
      /(sk-[a-zA-Z0-9_-]{10})[a-zA-Z0-9_-]+/gi,
      '$1••••••••'
    );
    scrubbed = scrubbed.replace(
      /(ghp_[a-zA-Z0-9]{4})[a-zA-Z0-9]+/gi,
      '$1••••••••'
    );

    return scrubbed;
  }

  /**
   * Recursively traverses and redacts secrets from objects and arrays.
   */
  public static redactObject<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      return this.redactText(obj) as any;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactObject(item)) as any;
    }

    if (typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('secret') ||
          lowerKey.includes('password') ||
          lowerKey.includes('token') ||
          lowerKey.includes('apikey') ||
          lowerKey.includes('api_key') ||
          lowerKey.includes('auth')
        ) {
          result[key] = typeof val === 'string' && val.length > 0 ? '••••••••' : val;
        } else {
          result[key] = this.redactObject(val);
        }
      }
      return result as any;
    }

    return obj;
  }
}
