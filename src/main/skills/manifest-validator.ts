import crypto from 'node:crypto';
import fs from 'node:fs';
import { SkillManifestSchema, type SkillManifest } from '../../shared/skills';

export interface ValidationResult {
  valid: boolean;
  manifest?: SkillManifest;
  checksum: string;
  errors: string[];
}

export class ManifestValidator {
  /**
   * Calculates SHA-256 checksum of raw content or stringified manifest.
   */
  public static calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Validates manifest object against SkillManifestSchema.
   */
  public static validate(raw: unknown): ValidationResult {
    const result = SkillManifestSchema.safeParse(raw);
    const serialized = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const checksum = this.calculateChecksum(serialized);

    if (!result.success) {
      return {
        valid: false,
        checksum,
        errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      };
    }

    return {
      valid: true,
      manifest: result.data,
      checksum,
      errors: []
    };
  }

  /**
   * Validates manifest file from filesystem.
   */
  public static validateFile(filePath: string): ValidationResult {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          valid: false,
          checksum: '',
          errors: [`File does not exist: ${filePath}`]
        };
      }
      const rawText = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(rawText);
      const res = this.validate(parsed);
      res.checksum = this.calculateChecksum(rawText);
      return res;
    } catch (err: any) {
      return {
        valid: false,
        checksum: '',
        errors: [`Failed to read or parse JSON: ${err.message}`]
      };
    }
  }
}
