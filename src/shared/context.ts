import { z } from 'zod';

export type SymbolKind =
  | 'function'
  | 'class'
  | 'method'
  | 'interface'
  | 'type'
  | 'import'
  | 'export'
  | 'variable';

export interface FileSymbol {
  id: string;
  filePath: string;
  name: string;
  kind: SymbolKind;
  line: number;
  endLine: number;
  containerName?: string;
  signature?: string;
}

export interface CodeChunk {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  symbolName?: string;
  language: string;
}

export interface IndexStats {
  totalFiles: number;
  totalSymbols: number;
  totalChunks: number;
  indexedLanguages: Record<string, number>;
  lastIndexedAt: number;
  isIndexing: boolean;
  isWatching: boolean;
  indexingProgress?: {
    current: number;
    total: number;
    currentFile: string;
  };
}

export interface SearchResult {
  chunkId: string;
  filePath: string;
  content: string;
  score: number;
  startLine: number;
  endLine: number;
  symbolName?: string;
  matchType: 'fts' | 'symbol' | 'filename' | 'exact' | 'hybrid';
}

export interface ContextFragment {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  reason: string;
  priority: number;
  tokenCount: number;
  isLiveDiskRead: boolean;
  symbolName?: string;
}

export interface ContextAssemblyResult {
  assembledText: string;
  fragments: ContextFragment[];
  estimatedTokens: number;
  actualTokens: number;
  tokenBudget: number;
  truncated: boolean;
  metrics: {
    searchTimeMs: number;
    assemblyTimeMs: number;
    liveReadsCount: number;
  };
}

// ==========================================
// Zod Schemas for IPC Validation
// ==========================================

export const StartIndexingSchema = z.object({
  projectPath: z.string().min(1),
  forceReindex: z.boolean().optional().default(false)
});

export const CancelIndexingSchema = z.object({
  projectPath: z.string().min(1)
});

export const GetIndexStatsSchema = z.object({
  projectPath: z.string().min(1)
});

export const SearchContextSchema = z.object({
  projectPath: z.string().min(1),
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional().default(20)
});

export const AssembleContextSchema = z.object({
  projectPath: z.string().min(1),
  taskDescription: z.string().min(1),
  activeFilePath: z.string().optional(),
  maxTokens: z.number().int().min(100).max(200000).optional().default(8000),
  modelTarget: z.enum(['claude', 'codex', 'gemini']).optional().default('claude')
});
