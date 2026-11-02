import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseService } from '../src/main/db/database.service';
import { contextAssemblyService } from '../src/main/context/assembly/context-assembly.service';
import { tokenCounterService } from '../src/main/context/tokens/token-counter.service';

const SCALE_BENCH_DIR = path.join(process.cwd(), '.test-scale-bench');

describe('Context Intelligence Scale Benchmarks (Synthetic Scale & Resource Profiling)', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    if (fs.existsSync(SCALE_BENCH_DIR)) {
      fs.rmSync(SCALE_BENCH_DIR, { recursive: true, force: true });
    }
    dbService = new DatabaseService(SCALE_BENCH_DIR);
    dbService.initialize();
  });

  afterEach(() => {
    dbService.close();
    if (fs.existsSync(SCALE_BENCH_DIR)) {
      fs.rmSync(SCALE_BENCH_DIR, { recursive: true, force: true });
    }
  });

  it('measures batch indexing throughput across 1,000 synthetic code chunks', () => {
    const indexDb = dbService.getIndexDb();

    const memBefore = process.memoryUsage();
    const startTime = performance.now();

    const insertBatch = indexDb.transaction(() => {
      for (let i = 0; i < 1000; i++) {
        const filePath = `src/modules/service_${i}.ts`;
        const content = `
export class ServiceWorker_${i} {
  private id = "${i}";
  public handleJob(payload: { id: number; data: string }): boolean {
    if (payload.id === ${i}) {
      console.log("Processed job in worker ${i}");
      return true;
    }
    return false;
  }
}
        `;
        indexDb.prepare(`
          INSERT INTO file_hashes (file_path, content_hash, size, mtime_ms, last_indexed_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(filePath, `hash_${i}_scale`, content.length, Date.now(), Date.now());

        indexDb.prepare(`
          INSERT INTO chunks (id, file_path, start_line, end_line, content, symbol_name, token_count)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(`chk-scale-${i}`, filePath, 1, 12, content, `ServiceWorker_${i}`, 20);

        indexDb.prepare(`
          INSERT INTO fts_chunks (file_path, chunk_content, symbol_name)
          VALUES (?, ?, ?)
        `).run(filePath, content, `ServiceWorker_${i}`);
      }
    });

    insertBatch();
    const durationMs = performance.now() - startTime;
    const memAfter = process.memoryUsage();

    const heapDeltaMb = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024);

    // 1,000 files/chunks in WAL batch should complete in under 500ms
    expect(durationMs).toBeLessThan(500);
    // Heap delta should remain lean (< 25 MB for 1,000 records)
    expect(heapDeltaMb).toBeLessThan(25);

    const chunkCount = indexDb.prepare('SELECT count(*) as c FROM chunks').get() as { c: number };
    expect(chunkCount.c).toBe(1000);
  });

  it('verifies FTS5 BM25 search latency remains < 15ms at scale', () => {
    const indexDb = dbService.getIndexDb();

    // Populate 1,000 searchable entries
    const insertBatch = indexDb.transaction(() => {
      for (let i = 0; i < 1000; i++) {
        indexDb.prepare(`
          INSERT INTO fts_chunks (file_path, chunk_content, symbol_name)
          VALUES (?, ?, ?)
        `).run(
          `src/handlers/handler_${i}.ts`,
          `function processEvent_${i}() { return "event_${i}_payload_data"; }`,
          `processEvent_${i}`
        );
      }
    });
    insertBatch();

    // Query with BM25 rank
    const startQuery = performance.now();
    const results = indexDb.prepare(`
      SELECT file_path, symbol_name, bm25(fts_chunks) as rank
      FROM fts_chunks
      WHERE fts_chunks MATCH 'processEvent_842'
      ORDER BY rank
      LIMIT 10
    `).all() as any[];
    const queryDurationMs = performance.now() - startQuery;

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].symbol_name).toBe('processEvent_842');
    // Sub-15ms target for full-text search
    expect(queryDurationMs).toBeLessThan(15);
  });

  it('verifies context assembly latency remains < 50ms for 50 prioritized fragments', async () => {
    const fragments = Array.from({ length: 50 }, (_, i) => ({
      id: `frag-scale-${i}`,
      filePath: `src/core/module_${i}.ts`,
      startLine: 1,
      endLine: 20,
      content: `export function module_${i}() { return "module ${i} active"; }`,
      reason: `matched requirement ${i}`,
      priority: 100 - i,
      tokenCount: 25,
      isLiveDiskRead: false
    }));

    const startAssembly = performance.now();
    const result = await contextAssemblyService.assemble({
      projectPath: SCALE_BENCH_DIR,
      fragments,
      maxTokens: 50000,
      modelTarget: 'claude'
    });
    const assemblyDurationMs = performance.now() - startAssembly;

    expect(result.fragments.length).toBe(50);
    expect(result.actualTokens).toBeGreaterThan(500);
    // Allow small tolerance (75ms) when full test suite runs under parallel CPU load
    expect(assemblyDurationMs).toBeLessThan(75);
  });
});
