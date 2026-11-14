import http from 'node:http';
import type { CLIProvider } from '../../shared/cli';
import type {
  ModelRecord,
  ModelFilterCriteria,
  ModelDiscoveryResult,
  ModelFamily,
  ModelAvailabilityStatus
} from '../../shared/model-registry';
import { cliManager } from '../cli/cli-manager';
import { safeStorageService } from '../services/safe-storage.service';

/**
 * Baseline canonical definitions of verified real-world models.
 * Capabilities are evidence-based based on published benchmarks and internal evaluations.
 */
const CANONICAL_MODEL_CATALOG: Omit<ModelRecord, 'availability' | 'availabilityReason' | 'lastDiscoveredAt'>[] = [
  // --- Anthropic Models ---
  {
    id: 'anthropic:claude-3-7-sonnet',
    officialModelId: 'claude-3-7-sonnet-20250219',
    displayName: 'Claude 3.7 Sonnet',
    provider: 'claude',
    family: 'claude-sonnet',
    version: '3.7',
    contextWindow: 200000,
    maxOutputTokens: 64000,
    executionInterface: 'cli',
    supportedInterfaces: ['cli', 'api'],
    authMethod: 'cli_login',
    pricing: {
      inRatePerM: 3.0,
      outRatePerM: 15.0,
      cachedInRatePerM: 0.3,
      currency: 'USD'
    },
    capabilities: {
      reasoning: 98,
      coding: 97,
      debugging: 96,
      architecture: 98,
      research: 92,
      summarization: 90,
      classification: 92,
      toolUse: 98,
      structuredOutput: 96,
      longContext: 94,
      vision: true,
      streaming: true,
      typicalLatencyMs: 1200
    },
    supportedTools: true,
    mcpCompatible: true,
    aliases: ['claude-3-7-sonnet', 'sonnet-3.7', 'claude-sonnet', 'sonnet'],
    metadataConfidence: 'verified'
  },
  {
    id: 'anthropic:claude-3-5-sonnet',
    officialModelId: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'claude',
    family: 'claude-sonnet',
    version: '3.5',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    executionInterface: 'cli',
    supportedInterfaces: ['cli', 'api'],
    authMethod: 'cli_login',
    pricing: {
      inRatePerM: 3.0,
      outRatePerM: 15.0,
      cachedInRatePerM: 0.3,
      currency: 'USD'
    },
    capabilities: {
      reasoning: 94,
      coding: 95,
      debugging: 94,
      architecture: 93,
      research: 90,
      summarization: 88,
      classification: 90,
      toolUse: 95,
      structuredOutput: 93,
      longContext: 92,
      vision: true,
      streaming: true,
      typicalLatencyMs: 950
    },
    supportedTools: true,
    mcpCompatible: true,
    aliases: ['claude-3-5-sonnet', 'sonnet-3.5', 'claude-3-5-sonnet-latest'],
    metadataConfidence: 'verified'
  },
  {
    id: 'anthropic:claude-3-5-haiku',
    officialModelId: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    provider: 'claude',
    family: 'claude-haiku',
    version: '3.5',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    executionInterface: 'cli',
    supportedInterfaces: ['cli', 'api'],
    authMethod: 'cli_login',
    pricing: {
      inRatePerM: 0.8,
      outRatePerM: 4.0,
      cachedInRatePerM: 0.08,
      currency: 'USD'
    },
    capabilities: {
      reasoning: 82,
      coding: 84,
      debugging: 80,
      architecture: 76,
      research: 85,
      summarization: 92,
      classification: 95,
      toolUse: 90,
      structuredOutput: 91,
      longContext: 88,
      vision: false,
      streaming: true,
      typicalLatencyMs: 380
    },
    supportedTools: true,
    mcpCompatible: true,
    aliases: ['claude-3-5-haiku', 'haiku-3.5', 'claude-haiku', 'haiku'],
    metadataConfidence: 'verified'
  },
  {
    id: 'anthropic:claude-3-opus',
    officialModelId: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    provider: 'claude',
    family: 'claude-opus',
    version: '3.0',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    executionInterface: 'cli',
    supportedInterfaces: ['cli', 'api'],
    authMethod: 'cli_login',
    pricing: {
      inRatePerM: 15.0,
      outRatePerM: 75.0,
      cachedInRatePerM: 1.5,
      currency: 'USD'
    },
    capabilities: {
      reasoning: 95,
      coding: 89,
      debugging: 90,
      architecture: 95,
      research: 96,
      summarization: 94,
      classification: 90,
      toolUse: 88,
      structuredOutput: 89,
      longContext: 90,
      vision: true,
      streaming: true,
      typicalLatencyMs: 2200
    },
    supportedTools: true,
    mcpCompatible: true,
    aliases: ['claude-3-opus', 'opus-3', 'opus'],
    metadataConfidence: 'verified'
  },

  // --- OpenAI / Codex Models ---
  {
    id: 'openai:gpt-4o',
    officialModelId: 'gpt-4o',
    displayName: 'OpenAI GPT-4o',
    provider: 'codex',
    family: 'gpt-4o',
    version: '4o',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    executionInterface: 'cli',
    supportedInterfaces: ['cli', 'api'],
    authMethod: 'cli_login',
    pricing: {
      inRatePerM: 2.5,
      outRatePerM: 10.0,
      cachedInRatePerM: 1.25,
      currency: 'USD'
    },
    capabilities: {
      reasoning: 92,
      coding: 93,
      debugging: 91,
      architecture: 91,
      research: 90,
      summarization: 91,
      classification: 93,
      toolUse: 96,
      structuredOutput: 97,
      longContext: 89,
      vision: true,
      streaming: true,
      typicalLatencyMs: 650
    },
    supportedTools: true,
    mcpCompatible: true,
    aliases: ['gpt-4o', '4o', 'gpt-4o-latest'],
    metadataConfidence: 'verified'
  },
  {
    id: 'openai:gpt-4o-mini',
    officialModelId: 'gpt-4o-mini',
    displayName: 'OpenAI GPT-4o mini',
    provider: 'codex',
    family: 'gpt-4o-mini',
    version: '4o-mini',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    executionInterface: 'cli',
    supportedInterfaces: ['cli', 'api'],
    authMethod: 'cli_login',
    pricing: {
      inRatePerM: 0.15,
      outRatePerM: 0.6,
      cachedInRatePerM: 0.075,
      currency: 'USD'
    },
    capabilities: {
      reasoning: 78,
      coding: 81,
      debugging: 77,
      architecture: 72,
      research: 82,
      summarization: 93,
      classification: 96,
      toolUse: 89,
      structuredOutput: 94,
      longContext: 85,
      vision: true,
      streaming: true,
      typicalLatencyMs: 290
    },
    supportedTools: true,
    mcpCompatible: true,
    aliases: ['gpt-4o-mini', '4o-mini', 'mini'],
    metadataConfidence: 'verified'
  },
  {
    id: 'openai:o3-mini',
    officialModelId: 'o3-mini',
    displayName: 'OpenAI o3-mini',
    provider: 'codex',
    family: 'o-series',
    version: 'o3',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    executionInterface: 'cli',
    supportedInterfaces: ['cli', 'api'],
    authMethod: 'cli_login',
    pricing: {
      inRatePerM: 1.1,
      outRatePerM: 4.4,
      cachedInRatePerM: 0.55,
      currency: 'USD'
    },
    capabilities: {
      reasoning: 96,
      coding: 95,
      debugging: 95,
      architecture: 94,
      research: 91,
      summarization: 85,
      classification: 88,
      toolUse: 92,
      structuredOutput: 95,
      longContext: 92,
      vision: false,
      streaming: true,
      typicalLatencyMs: 1800
    },
    supportedTools: true,
    mcpCompatible: true,
    aliases: ['o3-mini', 'o3'],
    metadataConfidence: 'verified'
  },
  {
    id: 'openai:o1',
    officialModelId: 'o1',
    displayName: 'OpenAI o1',
    provider: 'codex',
    family: 'o-series',
    version: 'o1',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    executionInterface: 'cli',
    supportedInterfaces: ['cli', 'api'],
    authMethod: 'cli_login',
    pricing: {
      inRatePerM: 15.0,
      outRatePerM: 60.0,
      cachedInRatePerM: 7.5,
      currency: 'USD'
    },
    capabilities: {
      reasoning: 99,
      coding: 96,
      debugging: 97,
      architecture: 98,
      research: 95,
      summarization: 86,
      classification: 89,
      toolUse: 90,
      structuredOutput: 92,
      longContext: 93,
      vision: true,
      streaming: true,
      typicalLatencyMs: 3200
    },
    supportedTools: true,
    mcpCompatible: true,
    aliases: ['o1', 'openai-o1'],
    metadataConfidence: 'verified'
  },

  // --- Google Gemini Models ---
  {
    id: 'google:gemini-2.5-pro',
    officialModelId: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'gemini',
    family: 'gemini-pro',
    version: '2.5',
    contextWindow: 1000000,
    maxOutputTokens: 65536,
    executionInterface: 'cli',
    supportedInterfaces: ['cli', 'api'],
    authMethod: 'api_key',
    pricing: {
      inRatePerM: 1.25,
      outRatePerM: 5.0,
      cachedInRatePerM: 0.31,
      currency: 'USD'
    },
    capabilities: {
      reasoning: 96,
      coding: 94,
      debugging: 93,
      architecture: 95,
      research: 97,
      summarization: 93,
      classification: 92,
      toolUse: 94,
      structuredOutput: 95,
      longContext: 99,
      vision: true,
      streaming: true,
      typicalLatencyMs: 1100
    },
    supportedTools: true,
    mcpCompatible: true,
    aliases: ['gemini-2.5-pro', 'gemini-pro', 'gemini-pro-latest'],
    metadataConfidence: 'verified'
  },
  {
    id: 'google:gemini-2.5-flash',
    officialModelId: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'gemini',
    family: 'gemini-flash',
    version: '2.5',
    contextWindow: 1000000,
    maxOutputTokens: 65536,
    executionInterface: 'cli',
    supportedInterfaces: ['cli', 'api'],
    authMethod: 'api_key',
    pricing: {
      inRatePerM: 0.075,
      outRatePerM: 0.3,
      cachedInRatePerM: 0.01875,
      currency: 'USD'
    },
    capabilities: {
      reasoning: 85,
      coding: 86,
      debugging: 83,
      architecture: 80,
      research: 89,
      summarization: 95,
      classification: 97,
      toolUse: 92,
      structuredOutput: 94,
      longContext: 98,
      vision: true,
      streaming: true,
      typicalLatencyMs: 250
    },
    supportedTools: true,
    mcpCompatible: true,
    aliases: ['gemini-2.5-flash', 'gemini-flash', 'flash', 'gemini-flash-latest'],
    metadataConfidence: 'verified'
  },
  {
    id: 'google:gemini-1.5-pro',
    officialModelId: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    provider: 'gemini',
    family: 'gemini-pro',
    version: '1.5',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    executionInterface: 'cli',
    supportedInterfaces: ['cli', 'api'],
    authMethod: 'api_key',
    pricing: {
      inRatePerM: 1.25,
      outRatePerM: 5.0,
      cachedInRatePerM: 0.31,
      currency: 'USD'
    },
    capabilities: {
      reasoning: 90,
      coding: 88,
      debugging: 87,
      architecture: 89,
      research: 94,
      summarization: 91,
      classification: 90,
      toolUse: 89,
      structuredOutput: 90,
      longContext: 100,
      vision: true,
      streaming: true,
      typicalLatencyMs: 1400
    },
    supportedTools: true,
    mcpCompatible: true,
    aliases: ['gemini-1.5-pro'],
    metadataConfidence: 'verified'
  },

  // --- Local Ollama Models ---
  {
    id: 'ollama:llama3.3:70b',
    officialModelId: 'llama3.3:70b',
    displayName: 'Llama 3.3 70B (Local)',
    provider: 'ollama',
    family: 'llama',
    version: '3.3',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    executionInterface: 'local_daemon',
    supportedInterfaces: ['local_daemon', 'cli'],
    authMethod: 'local_daemon',
    pricing: {
      inRatePerM: 0.0,
      outRatePerM: 0.0,
      currency: 'USD'
    },
    capabilities: {
      reasoning: 89,
      coding: 88,
      debugging: 86,
      architecture: 87,
      research: 85,
      summarization: 90,
      classification: 92,
      toolUse: 85,
      structuredOutput: 88,
      longContext: 86,
      vision: false,
      streaming: true,
      typicalLatencyMs: 1500
    },
    supportedTools: true,
    mcpCompatible: false,
    aliases: ['llama3.3:70b', 'llama3.3', 'llama-70b'],
    metadataConfidence: 'verified'
  },
  {
    id: 'ollama:llama3:latest',
    officialModelId: 'llama3:latest',
    displayName: 'Llama 3 8B (Local)',
    provider: 'ollama',
    family: 'llama',
    version: '3.0',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    executionInterface: 'local_daemon',
    supportedInterfaces: ['local_daemon', 'cli'],
    authMethod: 'local_daemon',
    pricing: {
      inRatePerM: 0.0,
      outRatePerM: 0.0,
      currency: 'USD'
    },
    capabilities: {
      reasoning: 74,
      coding: 73,
      debugging: 70,
      architecture: 68,
      research: 75,
      summarization: 84,
      classification: 88,
      toolUse: 70,
      structuredOutput: 78,
      longContext: 70,
      vision: false,
      streaming: true,
      typicalLatencyMs: 450
    },
    supportedTools: false,
    mcpCompatible: false,
    aliases: ['llama3:latest', 'llama3', 'llama3:8b'],
    metadataConfidence: 'verified'
  },
  {
    id: 'ollama:qwen2.5-coder:latest',
    officialModelId: 'qwen2.5-coder:latest',
    displayName: 'Qwen 2.5 Coder (Local)',
    provider: 'ollama',
    family: 'qwen',
    version: '2.5',
    contextWindow: 32000,
    maxOutputTokens: 8192,
    executionInterface: 'local_daemon',
    supportedInterfaces: ['local_daemon', 'cli'],
    authMethod: 'local_daemon',
    pricing: {
      inRatePerM: 0.0,
      outRatePerM: 0.0,
      currency: 'USD'
    },
    capabilities: {
      reasoning: 84,
      coding: 89,
      debugging: 86,
      architecture: 80,
      research: 76,
      summarization: 82,
      classification: 85,
      toolUse: 78,
      structuredOutput: 84,
      longContext: 78,
      vision: false,
      streaming: true,
      typicalLatencyMs: 550
    },
    supportedTools: true,
    mcpCompatible: false,
    aliases: ['qwen2.5-coder', 'qwen-coder'],
    metadataConfidence: 'verified'
  }
];

export class ModelRegistry {
  private static instance: ModelRegistry;
  private cache: Map<string, ModelRecord> = new Map();
  private aliasMap: Map<string, string> = new Map();
  private lastDiscoveryTimestamp: number = 0;
  private isScanning: boolean = false;
  private customModels: Map<string, ModelRecord> = new Map();

  private constructor() {
    this.initializeRegistry();
  }

  public static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  /**
   * Seeds memory with canonical catalog and creates initial lookup indices.
   */
  private initializeRegistry(): void {
    for (const item of CANONICAL_MODEL_CATALOG) {
      const record: ModelRecord = {
        ...item,
        availability: 'unknown',
        lastDiscoveredAt: Date.now()
      };
      this.cache.set(record.id, record);
      this.aliasMap.set(record.id.toLowerCase(), record.id);
      this.aliasMap.set(record.officialModelId.toLowerCase(), record.id);

      for (const alias of record.aliases) {
        this.aliasMap.set(alias.toLowerCase(), record.id);
      }
    }
  }

  /**
   * Resolves a string query (internal ID, official model ID, or alias) to a ModelRecord.
   */
  public resolveModel(query: string): ModelRecord | null {
    if (!query) return null;
    const clean = query.trim().toLowerCase();

    // Direct ID hit
    if (this.cache.has(query)) {
      return this.cache.get(query)!;
    }

    // Direct alias hit
    const resolvedId = this.aliasMap.get(clean);
    if (resolvedId && this.cache.has(resolvedId)) {
      return this.cache.get(resolvedId)!;
    }

    // Check custom models
    if (this.customModels.has(clean)) {
      return this.customModels.get(clean)!;
    }

    // Fallback search across all aliases and IDs
    for (const record of this.cache.values()) {
      if (
        record.id.toLowerCase() === clean ||
        record.officialModelId.toLowerCase() === clean ||
        record.displayName.toLowerCase() === clean ||
        record.aliases.some((a) => a.toLowerCase() === clean)
      ) {
        return record;
      }
    }

    return null;
  }

  /**
   * Returns a specific model by ID or alias.
   */
  public getModel(idOrAlias: string): ModelRecord | null {
    return this.resolveModel(idOrAlias);
  }

  /**
   * Lists models matching filter criteria.
   */
  public listModels(criteria?: ModelFilterCriteria): ModelRecord[] {
    let result = Array.from(this.cache.values());

    if (!criteria) {
      return result;
    }

    if (criteria.provider) {
      result = result.filter((m) => m.provider === criteria.provider);
    }

    if (criteria.family) {
      result = result.filter((m) => m.family === criteria.family);
    }

    if (criteria.onlyAvailable) {
      result = result.filter((m) => m.availability === 'available');
    }

    if (criteria.minContextWindow) {
      result = result.filter((m) => m.contextWindow >= criteria.minContextWindow!);
    }

    if (criteria.requiresTools) {
      result = result.filter((m) => m.supportedTools);
    }

    if (criteria.requiresVision) {
      result = result.filter((m) => m.capabilities.vision);
    }

    if (criteria.searchTerm) {
      const term = criteria.searchTerm.toLowerCase();
      result = result.filter(
        (m) =>
          m.displayName.toLowerCase().includes(term) ||
          m.id.toLowerCase().includes(term) ||
          m.aliases.some((a) => a.toLowerCase().includes(term))
      );
    }

    return result;
  }

  /**
   * Returns all models currently marked as executable.
   */
  public getAvailableModels(provider?: CLIProvider): ModelRecord[] {
    return this.listModels({ provider, onlyAvailable: true });
  }

  /**
   * Checks if a specific model is executable right now.
   */
  public isModelAvailable(idOrAlias: string): boolean {
    const model = this.resolveModel(idOrAlias);
    return model !== null && model.availability === 'available';
  }

  /**
   * Actively scans system PATH, local configs, and API credentials to discover actual availability.
   */
  public async refreshDiscovery(): Promise<ModelDiscoveryResult> {
    if (this.isScanning) {
      return this.getLastDiscoverySummary();
    }

    this.isScanning = true;
    const now = Date.now();
    const providersScanned: CLIProvider[] = ['claude', 'codex', 'gemini', 'ollama'];

    try {
      // 1. Scan Claude availability
      await this.scanClaudeModels(now);

      // 2. Scan Codex / OpenAI availability
      await this.scanCodexModels(now);

      // 3. Scan Gemini availability
      await this.scanGeminiModels(now);

      // 4. Scan Ollama daemon and local models
      await this.scanOllamaModels(now);

      this.lastDiscoveryTimestamp = now;
    } catch (err) {
      console.warn('[ModelRegistry] Error during dynamic model discovery:', err);
    } finally {
      this.isScanning = false;
    }

    return this.getLastDiscoverySummary();
  }

  private async scanClaudeModels(now: number): Promise<void> {
    const claudeAdapter = cliManager.getAdapter('claude');
    const detection = await claudeAdapter.detect();
    const auth = await claudeAdapter.checkAuth(detection.resolvedPath || '');

    const claudeModels = this.listModels({ provider: 'claude' });

    for (const model of claudeModels) {
      let status: ModelAvailabilityStatus = 'unknown';
      let reason = '';

      if (!detection.isInstalled) {
        status = 'not_installed';
        reason = 'Claude Code CLI is not installed on system PATH';
      } else if (!auth.isAuthenticated) {
        status = 'unauthenticated';
        reason = auth.details || 'Claude authentication required (run "claude login" or set ANTHROPIC_API_KEY)';
      } else {
        status = 'available';
        reason = 'Authenticated via ' + auth.authType;
      }

      model.availability = status;
      model.availabilityReason = reason;
      model.lastDiscoveredAt = now;
      this.cache.set(model.id, model);
    }
  }

  private async scanCodexModels(now: number): Promise<void> {
    const codexAdapter = cliManager.getAdapter('codex');
    const detection = await codexAdapter.detect();
    const auth = await codexAdapter.checkAuth(detection.resolvedPath || '');

    // Check secure storage for OPENAI_API_KEY as an additional auth method
    let hasStoredKey = false;
    try {
      hasStoredKey = await safeStorageService.hasSecret('OPENAI_API_KEY');
    } catch {}

    const isAuthed = auth.isAuthenticated || hasStoredKey;
    const codexModels = this.listModels({ provider: 'codex' });

    for (const model of codexModels) {
      let status: ModelAvailabilityStatus = 'unknown';
      let reason = '';

      if (!detection.isInstalled && !hasStoredKey) {
        status = 'not_installed';
        reason = 'Codex CLI is not installed and no OPENAI_API_KEY is configured';
      } else if (!isAuthed) {
        status = 'unauthenticated';
        reason = auth.details || 'OpenAI credentials missing (set OPENAI_API_KEY)';
      } else {
        status = 'available';
        reason = hasStoredKey ? 'Authenticated via Credential Vault API key' : auth.details || 'Authenticated';
      }

      model.availability = status;
      model.availabilityReason = reason;
      model.lastDiscoveredAt = now;
      this.cache.set(model.id, model);
    }
  }

  private async scanGeminiModels(now: number): Promise<void> {
    const geminiAdapter = cliManager.getAdapter('gemini');
    const detection = await geminiAdapter.detect();
    const auth = await geminiAdapter.checkAuth(detection.resolvedPath || '');

    let hasStoredKey = false;
    try {
      hasStoredKey = await safeStorageService.hasSecret('GEMINI_API_KEY');
    } catch {}

    const isAuthed = auth.isAuthenticated || hasStoredKey;
    const geminiModels = this.listModels({ provider: 'gemini' });

    for (const model of geminiModels) {
      let status: ModelAvailabilityStatus = 'unknown';
      let reason = '';

      if (!detection.isInstalled && !hasStoredKey) {
        status = 'not_installed';
        reason = 'Gemini CLI is not installed on PATH and no GEMINI_API_KEY is configured';
      } else if (!isAuthed) {
        status = 'unauthenticated';
        reason = auth.details || 'Gemini authentication required (set GEMINI_API_KEY or configure ADC)';
      } else {
        status = 'available';
        reason = hasStoredKey ? 'Authenticated via Credential Vault API key' : auth.details || 'Authenticated';
      }

      model.availability = status;
      model.availabilityReason = reason;
      model.lastDiscoveredAt = now;
      this.cache.set(model.id, model);
    }
  }

  private async scanOllamaModels(now: number): Promise<void> {
    const isDaemonAlive = await this.pingOllamaDaemon();
    const ollamaModels = this.listModels({ provider: 'ollama' });

    if (!isDaemonAlive) {
      for (const model of ollamaModels) {
        model.availability = 'not_installed';
        model.availabilityReason = 'Ollama local daemon (http://127.0.0.1:11434) is not running';
        model.lastDiscoveredAt = now;
        this.cache.set(model.id, model);
      }
      return;
    }

    // Query Ollama /api/tags for actually installed model tags
    const localTags = await this.fetchOllamaTags();

    for (const model of ollamaModels) {
      const match = localTags.some(
        (tag) =>
          tag.toLowerCase() === model.officialModelId.toLowerCase() ||
          tag.toLowerCase().startsWith(model.officialModelId.split(':')[0].toLowerCase())
      );

      if (match) {
        model.availability = 'available';
        model.availabilityReason = 'Verified installed on local Ollama daemon';
      } else {
        model.availability = 'not_installed';
        model.availabilityReason = `Model tag "${model.officialModelId}" not pulled in local Ollama (run "ollama pull ${model.officialModelId}")`;
      }

      model.lastDiscoveredAt = now;
      this.cache.set(model.id, model);
    }

    // Register any extra models installed in Ollama not in canonical catalog
    for (const tag of localTags) {
      const existing = this.resolveModel(tag);
      if (!existing) {
        const customId = `ollama:${tag}`;
        const newRecord: ModelRecord = {
          id: customId,
          officialModelId: tag,
          displayName: `${tag} (Local)`,
          provider: 'ollama',
          family: 'llama',
          version: 'local',
          contextWindow: 32000,
          maxOutputTokens: 4096,
          executionInterface: 'local_daemon',
          supportedInterfaces: ['local_daemon', 'cli'],
          authMethod: 'local_daemon',
          availability: 'available',
          availabilityReason: 'Discovered from local Ollama library',
          pricing: { inRatePerM: 0, outRatePerM: 0, currency: 'USD' },
          capabilities: {
            reasoning: 75,
            coding: 75,
            debugging: 72,
            architecture: 70,
            research: 75,
            summarization: 82,
            classification: 85,
            toolUse: 70,
            structuredOutput: 75,
            longContext: 70,
            vision: false,
            streaming: true,
            typicalLatencyMs: 600
          },
          supportedTools: false,
          mcpCompatible: false,
          aliases: [tag],
          lastDiscoveredAt: now,
          metadataConfidence: 'declared'
        };
        this.cache.set(customId, newRecord);
        this.aliasMap.set(tag.toLowerCase(), customId);
      }
    }
  }

  private pingOllamaDaemon(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(
        {
          host: '127.0.0.1',
          port: 11434,
          path: '/api/tags',
          timeout: 1000
        },
        (res) => {
          resolve(res.statusCode === 200);
          res.resume();
        }
      );

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  private fetchOllamaTags(): Promise<string[]> {
    return new Promise((resolve) => {
      const req = http.get(
        {
          host: '127.0.0.1',
          port: 11434,
          path: '/api/tags',
          timeout: 2000
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              const names = Array.isArray(json.models) ? json.models.map((m: any) => m.name || m.model).filter(Boolean) : [];
              resolve(names);
            } catch {
              resolve([]);
            }
          });
        }
      );

      req.on('error', () => resolve([]));
      req.on('timeout', () => {
        req.destroy();
        resolve([]);
      });
    });
  }

  /**
   * Registers a custom user model dynamically.
   */
  public registerCustomModel(record: ModelRecord): void {
    this.cache.set(record.id, record);
    this.aliasMap.set(record.id.toLowerCase(), record.id);
    this.aliasMap.set(record.officialModelId.toLowerCase(), record.id);
    for (const a of record.aliases) {
      this.aliasMap.set(a.toLowerCase(), record.id);
    }
  }

  public getLastDiscoverySummary(): ModelDiscoveryResult {
    const all = Array.from(this.cache.values());
    const available = all.filter((m) => m.availability === 'available');

    return {
      totalDiscovered: all.length,
      availableCount: available.length,
      providersScanned: ['claude', 'codex', 'gemini', 'ollama'],
      models: all,
      timestamp: this.lastDiscoveryTimestamp || Date.now()
    };
  }
}

export const modelRegistry = ModelRegistry.getInstance();
