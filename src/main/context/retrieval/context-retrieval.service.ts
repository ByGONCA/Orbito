import path from 'node:path';
import { hybridSearchService } from '../search/hybrid-search.service';
import { databaseService } from '../../db/database.service';
import type { ContextFragment, SearchResult } from '../../../shared/context';

export interface RetrievalOptions {
  taskDescription: string;
  activeFilePath?: string;
  maxCandidates?: number;
}

export class ContextRetrievalService {
  /**
   * Retrieves relevant fragments by combining lexical, structural, and dependency relevance.
   */
  public async retrieve(options: RetrievalOptions): Promise<ContextFragment[]> {
    const { taskDescription, activeFilePath, maxCandidates = 30 } = options;
    const fragments: ContextFragment[] = [];
    const seenRanges = new Set<string>();

    // 1. Extract tokens and identifiers from task description
    const keywords = this.extractQueryKeywords(taskDescription);

    // 2. Hybrid search across indexed chunks and symbols
    const searchPromises = keywords.slice(0, 5).map((kw) => hybridSearchService.search(kw, 15));
    const searchResultsArrays = await Promise.all(searchPromises);

    const mergedSearchResults: SearchResult[] = [];
    for (const arr of searchResultsArrays) {
      mergedSearchResults.push(...arr);
    }

    // 3. Process search results into prioritized context fragments
    for (const res of mergedSearchResults) {
      const key = `${res.filePath}:${res.startLine}-${res.endLine}`;
      if (seenRanges.has(key)) continue;
      seenRanges.add(key);

      fragments.push({
        id: `frag-${res.chunkId}`,
        filePath: res.filePath,
        startLine: res.startLine,
        endLine: res.endLine,
        content: res.content,
        reason: res.symbolName ? `Symbol definition: ${res.symbolName}` : `Keyword match in ${res.filePath}`,
        priority: res.matchType === 'symbol' ? 8 : 7,
        tokenCount: Math.ceil(res.content.length / 3.8),
        isLiveDiskRead: false,
        symbolName: res.symbolName
      });
    }

    // 4. If an active file is open, prioritize its definitions and imports
    if (activeFilePath) {
      const activeSymbols = databaseService.getSymbolsForFile(activeFilePath);
      const activeChunks = databaseService.getChunksForFile(activeFilePath);

      // Add top definitions from active file
      for (const sym of activeSymbols.slice(0, 5)) {
        const chunk = activeChunks.find((c) => sym.line >= c.startLine && sym.line <= c.endLine);
        if (chunk) {
          const key = `${activeFilePath}:${chunk.startLine}-${chunk.endLine}`;
          if (!seenRanges.has(key)) {
            seenRanges.add(key);
            fragments.push({
              id: `frag-active-${sym.id}`,
              filePath: activeFilePath,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
              content: chunk.content,
              reason: `Active file symbol: ${sym.name}`,
              priority: 10,
              tokenCount: Math.ceil(chunk.content.length / 3.8),
              isLiveDiskRead: false,
              symbolName: sym.name
            });
          }
        }
      }

      // Check imports in active file to pull in related dependency symbols
      const imports = activeSymbols.filter((s) => s.kind === 'import');
      for (const imp of imports.slice(0, 3)) {
        // Search symbols corresponding to import
        const depSyms = databaseService.searchSymbols(imp.name, 3);
        for (const ds of depSyms) {
          const key = `${ds.filePath}:${ds.startLine}-${ds.endLine}`;
          if (!seenRanges.has(key)) {
            seenRanges.add(key);
            fragments.push({
              id: `frag-dep-${ds.chunkId}`,
              filePath: ds.filePath,
              startLine: ds.startLine,
              endLine: ds.endLine,
              content: ds.content,
              reason: `Imported dependency of active file (${ds.symbolName})`,
              priority: 6,
              tokenCount: Math.ceil(ds.content.length / 3.8),
              isLiveDiskRead: false,
              symbolName: ds.symbolName
            });
          }
        }
      }
    }

    // 5. Look for relevant documentation (e.g. README.md or spec files matching query)
    const docResults = databaseService.searchFilePaths('.md', 5);
    for (const doc of docResults) {
      const docChunks = databaseService.getChunksForFile(doc.filePath);
      if (docChunks.length > 0) {
        const firstChunk = docChunks[0];
        const key = `${doc.filePath}:${firstChunk.startLine}-${firstChunk.endLine}`;
        if (!seenRanges.has(key)) {
          seenRanges.add(key);
          fragments.push({
            id: `frag-doc-${firstChunk.id}`,
            filePath: doc.filePath,
            startLine: firstChunk.startLine,
            endLine: firstChunk.endLine,
            content: firstChunk.content,
            reason: `Documentation context (${path.basename(doc.filePath)})`,
            priority: 4,
            tokenCount: Math.ceil(firstChunk.content.length / 3.8),
            isLiveDiskRead: false
          });
        }
      }
    }

    // Sort by priority descending
    fragments.sort((a, b) => b.priority - a.priority);

    return fragments.slice(0, maxCandidates);
  }

  private extractQueryKeywords(query: string): string[] {
    // Extract words, camelCase and PascalCase parts, filenames
    const terms = new Set<string>();
    const words = query.split(/[\s,.;:!?()[\]{}"'`]+/);

    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'from', 'what', 'this', 'that',
      'please', 'can', 'you', 'how', 'why', 'are', 'were', 'was',
      'will', 'would', 'could', 'should', 'perform', 'make', 'into',
      'about', 'have', 'has', 'had', 'does', 'doing'
    ]);

    for (const w of words) {
      const clean = w.trim();
      if (clean.length >= 3 && !stopWords.has(clean.toLowerCase())) {
        terms.add(clean);
      }
    }

    // If query has specific symbol names or paths
    if (terms.size === 0 && query.trim()) {
      terms.add(query.trim());
    }

    // Prioritize camelCase/PascalCase identifiers first, then other terms
    const identifiers = Array.from(terms).filter((t) => /[a-z][A-Z]|[A-Z]{2,}/.test(t));
    const otherTerms = Array.from(terms).filter((t) => !/[a-z][A-Z]|[A-Z]{2,}/.test(t));
    return [...identifiers, ...otherTerms];
  }
}

export const contextRetrievalService = new ContextRetrievalService();
