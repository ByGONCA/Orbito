import path from 'node:path';
import fs from 'node:fs';
import { ManifestValidator } from './manifest-validator';
import type { SkillMetadata, SkillDetails } from '../../shared/skills';

export class SkillLoader {
  /**
   * Loads metadata from a skill folder (manifest only, instructions left on disk).
   */
  public static loadMetadata(skillDir: string, isBuiltIn: boolean): { metadata?: SkillMetadata; error?: string } {
    const manifestPath = path.join(skillDir, 'manifest.json');
    const instructionsPath = path.join(skillDir, 'instructions.md');

    const validation = ManifestValidator.validateFile(manifestPath);
    if (!validation.valid || !validation.manifest) {
      return { error: `Invalid manifest in ${skillDir}: ${validation.errors.join(', ')}` };
    }

    const manifest = validation.manifest;
    const metadata: SkillMetadata = {
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      author: manifest.author,
      category: manifest.category,
      tags: manifest.tags,
      supportedProviders: manifest.supportedProviders,
      isBuiltIn,
      enabled: isBuiltIn, // Built-ins default to enabled, custom default to disabled
      checksum: validation.checksum,
      manifestPath,
      instructionsPath: fs.existsSync(instructionsPath) ? instructionsPath : '',
      permissions: manifest.requiredPermissions,
      contextRequirements: manifest.contextRequirements
    };

    return { metadata };
  }

  /**
   * Lazily loads full skill details including the markdown instructions from disk.
   */
  public static loadDetails(metadata: SkillMetadata): SkillDetails {
    let instructions = '';
    if (metadata.instructionsPath && fs.existsSync(metadata.instructionsPath)) {
      try {
        instructions = fs.readFileSync(metadata.instructionsPath, 'utf8');
      } catch (err: any) {
        instructions = `Failed to read instructions: ${err.message}`;
      }
    }

    let manifestRaw = {};
    if (metadata.manifestPath && fs.existsSync(metadata.manifestPath)) {
      try {
        manifestRaw = JSON.parse(fs.readFileSync(metadata.manifestPath, 'utf8'));
      } catch {}
    }

    return {
      ...metadata,
      manifest: manifestRaw as any,
      instructions
    };
  }
}
