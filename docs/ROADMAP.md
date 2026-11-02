# Product & Engineering Roadmap — AI Workspace

**Document Version:** 1.8.0  
**Status:** Phases 1–7 Fully Implemented & Verified | Production Ready  
**Execution Strategy:** Iterative Milestone Releases (Phases 1 to 7)  

---

## 1. Roadmap Overview & Strategic Phases

```
[Phase 1: Foundation & Benchmarking] (COMPLETED)
  Electron 34 Shell, React 19 UI, Vite 6, Dual SQLite (app/index), Secure IPC, Performance Harness
       │
       ▼
[Phase 2: CLI Engine & Terminal Infrastructure] (COMPLETED)
  node-pty ConPTY/OpenPTY, ExecutionEngine, Multi-Strategy CLI Detection, Claude/Codex/Gemini Adapters
       │
       ▼
[Phase 3: Context Intelligence Engine] (COMPLETED)
  Incremental Indexer, Tree-sitter WASM ABI 14 AST, SQLite FTS5 BM25, Race-Resilient Live Disk Reads
       │
       ▼
[Phase 4: Skills Engine & AI Experience Layer] (COMPLETED)
  Dynamic Skill Loader, Zod Manifests, 10 Built-in Skills, Permission Manager, Skills Manager UI
       │
       ▼
[Phase 5: Multi-Agent Orchestration] (COMPLETED)
  Coordinator DAG, Git Worktree Isolation, Specialist/Reviewer Agents, Diff Approval Gate, Agents Workspace UI
       │
       ▼
[Phase 6: Visual Automation & Flow Builder] (COMPLETED)
  React Flow Canvas (@xyflow/react), 29 Built-in Nodes, Bounded WorkflowEngine, NL DAG Generator, 10 Templates
       │
       ▼
[Phase 7: Ecosystem & Enterprise Hardening] (COMPLETED)
  Custom Extension SDK, Local Model (Ollama) Air-Gap Support, Advanced Analytics, Immutable Audit Logging
```

---

## 2. Phase Execution Status & Work Packages

```
Phase 1: Foundation & Benchmarking [COMPLETED]
├── WP 1.1: Project Scaffolding & Native Toolchain Configuration [DONE]
├── WP 1.2: IPC Contract & Security Architecture [DONE]
├── WP 1.3: Dual SQLite Persistence & Credential Keyring [DONE]
├── WP 1.4: Workspace & Project Management Engine [DONE]
├── WP 1.5: UI Shell & Core Components [DONE]
└── WP 1.6: Verification & Automated Performance Benchmarks [DONE]

Phase 2: CLI Engine & Provider Adapters [COMPLETED]
├── WP 2.1: Domain Types & Unified Contract (@shared/cli) [DONE]
├── WP 2.2: Provider Adapters (Claude Code, OpenAI Codex, Google Gemini) [DONE]
├── WP 2.3: Process Execution Engine (Subprocess spawn, stream, recursive kill) [DONE]
├── WP 2.4: Session Manager & SQLite Persistence (cli_sessions, messages) [DONE]
├── WP 2.5: UI AI Providers Panel & Stream Console [DONE]
└── WP 2.6: Test Suite (Adapter tests, execution mocks, stream parsers) [DONE]

Phase 3: Context Intelligence Engine [COMPLETED]
├── WP 3.1: Incremental Indexer & Content Hashing [DONE]
├── WP 3.2: Tree-sitter WASM ABI 14 AST Parser (Functions, Classes, Methods) [DONE]
├── WP 3.3: SQLite FTS5 Full-Text Search with BM25 Ranking [DONE]
├── WP 3.4: Three-Tier Context Freshness (Race-Resilient Live Disk Reads) [DONE]
├── WP 3.5: Token Counter & Provider Context Window Calibration (Claude 200k, Codex 128k, Gemini 1M) [DONE]
├── WP 3.6: Context Inspector UI & Retrieval Explorer [DONE]
└── WP 3.7: Scale Benchmarks (Synthetic 1,000 files, FTS5 < 15ms, assembly < 50ms) [DONE]

Phase 4: Skills Engine & Capabilities Layer [COMPLETED]
├── WP 4.1: Declarative Manifest Specification & Zod Validation [DONE]
├── WP 4.2: 10 Built-in Skills Catalog (Review, Bug, Refactor, Docs, Tests, Security, etc.) [DONE]
├── WP 4.3: Progressive Dynamic Loader & In-Memory Registry [DONE]
├── WP 4.4: Skill Permission Manager (Filesystem, Terminal, Network Guardrails) [DONE]
├── WP 4.5: Skill Resolver (Intent Matching & Progressive Disclosure) [DONE]
├── WP 4.6: Custom User Skills Import (Validation, Safe Defaults, Integrity Checksum) [DONE]
├── WP 4.7: Skill Execution Engine (Context Assembly + Specialized Prompting + DB History) [DONE]
├── WP 4.8: Skills Manager UI (Simple Mode Cards & Advanced Mode Permissions/History) [DONE]
└── WP 4.9: Skills Test Suite (5 dedicated test suites, 20 test files total) [DONE]

Phase 5: Multi-Agent Orchestration [COMPLETED]
├── WP 5.1: Coordinator DAG Engine (Task decomposition, topological scheduling, cascades) [DONE]
├── WP 5.2: 6 Specialist Agent Personas (Architect, Backend, Frontend, Testing, Security, Docs) [DONE]
├── WP 5.3: Git Worktree Isolation (.worktrees/agent-task-<id>, dedicated task branches) [DONE]
├── WP 5.4: Independent Reviewer Agent & Quality Gates (Typecheck, test runner, remediation loop) [DONE]
├── WP 5.5: Human-in-the-Loop Approval Center (Manual, Supervised, Autonomous modes, diff viewer) [DONE]
├── WP 5.6: Agents Workspace UI (Visual DAG, Agent Monitor, Approval Center, Run History) [DONE]
└── WP 5.7: Multi-Agent Test Suite (6 dedicated test suites, 26 test files, 126 tests passing) [DONE]

Phase 6: Visual Automation & Flow Builder [COMPLETED]
├── WP 6.1: Flow Canvas Architecture (@xyflow/react, zoom/pan/minimap, theme badges) [DONE]
├── WP 6.2: 29-Node Categorized Registry (AI, Context, Logic, IO, Dev contracts) [DONE]
├── WP 6.3: Bounded Workflow Engine (Kahn topological scheduler, parallel tiers, branch skipping) [DONE]
├── WP 6.4: Sandboxed Expression Evaluator (Comparisons, boolean logic, helper functions, zero eval) [DONE]
├── WP 6.5: Natural Language DAG Generator (Prompt intent classifier, permission estimation) [DONE]
├── WP 6.6: Event-Driven Trigger Architecture (Manual, startup, file change, git events, scheduled) [DONE]
├── WP 6.7: 10 Built-in Production Templates (Security audit, PR prep, testing, onboarding, etc.) [DONE]
└── WP 6.8: Workflow Test Suite (5 dedicated test suites, 31 total test files, 146 tests passing) [DONE]

Phase 7: Ecosystem & Enterprise Hardening [COMPLETED]
├── WP 7.1: Local Model & Air-Gap Support (Ollama Adapter, Local Model discovery, AirGapManager) [DONE]
├── WP 7.2: Custom Extension SDK (ExtensionManifestSchema, sandboxed loader, lifecycle hooks) [DONE]
├── WP 7.3: Dynamic Contribution Engine (Custom React Flow nodes, custom domain skills, SQLite persistence) [DONE]
├── WP 7.4: Advanced Analytics & Cost Attribution (Model rate cards, duration percentiles, local export) [DONE]
├── WP 7.5: Enterprise Audit Logging (Immutable SQLite audit_logs, security violation traps, CSV/JSON export) [DONE]
└── WP 7.6: Ecosystem & Hardening Test Suite (5 dedicated test suites, 36 total test files, 190 tests passing) [DONE]
```

---

## 3. Objective Acceptance Tests for Phase 1

To prevent subjective assessments, Phase 1 acceptance tests are divided strictly between **Mandatory Functional & Security Gates** (which block release if failed) and **Empirical Performance Benchmarks** (measured against reference hardware).

### 3.1 Cross-Platform Matrix
All tests must execute and pass on:
* **Windows 11 (x64)**
* **macOS Sonoma / Sequoia (Apple Silicon ARM64 & Intel x64)**
* **Linux Ubuntu 22.04 LTS (x64)**

### 3.2 Mandatory Functional & Security Gates (Release Blockers)

| Test ID | Category | Objective Test Procedure | Pass / Fail Criterion |
|---|---|---|---|
| **TEST-1.1** | Security / Sandbox | Launch app; open DevTools console in Renderer; inspect `window.require`, `process`, `fs`, `child_process`. | **PASS:** All are strictly `undefined`. Only `window.api` is accessible. |
| **TEST-1.2** | Security / Traversal | Invoke IPC `workspace:open` with relative paths (`../../Windows`) and symlinks pointing outside workspace root. | **PASS:** Rejected with `SecurityViolationException`. Canonical path verification blocks access. |
| **TEST-1.3** | SQLite / Dual WAL | Spin up Main Process (`app.sqlite`) and Indexer Worker thread (`index.sqlite`) concurrently; execute 1,000 rapid writes. | **PASS:** Zero `SQLITE_BUSY` errors; WAL files created and checkpointed cleanly. |
| **TEST-1.4** | Credential Encryption | Store test API key via IPC; inspect raw `app.sqlite` database file with SQLite reader. | **PASS:** Plaintext key does not appear anywhere in database; stored encrypted via OS `safeStorage`. |
| **TEST-1.5** | Native Rebuild | Run `npm install` and `npm run rebuild` across clean Node 22 / Electron environment. | **PASS:** `better-sqlite3`, `node-pty`, and `@parcel/watcher` compile without ABI mismatches. |
| **TEST-1.6** | Process Tree Kill | Spawn test child process tree; trigger application window close. | **PASS:** Zero orphan child processes remaining in OS Task Manager (`taskkill /T /F` or `SIGKILL`). |
| **TEST-1.7** | Virtualized Explorer | Open project folder with 5,000 files; scroll rapidly through file tree. | **PASS:** DOM renders ≤ 50 active nodes via TanStack Virtual; UI does not stutter. |
| **TEST-1.8** | Mode Toggle | Switch between Simple Mode and Advanced Mode in UI. | **PASS:** State is preserved; layout switches immediately with zero console errors. |

### 3.3 Empirical Performance Targets (Reference Hardware: 4C/8T, 16GB RAM, NVMe)

| Metric ID | Performance Metric | Engineering Target | Status & Measurement Harness |
|---|---|---|---|
| **PERF-1.1** | Cold Startup Time | ≤ 3.0 seconds | High-resolution performance timer (`performance.mark`) |
| **PERF-1.2** | Idle RAM (All Processes) | ≤ 300 MB total | Automated test harness via `process.getProcessMemoryInfo()` |
| **PERF-1.3** | Idle CPU Usage | < 1% sustained | OS CPU sampling over 60 seconds in idle state |
| **PERF-1.4** | Active Workspace RAM | ≤ 500 MB (with 5k files open) | Memory profile after opening synthetic 5,000-file repository |

---

## 4. Technical Risk Register

| Risk ID | Risk Description | Prob. | Impact | Severity | Mitigation Strategy | Status | Implementation Blocker? |
|---|---|---|---|---|---|---|---|
| **R-01** | Native C++ compilation failure on Windows (`better-sqlite3`, `node-pty`) | Med | High | High | Pre-configure `@electron/rebuild` and document MSVC 2022 / Python prerequisites; pin stable `node-pty@1.1.0`. | Mitigated in Architecture | **NO** (Solvable via standard build scripts) |
| **R-02** | SQLite write lock contention between Main and Indexer Worker | High | High | Critical | Dual-Database Architecture (`app.sqlite` for Main, `index.sqlite` for Worker) with WAL mode & `busy_timeout = 5000`. | Mitigated in Architecture | **NO** (Completely isolated by design) |
| **R-03** | Context Engine hallucination due to stale index data | High | Med | High | Three-Tier Freshness Architecture: live disk reads override stale index chunks for active working files. | Mitigated in Architecture | **NO** (Addressed in Context Resolver) |
| **R-04** | Malicious skill command execution or prompt injection | Med | High | Critical | Runtime Security Kernel encloses filesystem via `fs.realpathSync`, spawns with `shell: false`, and blocks permission escalation. | Mitigated in Architecture | **NO** (Enforced at kernel boundary) |
| **R-05** | Memory bloat from Chromium / Electron exceeding 300MB target | Med | Med | Medium | V8 heap caps (`--max-old-space-size=256`), DOM list virtualization, terminal scrollback capping at 5,000 lines. | Mitigated in Architecture | **NO** (Benchmarked in CI harness) |
| **R-06** | Orphaned child processes lingering after CLI cancellation | Med | Med | Medium | Recursive process tree termination (`taskkill /T /F` on Windows, process group `SIGKILL` on POSIX). | Mitigated in Architecture | **NO** (Verified in TEST-1.6) |
| **R-07** | React 19 ecosystem library incompatibility | Low | Med | Low | Pure client SPA setup; fallback to React 18.3.1 established if external canvas plugin issues occur during Phase 6. | Mitigated in Architecture | **NO** (Phase 1 uses standard React 19 primitives) |

**Conclusion on Risk Register:** Zero critical blocking risks remain. All identified technical risks have validated architectural mitigations ready for execution in Phase 1.

---

## 5. Summary of Roadmap Phases (Phases 2 to 7)

* **Phase 2 — CLI Engine & Terminal:** Implement provider adapters (Claude Code, Codex, Gemini), `node-pty` integration, and xterm.js WebGL canvas.
* **Phase 3 — Context Intelligence:** Deploy Tree-sitter AST indexer worker thread, SQLite FTS5 table, 5-tier memory, and opt-in local embeddings toggle.
* **Phase 4 — Skills Engine & Experience Layer:** Deploy dynamic capability registry, SHA-256 integrity checks, and intent classification.
* **Phase 5 — Multi-Agent System:** Implement Coordinator DAG, Git worktree isolation, Reviewer diff validation, and approval modals.
* **Phase 6 — Visual Automation:** React Flow canvas, natural language to DAG workflow generator, conditional nodes.
* **Phase 7 — Ecosystem & Enterprise Hardening:** Complete custom extension SDK, local model (Ollama) air-gap network isolation, advanced analytics with model rate cards, and immutable SQLite enterprise audit logging.
