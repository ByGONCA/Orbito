import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileScanner } from './file-scanner';
import { astParserService } from '../parser/ast-parser.service';
import { databaseService } from '../../db/database.service';
import type { IndexStats } from '../../../shared/context';

export interface IndexingProgressCallback {
  (progress: { current: number; total: number; currentFile: string }): void;
}

export class IncrementalIndexer {
  private isCancelled = false;
  private isRunning = false;

  public cancel(): void {
    if (this.isRunning) {
      this.isCancelled = true;
    }
  }

  public isIndexing(): boolean {
    return this.isRunning;
  }

  public async indexProject(
    projectPath: string,
    options?: {
      forceReindex?: boolean;
      onProgress?: IndexingProgressCallback;
    }
  ): Promise<{
    indexedCount: number;
    skippedCount: number;
    deletedCount: number;
    durationMs: number;
  }> {
    if (this.isRunning) {
      throw new Error('Indexing already in progress.');
    }

    this.isRunning = true;
    this.isCancelled = false;
    const startTime = Date.now();

    let indexedCount = 0;
    let skippedCount = 0;
    let deletedCount = 0;

    try {
      // 1. Scan project directory
      const scannedFiles = await fileScanner.scan(projectPath);
      const scannedPathsSet = new Set<string>();

      // 2. Fetch existing cached hashes
      const existingHashes = databaseService.getAllFileHashes();

      const total = scannedFiles.length;

      // 3. Process each scanned file incrementally
      for (let i = 0; i < total; i++) {
        if (this.isCancelled) {
          break;
        }

        const file = scannedFiles[i];
        scannedPathsSet.add(file.relativePath);

        options?.onProgress?.({
          current: i + 1,
          total,
          currentFile: file.relativePath
        });

        const cached = existingHashes.get(file.relativePath);

        // Fast path: Check mtime and size
        if (
          !options?.forceReindex &&
          cached &&
          cached.size === file.size &&
          Math.abs(cached.mtimeMs - file.mtimeMs) < 10
        ) {
          skippedCount++;
          continue;
        }

        // Read file content and compute hash
        let content: string;
        try {
          content = fs.readFileSync(file.absolutePath, 'utf8');
        } catch {
          continue;
        }

        const contentHash = crypto.createHash('sha256').update(content).digest('hex');

        // Check if hash matches (content unchanged even if mtime touched)
        if (!options?.forceReindex && cached && cached.contentHash === contentHash) {
          skippedCount++;
          continue;
        }

        // Parse with Tree-sitter & AST parser
        const parseResult = await astParserService.parseFile(file.relativePath, content);

        // Save into SQLite index database
        databaseService.upsertFileIndex(
          file.relativePath,
          contentHash,
          file.size,
          file.mtimeMs,
          parseResult.language,
          parseResult.symbols,
          parseResult.chunks
        );

        indexedCount++;
      }

      // 4. Detect and purge deleted files from index
      if (!this.isCancelled) {
        for (const [cachedPath] of existingHashes) {
          if (!scannedPathsSet.has(cachedPath)) {
            databaseService.deleteFileIndex(cachedPath);
            deletedCount++;
          }
        }
      }

      return {
        indexedCount,
        skippedCount,
        deletedCount,
        durationMs: Date.now() - startTime
      };
    } finally {
      this.isRunning = false;
      this.isCancelled = false;
    }
  }

  public async indexSingleFile(projectPath: string, relativePath: string): Promise<boolean> {
    const fullPath = `${projectPath}/${relativePath}`.replace(/\\/g, '/');
    if (!fs.existsSync(fullPath)) {
      databaseService.deleteFileIndex(relativePath);
      return true;
    }

    try {
      const stat = fs.statSync(fullPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      const contentHash = crypto.createHash('sha256').update(content).digest('hex');

      const cached = databaseService.getFileHash(relativePath);
      if (cached && cached.contentHash === contentHash) {
        return false; // No change
      }

      const parseResult = await astParserService.parseFile(relativePath, content);
      databaseService.upsertFileIndex(
        relativePath,
        contentHash,
        stat.size,
        stat.mtimeMs,
        parseResult.language,
        parseResult.symbols,
        parseResult.chunks
      );
      return true;
    } catch {
      return false;
    }
  }
}

export const incrementalIndexer = new IncrementalIndexer();
