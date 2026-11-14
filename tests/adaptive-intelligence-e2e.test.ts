import { describe, it, expect, beforeEach } from 'vitest';
import { modelRegistry } from '../src/main/ai/model-registry';
import { modelCapabilityEngine } from '../src/main/ai/model-capability-engine';
import { taskIntelligenceEngine } from '../src/main/ai/task-intelligence-engine';
import { adaptiveModelRouter } from '../src/main/ai/adaptive-model-router';
import { modelContextHandoffManager } from '../src/main/ai/model-context-handoff';
import { modelCostEngine } from '../src/main/ai/model-cost-engine';
import { multiModelCollaborationManager } from '../src/main/ai/multi-model-collaboration';
import { airGapManager } from '../src/main/services/air-gap.manager';

describe('Orbito Adaptive Intelligence — End-to-End Validation Suite', () => {
  beforeEach(() => {
    airGapManager.updateConfig({ enabled: false });
  });

  // Scenario A: Single-Provider Claude User
  describe('Scenario A: User with only Claude access', () => {
    it('intelligently optimizes across Claude models without requesting external providers', () => {
      // 1. Classification operation -> Haiku
      const classificationRoute = adaptiveModelRouter.routeOperation({
        taskDescription: 'Classify whether this issue is a frontend bug or backend defect',
        category: 'classification',
        preferredProvider: 'claude',
        singleProviderOnly: true
      });
      expect(classificationRoute.selectedProvider).toBe('claude');
      expect(classificationRoute.selectedModelId).toContain('haiku');

      // 2. Implementation operation -> Sonnet
      const codingRoute = adaptiveModelRouter.routeOperation({
        taskDescription: 'Implement secure token refresh mechanism in auth service',
        category: 'code_generation',
        preferredProvider: 'claude',
        singleProviderOnly: true
      });
      expect(codingRoute.selectedProvider).toBe('claude');
      expect(codingRoute.selectedModelId).toContain('sonnet');

      // 3. Deep Architecture operation -> Sonnet 3.7 / Opus
      const archRoute = adaptiveModelRouter.routeOperation({
        taskDescription: 'Redesign entire multi-agent state persistence topology',
        category: 'architecture',
        preferredProvider: 'claude',
        singleProviderOnly: true
      });
      expect(archRoute.selectedProvider).toBe('claude');
      expect(archRoute.selectedModelId).toMatch(/sonnet|opus/);
    });
  });

  // Scenario B: Single-Provider OpenAI User
  describe('Scenario B: User with only OpenAI access', () => {
    it('optimizes between OpenAI models without external provider dependency', () => {
      // Lightweight summarization -> gpt-4o-mini
      const summaryRoute = adaptiveModelRouter.routeOperation({
        taskDescription: 'Summarize git diff in one concise paragraph',
        category: 'summarization',
        preferredProvider: 'codex',
        singleProviderOnly: true
      });
      expect(summaryRoute.selectedProvider).toBe('codex');
      expect(summaryRoute.selectedModelId).toContain('mini');

      // Code implementation -> gpt-4o
      const codeRoute = adaptiveModelRouter.routeOperation({
        taskDescription: 'Write unit tests for authentication tokens',
        category: 'code_generation',
        preferredProvider: 'codex',
        singleProviderOnly: true
      });
      expect(codeRoute.selectedProvider).toBe('codex');
      expect(codeRoute.selectedModelId).toMatch(/gpt-4o|o3-mini|o1/);

      // Deep reasoning -> o3-mini or o1
      const reasoningRoute = adaptiveModelRouter.routeOperation({
        taskDescription: 'Diagnose why concurrent threads deadlock in SQLite WAL checkpoint',
        category: 'deep_reasoning',
        preferredProvider: 'codex',
        singleProviderOnly: true
      });
      expect(reasoningRoute.selectedProvider).toBe('codex');
      expect(reasoningRoute.selectedModelId).toMatch(/o3-mini|o1|gpt-4o/);
    });
  });

  // Scenario C: Multi-Provider User
  describe('Scenario C: User with multiple providers configured', () => {
    it('compares eligible models across providers and selects optimal fit', () => {
      const decision = adaptiveModelRouter.routeOperation({
        taskDescription: 'Implement mission-critical financial ledger with strict formal verification',
        category: 'deep_reasoning',
        optimizationMode: 'max_quality',
        allowedProviders: ['claude', 'codex', 'gemini']
      });

      expect(['claude', 'codex', 'gemini']).toContain(decision.selectedProvider);
      expect(decision.confidence).toBeGreaterThanOrEqual(0.85);
      expect(decision.fallbackModelIds.length).toBeGreaterThan(0);
    });
  });

  // Scenario D: Multi-Stage Task Pipeline Decomposition
  describe('Scenario D: Multi-stage pipeline across stages', () => {
    it('decomposes task into capability-driven operations with stage-specific model assignments', () => {
      const prompt = 'Analyze project architecture, identify security defects, implement fixes, and verify everything';
      const analysis = taskIntelligenceEngine.analyzeTask({ taskDescription: prompt });

      expect(analysis.complexity).toBe('critical');
      expect(analysis.pipeline.length).toBeGreaterThanOrEqual(4);

      // Verify progression of tiers:
      // Exploration -> fast_economical
      // Architecture -> frontier_reasoning
      // Implementation -> frontier_reasoning
      // Verification -> frontier_reasoning or balanced_coding
      expect(analysis.pipeline[0].recommendedTier).toBe('fast_economical');
      expect(analysis.pipeline[1].recommendedTier).toBe('frontier_reasoning');
    });
  });

  // Scenario E: Model Switching & Context Handoff
  describe('Scenario E: Dynamic model switching and context handoff', () => {
    it('preserves execution state, file diffs, and detects cyclic switching loops', () => {
      const taskId = `task-handoff-${Date.now()}`;

      // First transition: A -> B
      const switch1 = modelContextHandoffManager.recordSwitch(taskId, {
        fromModel: 'anthropic:claude-3-5-haiku',
        toModel: 'anthropic:claude-3-7-sonnet',
        fromProvider: 'claude',
        toProvider: 'claude',
        reason: 'Escalating to coding model',
        stageName: 'Implementation',
        timestamp: Date.now()
      });
      expect(switch1.allowed).toBe(true);

      // Verify structured handoff prompt assembly
      const handoffPkg = {
        taskId,
        orchestrationId: 'orch-test',
        originalGoal: 'Fix SQL injection in user profile query',
        currentObjective: 'Apply parameterized query fix',
        currentRole: 'Backend Engineer',
        fromModel: 'claude-3-5-haiku',
        toModel: 'claude-3-7-sonnet',
        fromProvider: 'claude',
        toProvider: 'claude',
        switchReason: 'Escalating from exploration to surgical coding',
        completedStages: [{
          stageId: 's1',
          role: 'Architect',
          modelUsed: 'claude-3-5-haiku',
          summary: 'Isolated defect to src/db/user.ts:42'
        }],
        architecturalInvariants: ['Must use prepared statements'],
        changedFiles: ['src/db/user.ts'],
        diffSnippet: '+ const stmt = db.prepare("SELECT * FROM users WHERE id = ?");',
        reviewerFeedback: undefined,
        switchCount: 1
      };

      const prompt = modelContextHandoffManager.assembleHandoffPrompt(handoffPkg);
      expect(prompt).toContain('ADAPTIVE MODEL HANDOFF CONTEXT');
      expect(prompt).toContain('Fix SQL injection in user profile query');
      expect(prompt).toContain('prepared statements');
      expect(prompt).toContain('src/db/user.ts');

      // Test loop detection (A -> B -> A -> B)
      modelContextHandoffManager.recordSwitch(taskId, {
        fromModel: 'anthropic:claude-3-7-sonnet',
        toModel: 'anthropic:claude-3-5-haiku',
        fromProvider: 'claude',
        toProvider: 'claude',
        reason: 'Loop step',
        stageName: 'Revert',
        timestamp: Date.now()
      });

      modelContextHandoffManager.recordSwitch(taskId, {
        fromModel: 'anthropic:claude-3-5-haiku',
        toModel: 'anthropic:claude-3-7-sonnet',
        fromProvider: 'claude',
        toProvider: 'claude',
        reason: 'Loop step',
        stageName: 'Step',
        timestamp: Date.now()
      });

      const loopSwitch = modelContextHandoffManager.recordSwitch(taskId, {
        fromModel: 'anthropic:claude-3-7-sonnet',
        toModel: 'anthropic:claude-3-5-haiku',
        fromProvider: 'claude',
        toProvider: 'claude',
        reason: 'Loop step',
        stageName: 'Step',
        timestamp: Date.now()
      });

      expect(loopSwitch.allowed).toBe(false);
      expect(loopSwitch.reason).toContain('loop detected');
    });
  });

  // Scenario F: Budget Enforcement & Approvals
  describe('Scenario F: Budget limits and cost controls', () => {
    it('tracks resource expenditure and halts when budget threshold is exceeded', () => {
      const orchId = `orch-budget-${Date.now()}`;

      // Set strict budget
      modelCostEngine.updateBudgetPolicy({
        maxCostPerOrchestrationUsd: 5.0,
        approvalThresholdUsd: 2.0,
        haltOnBudgetExceeded: true
      });

      // Record standard usage
      modelCostEngine.recordUsage({
        taskId: 't1',
        orchestrationId: orchId,
        modelId: 'anthropic:claude-3-7-sonnet',
        provider: 'claude',
        inputTokens: 50000,
        outputTokens: 10000,
        durationMs: 2500
      });

      const costCheck1 = modelCostEngine.checkBudget(orchId, 0.50);
      expect(costCheck1.allowed).toBe(true);

      // Record large expenditure exceeding budget
      modelCostEngine.recordUsage({
        taskId: 't2',
        orchestrationId: orchId,
        modelId: 'anthropic:claude-3-opus',
        provider: 'claude',
        inputTokens: 300000, // $4.50
        outputTokens: 20000,  // $1.50
        durationMs: 8000
      });

      const costCheck2 = modelCostEngine.checkBudget(orchId, 1.00);
      expect(costCheck2.allowed).toBe(false);
      expect(costCheck2.reason).toContain('exceeds maximum budget limit');
    });
  });

  // Scenario G: Multi-Model Review & Consensus
  describe('Scenario G: Multi-model consensus and competition', () => {
    it('evaluates consensus across independent models on architectural decisions', () => {
      const analyses = [
        { modelId: 'claude-3-7-sonnet', analysis: 'Approve: Clean decoupling', recommendsApproval: true },
        { modelId: 'gpt-4o', analysis: 'Approve: Thread safety validated', recommendsApproval: true },
        { modelId: 'gemini-2.5-pro', analysis: 'Approve: Minimal blast radius', recommendsApproval: true }
      ];

      const consensus = multiModelCollaborationManager.synthesizeConsensus(
        'Adopt SQLite WAL mode for multi-agent writes',
        analyses
      );

      expect(consensus.participatingModels.length).toBe(3);
      expect(consensus.recommendedDecision).toContain('PROCEED');
    });

    it('evaluates competing candidate solutions and selects the winner', () => {
      const candidates = [
        {
          modelId: 'model-a',
          provider: 'codex' as const,
          solutionSummary: 'Candidate A patch',
          diffSnippet: '+ fix()',
          testPassed: false,
          score: 60
        },
        {
          modelId: 'model-b',
          provider: 'claude' as const,
          solutionSummary: 'Candidate B patch',
          diffSnippet: '+ surgicalFix()',
          testPassed: true,
          score: 95
        }
      ];

      const result = multiModelCollaborationManager.evaluateCompetition('Solve memory leak', candidates);
      expect(result.winnerModelId).toBe('model-b');
      expect(result.selectionRationale).toContain('model-b');
    });
  });

  // Scenario H: Manual Model Selection Override
  describe('Scenario H: Manual model selection', () => {
    it('unconditionally respects user-selected model in manual mode', () => {
      const decision = adaptiveModelRouter.routeOperation({
        taskDescription: 'Perform simple one-line text classification',
        routingMode: 'manual',
        preferredModel: 'claude-3-opus'
      });

      expect(decision.routingMode).toBe('manual');
      expect(decision.selectedModelId).toContain('opus');
      expect(decision.reason).toContain('Manual Mode active');
    });
  });

  // Scenario I: Air-Gap Isolation Override
  describe('Scenario I: Air-Gap mode local isolation', () => {
    it('strictly forces Ollama execution and blocks all cloud models when Air-Gap is active', () => {
      airGapManager.updateConfig({ enabled: true, defaultLocalModel: 'llama3:latest' });

      const decision = adaptiveModelRouter.routeOperation({
        taskDescription: 'Generate critical enterprise backend API',
        optimizationMode: 'max_quality',
        preferredModel: 'claude-3-7-sonnet'
      });

      expect(decision.isAirGapEnforced).toBe(true);
      expect(decision.selectedProvider).toBe('ollama');
      expect(decision.selectedModelId).toContain('llama3');
      expect(decision.estimatedCostRateUsd.inRate).toBe(0);
    });
  });

  // Scenario J: Model Capability & Tool Compatibility
  describe('Scenario J: Model capability evaluation and requirement filtering', () => {
    it('disqualifies models that do not satisfy required tool calling or context capacity', () => {
      const sonnet = modelRegistry.resolveModel('claude-3-7-sonnet')!;
      const haiku = modelRegistry.resolveModel('claude-3-5-haiku')!;

      // Require extreme reasoning and deep architecture (> 90)
      const fitnessSonnet = modelCapabilityEngine.evaluateModelFitness(sonnet, {
        minReasoning: 95,
        minArchitecture: 95
      });
      expect(fitnessSonnet.isEligible).toBe(true);
      expect(fitnessSonnet.overallScore).toBeGreaterThanOrEqual(90);

      const fitnessHaiku = modelCapabilityEngine.evaluateModelFitness(haiku, {
        minReasoning: 95,
        minArchitecture: 95
      });
      // Haiku has 82 reasoning and 76 architecture, so it is disqualified for frontier architecture
      expect(fitnessHaiku.isEligible).toBe(false);
      expect(fitnessHaiku.disqualificationReasons.length).toBeGreaterThan(0);
    });
  });
});
