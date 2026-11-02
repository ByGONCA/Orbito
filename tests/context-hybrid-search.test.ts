import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../src/main/db/database.service';
import { hybridSearchService } from '../src/main/context/search/hybrid-search.service';

const TEST_DB_DIR = path.join(process.cwd(), '.test-search-db-dir');

describe('HybridSearchService & SQLite FTS5 Ranking', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_DIR)) fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });

    databaseService.initialize();

    // Populate mock index data
    databaseService.upsertFileIndex(
      'src/auth/token-manager.ts',
      'hash-auth-123',
      1024,
      Date.now(),
      'typescript',
      [
        {
          id: 'sym-1',
          filePath: 'src/auth/token-manager.ts',
          name: 'validateOAuthToken',
          kind: 'function',
          line: 10,
          endLine: 25,
          signature: 'function validateOAuthToken(token: string): boolean'
        },
        {
          id: 'sym-2',
          filePath: 'src/auth/token-manager.ts',
          name: 'TokenManager',
          kind: 'class',
          line: 5,
          endLine: 50
        }
      ],
      [
        {
          id: 'chk-1',
          filePath: 'src/auth/token-manager.ts',
          startLine: 10,
          endLine: 25,
          content: 'export function validateOAuthToken(token: string): boolean { return token.startsWith("ey"); }',
          symbolName: 'validateOAuthToken',
          language: 'typescript'
        }
      ]
    );

    databaseService.upsertFileIndex(
      'src/db/sqlite-connector.ts',
      'hash-sqlite-456',
      2048,
      Date.now(),
      'typescript',
      [
        {
          id: 'sym-3',
          filePath: 'src/db/sqlite-connector.ts',
          name: 'SqliteDatabaseConnector',
          kind: 'class',
          line: 1,
          endLine: 40
        }
      ],
      [
        {
          id: 'chk-2',
          filePath: 'src/db/sqlite-connector.ts',
          startLine: 1,
          endLine: 30,
          content: 'export class SqliteDatabaseConnector { connect() { return new Database(":memory:"); } }',
          symbolName: 'SqliteDatabaseConnector',
          language: 'typescript'
        }
      ]
    );
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(TEST_DB_DIR)) fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
  });

  it('performs FTS5 BM25 search matching content keywords', async () => {
    const results = await hybridSearchService.search('validateOAuthToken');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].filePath).toBe('src/auth/token-manager.ts');
    expect(results[0].content).toContain('validateOAuthToken');
  });

  it('performs Symbol search matching class and function names', async () => {
    const results = await hybridSearchService.search('SqliteDatabaseConnector');
    expect(results.length).toBeGreaterThan(0);
    const match = results.find((r) => r.symbolName === 'SqliteDatabaseConnector');
    expect(match).toBeDefined();
    expect(match?.filePath).toBe('src/db/sqlite-connector.ts');
  });

  it('performs filename matching', async () => {
    const results = await hybridSearchService.search('token-manager');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.filePath.includes('token-manager'))).toBe(true);
  });
});
