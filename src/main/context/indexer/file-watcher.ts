import path from 'node:path';
import { EventEmitter } from 'node:events';
import chokidar, { type FSWatcher } from 'chokidar';
import { incrementalIndexer } from './incremental-indexer';
import { databaseService } from '../../db/database.service';

export class FileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private currentProjectPath: string | null = null;
  private pendingUpdates: Set<string> = new Set();
  private debounceTimer: NodeJS.Timeout | null = null;

  public start(projectPath: string): void {
    this.stop();
    this.currentProjectPath = projectPath;

    this.watcher = chokidar.watch(projectPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.vscode/**',
        '**/dist/**',
        '**/out/**',
        '**/build/**',
        '**/.ai-workspace-data/**',
        '**/*.sqlite*',
        '**/*.log'
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      }
    });

    this.watcher.on('add', (filePath: string) => this.queueUpdate(filePath));
    this.watcher.on('change', (filePath: string) => this.queueUpdate(filePath));
    this.watcher.on('unlink', (filePath: string) => this.queueDelete(filePath));
  }

  public stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.pendingUpdates.clear();
    this.currentProjectPath = null;
  }

  public isWatching(): boolean {
    return this.watcher !== null;
  }

  private queueUpdate(filePath: string): void {
    if (!this.currentProjectPath) return;
    const relPath = path.relative(this.currentProjectPath, filePath).replace(/\\/g, '/');
    this.pendingUpdates.add(relPath);
    this.scheduleBatch();
  }

  private queueDelete(filePath: string): void {
    if (!this.currentProjectPath) return;
    const relPath = path.relative(this.currentProjectPath, filePath).replace(/\\/g, '/');
    databaseService.deleteFileIndex(relPath);
    this.emit('change', { type: 'delete', path: relPath });
  }

  private scheduleBatch(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(async () => {
      if (!this.currentProjectPath || this.pendingUpdates.size === 0) return;

      const batch = Array.from(this.pendingUpdates);
      this.pendingUpdates.clear();

      for (const relPath of batch) {
        await incrementalIndexer.indexSingleFile(this.currentProjectPath, relPath);
      }

      this.emit('change', { type: 'batch', count: batch.length });
    }, 300);
  }
}

export const fileWatcher = new FileWatcher();
