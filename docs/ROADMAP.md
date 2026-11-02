# Product & Engineering Roadmap — AI Workspace

**Document Version:** 1.2.0  
**Status:** Approved for Implementation Planning  
**Execution Strategy:** Iterative Milestone Releases (Phases 1 to 7)  

---

## 1. Roadmap Overview & Strategic Phases

```
[Phase 1: Foundation & Benchmarking]
  Electron 34 Shell, React 19 UI, Vite 6, Dual SQLite (app/index), Secure IPC, Performance Harness
       |
       v
[Phase 2: CLI Engine & Terminal Infrastructure]
  node-pty ConPTY/OpenPTY, xterm.js WebGL, Multi-Strategy CLI Detection, Claude/Codex/Gemini Adapters
       |
       v
[Phase 3: Context Intelligence Engine]
  Indexer Worker Thread, Tree-sitter AST, SQLite FTS5 BM25 Search, 5-Tier Memory, Opt-in Embeddings
       |
       v
[Phase 4: Skills Engine & AI Experience Layer]
  Dynamic Skill Loader, Permission Scopes Manifest, Intent Classification, Plan Evaluator
       |
       v
[Phase 5: Multi-Agent Orchestration]
  Coordinator DAG, Git Worktree Isolation, Specialist/Reviewer Agents, Diff Approval
       |
       v
[Phase 6: Visual Automation & Flow Builder]
  React Flow Canvas, Natural Language DAG Generation, Conditional Nodes, Triggers
       |
       v
[Phase 7: Ecosystem & Enterprise Hardening]
  Custom Extension SDK, Local Model (Ollama) Air-Gap Support, Advanced Analytics
```

---

## 2. Phase 1 Implementation Plan & Work Packages

```
Phase 1: Foundation & Benchmarking (COMPLETED)
├── WP 1.1: Project Scaffolding & Native Toolchain Configuration [DONE]
├── WP 1.2: IPC Contract & Security Architecture [DONE]
├── WP 1.3: Dual SQLite Persistence & Credential Keyring [DONE]
├── WP 1.4: Workspace & Project Management Engine [DONE]
├── WP 1.5: UI Shell & Core Components [DONE]
└── WP 1.6: Verification & Automated Performance Benchmarks [DONE]
```

### 2.1 Phase 2 Implementation Plan & Work Packages (IN PROGRESS)

```
Phase 2: CLI Engine & Provider Adapters
├── WP 2.1: Domain Types & Unified Contract (@shared/cli)
│   ├── Provider identifier types ('claude' | 'codex' | 'gemini')
│   ├── Installation, auth status, and capability schemas
│   ├── Normalized stream event types ('stdout', 'stderr', 'status', 'token_usage', 'exit')
│   └── Typed IPC channels for detection, execution, streaming, and session history
│
├── WP 2.2: Provider Adapters (Decoupled & Normalized)
│   ├── ICLIAdapter base contract & helper utilities (path lookup, semver probe)
│   ├── ClaudeCodeAdapter (@anthropic-ai/claude-code, ~/.claude.json, resume support)
│   ├── CodexAdapter (codex/openai CLI, API key, stdin/exec piping)
│   └── GeminiAdapter (gemini/gcloud CLI, ADC/API key detection)
│
├── WP 2.3: Process Execution Engine
│   ├── Process spawn with shell: false and clean argument arrays
│   ├── Process tree clean termination (taskkill /pid /T /F on Win, process groups on POSIX)
│   ├── Real-time stdout/stderr stream parsing and IPC broadcast
│   ├── Configurable execution timeouts & cancellation tokens
│   └── Session isolation (preventing cross-session environment or state leakage)
│
├── WP 2.4: Session Manager & SQLite Persistence
│   ├── Schema migration: cli_sessions and cli_session_messages tables in app.sqlite
│   ├── Association with workspaceId and currentProjectId
│   ├── Execution history tracking (status, exit code, duration, token metrics)
│   └── Capability-gated session resumption (only enabled when supported by provider)
│
├── WP 2.5: UI AI Providers Panel & Stream Console
│   ├── Providers overview tab in UI showing detection, version, and auth status
│   ├── Custom executable path configuration inputs per provider
│   ├── Active provider selector
│   ├── Real-time execution stream console with auto-scroll and status pills
│   └── Actionable, human-readable error banners for missing binaries or auth failures
│
└── WP 2.6: Test Suite (Mocks & Integration)
    ├── Unit tests with process mocks for Claude Code, Codex, and Gemini adapters
    ├── Execution engine tests (streaming, timeout, clean tree kill, error normalization)
    ├── SQLite session persistence & history querying tests
    └── Integration test harness separating mocked runs from live binary checks
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
* **Phase 7 — Ecosystem & Air-Gap:** Custom extension SDK, Ollama / llama.cpp air-gapped support, and telemetry opt-in.
