# Architectural Decision Records (ADRs) — AI Workspace

This document records the foundational architectural decisions, their context, alternatives considered, and rationale.

---

### ADR-001: Desktop Framework Stack — Electron 34, React 19, Vite 6, TypeScript Strict
- **Date:** 2026-11-02  
- **Status:** Accepted & Implemented (Phase 1)  
- **Context:** Need a high-performance cross-platform desktop shell with deep OS access (node-pty, better-sqlite3) and modern UI primitives.
- **Decision:** Use Electron 34 with `electron-vite`, React 19, and TypeScript in strict mode. Enforce `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- **Consequences:** Provides maximum native integration for PTY and SQLite while strictly sandboxing the DOM layer against RCE vulnerabilities.

---

### ADR-002: Dual-Database SQLite Architecture (`app.sqlite` and `index.sqlite`)
- **Date:** 2026-11-02  
- **Status:** Accepted & Implemented (Phase 1)  
- **Context:** Heavy concurrent indexing of codebases would block user UI state transactions if sharing a single SQLite database file.
- **Decision:** Split storage into two independent database files:
  1. `app.sqlite`: Workspaces, settings, encrypted secrets, memories, cli sessions, skills, skill executions.
  2. `index.sqlite`: File hashes, AST symbols, code chunks, FTS5 virtual tables.
  Both configured with WAL mode (`PRAGMA journal_mode = WAL`) and `busy_timeout = 5000`.
- **Consequences:** Eliminates write contention between background indexing workers and main UI transactions.

---

### ADR-003: Unified Adapter Pattern for AI CLI Providers
- **Date:** 2026-11-02  
- **Status:** Accepted & Implemented (Phase 2)  
- **Context:** CLI tools (Claude Code, OpenAI Codex, Google Gemini) differ wildly in execution flags, resume syntaxes, and stream formats.
- **Decision:** Implement a polymorphic `ICLIAdapter` interface with provider-specific adapters and discrete stream parsers.
  - Claude: `claude -p "<prompt>" --output-format stream-json --verbose`
  - Codex: `codex exec "<prompt>" --json` and `codex exec resume <SESSION_ID>`
  - Gemini: `gemini -p "<prompt>"` and `gemini --resume <SESSION_ID>`
- **Consequences:** Decouples core UI and orchestration from provider-specific CLI syntaxes.

---

### ADR-004: Tree-sitter WASM ABI 14 for Cross-Platform AST Parsing
- **Date:** 2026-11-02  
- **Status:** Accepted & Implemented (Phase 3)  
- **Context:** Native C++ Tree-sitter grammars require complex platform-specific toolchains (MSVC, Xcode, GCC) that frequently fail across user machines.
- **Decision:** Pin `web-tree-sitter@0.22.6` with `tree-sitter-wasms` (ABI 14 compatible).
- **Consequences:** Enables zero-compilation, lightning-fast AST parsing on Windows, macOS, and Linux out-of-the-box.

---

### ADR-005: SQLite FTS5 with BM25 Ranking as Primary Search Engine
- **Date:** 2026-11-02  
- **Status:** Accepted & Implemented (Phase 3)  
- **Context:** Vector embeddings require large model downloads (~500MB), high RAM, and GPU/CPU inference overhead.
- **Decision:** Use built-in SQLite FTS5 full-text search with BM25 ranking and symbol boosting as the default search engine, offering opt-in local embeddings later.
- **Consequences:** Delivers sub-5ms query latency on 10,000+ chunks with zero external model dependencies and zero network requests.

---

### ADR-006: Three-Tier Context Freshness with Race-Resilient Live Disk Reads
- **Date:** 2026-11-02  
- **Status:** Accepted & Implemented (Phase 3)  
- **Context:** When code is modified during active agent execution, relying purely on SQLite index yields stale context and hallucinations.
- **Decision:** Check physical `mtimeMs` against cached `file_hashes.mtime_ms`. If modified, perform live atomic disk reads using file descriptors and defensive error handling, overriding cached chunks.
- **Consequences:** Guarantees 100% fresh context without needing synchronous re-indexing of the entire repository before every prompt.

---

### ADR-007: Declarative Skills Manifests with Progressive Dynamic Loading
- **Date:** 2026-11-02  
- **Status:** Accepted & Implemented (Phase 4)  
- **Context:** Loading dozens of skill prompt templates into memory at startup wastes RAM and makes skills rigid.
- **Decision:** Declarative JSON manifests validated via Zod. Startup scans only metadata (~5 KB). Heavy Markdown instructions are lazily read on demand during skill execution or inspection.
- **Consequences:** Keeps startup instantaneous (< 3s) and RAM lean (< 50 MB), while providing extensible capabilities and strict permission boundaries.

---

### ADR-008: Git Worktree Sandboxing for Multi-Agent Orchestration
- **Date:** 2026-11-02  
- **Status:** Approved Specification (Phase 5)  
- **Context:** Multiple specialist agents running concurrently in the same directory cause git index lock errors and file write collisions.
- **Decision:** Spin up isolated ephemeral Git Worktrees (`.worktrees/wt-task-<id>`) on dedicated task branches (`agent/task-<id>`). Merge changes back only after passing tests and Reviewer Agent verification.
- **Consequences:** Enables true parallel multi-agent execution with zero filesystem corruption and clear, auditable pull-request-style diffs.
