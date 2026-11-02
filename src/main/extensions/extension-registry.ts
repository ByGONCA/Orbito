import fs from 'node:fs';
import path from 'node:path';
import type { ExtensionRecord } from '../../shared/extensions';
import { databaseService } from '../db/database.service';
import { ExtensionLoader } from './extension-loader';
import { auditService } from '../services/audit.service';

export class ExtensionRegistry {
  private extensions: Map<string, ExtensionRecord> = new Map();
  private extensionsDir: string;
  private initialized = false;

  constructor(customStorageDir?: string) {
    const baseDir = customStorageDir || path.join(process.cwd(), '.ai-workspace-data');
    this.extensionsDir = path.join(baseDir, 'extensions');
    this.ensureExtensionsDir();
  }

  private ensureExtensionsDir(): void {
    if (!fs.existsSync(this.extensionsDir)) {
      fs.mkdirSync(this.extensionsDir, { recursive: true });
    }
  }

  public getExtensionsDir(): string {
    return this.extensionsDir;
  }

  /**
   * Initialize and load persisted extensions from SQLite.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    this.ensureExtensionsDir();

    try {
      const persisted = databaseService.listExtensions();
      for (const record of persisted) {
        this.extensions.set(record.id, record);
        if (record.enabled) {
          await ExtensionLoader.activateExtension(record);
        }
      }
    } catch (err) {
      console.error('[ExtensionRegistry] Failed to initialize extensions from database:', err);
    }

    this.initialized = true;
  }

  public listExtensions(): ExtensionRecord[] {
    return Array.from(this.extensions.values());
  }

  public getExtension(id: string): ExtensionRecord | null {
    return this.extensions.get(id) || null;
  }

  /**
   * Installs an extension from a directory.
   */
  public async installFromDirectory(sourceDir: string): Promise<{
    success: boolean;
    extension?: ExtensionRecord;
    error?: string;
  }> {
    const { record, error } = await ExtensionLoader.loadFromDirectory(sourceDir);
    if (error || !record) {
      return { success: false, error: error || 'Failed to load extension' };
    }

    // Target directory in .ai-workspace-data/extensions/<id>
    const targetDir = path.join(this.extensionsDir, record.id);
    if (path.resolve(sourceDir) !== path.resolve(targetDir)) {
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
      fs.cpSync(sourceDir, targetDir, { recursive: true });
      record.installPath = targetDir;
    }

    // Persist in SQLite
    databaseService.upsertExtension(record);
    this.extensions.set(record.id, record);

    // Activate
    await ExtensionLoader.activateExtension(record);

    auditService.log({
      eventType: 'extension_installed',
      severity: 'info',
      actor: 'user',
      action: 'install',
      target: record.id,
      details: { version: record.version, name: record.name }
    });

    return { success: true, extension: record };
  }

  /**
   * Toggles an extension on or off.
   */
  public async toggleExtension(id: string, enabled: boolean): Promise<boolean> {
    const record = this.extensions.get(id);
    if (!record) return false;

    if (record.enabled === enabled) return true;

    record.enabled = enabled;
    record.updatedAt = Date.now();

    if (enabled) {
      await ExtensionLoader.activateExtension(record);
    } else {
      await ExtensionLoader.deactivateExtension(record);
    }

    databaseService.setExtensionEnabled(id, enabled);
    return true;
  }

  /**
   * Uninstalls and removes an extension.
   */
  public async uninstallExtension(id: string): Promise<boolean> {
    const record = this.extensions.get(id);
    if (!record) return false;

    // Deactivate first
    await ExtensionLoader.deactivateExtension(record);

    // Remove from disk if in extensions directory
    if (record.installPath && fs.existsSync(record.installPath)) {
      try {
        fs.rmSync(record.installPath, { recursive: true, force: true });
      } catch (err) {
        console.warn(`[ExtensionRegistry] Could not remove files at ${record.installPath}:`, err);
      }
    }

    // Remove from SQLite
    databaseService.deleteExtension(id);
    this.extensions.delete(id);

    auditService.log({
      eventType: 'extension_uninstalled',
      severity: 'info',
      actor: 'user',
      action: 'uninstall',
      target: id,
      details: {}
    });

    return true;
  }
}

export const extensionRegistry = new ExtensionRegistry();
