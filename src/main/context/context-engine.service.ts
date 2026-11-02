import { EventEmitter } from 'node:events';
import { incrementalIndexer } from './indexer/incremental-indexer';
import { fileWatcher } from './indexer/file-watcher';
import { hybridSearchService } from './search/hybrid-search.service';
import { contextRetrievalService } from './retrieval/context-retrieval.service';
import { contextAssemblyService } from './assembly/context-assembly.service';
import { databaseService } from '../db/database.service';
import type {
  IndexStats,
  SearchResult,
  ContextAssemblyResult
} from '../../shared/context';

export class ContextEngineService extends EventEmitter {
  private activeProjectPath: string | null = null;
  private currentProgress: { current: number; total: number; currentFile: string } | null = null;

  public async startIndexing(
    projectPath: string,
    forceReindex = false
  ): Promise<IndexStats> {
    this.activeProjectPath = projectPath;
    this.emit('status', { isIndexing: true, isWatching: fileWatcher.isWatching() });

    try {
      await incrementalIndexer.indexProject(projectPath, {
        forceReindex,
        onProgress: (prog) => {
          this.currentProgress = prog;
          this.emit('progress', prog);
        }
      });

      // Start file watcher if not already watching this path
      fileWatcher.start(projectPath);

      this.currentProgress = null;
      return this.getIndexStats(projectPath);
    } finally {
      this.currentProgress = null;
      this.emit('status', { isIndexing: false, isWatching: fileWatcher.isWatching() });
    }
  }

  public cancelIndexing(): void {
    incrementalIndexer.cancel();
    this.currentProgress = null;
    this.emit('status', { isIndexing: false, isWatching: fileWatcher.isWatching() });
  }

  public getIndexStats(projectPath?: string): IndexStats {
    const stats = databaseService.getIndexStats();
    return {
      ...stats,
      isIndexing: incrementalIndexer.isIndexing(),
      isWatching: fileWatcher.isWatching(),
      indexingProgress: this.currentProgress || undefined
    };
  }

  public async search(query: string, limit = 20): Promise<SearchResult[]> {
    return hybridSearchService.search(query, limit);
  }

  public async assembleContext(params: {
    projectPath: string;
    taskDescription: string;
    activeFilePath?: string;
    maxTokens?: number;
    modelTarget?: 'claude' | 'codex' | 'gemini';
  }): Promise<ContextAssemblyResult> {
    const searchStartTime = Date.now();

    // 1. Retrieve candidates
    const fragments = await contextRetrievalService.retrieve({
      taskDescription: params.taskDescription,
      activeFilePath: params.activeFilePath,
      maxCandidates: 25
    });

    const searchTimeMs = Date.now() - searchStartTime;

    // 2. Assemble context with live disk reads & token optimization
    const result = await contextAssemblyService.assemble({
      projectPath: params.projectPath,
      fragments,
      maxTokens: params.maxTokens,
      modelTarget: params.modelTarget
    });

    result.metrics.searchTimeMs = searchTimeMs;
    return result;
  }
}

export const contextEngineService = new ContextEngineService();
