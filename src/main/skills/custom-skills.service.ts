import path from 'node:path';
import fs from 'node:fs';
import { ManifestValidator } from './manifest-validator';
import { SkillDiscovery } from './skill-discovery';
import { skillRegistry } from './skill-registry';
import { SkillLoader } from './skill-loader';
import { databaseService } from '../db/database.service';
import type { SkillMetadata } from '../../shared/skills';

export interface ImportCustomSkillResult {
  success: boolean;
  skill?: SkillMetadata;
  error?: string;
  securityNotice?: string;
}

export class CustomSkillsService {
  /**
   * Imports and validates a custom skill directory.
   */
  public static importFromFolder(sourceDir: string): ImportCustomSkillResult {
    if (!fs.existsSync(sourceDir)) {
      return { success: false, error: `Directory does not exist: ${sourceDir}` };
    }

    const manifestPath = path.join(sourceDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return { success: false, error: `manifest.json missing in source directory: ${sourceDir}` };
    }

    // 1. Validate manifest
    const validation = ManifestValidator.validateFile(manifestPath);
    if (!validation.valid || !validation.manifest) {
      return {
        success: false,
        error: `Invalid manifest: ${validation.errors.join('; ')}`
      };
    }

    const manifest = validation.manifest;

    // 2. Prevent colliding with built-ins
    const existing = skillRegistry.getSkill(manifest.id);
    if (existing && existing.isBuiltIn) {
      return {
        success: false,
        error: `Cannot override built-in skill with ID: "${manifest.id}"`
      };
    }

    // 3. Copy to custom skills directory
    const customBaseDir = SkillDiscovery.getCustomSkillsDir();
    const targetDir = path.join(customBaseDir, manifest.id);

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    // Copy files
    const entries = fs.readdirSync(sourceDir);
    for (const file of entries) {
      const srcFile = path.join(sourceDir, file);
      const destFile = path.join(targetDir, file);
      const stat = fs.statSync(srcFile);
      if (stat.isFile()) {
        fs.copyFileSync(srcFile, destFile);
      }
    }

    // 4. Load metadata
    const { metadata, error } = SkillLoader.loadMetadata(targetDir, false);
    if (!metadata) {
      return { success: false, error: error || 'Failed to load imported skill metadata.' };
    }

    // Default to disabled for security until user explicitly enables
    metadata.enabled = false;

    // Persist to SQLite
    const manifestRaw = fs.readFileSync(path.join(targetDir, 'manifest.json'), 'utf8');
    databaseService.upsertSkill({
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      version: metadata.version,
      author: metadata.author,
      category: metadata.category,
      tags: metadata.tags,
      supportedProviders: metadata.supportedProviders,
      isBuiltIn: false,
      enabled: false,
      manifestJson: manifestRaw,
      instructionsPath: metadata.instructionsPath,
      checksum: metadata.checksum
    });

    skillRegistry.registerLoadedSkill(metadata);

    return {
      success: true,
      skill: metadata,
      securityNotice:
        'Custom skill imported successfully. For safety, custom skills are disabled by default. Review required permissions before enabling.'
    };
  }
}
