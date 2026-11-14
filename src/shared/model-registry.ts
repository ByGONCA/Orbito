import { z } from 'zod';
import type { CLIProvider } from './cli';

export type ModelExecutionInterface = 'cli' | 'api' | 'local_daemon';

export type ModelAuthMethod = 'cli_login' | 'api_key' | 'adc' | 'local_daemon' | 'none';

export type ModelAvailabilityStatus =
  | 'available'
  | 'unauthenticated'
  | 'not_installed'
  | 'quota_exceeded'
  | 'deprecated'
  | 'unknown';

export type ModelFamily =
  | 'claude-opus'
  | 'claude-sonnet'
  | 'claude-haiku'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o-series'
  | 'gemini-pro'
  | 'gemini-flash'
  | 'llama'
  | 'deepseek'
  | 'qwen'
  | 'mistral'
  | 'other';

export interface ModelPricing {
  inRatePerM: number; // USD per 1M input tokens
  outRatePerM: number; // USD per 1M output tokens
  cachedInRatePerM?: number; // USD per 1M cached input tokens
  currency: 'USD';
  isEstimated?: boolean;
}

export interface ModelCognitiveCapabilities {
  reasoning: number; // 0 - 100
  coding: number; // 0 - 100
  debugging: number; // 0 - 100
  architecture: number; // 0 - 100
  research: number; // 0 - 100
  summarization: number; // 0 - 100
  classification: number; // 0 - 100
  toolUse: number; // 0 - 100
  structuredOutput: number; // 0 - 100
  longContext: number; // 0 - 100
  vision: boolean;
  streaming: boolean;
  typicalLatencyMs: number;
}

export interface ModelRecord {
  id: string; // Stable internal identifier, e.g. "anthropic:claude-3-7-sonnet"
  officialModelId: string; // Official provider string, e.g. "claude-3-7-sonnet-20250219"
  displayName: string;
  provider: CLIProvider;
  family: ModelFamily;
  version: string;
  contextWindow: number;
  maxOutputTokens: number;
  executionInterface: ModelExecutionInterface;
  supportedInterfaces: ModelExecutionInterface[];
  authMethod: ModelAuthMethod;
  availability: ModelAvailabilityStatus;
  availabilityReason?: string;
  isDeprecated?: boolean;
  deprecationNotice?: string;
  pricing: ModelPricing;
  capabilities: ModelCognitiveCapabilities;
  supportedTools: boolean;
  mcpCompatible: boolean;
  aliases: string[];
  lastDiscoveredAt: number;
  metadataConfidence: 'verified' | 'estimated' | 'declared';
}

export const ModelPricingSchema = z.object({
  inRatePerM: z.number().nonnegative(),
  outRatePerM: z.number().nonnegative(),
  cachedInRatePerM: z.number().nonnegative().optional(),
  currency: z.literal('USD'),
  isEstimated: z.boolean().optional()
});

export const ModelCognitiveCapabilitiesSchema = z.object({
  reasoning: z.number().min(0).max(100),
  coding: z.number().min(0).max(100),
  debugging: z.number().min(0).max(100),
  architecture: z.number().min(0).max(100),
  research: z.number().min(0).max(100),
  summarization: z.number().min(0).max(100),
  classification: z.number().min(0).max(100),
  toolUse: z.number().min(0).max(100),
  structuredOutput: z.number().min(0).max(100),
  longContext: z.number().min(0).max(100),
  vision: z.boolean(),
  streaming: z.boolean(),
  typicalLatencyMs: z.number().nonnegative()
});

export const ModelRecordSchema = z.object({
  id: z.string(),
  officialModelId: z.string(),
  displayName: z.string(),
  provider: z.string(),
  family: z.enum([
    'claude-opus',
    'claude-sonnet',
    'claude-haiku',
    'gpt-4o',
    'gpt-4o-mini',
    'o-series',
    'gemini-pro',
    'gemini-flash',
    'llama',
    'deepseek',
    'qwen',
    'mistral',
    'other'
  ]),
  version: z.string(),
  contextWindow: z.number().positive(),
  maxOutputTokens: z.number().positive(),
  executionInterface: z.enum(['cli', 'api', 'local_daemon']),
  supportedInterfaces: z.array(z.enum(['cli', 'api', 'local_daemon'])),
  authMethod: z.enum(['cli_login', 'api_key', 'adc', 'local_daemon', 'none']),
  availability: z.enum([
    'available',
    'unauthenticated',
    'not_installed',
    'quota_exceeded',
    'deprecated',
    'unknown'
  ]),
  availabilityReason: z.string().optional(),
  isDeprecated: z.boolean().optional(),
  deprecationNotice: z.string().optional(),
  pricing: ModelPricingSchema,
  capabilities: ModelCognitiveCapabilitiesSchema,
  supportedTools: z.boolean(),
  mcpCompatible: z.boolean(),
  aliases: z.array(z.string()),
  lastDiscoveredAt: z.number(),
  metadataConfidence: z.enum(['verified', 'estimated', 'declared'])
});

export interface ModelFilterCriteria {
  provider?: CLIProvider;
  family?: ModelFamily;
  onlyAvailable?: boolean;
  minContextWindow?: number;
  requiresTools?: boolean;
  requiresVision?: boolean;
  searchTerm?: string;
}

export interface ModelDiscoveryResult {
  totalDiscovered: number;
  availableCount: number;
  providersScanned: CLIProvider[];
  models: ModelRecord[];
  timestamp: number;
}
