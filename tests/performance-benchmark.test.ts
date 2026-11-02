import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseService } from '../src/main/db/database.service';

const BENCH_STORAGE_DIR = path.join(process.cwd(), '.test-bench-perf');

describe('Empirical Performance Benchmarks (Phase 1 Baseline)', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    if (fs.existsSync(BENCH_STORAGE_DIR)) {
      fs.rmSync(BENCH_STORAGE_DIR, { recursive: true, force: true });
    }
    dbService = new DatabaseService(BENCH_STORAGE_DIR);
    dbService.initialize();
  });

  afterEach(() => {
    dbService.close();
    if (fs.existsSync(BENCH_STORAGE_DIR)) {
      fs.rmSync(BENCH_STORAGE_DIR, { recursive: true, force: true });
    }
  });

  it('measures SQLite batch insertion latency (500 chunks in WAL mode)', () => {
    const indexDb = dbService.getIndexDb();

    const startTime = performance.now();
    const batchInsert = indexDb.transaction(() => {
      for (let i = 0; i < 500; i++) {
        indexDb.prepare(`
          INSERT INTO file_hashes (file_path, content_hash, size, mtime_ms, last_indexed_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(`src/file_${i}.ts`, `hash_${i}_abcdef`, 1024, Date.now(), Date.now());
      }
    });

    batchInsert();
    const durationMs = performance.now() - startTime;

    // 500 records in WAL transaction should comfortably execute in under 100ms
    expect(durationMs).toBeLessThan(100);

    const count = indexDb.prepare('SELECT count(*) as c FROM file_hashes').get() as any;
    expect(count.c).toBe(500);
  });

  it('measures SQLite FTS5 query latency on populated table', () => {
    const indexDb = dbService.getIndexDb();

    // Populate 200 searchable text chunks
    const insertFts = indexDb.transaction(() => {
      for (let i = 0; i < 200; i++) {
        indexDb.prepare(`
          INSERT INTO fts_chunks (file_path, chunk_content, symbol_name)
          VALUES (?, ?, ?)
        `).run(
          `src/components/Button_${i}.tsx`,
          `export function ButtonComponent_${i}() { return <button className="btn">Click ${i}</button>; }`,
          `ButtonComponent_${i}`
        );
      }
    });
    insertFts();

    const startQuery = performance.now();
    const results = indexDb.prepare(`
      SELECT file_path, symbol_name
      FROM fts_chunks
      WHERE fts_chunks MATCH 'ButtonComponent_50'
    `).all();
    const queryDurationMs = performance.now() - startQuery;

    expect(results.length).toBeGreaterThan(0);
    // Microsecond / sub-millisecond lexical match
    expect(queryDurationMs).toBeLessThan(15);
  });

  it('measures process memory consumption baseline', () => {
    const memUsage = process.memoryUsage();
    const heapUsedMb = Math.round(memUsage.heapUsed / (1024 * 1024));

    // In isolated Node runtime, baseline heap should remain well below 100 MB
    expect(heapUsedMb).toBeLessThan(100);
  });
});
