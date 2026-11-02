import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { databaseService } from '../src/main/db/database.service';
import { analyticsService } from '../src/main/services/analytics.service';
import { auditService } from '../src/main/services/audit.service';

describe('Analytics, Cost Attribution & Enterprise Audit Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-test-'));
    databaseService.initialize(tempDir);
    analyticsService.clear();
    auditService.clear();
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Model Rate Card & Cost Calculation', () => {
    it('calculates cost correctly for Claude models', () => {
      // 1M in = $3.00, 1M out = $15.00
      const cost = analyticsService.estimateCost('claude', 'claude-3-5-sonnet', 100_000, 20_000);
      // in: 100k / 1M * 3 = 0.30
      // out: 20k / 1M * 15 = 0.30
      // total = 0.60
      expect(cost).toBeCloseTo(0.60, 4);
    });

    it('calculates cost correctly for OpenAI Codex / GPT-4o models', () => {
      // 1M in = $2.50, 1M out = $10.00
      const cost = analyticsService.estimateCost('codex', 'gpt-4o', 50_000, 10_000);
      // in: 50k / 1M * 2.5 = 0.125
      // out: 10k / 1M * 10 = 0.100
      // total = 0.225
      expect(cost).toBeCloseTo(0.225, 4);
    });

    it('calculates cost correctly for Google Gemini models', () => {
      // 1M in = $1.25, 1M out = $5.00
      const cost = analyticsService.estimateCost('gemini', 'gemini-1.5-pro', 200_000, 40_000);
      // in: 200k / 1M * 1.25 = 0.25
      // out: 40k / 1M * 5 = 0.20
      // total = 0.45
      expect(cost).toBeCloseTo(0.45, 4);
    });

    it('calculates zero cost ($0.00) for local air-gapped models (Ollama)', () => {
      const cost1 = analyticsService.estimateCost('ollama', 'llama3:latest', 1_000_000, 500_000);
      expect(cost1).toBe(0.0);

      const cost2 = analyticsService.estimateCost('ollama', 'mistral', 250_000, 100_000);
      expect(cost2).toBe(0.0);
    });
  });

  describe('Analytics Events Aggregation & Summary Metrics', () => {
    it('records events and computes aggregated metrics with latency percentiles', () => {
      analyticsService.recordEvent({
        provider: 'claude',
        model: 'claude-3-5-sonnet',
        tokensIn: 1000,
        tokensOut: 500,
        durationMs: 1200,
        status: 'success',
        feature: 'cli'
      });

      analyticsService.recordEvent({
        provider: 'ollama',
        model: 'llama3:latest',
        tokensIn: 2000,
        tokensOut: 1500,
        durationMs: 800,
        status: 'success',
        feature: 'workflow'
      });

      analyticsService.recordEvent({
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        tokensIn: 5000,
        tokensOut: 2000,
        durationMs: 2500,
        status: 'success',
        feature: 'orchestration'
      });

      const summary = analyticsService.getSummary();
      expect(summary.totalCalls).toBe(3);
      expect(summary.totalTokensIn).toBe(8000);
      expect(summary.totalTokensOut).toBe(4000);
      expect(summary.totalCostUsd).toBeGreaterThan(0);
      expect(summary.avgDurationMs).toBe(1500);
      expect(summary.p50DurationMs).toBe(1200);

      expect(summary.byProvider['claude']?.calls).toBe(1);
      expect(summary.byProvider['ollama']?.calls).toBe(1);
      expect(summary.byProvider['ollama']?.costUsd).toBe(0);
      expect(summary.byFeature['workflow']?.calls).toBe(1);
      expect(summary.timeline.length).toBeGreaterThanOrEqual(1);
    });

    it('exports analytics data in JSON and CSV formats', () => {
      analyticsService.recordEvent({
        provider: 'codex',
        model: 'gpt-4o',
        tokensIn: 400,
        tokensOut: 200,
        durationMs: 900,
        status: 'success',
        feature: 'skill'
      });

      const jsonExport = analyticsService.exportData('json');
      const parsed = JSON.parse(jsonExport);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].provider).toBe('codex');

      const csvExport = analyticsService.exportData('csv');
      expect(csvExport).toContain('tokens_in,tokens_out');
      expect(csvExport).toContain('gpt-4o');
    });
  });

  describe('Enterprise Audit Logging', () => {
    it('records general audit entries and security violations', () => {
      const entry = auditService.log({
        eventType: 'config_change',
        severity: 'info',
        actor: 'user',
        action: 'toggle_airgap',
        details: { enabled: true }
      });

      expect(entry.id).toBeDefined();
      expect(entry.eventType).toBe('config_change');

      const violation = auditService.logSecurityViolation(
        'security_kernel',
        'path_traversal_blocked',
        'Attempted escape via ../../etc/passwd',
        '../../etc/passwd',
        '/workspace/root'
      );

      expect(violation.severity).toBe('critical');
      expect(violation.eventType).toBe('security_violation');
    });

    it('queries and filters audit logs with criteria', () => {
      auditService.log({ eventType: 'user_action', severity: 'info', actor: 'alice', action: 'open_file' });
      auditService.log({ eventType: 'user_action', severity: 'info', actor: 'bob', action: 'open_file' });
      auditService.log({ eventType: 'system_error', severity: 'error', actor: 'indexer', action: 'parse_fail' });
      auditService.logSecurityViolation('sandbox', 'denied_write', 'Read-only mode active');

      const all = auditService.query();
      expect(all.length).toBeGreaterThanOrEqual(4);

      const criticalOnly = auditService.query({ severity: 'critical' });
      expect(criticalOnly).toHaveLength(1);
      expect(criticalOnly[0].actor).toBe('sandbox');

      const bobOnly = auditService.query({ actor: 'bob' });
      expect(bobOnly).toHaveLength(1);
    });

    it('exports audit logs cleanly to JSON and CSV formats', () => {
      auditService.log({
        eventType: 'auth_attempt',
        severity: 'info',
        actor: 'cli_manager',
        action: 'check_credentials'
      });

      const json = auditService.export('json');
      const parsed = JSON.parse(json);
      expect(parsed.length).toBeGreaterThanOrEqual(1);

      const csv = auditService.export('csv');
      expect(csv).toContain('id,timestamp,eventType,severity,actor,action');
      expect(csv).toContain('auth_attempt');
    });
  });
});
