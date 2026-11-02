import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  ExtensionManifest,
  ExtensionRecord
} from '../../shared/extensions';
import { ExtensionManifestSchema } from '../../shared/extensions';
import { registerCustomNode, unregisterCustomNode } from '../../shared/node-registry';
import { skillRegistry } from '../skills/skill-registry';
import { auditService } from '../services/audit.service';
import { airGapManager } from '../services/air-gap.manager';
import { extensionHostManager } from './extension-host-manager';

export class ExtensionLoader {
  /**
   * Validates that contributed skill permissions do not exceed extension manifest permissions.
   */
  private static validateSkillPermissions(manifest: ExtensionManifest, skillPerms: any): boolean {
    if (!skillPerms) return true;
    if (skillPerms.terminal?.execute && !manifest.permissions?.shell) {
      return false;
    }
    if (skillPerms.network?.allowed && !manifest.permissions?.network?.allowExternal) {
      return false;
    }
    return true;
  }

  /**
   * Computes SHA-256 checksum of an extension folder and manifest.
   */
  public static computeChecksum(dirPath: string, manifestContent: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(manifestContent);

    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files.sort()) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && file !== 'extension.json') {
          const content = fs.readFileSync(fullPath);
          hash.update(file);
          hash.update(content);
        }
      }
    } catch {
      // Ignore directory read errors
    }

    return hash.digest('hex');
  }

  /**
   * Validates and loads an extension from its directory.
   */
  public static async loadFromDirectory(dirPath: string): Promise<{
    record?: ExtensionRecord;
    error?: string;
  }> {
    const manifestPath = path.join(dirPath, 'extension.json');
    if (!fs.existsSync(manifestPath)) {
      return { error: `Manifest file 'extension.json' not found in ${dirPath}` };
    }

    let manifestRaw = '';
    try {
      manifestRaw = fs.readFileSync(manifestPath, 'utf8');
    } catch (err: any) {
      return { error: `Failed to read 'extension.json': ${err.message}` };
    }

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(manifestRaw);
    } catch (err: any) {
      return { error: `Invalid JSON in 'extension.json': ${err.message}` };
    }

    const validation = ExtensionManifestSchema.safeParse(parsedJson);
    if (!validation.success) {
      const issues = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      return { error: `Manifest validation failed: ${issues}` };
    }

    const manifest: ExtensionManifest = validation.data;
    const checksum = this.computeChecksum(dirPath, manifestRaw);

    // Air-gap network validation for extensions
    if (airGapManager.isAirGapEnabled() && manifest.permissions?.network?.allowExternal) {
      auditService.logSecurityViolation(
        'extension_loader',
        'extension_network_rejected',
        `Extension '${manifest.id}' requests external network access, which is forbidden under active Air-Gap isolation mode.`,
        manifestPath
      );
      return {
        error: `Extension '${manifest.id}' requires external network access, blocked by Air-Gap isolation mode.`
      };
    }

    const record: ExtensionRecord = {
      id: manifest.id,
      name: manifest.name,
      displayName: manifest.displayName || manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      enabled: true,
      status: 'active',
      installPath: dirPath,
      checksum,
      manifest,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    return { record };
  }

  /**
   * Activates an extension and wires its contributions.
   */
  public static async activateExtension(record: ExtensionRecord): Promise<void> {
    const { manifest, installPath } = record;

    // 1. Register contributed workflow nodes with permission validation
    if (manifest.contributes?.nodes && Array.isArray(manifest.contributes.nodes)) {
      for (const node of manifest.contributes.nodes as any[]) {
        if (node.data?.requiredPermissions?.terminal?.execute && !manifest.permissions?.shell) {
          auditService.logSecurityViolation(
            record.id,
            'node_permission_escalation',
            `Contributed node '${node.id}' requires terminal execution not granted to extension.`
          );
          continue;
        }
        registerCustomNode(node);
      }
    }

    // 2. Register contributed skills with permission validation
    if (manifest.contributes?.skills && Array.isArray(manifest.contributes.skills)) {
      for (const s of manifest.contributes.skills) {
        if (!this.validateSkillPermissions(manifest, s.requiredPermissions)) {
          auditService.logSecurityViolation(
            record.id,
            'skill_permission_escalation',
            `Contributed skill '${s.id}' requires permissions exceeding extension manifest.`
          );
          continue;
        }

        skillRegistry.registerLoadedSkill({
          id: s.id,
          name: s.name,
          description: s.description,
          version: s.version,
          author: s.author || manifest.author,
          category: (s.category as any) || 'analysis',
          tags: s.tags || ['extension', manifest.id],
          supportedProviders: (s.supportedProviders as any) || ['claude', 'codex', 'gemini'],
          isBuiltIn: false,
          enabled: true,
          manifestPath: path.join(installPath, 'extension.json'),
          instructionsPath: path.join(installPath, 'README.md'),
          permissions: (s.requiredPermissions as any) || {
            filesystem: { read: true, write: false },
            terminal: { execute: false },
            network: { allowed: false }
          },
          contextRequirements: s.contextRequirements || { indexingNeeded: false, maxContextTokens: 16000 },
          checksum: record.checksum
        });
      }
    }

    // 3. If main script is present, run inside isolated Extension Host child process
    if (manifest.main) {
      try {
        await extensionHostManager.activateInHost(record);
      } catch (err: any) {
        record.status = 'error';
        record.errorMessage = err.message;
        console.error(`[ExtensionLoader] Error activating extension ${record.id} in host:`, err);
        return;
      }
    }

    auditService.log({
      eventType: 'extension_activated',
      severity: 'info',
      actor: 'extension_loader',
      action: 'activate',
      target: record.id,
      details: {
        version: record.version,
        nodesCount: manifest.contributes?.nodes?.length || 0,
        skillsCount: manifest.contributes?.skills?.length || 0
      }
    });
  }

  /**
   * Deactivates an extension and rolls back contributions.
   */
  public static async deactivateExtension(record: ExtensionRecord): Promise<void> {
    const { manifest } = record;

    // 1. Unregister contributed workflow nodes
    if (manifest.contributes?.nodes && Array.isArray(manifest.contributes.nodes)) {
      for (const node of manifest.contributes.nodes as any[]) {
        unregisterCustomNode(node.type);
      }
    }

    // 2. Unregister contributed skills
    if (manifest.contributes?.skills && Array.isArray(manifest.contributes.skills)) {
      for (const s of manifest.contributes.skills) {
        skillRegistry.removeCustomSkill(s.id);
      }
    }

    // 3. Terminate isolated Extension Host process if running
    if (manifest.main) {
      try {
        await extensionHostManager.terminateHost(record.id);
      } catch (err) {
        console.warn(`[ExtensionLoader] Error terminating host for ${record.id}:`, err);
      }
    }

    record.status = 'disabled';
    auditService.log({
      eventType: 'extension_deactivated',
      severity: 'info',
      actor: 'extension_loader',
      action: 'deactivate',
      target: record.id,
      details: {}
    });
  }
}
