# Orbito — Development Guide & Engineering Knowledge Base

This document serves as the authoritative, persistent shared knowledge base for all human developers and AI agents (Lead Architect and Specialists) operating in the Orbito codebase.

---

## 1. Project Overview & Architecture

Orbito (Orc AI Workspace) is a local-first desktop application for AI-assisted software development, running on Electron 34 with React 19.

### Process Boundaries & Isolation
```
┌────────────────────────────────────────────────────────┐
│                   Renderer Process                     │
│  - React 19, Tailwind CSS 3.4, Zustand 5               │
│  - Chromium sandbox: contextIsolation: true            │
│  - No direct Node.js or filesystem access              │
└───────────────────────────┬────────────────────────────┘
                            │
               Typed IPC (`window.api`)
                            │
┌───────────────────────────▼────────────────────────────┐
│                    Preload Script                      │
│  - src/preload/index.ts                                │
│  - Exposes typed contextBridge APIs                    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                     Main Process                       │
│  - Node.js runtime, Electron main                      │
│  - src/main/ipc/register.ts                            │
│  - Security Kernel, path containment                   │
│  - Database: better-sqlite3 11.8, Drizzle ORM          │
│  - PTY Process: node-pty subprocess management         │
│  - Indexer Worker: web-tree-sitter, FTS5 in SQLite     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Agent Responsibilities & Multi-Agent Development System

All development follows the Lead Architect orchestration model:
- **Lead Architect (`lead-architect`):** Task decomposition, wave planning, conflict avoidance, integration review.
- **Frontend Specialist (`frontend-specialist`):** `src/renderer/`, UI components, Zustand stores, anti-boxiness, virtualized lists.
- **Backend Specialist (`backend-specialist`):** `src/main/`, IPC handlers, SQLite services, PTY subprocesses, filesystem.
- **Git Specialist (`git-specialist`):** Git worktrees, atomic commits, diff analysis, safe VCS operations (zero destructive commands).
- **Security Specialist (`security-specialist`):** Read-only audit of IPC validation, sandboxing flags, path traversal, secrets protection.
- **QA & Testing Specialist (`qa-specialist`):** Vitest test execution, `tsc` compilation checks, regression detection, bug reproduction.
- **Performance Specialist (`performance-specialist`):** Profiling React re-renders, DB query indexing, memory leaks, IPC overhead.
- **Code Quality Specialist (`code-quality-specialist`):** Ponytail simplicity ladder, DRY, SOLID, removing unnecessary abstractions.
- **Documentation Specialist (`documentation-specialist`):** Technical docs, architecture sync, changelogs (never documents unverified code).
- **Research Specialist (`research-specialist`):** Read-only evaluation of libraries, APIs, and technical feasibility.

Registry: `.agents/agents/roster.json`  
Orchestration Rules: `.agents/rules/multi-agent-system.md`  
Workflow: `.agents/workflows/orchestrate.md`

---

## 3. Core Development Conventions

### A. Simplicity-First Engineering (Ponytail Ladder)
1. **YAGNI:** Never add speculative parameters, factories, or premature abstractions.
2. **Reuse Existing:** Always search for existing utilities, components, and types before writing new ones.
3. **Stdlib & Native First:** Prefer standard browser, Node.js, and TypeScript built-ins.
4. **Existing Dependencies:** Use existing packages in `package.json`. Do not add dependencies without authorization.
5. **Shortest Working Diff:** Make the smallest, cleanest change that addresses the root cause.

### B. Anti-Boxiness & Clean Typography
- **No Container Proliferation:** Avoid surrounding every metric, section, or card with borders and background pills.
- **No Backgrounds on Numbers & Counts:** Badges, tab counts, and file counts must be clean, borderless typographic numbers with subtle color.
- **Borderless / Fluid Layout:** Leverage whitespace, typographic weight, and alignment on dark backgrounds.

---

## 4. Key Technical Decisions & Dependencies

- **Database:** `better-sqlite3` compiled for Electron 34 ABI (NODE_MODULE_VERSION 132).
  - Main database: `app.sqlite` (app settings, workspaces, tabs).
  - Index database: `index.sqlite` (FTS5 code search, tree-sitter symbol index).
- **ORM:** Drizzle ORM for schema definitions and migrations.
- **UI & State:**
  - React 19 with strict TypeScript.
  - Zustand 5 for lightweight reactive stores (`workspace.store.ts`).
  - `@tanstack/react-virtual` for virtualized rendering of long lists.
  - `@xyflow/react` for node/flow graph visualizations.
  - Lucide icons (`lucide-react`).
- **Codebase Graph:** Pre-built AST graph at `graphify-out/graph.json`. Query with `graphify query "<question>"`.

---

## 5. Security Requirements & Boundaries

1. **Chromium Sandboxing:** All renderer windows must have `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
2. **Path Containment:** Every filesystem API must canonicalize paths (`path.resolve`) and verify that target paths reside within allowed workspace boundaries.
3. **IPC Payload Validation:** All IPC arguments received in `ipcMain.handle` must be validated before processing.
4. **Secrets Management:** Sensitive keys and tokens must be encrypted using Electron's `safeStorage` API, never stored in plain text.
5. **Subprocess Isolation:** Command executions via `node-pty` or `child_process` must pass arguments as arrays to prevent shell injection.

---

## 6. Testing & Validation Conventions

- **Type Check:** `npm run typecheck` (`tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json`). Must pass with 0 errors.
- **Test Suite:** `npm run test` runs tests inside Electron environment (`scripts/run-electron-tests.js run`) due to native `better-sqlite3` Electron ABI compatibility.
- **Independent QA Verification:** QA Specialist must execute these commands directly and verify exit codes rather than relying on claims.

---

## 7. Known Constraints & Limitations

1. **Native Module ABI:** Running host `vitest run` directly will fail if host Node.js ABI differs from Electron 34 ABI (132). Always use `npm run test` (Electron test runner).
2. **Subagent Session Scope:** Subagents defined via `define_subagent` exist in memory for the duration of the current Antigravity conversation session. Persistent definitions in `.agents/agents/roster.json` ensure any new session can instantly load them.
3. **Parallel Working Tree Guard:** Parallel agents must never write to overlapping file sets. Use wave-based scheduling or Git worktrees.
