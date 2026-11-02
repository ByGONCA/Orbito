import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  ToggleExtensionSchema,
  InstallExtensionSchema,
  UninstallExtensionSchema,
  RecordAnalyticsEventSchema,
  ExportAnalyticsSchema,
  QueryAuditLogsSchema,
  UpdateAirGapConfigSchema
} from '../src/shared/ipc';
import { databaseService } from '../src/main/db/database.service';
import { airGapManager, AirGapViolationException } from '../src/main/services/air-gap.manager';
import { auditService } from '../src/main/services/audit.service';
import { analyticsService } from '../src/main/services/analytics.service';
import { extensionRegistry } from '../src/main/extensions/extension-registry';

describe('Phase 7 System-Wide Integration & IPC Verification Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase7-integration-'));
    databaseService.initialize(tempDir);
    airGapManager.updateConfig({ enabled: false, enforceLocalModels: true });
  });

  afterEach(() => {
    airGapManager.updateConfig({ enabled: false });
    databaseService.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Phase 7 IPC Zod Schemas Validation', () => {
    it('validates ToggleExtensionSchema and rejects invalid types', () => {
      const valid = ToggleExtensionSchema.safeParse({ extensionId: 'ext-123', enabled: true });
      expect(valid.success).toBe(true);

      const invalid = ToggleExtensionSchema.safeParse({ extensionId: '', enabled: 'true' });
      expect(invalid.success).toBe(false);
    });

    it('validates InstallExtensionSchema and rejects empty paths', () => {
      const valid = InstallExtensionSchema.safeParse({ directoryPath: '/path/to/extension' });
      expect(valid.success).toBe(true);

      const invalid = InstallExtensionSchema.safeParse({ directoryPath: '' });
      expect(invalid.success).toBe(false);
    });

    it('validates RecordAnalyticsEventSchema and rejects negative token values', () => {
      const valid = RecordAnalyticsEventSchema.safeParse({
        provider: 'ollama',
        model: 'llama3:latest',
        tokensIn: 100,
        tokensOut: 200,
        durationMs: 500,
        feature: 'cli'
      });
      expect(valid.success).toBe(true);

      const negativeTokens = RecordAnalyticsEventSchema.safeParse({
        provider: 'ollama',
        model: 'llama3',
        tokensIn: -50,
        tokensOut: 100,
        durationMs: 500,
        feature: 'cli'
      });
      expect(negativeTokens.success).toBe(false);
    });

    it('validates ExportAnalyticsSchema formats', () => {
      expect(ExportAnalyticsSchema.safeParse({ format: 'json' }).success).toBe(true);
      expect(ExportAnalyticsSchema.safeParse({ format: 'csv' }).success).toBe(true);
      expect(ExportAnalyticsSchema.safeParse({ format: 'xml' }).success).toBe(false);
    });

    it('validates UpdateAirGapConfigSchema', () => {
      const valid = UpdateAirGapConfigSchema.safeParse({
        enabled: true,
        allowedHosts: ['127.0.0.1', 'localhost'],
        blockExternalNetwork: true,
        enforceLocalModels: true,
        defaultLocalModel: 'mistral:latest'
      });
      expect(valid.success).toBe(true);

      const invalid = UpdateAirGapConfigSchema.safeParse({
        enabled: 'not-a-bool'
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('End-to-End Air-Gap Isolation & Persistence Cycle', () => {
    it('persists air-gap state across updates and updates config properly in DB', () => {
      const updated = airGapManager.updateConfig({
        enabled: true,
        defaultLocalModel: 'deepseek-r1:14b'
      });

      expect(updated.enabled).toBe(true);
      expect(updated.defaultLocalModel).toBe('deepseek-r1:14b');

      // Verify DB persistence
      const persisted = databaseService.getAirGapConfig();
      expect(persisted.enabled).toBe(true);
      expect(persisted.defaultLocalModel).toBe('deepseek-r1:14b');
    });

    it('logs security violation audit events when air-gap violations occur', () => {
      airGapManager.updateConfig({
        enabled: true,
        enforceLocalModels: false
      });

      // 1. Attempt outbound network access
      expect(() => airGapManager.assertNetworkAllowed('https://api.anthropic.com')).toThrow(
        AirGapViolationException
      );

      // 2. Attempt cloud CLI invocation
      expect(() => airGapManager.resolveProvider('claude')).toThrow(AirGapViolationException);

      // 3. Verify audit log captures violations
      const auditEntries = auditService.query({ eventType: 'security_violation' });
      expect(auditEntries.length).toBeGreaterThanOrEqual(2);
      expect(auditEntries.some((e) => e.action === 'network_egress_blocked')).toBe(true);
      expect(auditEntries.some((e) => e.action === 'cloud_provider_blocked')).toBe(true);
    });
  });
});
