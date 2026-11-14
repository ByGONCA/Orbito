import type { CLIProvider } from '../../shared/cli';
import type { ModelRecord } from '../../shared/model-registry';
import { modelRegistry } from './model-registry';
import { adaptiveModelRouter } from './adaptive-model-router';
import { modelCostEngine } from './model-cost-engine';

export interface IndependentReviewRequest {
  taskId: string;
  codeDiff: string;
  taskTitle: string;
  primaryModelId: string;
  primaryProvider: CLIProvider;
  acceptanceCriteria: string[];
}

export interface IndependentReviewResponse {
  reviewerModelId: string;
  reviewerProvider: CLIProvider;
  passed: boolean;
  critique: string;
  confidence: number;
  identifiedRisks: string[];
  remediationSuggestions: string[];
}

export interface CompetingCandidate {
  modelId: string;
  provider: CLIProvider;
  solutionSummary: string;
  diffSnippet: string;
  testPassed: boolean;
  score: number;
}

export interface CompetitionResult {
  winnerModelId: string;
  winnerProvider: CLIProvider;
  selectionRationale: string;
  candidates: CompetingCandidate[];
}

export interface ConsensusAnalysisResult {
  topic: string;
  participatingModels: string[];
  agreedPoints: string[];
  divergentPoints: string[];
  recommendedDecision: string;
}

export class MultiModelCollaborationManager {
  private static instance: MultiModelCollaborationManager;

  private constructor() {}

  public static getInstance(): ModelCollaborationManager {
    if (!MultiModelCollaborationManager.instance) {
      MultiModelCollaborationManager.instance = new MultiModelCollaborationManager();
    }
    return MultiModelCollaborationManager.instance;
  }

  /**
   * Selects an independent model (different family where possible) to review work produced by the primary model.
   */
  public selectReviewerModel(primaryModelId: string, preferredProvider?: CLIProvider): ModelRecord {
    const primary = modelRegistry.resolveModel(primaryModelId);
    let candidates = modelRegistry.getAvailableModels();
    if (candidates.length === 0) candidates = modelRegistry.listModels();

    // Prefer a different model family or at least a different model ID
    let differentFamily = candidates.filter((m) => primary && m.family !== primary.family);

    // If user is restricted to a single provider, select a different model within that provider
    if (preferredProvider || differentFamily.length === 0) {
      const sameProvider = candidates.filter((m) => primary && m.provider === primary.provider && m.id !== primary.id);
      if (sameProvider.length > 0) {
        return sameProvider.sort((a, b) => b.capabilities.reasoning - a.capabilities.reasoning)[0];
      }
    }

    if (differentFamily.length > 0) {
      return differentFamily.sort((a, b) => b.capabilities.reasoning - a.capabilities.reasoning)[0];
    }

    // Fallback: highest reasoning available
    return candidates.sort((a, b) => b.capabilities.reasoning - a.capabilities.reasoning)[0];
  }

  /**
   * Evaluates competing candidate solutions produced by different models and selects the winner.
   */
  public evaluateCompetition(
    objective: string,
    candidates: CompetingCandidate[]
  ): CompetitionResult {
    if (candidates.length === 0) {
      throw new Error('No candidates provided for competition evaluation.');
    }

    // Rank candidates: test pass status is primary, followed by score, then diff conciseness
    const ranked = [...candidates].sort((a, b) => {
      if (a.testPassed && !b.testPassed) return -1;
      if (!a.testPassed && b.testPassed) return 1;
      return b.score - a.score;
    });

    const winner = ranked[0];
    return {
      winnerModelId: winner.modelId,
      winnerProvider: winner.provider,
      selectionRationale: `Candidate [${winner.modelId}] selected with score ${winner.score}/100 (Tests: ${winner.testPassed ? 'PASSED' : 'FAILED'}).`,
      candidates
    };
  }

  /**
   * Synthesizes agreements and contradictions between multiple models analyzing an architectural proposal.
   */
  public synthesizeConsensus(
    topic: string,
    modelAnalyses: { modelId: string; analysis: string; recommendsApproval: boolean }[]
  ): ConsensusAnalysisResult {
    const participatingModels = modelAnalyses.map((m) => m.modelId);
    const agreedPoints: string[] = [];
    const divergentPoints: string[] = [];

    const approvalCount = modelAnalyses.filter((m) => m.recommendsApproval).length;
    const approvalRatio = modelAnalyses.length > 0 ? approvalCount / modelAnalyses.length : 0;

    agreedPoints.push(`Evaluated across ${modelAnalyses.length} independent model perspective(s).`);

    if (approvalRatio >= 0.66) {
      agreedPoints.push('Supermajority of participating models support the architectural proposal.');
    } else if (approvalRatio <= 0.33) {
      divergentPoints.push('Substantial opposition detected: majority of models flagged architectural risks.');
    } else {
      divergentPoints.push('Split consensus: Models disagree on implementation trade-offs and complexity.');
    }

    const recommendedDecision =
      approvalRatio >= 0.5
        ? 'PROCEED: Architectural proposal meets consensus requirements with acceptable trade-offs.'
        : 'REVISE: Address identified risks and reconcile divergent trade-offs before proceeding.';

    return {
      topic,
      participatingModels,
      agreedPoints,
      divergentPoints,
      recommendedDecision
    };
  }
}

export type ModelCollaborationManager = MultiModelCollaborationManager;
export const multiModelCollaborationManager = MultiModelCollaborationManager.getInstance();
