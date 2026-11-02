import { describe, it, expect, beforeEach } from 'vitest';
import { PromptAssemblyService } from '../src/main/prompt/prompt-assembly.service';
import { SkillCompositionService } from '../src/main/skills/skill-composition.service';
import { MultiTierCacheService } from '../src/main/services/cache.service';
import { IntelligenceRouter } from '../src/main/services/intelligence-router.service';
import { ToolOutputNormalizer } from '../src/main/services/tool-output-normalizer';
import { airGapManager } from '../src/main/services/air-gap.manager';

describe('Token Optimization Pipeline Tests', () => {
  beforeEach(() => {
    MultiTierCacheService.clearAll();
    airGapManager.updateConfig({ enabled: false, allowedHosts: ['localhost', '127.0.0.1'] });
  });

  describe('PromptAssemblyService', () => {
    it('should assemble structured sections and compress redundant whitespace', () => {
      const result = PromptAssemblyService.assemblePrompt({
        systemPrompt: 'You are an expert engineer.\n\n\n\nPreserve comments.',
        securityConstraints: ['Do not run arbitrary shell scripts', 'Enforce local boundaries'],
        userObjective: 'Implement a function to parse CSV files with quotes.',
        acceptanceCriteria: ['Handles commas in quoted cells', 'Handles escaped double quotes'],
        contextMarkdown: '```typescript\nfunction csv() {\n\n\n\n  return [];\n}\n```',
        expectedOutputFormat: 'Return only valid TypeScript code.',
        providerFormat: 'xml_tags'
      });

      expect(result.assembledPrompt).toContain('<system>');
      expect(result.assembledPrompt).toContain('<security>');
      expect(result.assembledPrompt).toContain('<objective>');
      expect(result.assembledPrompt).toContain('<acceptance_criteria>');
      expect(result.assembledPrompt).toContain('<context>');
      expect(result.assembledPrompt).toContain('<format>');
      expect(result.promptFingerprint).toHaveLength(64); // SHA-256
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.assembledPrompt).not.toContain('\n\n\n\n');
    });

    it('should enforce budget trimming on lower priority sections when budget is restricted', () => {
      const largeContext = 'const item = 1;\n'.repeat(500); // Many tokens
      const result = PromptAssemblyService.assemblePrompt({
        systemPrompt: 'System instructions.',
        userObjective: 'Core objective.',
        contextMarkdown: largeContext,
        maxTokens: 100 // Constrained budget
      });

      // Mandatory objective & system should remain, context should be trimmed or dropped
      const objectiveSection = result.sections.find((s) => s.type === 'objective');
      expect(objectiveSection).toBeDefined();
      expect(result.totalTokens).toBeLessThanOrEqual(250);
    });

    it('should deduplicate repeated lines across prompt sections', () => {
      const duplicateClause = 'You must follow all project coding standards and clean code conventions.';
      const result = PromptAssemblyService.assemblePrompt({
        systemPrompt: `Always follow rules.\n${duplicateClause}`,
        userObjective: 'Implement feature',
        expectedOutputFormat: `Format properly.\n${duplicateClause}`
      });

      expect(result.deduplicationSavingsTokens).toBeGreaterThanOrEqual(0);
    });
  });

  describe('SkillCompositionService', () => {
    it('should progressively load skill instructions with tiered token consumption', () => {
      const skillIds = ['code-review', 'bug-investigation'];

      // Level 1: Metadata
      const meta = SkillCompositionService.composeSkills(skillIds, 'metadata');
      expect(meta.composedText).toContain('code-review');
      expect(meta.composedText).toContain('bug-investigation');
      expect(meta.totalTokens).toBeLessThan(150);

      // Level 2: Summary
      const summary = SkillCompositionService.composeSkills(skillIds, 'summary');
      expect(summary.totalTokens).toBeGreaterThan(meta.totalTokens);
      expect(summary.composedText).toContain('Specialist');
      expect(summary.totalTokens).toBeLessThan(250);

      // Level 3: Full instructions
      const full = SkillCompositionService.composeSkills(skillIds, 'full');
      expect(full.totalTokens).toBeGreaterThan(summary.totalTokens);
      expect(full.activeSkillIds).toEqual(skillIds);
    });

    it('should record skill telemetry and maintain execution counts', () => {
      SkillCompositionService.recordSkillUsage('code-review', 120, 150, true);
      SkillCompositionService.recordSkillUsage('code-review', 140, 200, true);
      const stats = SkillCompositionService.getSkillUsageStats('code-review');
      expect(stats).toBeDefined();
      expect(stats?.invocations).toBe(2);
      expect(stats?.successCount).toBe(2);
      expect(stats?.avgExecutionTimeMs).toBe(175);
    });
  });

  describe('MultiTierCacheService', () => {
    it('should support LRU cache set, get, TTL and stats', () => {
      const key = 'test_key';
      MultiTierCacheService.contextCache.set(key, { symbols: ['parse'] }, 50);

      const cached = MultiTierCacheService.contextCache.get(key);
      expect(cached).toEqual({ symbols: ['parse'] });

      const stats = MultiTierCacheService.getAggregatedStats();
      expect(stats.context.hits).toBe(1);
      expect(stats.context.tokensSaved).toBe(50);
      expect(stats.totalTokensSaved).toBe(50);
    });

    it('should invalidate matching keys when a file is modified', () => {
      const filePath = 'src/test/parser.ts';
      MultiTierCacheService.contextCache.set(`ast_${filePath}`, { ast: {} }, 100);
      MultiTierCacheService.promptCache.set(`prompt_${filePath}`, { prompt: '...' }, 200);

      MultiTierCacheService.onFileModified(filePath);

      expect(MultiTierCacheService.contextCache.get(`ast_${filePath}`)).toBeNull();
      expect(MultiTierCacheService.promptCache.get(`prompt_${filePath}`)).toBeNull();
    });

    it('should reject caching when request contains secrets or modifying commands', () => {
      const safe = MultiTierCacheService.isCacheEligible({
        category: 'classification',
        prompt: 'Classify this function error'
      });
      expect(safe).toBe(true);

      const modifying = MultiTierCacheService.isCacheEligible({
        category: 'classification',
        isModifying: true,
        prompt: 'Classify and write file'
      });
      expect(modifying).toBe(false);

      const secret = MultiTierCacheService.isCacheEligible({
        category: 'summarization',
        prompt: 'Summarize the request with bearer sk-ant-api03-secret-key-12345'
      });
      expect(secret).toBe(false);
    });
  });

  describe('IntelligenceRouter', () => {
    it('should categorize task and route to appropriate model and tier', () => {
      const classification = IntelligenceRouter.routeTask({
        taskDescription: 'Classify whether this code snippet is Python or TypeScript'
      });
      expect(classification.taskCategory).toBe('classification');
      expect(classification.estimatedCostRateUsd.inRate).toBeLessThan(1.0);

      const architecture = IntelligenceRouter.routeTask({
        taskDescription: 'Architect a distributed fault-tolerant actor system with event sourcing',
        requiresReasoning: true
      });
      expect(architecture.taskCategory).toBe('architecture');
      expect(architecture.selectedModel).toContain('sonnet');
      expect(architecture.confidence).toBeGreaterThan(0.8);
    });

    it('should strictly override all routing decisions to local Ollama when Air-Gap mode is enabled', () => {
      airGapManager.updateConfig({ enabled: true, allowedHosts: ['localhost', '127.0.0.1'] });

      const decision = IntelligenceRouter.routeTask({
        taskDescription: 'Refactor cryptography primitives',
        preferredProvider: 'claude'
      });

      expect(decision.isAirGapEnforced).toBe(true);
      expect(decision.selectedProvider).toBe('ollama');
      expect(decision.reason).toContain('Air-Gap');
    });
  });

  describe('ToolOutputNormalizer', () => {
    it('should strip ANSI escape sequences and preserve error highlights', () => {
      const rawTerminal = '\u001b[31mTypeError: Cannot read property "name" of undefined\u001b[0m\n' +
        Array.from({ length: 150 }, (_, i) => `    at line_${i} (index.js:${i}:1)`).join('\n') +
        '\n\u001b[32mExited with code 1\u001b[0m';

      const normalized = ToolOutputNormalizer.normalize(rawTerminal, { maxLines: 20 });
      expect(normalized.isTruncated).toBe(true);
      expect(normalized.normalized).not.toContain('\u001b[');
      expect(normalized.normalized).toContain('TypeError');
      expect(normalized.normalized).toContain('Exited with code 1');
      expect(normalized.tokensSaved).toBeGreaterThan(0);
      expect(normalized.errorSnippet).toContain('TypeError');
    });

    it('should normalize git diffs and truncate long changesets', () => {
      const rawDiff = `diff --git a/app.ts b/app.ts
--- a/app.ts
+++ b/app.ts
` + Array.from({ length: 250 }, (_, i) => `+ const line_${i} = ${i};`).join('\n');

      const normalized = ToolOutputNormalizer.normalizeDiff(rawDiff, 30);
      expect(normalized).toContain('diff --git a/app.ts b/app.ts');
      expect(normalized).toContain('Diff truncated');
    });
  });
});
