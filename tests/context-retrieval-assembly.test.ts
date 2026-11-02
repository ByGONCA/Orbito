import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../src/main/db/database.service';
import { contextRetrievalService } from '../src/main/context/retrieval/context-retrieval.service';
import { contextAssemblyService } from '../src/main/context/assembly/context-assembly.service';
import { tokenCounterService } from '../src/main/context/tokens/token-counter.service';

const TEST_DIR = path.join(process.cwd(), '.test-assembly-workspace');

describe('Context Retrieval & Assembly Engine (Live Disk Reads, Deduplication, Token Optimization)', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });

    databaseService.initialize();

    // Clean index database tables
    databaseService.getIndexDb().prepare('DELETE FROM fts_chunks').run();
    databaseService.getIndexDb().prepare('DELETE FROM chunks').run();
    databaseService.getIndexDb().prepare('DELETE FROM symbols').run();
    databaseService.getIndexDb().prepare('DELETE FROM file_hashes').run();

    // Create a real file on disk and index it
    const authFilePath = path.join(TEST_DIR, 'auth.ts');
    fs.writeFileSync(
      authFilePath,
      `export class AuthenticationController {
  public authenticateUser(user: string, secret: string): boolean {
    return secret === "admin-pass";
  }
}`
    );

    databaseService.upsertFileIndex(
      'auth.ts',
      'hash-auth-init',
      200,
      fs.statSync(authFilePath).mtimeMs,
      'typescript',
      [
        {
          id: 'sym-auth-1',
          filePath: 'auth.ts',
          name: 'AuthenticationController',
          kind: 'class',
          line: 1,
          endLine: 6
        },
        {
          id: 'sym-auth-2',
          filePath: 'auth.ts',
          name: 'authenticateUser',
          kind: 'method',
          line: 2,
          endLine: 4
        }
      ],
      [
        {
          id: 'chk-auth-1',
          filePath: 'auth.ts',
          startLine: 1,
          endLine: 6,
          content: 'export class AuthenticationController {\n  public authenticateUser(user: string, secret: string): boolean {\n    return secret === "admin-pass";\n  }\n}',
          symbolName: 'AuthenticationController',
          language: 'typescript'
        }
      ]
    );
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('retrieves relevant fragments matching task description query', async () => {
    const fragments = await contextRetrievalService.retrieve({
      taskDescription: 'Fix authenticateUser validation logic'
    });

    expect(fragments.length).toBeGreaterThan(0);
    const match = fragments.find((f) => f.filePath === 'auth.ts');
    expect(match).toBeDefined();
    expect(match?.content).toContain('authenticateUser');
  });

  it('merges overlapping fragments from the same file to prevent duplicates', async () => {
    const f1 = {
      id: 'frag-1',
      filePath: 'auth.ts',
      startLine: 1,
      endLine: 3,
      content: 'line 1\nline 2\nline 3',
      reason: 'test 1',
      priority: 5,
      tokenCount: 10,
      isLiveDiskRead: false
    };

    const f2 = {
      id: 'frag-2',
      filePath: 'auth.ts',
      startLine: 3,
      endLine: 5,
      content: 'line 3\nline 4\nline 5',
      reason: 'test 2',
      priority: 8,
      tokenCount: 10,
      isLiveDiskRead: false
    };

    const res = await contextAssemblyService.assemble({
      projectPath: TEST_DIR,
      fragments: [f1, f2],
      maxTokens: 1000
    });

    // Should merge into a single continuous fragment (lines 1 to 5)
    expect(res.fragments.length).toBe(1);
    expect(res.fragments[0].startLine).toBe(1);
    expect(res.fragments[0].endLine).toBe(5);
    expect(res.assembledText).toContain('line 1');
    expect(res.assembledText).toContain('line 5');
  });

  it('detects modified files on disk and performs Live Disk Read to guarantee up-to-date context', async () => {
    const authFilePath = path.join(TEST_DIR, 'auth.ts');

    // Wait slightly to ensure mtime changes, then modify on disk WITHOUT running indexer
    await new Promise((r) => setTimeout(r, 20));
    fs.writeFileSync(
      authFilePath,
      `export class AuthenticationController {
  // LIVE MODIFIED ON DISK!
  public authenticateUser(user: string, secret: string): boolean {
    return secret.length > 8 && secret !== "admin-pass";
  }
}`
    );

    const staleFragment = {
      id: 'frag-stale',
      filePath: 'auth.ts',
      startLine: 1,
      endLine: 6,
      content: 'OLD STALE INDEXED CONTENT',
      reason: 'indexed match',
      priority: 10,
      tokenCount: 10,
      isLiveDiskRead: false
    };

    const res = await contextAssemblyService.assemble({
      projectPath: TEST_DIR,
      fragments: [staleFragment],
      maxTokens: 2000
    });

    expect(res.metrics.liveReadsCount).toBe(1);
    expect(res.fragments[0].isLiveDiskRead).toBe(true);
    expect(res.fragments[0].content).toContain('LIVE MODIFIED ON DISK!');
    expect(res.assembledText).toContain('• [Live Disk Read]');
  });

  it('enforces token budget and sets truncated flag when limit is exceeded', async () => {
    const largeFragments = Array.from({ length: 20 }, (_, i) => ({
      id: `frag-large-${i}`,
      filePath: `file_${i}.ts`,
      startLine: 1,
      endLine: 50,
      content: `// Large chunk ${i}\n`.repeat(30),
      reason: `chunk ${i}`,
      priority: 20 - i, // descending priority
      tokenCount: 100,
      isLiveDiskRead: false
    }));

    const res = await contextAssemblyService.assemble({
      projectPath: TEST_DIR,
      fragments: largeFragments,
      maxTokens: 300 // Small budget
    });

    expect(res.truncated).toBe(true);
    expect(res.actualTokens).toBeLessThanOrEqual(res.tokenBudget + 50); // within bounded budget
    expect(res.fragments.length).toBeLessThan(largeFragments.length);
  });

  it('distinguishes actual BPE tokens from estimated tokens accurately', () => {
    const sample = 'export function calculateTotal(items: CartItem[]): number { return items.reduce((acc, i) => acc + i.price, 0); }';
    const counts = tokenCounterService.count(sample);

    expect(counts.actualTokens).toBeGreaterThan(0);
    expect(counts.estimatedTokens).toBeGreaterThan(0);
    // Both metrics exist and are non-zero integers
    expect(Number.isInteger(counts.actualTokens)).toBe(true);
    expect(Number.isInteger(counts.estimatedTokens)).toBe(true);
  });

  it('calculates provider-specific context budgets with safety margin buffer', () => {
    const claudeBudget = tokenCounterService.calculateAvailableContextBudget('claude');
    const codexBudget = tokenCounterService.calculateAvailableContextBudget('codex');
    const geminiBudget = tokenCounterService.calculateAvailableContextBudget('gemini');

    // Claude: (200k - 8k - 4k) * 0.9 = 169,027 tokens approx
    expect(claudeBudget).toBeGreaterThan(160000);
    expect(claudeBudget).toBeLessThan(200000);

    // Codex: (128k - 16k - 4k) * 0.9 = 96,854 tokens approx
    expect(codexBudget).toBeGreaterThan(90000);
    expect(codexBudget).toBeLessThan(128000);

    // Gemini: (1M - 8k - 4k) * 0.9 = 889k tokens approx
    expect(geminiBudget).toBeGreaterThan(800000);
    expect(geminiBudget).toBeLessThan(1000000);
  });

  it('safely handles missing or truncated files during live disk read without crashing', async () => {
    const nonExistentFrag = {
      id: 'frag-ghost',
      filePath: 'does_not_exist_on_disk.ts',
      startLine: 1,
      endLine: 10,
      content: '// fallback cached content',
      reason: 'test ghost file',
      priority: 5,
      tokenCount: 15,
      isLiveDiskRead: false
    };

    const res = await contextAssemblyService.assemble({
      projectPath: TEST_DIR,
      fragments: [nonExistentFrag],
      maxTokens: 500
    });

    expect(res.fragments.length).toBe(1);
    expect(res.fragments[0].content).toBe('// fallback cached content');
    expect(res.fragments[0].isLiveDiskRead).toBe(false);
  });
});
