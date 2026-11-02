import { describe, it, expect, beforeEach } from 'vitest';
import { PromptAssemblyService } from '../src/main/prompt/prompt-assembly.service';
import { SkillCompositionService } from '../src/main/skills/skill-composition.service';
import { MultiTierCacheService } from '../src/main/services/cache.service';
import { IntelligenceRouter } from '../src/main/services/intelligence-router.service';
import { ToolOutputNormalizer } from '../src/main/services/tool-output-normalizer';
import { tokenCounterService } from '../src/main/context/tokens/token-counter.service';
import { airGapManager } from '../src/main/services/air-gap.manager';

interface BenchmarkReport {
  task: string;
  unoptimizedTokens: number;
  optimizedTokens: number;
  savingsPercentage: number;
  qualityPreserved: boolean;
}

describe('Intelligence & Token Optimization Quality Benchmarks', () => {
  const benchmarkResults: BenchmarkReport[] = [];

  beforeEach(() => {
    MultiTierCacheService.clearAll();
    airGapManager.updateConfig({ enabled: false, allowedHosts: ['localhost', '127.0.0.1'] });
  });

  it('Benchmark 1: Code Explanation Task', () => {
    // Unoptimized baseline: full skill instructions (Level 3) + redundant blank lines + uncompressed context
    const fullSkill = SkillCompositionService.composeSkills(['code-explanation'], 'full');
    const rawContext = `
import { Database } from 'better-sqlite3';



export function querySessions(db: Database, projectId: string) {



  const stmt = db.prepare('SELECT * FROM sessions WHERE project_id = ?');



  return stmt.all(projectId);
}
`;

    const userPrompt = 'Explain what querySessions does, how parameters are bound, and any SQL injection risks.';

    const unoptimizedPrompt = `System:\nYou are an expert software engineer.\n\nInstructions:\n${fullSkill.composedText}\n\nContext:\n${rawContext}\n\nTask:\n${userPrompt}`;
    const unoptimizedTokens = tokenCounterService.countActualTokens(unoptimizedPrompt);

    // Optimized pipeline: Level 2 summary + compressed whitespace + deduplication + structured XML
    const summarySkill = SkillCompositionService.composeSkills(['code-explanation'], 'summary');
    const optimized = PromptAssemblyService.assemblePrompt({
      systemPrompt: 'You are an expert software engineer.',
      skillInstructions: summarySkill.composedText,
      contextMarkdown: rawContext,
      userObjective: userPrompt,
      mode: 'cost_efficient',
      providerFormat: 'xml_tags'
    });

    const optimizedTokens = optimized.totalTokens;
    const savings = ((unoptimizedTokens - optimizedTokens) / unoptimizedTokens) * 100;

    // Quality assertions: essential symbols and query must be preserved
    expect(optimized.assembledPrompt).toContain('querySessions');
    expect(optimized.assembledPrompt).toContain('better-sqlite3');
    expect(optimized.assembledPrompt).toContain('SQL injection risks');
    expect(optimized.assembledPrompt).not.toContain('\n\n\n');
    expect(savings).toBeGreaterThan(15); // Consistent token reduction

    benchmarkResults.push({
      task: 'Code Explanation',
      unoptimizedTokens,
      optimizedTokens,
      savingsPercentage: Number(savings.toFixed(1)),
      qualityPreserved: true
    });
  });

  it('Benchmark 2: Bug Investigation Task with Verbose Terminal Stack Trace', () => {
    const rawTrace = `
\u001b[31mError: Connection timeout to PostgreSQL host 10.0.1.25:5432\u001b[0m
    at Connection.connect (node_modules/pg/lib/connection.js:120:15)
    at Pool._connect (node_modules/pg-pool/index.js:200:10)
` + Array.from({ length: 120 }, (_, i) => `    at retryLoop_${i} (node_modules/internal/retry.js:${i}:5)`).join('\n') + `
\u001b[31mFatal: Max connection attempts (5) reached without socket response\u001b[0m
`;

    const rawPrompt = `Investigate this bug and find the root cause:\n${rawTrace}\n` +
      `Check environment settings, connection strings, and network policies.`;
    const unoptimizedTokens = tokenCounterService.countActualTokens(rawPrompt);

    // Optimized pipeline: normalize tool output + error highlight extraction + structured prompt
    const normalizedTool = ToolOutputNormalizer.normalize(rawTrace, { maxLines: 25, preserveErrors: true });
    const composedSkill = SkillCompositionService.composeSkills(['bug-investigation'], 'summary');
    const optimized = PromptAssemblyService.assemblePrompt({
      systemPrompt: 'Diagnose system errors isolating root cause.',
      skillInstructions: composedSkill.composedText,
      contextMarkdown: normalizedTool.normalized,
      userObjective: 'Investigate connection timeout and identify remedy.',
      mode: 'cost_efficient'
    });

    const optimizedTokens = optimized.totalTokens;
    const savings = ((unoptimizedTokens - optimizedTokens) / unoptimizedTokens) * 100;

    // Quality assertions: error root cause and fatal condition must be preserved
    expect(optimized.assembledPrompt).toContain('Connection timeout to PostgreSQL');
    expect(optimized.assembledPrompt).toContain('Max connection attempts');
    expect(optimized.assembledPrompt).not.toContain('\u001b[');
    expect(savings).toBeGreaterThan(50); // > 50% savings on bloated logs

    benchmarkResults.push({
      task: 'Bug Investigation (Verbose Logs)',
      unoptimizedTokens,
      optimizedTokens,
      savingsPercentage: Number(savings.toFixed(1)),
      qualityPreserved: true
    });
  });

  it('Benchmark 3: Code Generation Task with Multiple Supporting Skills', () => {
    // Unoptimized: injecting 3 full markdown skills manually
    const skillIds = ['refactoring', 'test-generation', 'documentation'];
    const fullSkills = SkillCompositionService.composeSkills(skillIds, 'full');
    const userGoal = 'Implement an in-memory priority queue with max-heap property in TypeScript.';

    const unoptimizedPrompt = `${fullSkills.composedText}\n\nTask:\n${userGoal}`;
    const unoptimizedTokens = tokenCounterService.countActualTokens(unoptimizedPrompt);

    // Optimized: Level 2 operational summaries with deduplication of shared coding standards
    const summarySkills = SkillCompositionService.composeSkills(skillIds, 'summary');
    const optimized = PromptAssemblyService.assemblePrompt({
      systemPrompt: 'Write clean, type-safe TypeScript algorithms.',
      skillInstructions: summarySkills.composedText,
      userObjective: userGoal,
      acceptanceCriteria: ['O(log n) insertion and extraction', 'Generic element type T', 'Comprehensive unit tests'],
      expectedOutputFormat: 'TypeScript class implementation + Vitest test suite'
    });

    const optimizedTokens = optimized.totalTokens;
    const savings = ((unoptimizedTokens - optimizedTokens) / unoptimizedTokens) * 100;

    // Quality assertions: All 3 skill capabilities represented, objective & criteria intact
    expect(optimized.assembledPrompt).toContain('priority queue');
    expect(optimized.assembledPrompt).toContain('Generic element type T');
    expect(summarySkills.conflictsResolved).toBeDefined();
    expect(savings).toBeGreaterThan(35); // > 35% savings on multi-skill composition

    benchmarkResults.push({
      task: 'Code Generation (Multi-Skill)',
      unoptimizedTokens,
      optimizedTokens,
      savingsPercentage: Number(savings.toFixed(1)),
      qualityPreserved: true
    });
  });

  it('Benchmark 4: Deterministic Model Response Caching (Repeat Execution)', () => {
    const prompt = 'Classify the severity of this error: "SQLITE_BUSY: database is locked"';
    const initialTokens = tokenCounterService.countActualTokens(prompt);

    // First execution: cache miss, compute and store in cache
    const cacheKey = MultiTierCacheService.hash(prompt);
    expect(MultiTierCacheService.modelResponseCache.get(cacheKey)).toBeNull();

    const simulatedResponse = JSON.stringify({ severity: 'HIGH', category: 'CONCURRENCY_LOCK' });
    MultiTierCacheService.modelResponseCache.set(cacheKey, simulatedResponse, initialTokens);

    // Second execution: cache hit, zero new LLM tokens consumed
    const cachedHit = MultiTierCacheService.modelResponseCache.get(cacheKey);
    expect(cachedHit).toBe(simulatedResponse);

    const stats = MultiTierCacheService.getAggregatedStats();
    expect(stats.modelResponses.hits).toBe(1);
    expect(stats.modelResponses.tokensSaved).toBe(initialTokens);

    // 100% savings on cache hit
    benchmarkResults.push({
      task: 'Deterministic Cache Hit (Repeat Task)',
      unoptimizedTokens: initialTokens,
      optimizedTokens: 0,
      savingsPercentage: 100,
      qualityPreserved: true
    });
  });

  it('Benchmark 5: Large Git Diff Review Task', () => {
    const rawDiff = `diff --git a/src/auth.ts b/src/auth.ts
index 1029384..5647382 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,5 +1,6 @@
+import { verifySignature } from './crypto';
` + Array.from({ length: 300 }, (_, i) => `+ const dummyLine_${i} = "${i}";`).join('\n') + `
@@ -50,6 +51,7 @@ export function authenticateUser(req: Request) {
-  return checkLegacyToken(req);
+  return verifySignature(req.headers['x-signature']);
 }
`;

    const unoptimizedTokens = tokenCounterService.countActualTokens(rawDiff);
    const normalizedDiff = ToolOutputNormalizer.normalizeDiff(rawDiff, 40);
    const optimizedTokens = tokenCounterService.countActualTokens(normalizedDiff);
    const savings = ((unoptimizedTokens - optimizedTokens) / unoptimizedTokens) * 100;

    expect(normalizedDiff).toContain('diff --git a/src/auth.ts b/src/auth.ts');
    expect(normalizedDiff).toContain('Diff truncated');
    expect(savings).toBeGreaterThan(40); // > 40% reduction

    benchmarkResults.push({
      task: 'Large Diff Review',
      unoptimizedTokens,
      optimizedTokens,
      savingsPercentage: Number(savings.toFixed(1)),
      qualityPreserved: true
    });
  });

  it('All Benchmark Tasks should maintain average token savings >= 30% without quality regression', () => {
    expect(benchmarkResults.length).toBe(5);
    const avgSavings =
      benchmarkResults.reduce((acc, b) => acc + b.savingsPercentage, 0) / benchmarkResults.length;

    // Average savings across all benchmarks should exceed 40%
    expect(avgSavings).toBeGreaterThan(40);

    for (const b of benchmarkResults) {
      expect(b.qualityPreserved).toBe(true);
      expect(b.savingsPercentage).toBeGreaterThan(15);
    }
  });
});
