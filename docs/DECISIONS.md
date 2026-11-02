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
- **Status:** Accepted & Implemented (Phase 5)  
- **Context:** Multiple specialist agents running concurrently in the same directory cause git index lock errors and file write collisions.
- **Decision:** Spin up isolated ephemeral Git Worktrees (`.worktrees/agent-task-<id>`) on dedicated task branches (`agent/task-<id>`). Merge changes back only after passing tests and Reviewer Agent verification. Clean up worktrees safely on completion or cancellation.
- **Consequences:** Enables true parallel multi-agent execution with zero filesystem corruption and clear, auditable pull-request-style diffs.

---

### ADR-009: Directed Acyclic Graph (DAG) with Topological Concurrency Scheduling
- **Date:** 2026-11-02  
- **Status:** Accepted & Implemented (Phase 5)  
- **Context:** Complex user goals require breaking into coordinated subtasks without infinite cycles or unconstrained resource exhaustion.
- **Decision:** Implement `CoordinatorAgent` to compile user goals into a strict DAG, validated with Kahn's cycle-detection algorithm (`DAGValidator`). Schedule ready tasks with a bounded concurrency pool (max 3 workers) and cascading cancellations upon prerequisite failure.
- **Consequences:** Guarantees deterministic, deadlock-free agent execution within acceptable desktop RAM/CPU boundaries (< 500 MB per worker).

---

### ADR-010: Independent Adversarial Reviewer Agent Quality Gates
- **Date:** 2026-11-02  
- **Status:** Accepted & Implemented (Phase 5)  
- **Context:** Agents evaluating their own code exhibit blind spots, leading to unnoticed regressions and syntax errors.
- **Decision:** Implement a dedicated `ReviewerAgent` with read-only authority. Before any worker task is marked completed or presented for merge, the Reviewer independently executes typechecking, runs the project's test suite, and verifies acceptance criteria. Failed checks initiate an automated remediation loop (up to 2 retries).
- **Consequences:** Prevents broken code from reaching the main branch while automating standard defect remediation.

---

### ADR-011: Three-Tier Human-in-the-Loop Approval Model
- **Date:** 2026-11-02  
- **Status:** Accepted & Implemented (Phase 5)  
- **Context:** Different user personas (beginners vs. experienced architects) and task types demand varying degrees of autonomy vs. verification.
- **Decision:** Provide three selectable execution modes:
  1. `manual`: Every task start, command, and diff requires explicit approval.
  2. `supervised`: Specialist tasks run autonomously in worktrees; branch merges and system operations require human sign-off with unified diff preview.
  3. `autonomous`: Verified tasks merge automatically when quality gates pass; halts only on unresolvable defects or security anomalies.
- **Consequences:** Gives users full control over agent autonomy without sacrificing development velocity.

---

### ADR-012: Visual Workflow Canvas via React Flow (`@xyflow/react`)
- **Date:** 2026-11-02  
- **Status:** Accepted & Implemented (Phase 6)  
- **Context:** Need an interactive, responsive infinite canvas for DAG workflow creation and execution monitoring that scales cleanly without UI freezing.
- **Decision:** Use `@xyflow/react` with custom-themed node components, typed handles, animated dataflow edges, and collapsible drawer monitors.
- **Consequences:** Delivers a fluid 60 FPS visual programming experience with zoom/pan/minimap controls, while maintaining strict isolation between visual graph state and backend execution.

---

### ADR-013: Sandboxed Restricted Grammar for Expression Evaluation
- **Date:** 2026-11-02  
- **Status:** Accepted & Implemented (Phase 6)  
- **Context:** Condition and switch nodes require evaluating expressions against dynamic inputs and workflow variables without opening Remote Code Execution (RCE) vectors.
- **Decision:** Implement a custom recursive descent parser (`ExpressionEvaluator`) supporting comparison operators, boolean logic, and pure helper functions (`contains`, `startsWith`, `length`, `isEmpty`), strictly forbidding `eval()`, `Function()`, and prototype pollution.
- **Consequences:** Completely eliminates script injection vulnerabilities in user-defined or imported workflow expressions.

---

### ADR-014: Unified 29-Node Categorized Registry with Main Process Execution
- **Date:** 2026-11-02  
- **Status:** Accepted & Implemented (Phase 6)  
- **Context:** Visual nodes must represent real system capabilities across AI, context search, logic, I/O, and developer toolchains rather than simulated components.
- **Decision:** Define a formal `NODE_REGISTRY` of 29 nodes across 5 categories. Each node defines explicit input/output port schemas and required permissions. Execution is managed exclusively in the Main Process by `WorkflowEngine`, reusing existing CLI, Context, and Multi-Agent services.
- **Consequences:** Guarantees zero code duplication and ensures all operations respect host security boundaries and OS sandboxing.
