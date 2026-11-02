import { databaseService } from '../../db/database.service';
import type { SearchResult } from '../../../shared/context';

export interface ISearchEngine {
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

export class HybridSearchService implements ISearchEngine {
  /**
   * Performs hybrid search by fusing BM25 FTS5, Symbol search, and Path matching.
   */
  public async search(query: string, limit = 20): Promise<SearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    // 1. FTS5 BM25 search
    const ftsResults = databaseService.searchFTS(trimmed, limit * 2);

    // 2. Symbol search
    const symbolResults = databaseService.searchSymbols(trimmed, limit);

    // 3. Path / Filename search
    const pathResults = databaseService.searchFilePaths(trimmed, limit);

    // Map to aggregate combined scores by chunkId/filePath
    const resultMap = new Map<string, SearchResult>();

    // Weight coefficients:
    // FTS BM25: 0.5, Symbol match: 0.35, Path match: 0.15
    for (const res of ftsResults) {
      const key = `${res.filePath}:${res.startLine}-${res.endLine}`;
      resultMap.set(key, {
        ...res,
        score: res.score * 0.5,
        matchType: 'fts'
      });
    }

    for (const sym of symbolResults) {
      const key = `${sym.filePath}:${sym.startLine}-${sym.endLine}`;
      const existing = resultMap.get(key);
      if (existing) {
        existing.score += sym.score * 0.35;
        existing.symbolName = sym.symbolName;
        existing.matchType = 'hybrid';
      } else {
        resultMap.set(key, {
          ...sym,
          score: sym.score * 0.35,
          matchType: 'symbol'
        });
      }
    }

    for (const pathRes of pathResults) {
      const key = `${pathRes.filePath}:1-1`;
      const existing = resultMap.get(key);
      if (existing) {
        existing.score += pathRes.score * 0.15;
      } else {
        resultMap.set(key, {
          ...pathRes,
          score: pathRes.score * 0.15,
          matchType: 'filename'
        });
      }
    }

    // Sort by combined score descending and slice to limit
    const sorted = Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return sorted;
  }
}

export const hybridSearchService = new HybridSearchService();
