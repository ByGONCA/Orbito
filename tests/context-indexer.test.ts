import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { incrementalIndexer } from '../src/main/context/indexer/incremental-indexer';
import { databaseService } from '../src/main/db/database.service';

const TEST_WORKSPACE = path.join(process.cwd(), '.test-indexer-workspace');

describe('IncrementalIndexer (Hashing, Discovery, Change Detection, Cancellation)', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_WORKSPACE)) fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    fs.mkdirSync(TEST_WORKSPACE, { recursive: true });

    databaseService.initialize();

    // Clean index database tables
    databaseService.getIndexDb().prepare('DELETE FROM fts_chunks').run();
    databaseService.getIndexDb().prepare('DELETE FROM chunks').run();
    databaseService.getIndexDb().prepare('DELETE FROM symbols').run();
    databaseService.getIndexDb().prepare('DELETE FROM file_hashes').run();

    // Create realistic initial files
    fs.writeFileSync(
      path.join(TEST_WORKSPACE, 'auth.ts'),
      'export function login(user: string): boolean { return true; }\n'
    );
    fs.writeFileSync(
      path.join(TEST_WORKSPACE, 'calc.py'),
      'def add(a, b):\n    return a + b\n'
    );
    fs.writeFileSync(
      path.join(TEST_WORKSPACE, 'notes.md'),
      '# Project Notes\nThis is an important design document.\n'
    );
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(TEST_WORKSPACE)) fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
  });

  it('performs full initial indexing across project files', async () => {
    const res = await incrementalIndexer.indexProject(TEST_WORKSPACE);
    expect(res.indexedCount).toBe(3);
    expect(res.skippedCount).toBe(0);
    expect(res.deletedCount).toBe(0);

    const stats = databaseService.getIndexStats();
    expect(stats.totalFiles).toBe(3);
    expect(stats.totalSymbols).toBeGreaterThanOrEqual(3);
  });

  it('skips unchanged files completely on second run (0 wasted work)', async () => {
    // Run 1: initial index
    await incrementalIndexer.indexProject(TEST_WORKSPACE);

    // Run 2: immediate re-index without file changes
    const res2 = await incrementalIndexer.indexProject(TEST_WORKSPACE);
    expect(res2.indexedCount).toBe(0);
    expect(res2.skippedCount).toBe(3); // All 3 skipped!
    expect(res2.deletedCount).toBe(0);
  });

  it('detects and indexes only modified files', async () => {
    await incrementalIndexer.indexProject(TEST_WORKSPACE);

    // Modify auth.ts (wait 20ms to ensure mtime changes)
    await new Promise((r) => setTimeout(r, 20));
    fs.writeFileSync(
      path.join(TEST_WORKSPACE, 'auth.ts'),
      'export function login(user: string, token: string): boolean { return token.length > 5; }\n'
    );

    const res = await incrementalIndexer.indexProject(TEST_WORKSPACE);
    expect(res.indexedCount).toBe(1); // Only auth.ts indexed
    expect(res.skippedCount).toBe(2); // calc.py and notes.md skipped
    expect(res.deletedCount).toBe(0);
  });

  it('detects newly added files', async () => {
    await incrementalIndexer.indexProject(TEST_WORKSPACE);

    // Add new file
    fs.writeFileSync(
      path.join(TEST_WORKSPACE, 'service.ts'),
      'export class DataService { run() {} }\n'
    );

    const res = await incrementalIndexer.indexProject(TEST_WORKSPACE);
    expect(res.indexedCount).toBe(1); // Only service.ts indexed
    expect(res.skippedCount).toBe(3); // Previous 3 skipped
  });

  it('detects deleted files and purges them from SQLite index', async () => {
    await incrementalIndexer.indexProject(TEST_WORKSPACE);

    // Delete notes.md
    fs.unlinkSync(path.join(TEST_WORKSPACE, 'notes.md'));

    const res = await incrementalIndexer.indexProject(TEST_WORKSPACE);
    expect(res.deletedCount).toBe(1);
    expect(res.skippedCount).toBe(2);

    const stats = databaseService.getIndexStats();
    expect(stats.totalFiles).toBe(2);
  });

  it('supports cancellation during indexing without corrupting state', async () => {
    // Add 10 dummy files
    for (let i = 0; i < 10; i++) {
      fs.writeFileSync(path.join(TEST_WORKSPACE, `file_${i}.ts`), `export const v${i} = ${i};\n`);
    }

    // Cancel after progress triggers
    let progressCalls = 0;
    const indexPromise = incrementalIndexer.indexProject(TEST_WORKSPACE, {
      onProgress: () => {
        progressCalls++;
        if (progressCalls === 2) {
          incrementalIndexer.cancel();
        }
      }
    });

    const res = await indexPromise;
    expect(res.indexedCount).toBeLessThan(13); // Stopped early due to cancellation
  });
});
