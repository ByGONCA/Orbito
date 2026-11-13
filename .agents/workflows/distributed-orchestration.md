# Workflow: Distributed Multi-Worktree Orchestration

## 1. Overview & Architectural Hierarchy

Orbito organizes AI engineering through a 3-level hierarchical execution topology spanning multiple Git worktrees:

```
Level 1: MAIN Central Orchestrator (Lead Architect on master)
         │  (Decomposes requests, generates work packages, verifies global contracts)
         ▼
Level 2: Autonomous Worktree Teams (Team Leads in isolated worktrees)
         │  (Analyzes work package, decomposes into specialist subtasks)
         ▼
Level 3: Specialist Sub-Agents (Focused domain execution)
         │  (Executes discrete code/research/audit slices)
         ▼
Level 4: Local Worktree Team Integration & Packaging
         │  (Synthesizes subagent findings, runs local tests, produces HANDOFF.md)
         ▼
Level 5: MAIN Central Integration & Quality Gates
            (Rebases, runs Gates 1-4, independent QA, releases to master)
```

---

## 2. Phase 2 — MAIN Central Orchestrator Responsibilities

The MAIN Orchestrator (running on `master` at primary repository):
1. **Request Intake & Analysis:** Parses user objectives and checks file ownership via `.agents/coordination/OWNERSHIP.json`.
2. **Work Breakdown & Worktree Assignment:** Decomposes cross-cutting objectives into domain-bound task specifications (`.agents/coordination/tasks/active/ORB-<DOMAIN>-<ID>.json`).
3. **Contract Freezing:** If shared contracts (`src/shared/ipc.ts`, `package.json`) are affected, freezes the interface specification before dispatching downstream worktrees.
4. **State Dispatch:** Updates `.agents/coordination/REGISTRY.json` and stages task files.
5. **Barrier Synchronization:** Monitors team heartbeats (`STATUS.json`) and coordinates parallel execution waves.
6. **Integration Gate Execution:** Upon receiving `HANDOFF.md`, executes the 4 Quality Gates.
7. **Unified Delivery:** Delivers verified results to the user.

---

## 3. Phase 4 — The 5-Level Hierarchical Delegation Protocol

### Level 1: MAIN Task Dispatch
- Lead Architect creates formal task JSON in `.agents/coordination/tasks/active/`.
- Updates target worktree `STATUS.json` (`status: "READY"`, `current_task: "<TASK_ID>"`).

### Level 2: Worktree Team Lead Intake & Sub-Agent Dispatch
- Team Lead reads task specification and evaluates domain requirements.
- Spawns at least two specialized subagents using `define_subagent` and `invoke_subagent` (or Antigravity `swarm` / subagent tooling):
  - Example Backend Team: Dispatches `security-specialist` for IPC boundary audit + `performance-specialist` for throughput/latency profiling.
  - Example Frontend Team: Dispatches `ui-ux-specialist` for anti-boxiness/typography + `glass-material-specialist` for physical glass materials.

### Level 3: Specialist Sub-Agent Execution
- Sub-agents operate in parallel within strictly bounded scopes.
- Return structured findings, benchmarks, or code snippets directly to their Team Lead.
- No direct cross-worktree or cross-domain tampering.

### Level 4: Worktree Team Synthesis & Local Validation
- Team Lead collates sub-agent deliverables.
- Executes local validation stack:
  - Backend: `npx vitest run tests/main/ tests/pty-terminal.test.ts` + `npm run typecheck`
  - Frontend: `npm run typecheck` + `npx vitest run tests/ui/`
- Writes formal `HANDOFF.md` containing verification evidence.
- Sets local `STATUS.json` to `"WAITING"` (awaiting integration).

### Level 5: MAIN Central Integration & Release
- Lead Architect verifies `HANDOFF.md`.
- Enforces Integration Gates:
  - Gate 1: `npm run typecheck`
  - Gate 2: `npm test`
  - Gate 3: `git rebase master` (confirming zero merge conflicts)
  - Gate 4: `node scripts/validate-coordination.js`
- Invokes independent `qa-specialist` for adversarial verification.
- Updates task file to `.agents/coordination/tasks/completed/`.
- Resets worktree status to `"IDLE"`.

---

## 4. Phase 5 — Parallel Execution Engine & Barrier Synchronization

```
Wave 1: Parallel Investigation & Decomposition
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Backend Worktree Team       │       │     Frontend Worktree Team      │
│ (backend + security + perf)     │       │ (frontend + ui-ux + glass)      │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 ▼                                         ▼
═════════════════════════════════════════════════════════════════════════════
BARRIER 1: Contract Synchronization & Shared Schema Freeze (src/shared/ipc.ts)
═════════════════════════════════════════════════════════════════════════════
                 │                                         │
                 ▼                                         ▼
Wave 2: Parallel Implementation & Local Testing
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Backend Implementation      │       │     Frontend Implementation     │
│   (Local vitest + typecheck)    │       │   (Local vitest + typecheck)    │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 ▼                                         ▼
═════════════════════════════════════════════════════════════════════════════
BARRIER 2: Integration Gates (Gates 1-4) & QA Independent Verification
═════════════════════════════════════════════════════════════════════════════
                 │
                 ▼
         Merge into Master & Delivery
```

### Barrier Sync Rules:
1. **Non-Overlapping Execution:** Worktrees operating in separate domains execute concurrently without waiting.
2. **Contract Freeze Barrier:** Neither team may finalize implementation of IPC communication until the shared contract in `src/shared/ipc.ts` is signed off by the Lead Architect.
3. **Deadlock / Stall Prevention:** If a worktree heartbeat in `STATUS.json` does not update within 5 minutes or flags `status: "BLOCKED"`, the Lead Architect intervenes, unblocks the dependency, or reassigns.

---

## 5. Phase 6 — Inter-Team Communication Protocols

1. **Task Dispatch File:** Defined by `.agents/coordination/schemas/task-dispatch.schema.json`.
2. **Heartbeat & Status:** Defined by `.agents/coordination/schemas/status-update.schema.json`.
3. **Handoff Report:** Defined by `.agents/coordination/schemas/handoff-report.schema.json`.
4. **Architectural Decisions (ADR):** Defined by `.agents/coordination/schemas/decision-request.schema.json`.

---

## 6. Phase 7 & 8 — Resource Optimization & Daily Operating Defaults

### Worktree Dispatch Decision Matrix:
- **Single Worktree (Lightweight):**
  - Scope: <= 3 files, confined to a single domain (e.g. fixing a button styling in frontend, or a query index in backend).
  - Dispatch: Directly assign to the relevant specialist in MAIN or the specific worktree.
- **Distributed Multi-Worktree (Full Organization):**
  - Scope: >= 2 domains, shared IPC contract changes, architectural refactoring, end-to-end features.
  - Dispatch: Full hierarchical orchestration across MAIN, Backend, and Frontend teams.
