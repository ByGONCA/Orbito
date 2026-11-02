import { describe, it, expect, beforeEach } from 'vitest';
import { PromptAssemblyService, MandatoryBudgetExceededError } from '../src/main/prompt/prompt-assembly.service';
import { SkillCompositionService } from '../src/main/skills/skill-composition.service';
import { MultiTierCacheService } from '../src/main/services/cache.service';
import { IntelligenceRouter } from '../src/main/services/intelligence-router.service';
import { ToolOutputNormalizer } from '../src/main/services/tool-output-normalizer';
import { tokenCounterService } from '../src/main/context/tokens/token-counter.service';
import { airGapManager } from '../src/main/services/air-gap.manager';

describe('Phase 8.1: Intelligence Validation & Optimization Hardening', () => {
  beforeEach(() => {
    MultiTierCacheService.clearAll();
    ToolOutputNormalizer.clearRawOutputs();
    airGapManager.updateConfig({ enabled: false, allowedHosts: ['localhost', '127.0.0.1'] });
  });

  describe('1. Tokenizer Accuracy & Model-Aware Evaluation', () => {
    it('accurately differentiates o200k_base vs cl100k_base encodings for OpenAI models', () => {
      const codeSample = `
export interface WorkerTask<T = unknown> {
  id: string;
  payload: T;
  priority: number;
  retryCount: number;
  createdAt: Date;
}
`;
      const gpt4oTokens = tokenCounterService.countModelTokens(codeSample, 'gpt-4o');
      const gpt4Tokens = tokenCounterService.countModelTokens(codeSample, 'gpt-4');

      expect(gpt4oTokens).toBeGreaterThan(0);
      expect(gpt4Tokens).toBeGreaterThan(0);

      // Evaluate detailed token info with confidence labels
      const gpt4oEval = tokenCounterService.evaluateTokens(codeSample, 'gpt-4o');
      expect(gpt4oEval.method).toBe('exact_bpe');
      expect(gpt4oEval.confidence).toBe('exact');
      expect(gpt4oEval.encodingUsed).toBe('o200k_base');

      const claudeEval = tokenCounterService.evaluateTokens(codeSample, 'claude-3-5-sonnet');
      expect(claudeEval.method).toBe('calibrated_estimate');
      expect(claudeEval.confidence).toBe('high');

      const geminiEval = tokenCounterService.evaluateTokens(codeSample, 'gemini-1.5-pro');
      expect(geminiEval.method).toBe('calibrated_estimate');
      expect(geminiEval.confidence).toBe('high');
    });

    it('reconciles local token estimates against provider reported usage', () => {
      const estimated = 1200;
      const reported = 1150;
      const reconciliation = tokenCounterService.reconcileWithProviderUsage(estimated, reported);

      expect(reconciliation.estimatedTokens).toBe(1200);
      expect(reconciliation.reportedTokens).toBe(1150);
      expect(reconciliation.varianceTokens).toBe(50);
      expect(reconciliation.variancePercentage).toBeCloseTo(4.35, 1);
    });

    it('reports exact per-model context limits', () => {
      expect(tokenCounterService.getModelContextLimit('gemini-1.5-pro')).toBe(2000000);
      expect(tokenCounterService.getModelContextLimit('claude-3-7-sonnet')).toBe(200000);
      expect(tokenCounterService.getModelContextLimit('gpt-4o')).toBe(128000);
      expect(tokenCounterService.getModelContextLimit('llama3:latest')).toBe(32000);
    });
  });

  describe('2. Response Cache Safety & Isolation', () => {
    it('strictly isolates cache entries between different workspaces', () => {
      const prompt = 'Analyze memory consumption in queue manager.';
      const keyWorkspaceA = MultiTierCacheService.buildModelResponseKey({
        workspacePath: '/Users/test/workspace-alpha',
        provider: 'claude',
        model: 'claude-3-5-sonnet',
        prompt
      });

      const keyWorkspaceB = MultiTierCacheService.buildModelResponseKey({
        workspacePath: '/Users/test/workspace-beta',
        provider: 'claude',
        model: 'claude-3-5-sonnet',
        prompt
      });

      expect(keyWorkspaceA).not.toBe(keyWorkspaceB);

      MultiTierCacheService.modelResponseCache.set(keyWorkspaceA, 'Alpha Result', 100);
      expect(MultiTierCacheService.modelResponseCache.get(keyWorkspaceA)).toBe('Alpha Result');
      expect(MultiTierCacheService.modelResponseCache.get(keyWorkspaceB)).toBeNull();
    });

    it('rejects non-deterministic requests (temperature > 0 or mutation keywords)', () => {
      expect(MultiTierCacheService.isCacheEligible({ temperature: 0.7 })).toBe(false);
      expect(MultiTierCacheService.isCacheEligible({ userPrompt: 'delete all logs' })).toBe(false);
      expect(MultiTierCacheService.isCacheEligible({ userPrompt: 'Bearer secret_token_abc123' })).toBe(false);
      expect(MultiTierCacheService.isCacheEligible({ temperature: 0, userPrompt: 'Explain binary search' })).toBe(true);
    });

    it('invalidates caches when Air-Gap is toggled to prevent cross-network data bleed', () => {
      const key = MultiTierCacheService.buildModelResponseKey({
        workspacePath: '/repo',
        provider: 'claude',
        model: 'claude-3-5-sonnet',
        prompt: 'Check architecture'
      });

      MultiTierCacheService.modelResponseCache.set(key, 'Cached Analysis', 250);
      expect(MultiTierCacheService.modelResponseCache.get(key)).toBe('Cached Analysis');

      // Air-Gap toggled -> all response caches cleared
      MultiTierCacheService.onAirGapToggled(true);
      expect(MultiTierCacheService.modelResponseCache.get(key)).toBeNull();
    });

    it('invalidates caches on permission tier transitions', () => {
      const key = MultiTierCacheService.buildModelResponseKey({
        workspacePath: '/repo',
        provider: 'claude',
        model: 'claude-3-5-sonnet',
        prompt: 'Audit files'
      });

      MultiTierCacheService.modelResponseCache.set(key, 'Audit OK', 150);
      expect(MultiTierCacheService.modelResponseCache.get(key)).toBe('Audit OK');

      MultiTierCacheService.onPermissionTierChanged('admin');
      expect(MultiTierCacheService.modelResponseCache.get(key)).toBeNull();
    });
  });

  describe('3. Prompt Assembly Correctness & Budget Protection', () => {
    it('throws MandatoryBudgetExceededError when mandatory sections exceed total budget', () => {
      const hugeSystemPrompt = 'CRITICAL SYSTEM INSTRUCTION: '.repeat(500); // Many tokens
      const hugeObjective = 'PRIMARY USER OBJECTIVE: '.repeat(500);

      expect(() => {
        PromptAssemblyService.assemblePrompt({
          systemPrompt: hugeSystemPrompt,
          userObjective: hugeObjective,
          maxTokens: 50 // Far too small for mandatory sections
        });
      }).toThrowError(MandatoryBudgetExceededError);

      try {
        PromptAssemblyService.assemblePrompt({
          systemPrompt: hugeSystemPrompt,
          userObjective: hugeObjective,
          maxTokens: 50
        });
      } catch (err) {
        expect(err).toBeInstanceOf(MandatoryBudgetExceededError);
        const budgetErr = err as MandatoryBudgetExceededError;
        expect(budgetErr.mandatoryTokens).toBeGreaterThan(50);
        expect(budgetErr.totalCapacity).toBe(50);
        expect(budgetErr.sectionBreakdown).toHaveProperty('system');
        expect(budgetErr.sectionBreakdown).toHaveProperty('objective');
      }
    });

    it('compresses whitespace while rigorously preserving fenced code, tables, and indentation', () => {
      const input = `
Some introductory text.



| Column 1 | Column 2 | Column 3 |
| :--- | :--- | :--- |
|   val A   |   val B   |   val C   |

    const indentedCode = true;
    function test() {
      return 42;
    }

\`\`\`typescript
interface TableItem {
  id: string;
  name: string;
}
\`\`\`
`;

      const compressed = PromptAssemblyService.compressWhitespace(input);

      // Markdown table spacing preserved
      expect(compressed).toContain('| Column 1 | Column 2 | Column 3 |');
      expect(compressed).toContain('|   val A   |   val B   |   val C   |');

      // Indented code preserved
      expect(compressed).toContain('    const indentedCode = true;');
      expect(compressed).toContain('      return 42;');

      // Fenced code preserved
      expect(compressed).toContain('interface TableItem');

      // Multiple blank lines collapsed
      expect(compressed).not.toContain('\n\n\n');
    });
  });

  describe('4. Skill Composition Quality & Multi-Skill Conflict Resolution', () => {
    it('detects and resolves output format conflicts in favor of primary skill', () => {
      // Primary: bug-investigation (expects root cause explanation)
      // Supporting: a skill asking for JSON output
      const composed = SkillCompositionService.composeSkills(['bug-investigation', 'code-review'], 'full');

      expect(composed.primarySkillId).toBe('bug-investigation');
      expect(composed.activeSkillIds).toContain('bug-investigation');
      expect(composed.activeSkillIds).toContain('code-review');
      expect(composed.composedText).toContain('Composed Skill Protocol');
      expect(composed.conflictsResolved).toBeDefined();
    });

    it('validates provider compatibility for registered skills', () => {
      const validation = SkillCompositionService.validateProviderCompatibility(
        ['bug-investigation', 'code-review'],
        'claude'
      );
      expect(validation.compatible.length).toBeGreaterThan(0);
    });

    it('cascades down skill loading levels when token budget is constrained', () => {
      const skillIds = ['bug-investigation', 'code-review', 'refactoring', 'documentation'];
      // Full loading has substantial tokens
      const full = SkillCompositionService.composeSkills(skillIds, 'full');
      // Constrain budget to 120 tokens
      const constrained = SkillCompositionService.composeSkills(skillIds, 'full', 120);

      expect(constrained.totalTokens).toBeLessThan(full.totalTokens);
      expect(constrained.tokensSaved).toBeGreaterThan(0);
      expect(constrained.composedText).toContain('Primary');
    });
  });

  describe('5. Tool Output Normalization & Raw Store', () => {
    it('stores raw un-truncated tool output for on-demand retrieval by rawOutputId', () => {
      const largeOutput = Array.from({ length: 250 }, (_, i) => `log line ${i}: operation running`).join('\n');
      const normalized = ToolOutputNormalizer.normalize(largeOutput, { maxLines: 30 });

      expect(normalized.isTruncated).toBe(true);
      expect(normalized.rawOutputId).toBeDefined();

      const retrieved = ToolOutputNormalizer.getRawOutput(normalized.rawOutputId!);
      expect(retrieved).toBe(largeOutput.trim());
    });

    it('normalizes multi-file git diffs with balanced representation across all files', () => {
      const multiFileDiff = `diff --git a/src/auth.ts b/src/auth.ts
index 1111111..2222222 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,5 +1,6 @@
` + Array.from({ length: 150 }, (_, i) => `+ const authLine_${i} = ${i};`).join('\n') + `
diff --git a/src/payment.ts b/src/payment.ts
index 3333333..4444444 100644
--- a/src/payment.ts
+++ b/src/payment.ts
@@ -1,5 +1,6 @@
` + Array.from({ length: 150 }, (_, i) => `+ const paymentLine_${i} = ${i};`).join('\n') + `
diff --git a/src/users.ts b/src/users.ts
index 5555555..6666666 100644
--- a/src/users.ts
+++ b/src/users.ts
@@ -1,5 +1,6 @@
` + Array.from({ length: 150 }, (_, i) => `+ const usersLine_${i} = ${i};`).join('\n');

      const balancedDiff = ToolOutputNormalizer.normalizeDiff(multiFileDiff, 60);

      // All 3 files must be present and represented in the balanced diff
      expect(balancedDiff).toContain('diff --git a/src/auth.ts');
      expect(balancedDiff).toContain('diff --git a/src/payment.ts');
      expect(balancedDiff).toContain('diff --git a/src/users.ts');
      expect(balancedDiff).toContain('Multi-file diff balanced');
    });
  });

  describe('6. Intelligence Router Validation', () => {
    it('strictly enforces local Ollama in Air-Gap mode regardless of token volume or preferred provider', () => {
      airGapManager.updateConfig({ enabled: true, defaultLocalModel: 'llama3:latest' });

      const decision = IntelligenceRouter.routeTask({
        taskDescription: 'Refactor enterprise payment engine and check security',
        estimatedInputTokens: 50000,
        preferredProvider: 'claude'
      });

      expect(decision.selectedProvider).toBe('ollama');
      expect(decision.selectedModel).toBe('llama3:latest');
      expect(decision.isAirGapEnforced).toBe(true);
      expect(decision.estimatedCostRateUsd.inRate).toBe(0);
      expect(decision.reason).toContain('Air-Gap');
    });

    it('falls back to an available provider when preferred provider is uninstalled or unauthenticated', () => {
      const decision = IntelligenceRouter.routeTask({
        taskDescription: 'Classify incoming ticket priority',
        category: 'classification',
        preferredProvider: 'claude',
        providerStatus: {
          claude: { isInstalled: false, isAuthenticated: false },
          gemini: { isInstalled: true, isAuthenticated: true },
          codex: { isInstalled: true, isAuthenticated: true }
        }
      });

      // Claude is uninstalled -> must route to gemini-flash or gpt-4o-mini
      expect(decision.selectedProvider).not.toBe('claude');
      expect(decision.reason).toContain('Fallback applied');
    });

    it('disqualifies candidate models when estimated tokens exceed model context limit', () => {
      const decision = IntelligenceRouter.routeTask({
        taskDescription: 'Analyze massive codebase context',
        estimatedInputTokens: 150000, // Exceeds GPT-4o 128k limit
        preferredProvider: 'codex'
      });

      // GPT-4o window is 128k -> disqualified; must pick gemini-pro (1M) or claude-sonnet (200k)
      expect(decision.selectedModel).not.toBe('gpt-4o');
      expect(['gemini-1.5-pro', 'claude-3-5-sonnet']).toContain(decision.selectedModel);
    });
  });

  describe('7. Disaggregated Benchmark Metrics (Unbundling the 67.7% Claim)', () => {
    it('measures and asserts honest, disaggregated optimization categories', () => {
      // Category A: Cold Prompt Whitespace Compression & Deduplication (20-45%)
      const bloatedGuidelines = [
        'Adhere strictly to project TypeScript coding standards.',
        'Preserve existing comments and docstrings when modifying files.',
        'Do not modify unrelated files outside the specified scope.',
        'Ensure all edge cases and error handling branches are validated.',
        'Follow established architectural conventions across services.',
        ''
      ].join('\n\n\n\n');

      const bloatedPrompt = `
System:
You are an expert system.

${bloatedGuidelines}
${bloatedGuidelines}

Security:
- Never disclose API keys
- Never bypass authentication checks

Task:
Refactor the token counting service to support o200k_base tokenizer accurately.
`;
      const unoptimizedColdTokens = tokenCounterService.countActualTokens(bloatedPrompt);
      const assembledCold = PromptAssemblyService.assemblePrompt({
        systemPrompt: `You are an expert system.\n${bloatedGuidelines}`,
        securityConstraints: ['Never disclose API keys', 'Never bypass authentication checks'],
        userObjective: 'Refactor the token counting service to support o200k_base tokenizer accurately.'
      });
      const coldSavingsPct = ((unoptimizedColdTokens - assembledCold.totalTokens) / unoptimizedColdTokens) * 100;
      expect(coldSavingsPct).toBeGreaterThan(15);

      // Category B: Skill Deduplication & Progressive Loading (50-75%)
      const fullSkills = SkillCompositionService.composeSkills(['bug-fixing', 'refactoring', 'test-generation'], 'full');
      const summarySkills = SkillCompositionService.composeSkills(['bug-fixing', 'refactoring', 'test-generation'], 'summary');
      const skillSavingsPct = ((fullSkills.totalTokens - summarySkills.totalTokens) / fullSkills.totalTokens) * 100;
      expect(skillSavingsPct).toBeGreaterThan(50);

      // Category C: Log & Tool Output Truncation (50-80%)
      const massiveLog = Array.from({ length: 200 }, (_, i) => `[TRACE 2026-11-02] Event loop iteration ${i} processed normally`).join('\n');
      const normLog = ToolOutputNormalizer.normalize(massiveLog, { maxLines: 20 });
      const logSavingsPct = (normLog.tokensSaved / tokenCounterService.countActualTokens(massiveLog)) * 100;
      expect(logSavingsPct).toBeGreaterThan(60);

      // Category D: Deterministic Response Cache Hit (100% on repeat execution)
      const repeatPrompt = 'Explain memoization';
      const promptTokens = tokenCounterService.countActualTokens(repeatPrompt);
      const cacheKey = MultiTierCacheService.buildModelResponseKey({
        workspacePath: '/repo',
        provider: 'claude',
        model: 'claude-3-5-sonnet',
        prompt: repeatPrompt
      });
      MultiTierCacheService.modelResponseCache.set(cacheKey, 'Memoization caches function outputs.', promptTokens);
      const cached = MultiTierCacheService.modelResponseCache.get(cacheKey);
      expect(cached).toBeDefined();

      // Explicit verification: Cache hit is 100%, but must NOT be conflated with cold prompt compression!
      expect(coldSavingsPct).toBeLessThan(60);
      expect(skillSavingsPct).toBeGreaterThan(50);
      expect(logSavingsPct).toBeGreaterThan(50);
    });
  });
});
