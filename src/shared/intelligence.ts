import { z } from 'zod';
import type { CLIProvider } from './cli';

export type OptimizationMode = 'balanced' | 'cost_efficient' | 'max_quality';

export type TaskCategory =
  | 'classification'
  | 'summarization'
  | 'code_generation'
  | 'deep_reasoning'
  | 'architecture'
  | 'security_review'
  | 'large_context'
  | 'general';

export interface ModelRoutingDecision {
  selectedProvider: CLIProvider;
  selectedModel: string;
  taskCategory: TaskCategory;
  reason: string;
  isAirGapEnforced: boolean;
  estimatedCostRateUsd: { inRate: number; outRate: number };
  confidence: number;
}

export type PromptSectionType =
  | 'system'
  | 'security'
  | 'objective'
  | 'acceptance_criteria'
  | 'skills'
  | 'context'
  | 'history'
  | 'format';

export interface PromptSection {
  type: PromptSectionType;
  title: string;
  content: string;
  tokens: number;
  priority: number; // 1-100 (100 = mandatory/highest)
  mandatory: boolean;
}

export interface PromptAssemblyResult {
  assembledPrompt: string;
  promptFingerprint: string;
  totalTokens: number;
  sections: PromptSection[];
  tokenBreakdown: Record<PromptSectionType, number>;
  deduplicationSavingsTokens: number;
  cacheEligible: boolean;
}

export type SkillLoadingLevel = 'metadata' | 'summary' | 'full';

export interface SkillOperationalSummary {
  id: string;
  name: string;
  summary: string;
  requiredCapabilities: string[];
  expectedOutput: string;
  tokens: number;
}

export interface ComposedSkillInstructions {
  primarySkillId: string;
  activeSkillIds: string[];
  composedText: string;
  totalTokens: number;
  tokensSaved: number;
  conflictsResolved: string[];
}

export interface NormalizedToolOutput {
  normalized: string;
  originalLength: number;
  normalizedLength: number;
  tokensSaved: number;
  isTruncated: boolean;
  errorSnippet?: string;
  rawOutputId?: string;
}

export interface IntelligenceConfig {
  mode: OptimizationMode;
  enableContextDeduplication: boolean;
  enableWhitespaceCompression: boolean;
  enablePromptCaching: boolean;
  enableModelResponseCaching: boolean;
  enableProgressiveSkillLoading: boolean;
  enableToolOutputNormalization: boolean;
  maxContextBudgetTokens: number;
  reservedOutputTokens: number;
  defaultModelTarget: string;
}

export const IntelligenceConfigSchema = z.object({
  mode: z.enum(['balanced', 'cost_efficient', 'max_quality']).default('balanced'),
  enableContextDeduplication: z.boolean().default(true),
  enableWhitespaceCompression: z.boolean().default(true),
  enablePromptCaching: z.boolean().default(true),
  enableModelResponseCaching: z.boolean().default(true),
  enableProgressiveSkillLoading: z.boolean().default(true),
  enableToolOutputNormalization: z.boolean().default(true),
  maxContextBudgetTokens: z.number().min(1000).max(1000000).default(64000),
  reservedOutputTokens: z.number().min(1000).max(32000).default(4096),
  defaultModelTarget: z.string().default('claude')
});
