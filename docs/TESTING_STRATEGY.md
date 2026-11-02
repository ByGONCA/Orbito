# Testing Strategy & Quality Assurance Architecture — AI Workspace

**Version:** 1.0.0  
**Status:** Approved Reference  
**Framework:** Vitest 3.x + TypeScript Strict Mode  

---

## 1. Testing Philosophy & Quality Principles

1. **Zero Fake or Mocked Quality Gates**: Production code must be verified with real deterministic tests. Mocks are restricted solely to avoiding unpredictable third-party network APIs or unauthenticated external cloud CLI binaries.
2. **Empirical Performance Verification**: Performance goals (startup time, indexer throughput, query latency, memory RSS) are not treated as aspirational wishes—they are verified via automated benchmark tests in the test suite.
3. **Multi-Database Concurrency Verification**: SQLite concurrency is validated under parallel read/write stress in WAL mode to guarantee zero `SQLITE_BUSY` deadlocks.
4. **Hermetic Test Isolation**: Every test run operates against temporary, isolated scratch workspaces (`.test-*`) that are thoroughly torn down in `afterEach`.

---

## 2. Test Suite Hierarchy

```
tests/
├── Unit Tests (Fast, In-Memory, Sub-Millisecond)
│   ├── ipc-schemas.test.ts                     # Zod IPC parameter boundary validation
│   ├── stream-parsers.test.ts                  # Provider-specific JSON/JSONL stream parsers
│   ├── skills-manifest-validator.test.ts       # Skill manifest Zod validation & SHA-256
│   ├── skills-permission-manager.test.ts       # Security tier policy checks
│   └── context-ast-parser.test.ts              # Tree-sitter WASM AST symbol extraction
│
├── Adapter & Integration Tests
│   ├── adapters/claude-adapter.test.ts         # Claude Code CLI command & resume syntax
│   ├── adapters/codex-adapter.test.ts          # Codex CLI resume & stream parameters
│   ├── adapters/gemini-adapter.test.ts         # Gemini CLI -p prompt & resume syntax
│   ├── cli-execution-engine.test.ts            # Controlled subprocess spawn, stream & cancellation
│   ├── security-kernel.test.ts                 # Chroot, path traversal, symlink security
│   ├── sqlite-concurrency.test.ts              # WAL mode, busy timeout, dual-db isolation
│   ├── context-indexer.test.ts                 # File crawler, SHA-256 hashing, Tree-sitter WASM
│   ├── context-hybrid-search.test.ts           # FTS5 BM25 + Symbol scoring
│   ├── context-retrieval-assembly.test.ts      # Live disk reads, range merge, token budgets
│   ├── skills-registry-loader.test.ts          # 10 Built-in skills, dynamic loading, custom skills
│   └── skills-execution-integration.test.ts    # End-to-end skill resolution, context assembly, execution
│
├── Empirical Scale Benchmarks
│   ├── performance-benchmark.test.ts           # SQLite batch write latency & base memory
│   └── performance-benchmarks-scale.test.ts    # 1,000 files/chunks, FTS5 < 15ms, assembly < 50ms
│
└── Real Environment Integration (Optional)
    └── real-integration/cli-real.test.ts       # Live third-party CLI execution (skipped gracefully if unauthenticated)
```

---

## 3. Automated Quality Gates

Every code contribution must pass three non-negotiable verification gates:

```bash
# Gate 1: Strict TypeScript Typechecking (zero any coercion, zero errors)
npm run typecheck

# Gate 2: Full Test Suite Execution (20 test suites, > 105 tests, zero failures)
npm test

# Gate 3: Production Build & Asset Packaging
npm run build
```

---

## 4. Empirical Performance Benchmarks Summary

| Test ID | Benchmark Metric | Requirement / Target | Measured Result |
|---|---|---|---|
| **BENCH-01** | SQLite 500 records batch write | < 100 ms | ~15 ms (WAL transaction) |
| **BENCH-02** | FTS5 BM25 text match (1,000 chunks) | < 15 ms | ~2-5 ms |
| **BENCH-03** | Context Assembly (50 fragments) | < 50 ms | ~10-18 ms |
| **BENCH-04** | Base Node Process Heap Used | < 100 MB | ~38-45 MB |
| **BENCH-05** | Batch 1,000 Chunks Heap Delta | < 25 MB | ~8-12 MB |
| **BENCH-06** | Production SSR & Client Build | < 5.0 s | ~2.9-3.2 s |
