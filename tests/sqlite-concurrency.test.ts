import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseService } from '../src/main/db/database.service';

const TEST_STORAGE_DIR = path.join(process.cwd(), '.test-storage-concurrency');

describe('SQLite Architecture & Concurrency Tests', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    if (fs.existsSync(TEST_STORAGE_DIR)) {
      fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
    dbService = new DatabaseService(TEST_STORAGE_DIR);
    dbService.initialize();
  });

  afterEach(() => {
    dbService.close();
    if (fs.existsSync(TEST_STORAGE_DIR)) {
      fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
  });

  it('validates WAL mode and busy_timeout PRAGMAs on both databases', () => {
    const appDb = dbService.getAppDb();
    const indexDb = dbService.getIndexDb();

    const appJournal = appDb.pragma('journal_mode', { simple: true });
    const indexJournal = indexDb.pragma('journal_mode', { simple: true });
    expect(appJournal).toBe('wal');
    expect(indexJournal).toBe('wal');

    const appTimeout = appDb.pragma('busy_timeout', { simple: true });
    const indexTimeout = indexDb.pragma('busy_timeout', { simple: true });
    expect(appTimeout).toBe(5000);
    expect(indexTimeout).toBe(5000);
  });

  it('handles concurrent reads while writing to app.sqlite without blocking', () => {
    const appDb1 = dbService.getAppDb();
    const appDbPath = path.join(TEST_STORAGE_DIR, 'app.sqlite');

    // Create second independent connection to app.sqlite
    const appDb2 = new Database(appDbPath, { timeout: 5000 });
    appDb2.pragma('busy_timeout = 5000');

    // Write from connection 1
    const insert = appDb1.prepare(`
      INSERT INTO projects (id, name, path, last_opened_at, is_git_repo, permission_level)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insert.run('p1', 'Project 1', 'C:/p1', Date.now(), 0, 'standard');

    // Read immediately from connection 2 (WAL mode allows concurrent readers)
    const read = appDb2.prepare('SELECT * FROM projects WHERE id = ?').get('p1') as any;
    expect(read).toBeDefined();
    expect(read.name).toBe('Project 1');

    appDb2.close();
  });

  it('verifies transaction rollback on error in index.sqlite', () => {
    const indexDb = dbService.getIndexDb();

    // Verify initial count
    const countBefore = indexDb.prepare('SELECT count(*) as count FROM file_hashes').get() as any;
    expect(countBefore.count).toBe(0);

    // Run transaction that throws an intentional error
    const failedTx = indexDb.transaction(() => {
      indexDb.prepare(`
        INSERT INTO file_hashes (file_path, content_hash, size, mtime_ms, last_indexed_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('file1.ts', 'hash1', 100, 1.0, Date.now());

      // Throw error to trigger rollback
      throw new Error('Simulated crash mid-transaction');
    });

    expect(() => failedTx()).toThrow('Simulated crash mid-transaction');

    // Verify that file1.ts was rolled back and not persisted
    const countAfter = indexDb.prepare('SELECT count(*) as count FROM file_hashes').get() as any;
    expect(countAfter.count).toBe(0);
  });

  it('validates isolation: concurrent writes to app.sqlite and index.sqlite do not collide', () => {
    const appDb = dbService.getAppDb();
    const indexDb = dbService.getIndexDb();

    // Perform simultaneous batch operations on both databases
    const runBatchApp = appDb.transaction(() => {
      for (let i = 0; i < 50; i++) {
        appDb.prepare(`
          INSERT INTO memories (id, tier, entity_key, content, tokens, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(`m-${i}`, 'task', `key-${i}`, `content-${i}`, 10, Date.now(), Date.now());
      }
    });

    const runBatchIndex = indexDb.transaction(() => {
      for (let i = 0; i < 50; i++) {
        indexDb.prepare(`
          INSERT INTO file_hashes (file_path, content_hash, size, mtime_ms, last_indexed_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(`file-${i}.ts`, `hash-${i}`, 200, 1.0, Date.now());
      }
    });

    expect(() => {
      runBatchApp();
      runBatchIndex();
    }).not.toThrow();

    const memCount = appDb.prepare('SELECT count(*) as c FROM memories').get() as any;
    const fileCount = indexDb.prepare('SELECT count(*) as c FROM file_hashes').get() as any;

    expect(memCount.c).toBe(50);
    expect(fileCount.c).toBe(50);
  });

  it('executes checkpoints cleanly without corruption', () => {
    const appDb = dbService.getAppDb();
    const indexDb = dbService.getIndexDb();

    // Insert records to generate WAL frames
    appDb.prepare(`
      INSERT INTO workspaces (id, name, ui_mode, theme, auto_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('w-test', 'Test Workspace', 'simple', 'dark', 1, Date.now(), Date.now());

    // Execute PASSIVE checkpoint
    const appCheckpoint = appDb.pragma('wal_checkpoint(PASSIVE)') as any[];
    const indexCheckpoint = indexDb.pragma('wal_checkpoint(PASSIVE)') as any[];

    expect(appCheckpoint).toBeDefined();
    expect(indexCheckpoint).toBeDefined();

    // Verify integrity
    const appIntegrity = appDb.pragma('integrity_check', { simple: true });
    const indexIntegrity = indexDb.pragma('integrity_check', { simple: true });

    expect(appIntegrity).toBe('ok');
    expect(indexIntegrity).toBe('ok');
  });
});
