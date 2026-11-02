import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../db/database.service';
import { SkillDiscovery } from './skill-discovery';
import { SkillLoader } from './skill-loader';
import type { SkillMetadata, SkillDetails } from '../../shared/skills';

export class SkillRegistry {
  private cache: Map<string, SkillMetadata> = new Map();
  private initialized = false;

  public initialize(customBaseDir?: string): void {
    this.cache.clear();

    // 1. Discover and load built-in skills
    const builtinDir = SkillDiscovery.getBuiltinSkillsDir();
    const builtinSkillDirs = SkillDiscovery.discoverSkillDirs(builtinDir);

    for (const sDir of builtinSkillDirs) {
      const { metadata, error } = SkillLoader.loadMetadata(sDir, true);
      if (metadata) {
        this.cache.set(metadata.id, metadata);
      } else if (error) {
        console.warn(`[SkillRegistry] Failed loading built-in skill at ${sDir}:`, error);
      }
    }

    // 2. Discover and load user custom skills
    const customDir = SkillDiscovery.getCustomSkillsDir(customBaseDir);
    const customSkillDirs = SkillDiscovery.discoverSkillDirs(customDir);

    for (const sDir of customSkillDirs) {
      const { metadata, error } = SkillLoader.loadMetadata(sDir, false);
      if (metadata) {
        if (this.cache.has(metadata.id)) {
          console.warn(`[SkillRegistry] Collision: custom skill ID "${metadata.id}" conflicts with existing skill. Ignoring custom.`);
          continue;
        }
        this.cache.set(metadata.id, metadata);
      } else if (error) {
        console.warn(`[SkillRegistry] Failed loading custom skill at ${sDir}:`, error);
      }
    }

    // 3. Reconcile with SQLite persistence (sync enabled state and cache)
    try {
      const persistedSkills = databaseService.listSkills();
      const persistedMap = new Map(persistedSkills.map((s) => [s.id, s]));

      for (const [id, skill] of this.cache) {
        const persisted = persistedMap.get(id);
        if (persisted) {
          // Restore user's enabled toggle from database
          skill.enabled = persisted.enabled;
        } else {
          // Persist to database
          const manifestRaw = fs.existsSync(skill.manifestPath)
            ? fs.readFileSync(skill.manifestPath, 'utf8')
            : '{}';

          databaseService.upsertSkill({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            version: skill.version,
            author: skill.author,
            category: skill.category,
            tags: skill.tags,
            supportedProviders: skill.supportedProviders,
            isBuiltIn: skill.isBuiltIn,
            enabled: skill.enabled,
            manifestJson: manifestRaw,
            instructionsPath: skill.instructionsPath,
            checksum: skill.checksum
          });
        }
      }
    } catch (err) {
      console.warn('[SkillRegistry] SQLite synchronization note:', err);
    }

    this.initialized = true;
  }

  public listSkills(): SkillMetadata[] {
    if (!this.initialized) this.initialize();
    return Array.from(this.cache.values());
  }

  public getSkill(id: string): SkillMetadata | null {
    if (!this.initialized) this.initialize();
    return this.cache.get(id) || null;
  }

  public getSkillDetails(id: string): SkillDetails | null {
    const meta = this.getSkill(id);
    if (!meta) return null;
    return SkillLoader.loadDetails(meta);
  }

  public toggleSkill(id: string, enabled: boolean): boolean {
    const skill = this.getSkill(id);
    if (!skill) return false;

    skill.enabled = enabled;
    try {
      databaseService.toggleSkill(id, enabled);
    } catch (err) {
      console.warn(`[SkillRegistry] Error updating toggle in db:`, err);
    }
    return true;
  }

  public removeCustomSkill(id: string): boolean {
    const skill = this.getSkill(id);
    if (!skill || skill.isBuiltIn) return false;

    // Delete folder from custom directory
    if (skill.manifestPath) {
      const skillFolder = path.dirname(skill.manifestPath);
      if (fs.existsSync(skillFolder)) {
        fs.rmSync(skillFolder, { recursive: true, force: true });
      }
    }

    this.cache.delete(id);
    try {
      databaseService.deleteSkill(id);
    } catch {}
    return true;
  }

  public registerLoadedSkill(metadata: SkillMetadata): void {
    this.cache.set(metadata.id, metadata);
  }
}

export const skillRegistry = new SkillRegistry();
