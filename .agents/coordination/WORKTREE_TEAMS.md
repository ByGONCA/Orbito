# Orbito Autonomous Worktree Teams Specification

This document formalizes the autonomous organizational structure for Orbito's distributed multi-worktree AI development teams. Each Git worktree operates as a distinct engineering team with its own Team Lead and specialized sub-agent roster.

---

## Organizational Topology

```
                       ┌─────────────────────────────────────────┐
                       │           MAIN ORCHESTRATOR             │
                       │    (Lead Architect & Primary Hub)       │
                       │   Global QA, Strategy & Integration     │
                       └───────────────────┬─────────────────────┘
                                           │
         ┌───────────────────┬─────────────┴───────┬───────────────────┐
         ▼                   ▼                     ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  BACKEND TEAM   │ │  FRONTEND TEAM  │ │ GIT-REVIEW TEAM │ │ WORKFLOWS TEAM  │
│  (orbito-back)  │ │ (orbito-front)  │ │ (orbito-git)    │ │ (orbito-wf)     │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ Team Lead:      │ │ Team Lead:      │ │ Team Lead:      │ │ Team Lead:      │
│ backend-spec.   │ │ frontend-spec.  │ │ git-specialist  │ │ workflows-spec. │
│                 │ │                 │ │                 │ │                 │
│ Sub-Agents:     │ │ Sub-Agents:     │ │ Sub-Agents:     │ │ Sub-Agents:     │
│ • security-sp.  │ │ • ui-ux-spec.   │ │ • code-quality  │ │ • doc-spec.     │
│ • perf-spec.    │ │ • glass-spec.   │ │ • security-sp.  │ │ • research-sp.  │
│ • arch-spec.    │ │ • perf-spec.    │ │ • critical-th.  │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 1. Backend Worktree Team

- **Worktree Directory:** `C:/Users/gonca/orca/workspaces/Orbito/orbito-backend`
- **Git Branch:** `agent/backend-core`
- **Team Lead:** `backend-specialist`
- **Assigned Sub-Agents:**
  - `security-specialist`: IPC boundary audit, path traversal checks, sanitized inputs, credential containment.
  - `performance-specialist`: Process lifecycle, PTY stream backpressure, SQLite indexing, memory profiling.
  - `architecture-specialist`: Modular service topology, database transaction boundaries, error hierarchies.
- **Domain Scope (`OWNERSHIP.json`):**
  - `src/main/**` (except `src/main/services/git/**`, `src/main/services/code-review/**`, `src/main/db/schema.ts`)
  - `src/preload/**`
  - `tests/pty-terminal.test.ts`, `tests/main/**`
- **Local Validation Stack:**
  - `npx vitest run tests/pty-terminal.test.ts tests/ipc-schemas.test.ts`
  - `npm run typecheck`
- **Autonomy Boundaries:**
  - May add internal backend helper services and refactor internal PTY/DB/IPC logic.
  - Cannot alter `src/shared/ipc.ts` or `package.json` without an approved ADR submitted to MAIN.

---

## 2. Frontend Worktree Team

- **Worktree Directory:** `C:/Users/gonca/orca/workspaces/Orbito/orbito-frontend`
- **Git Branch:** `agent/frontend-ui`
- **Team Lead:** `frontend-specialist`
- **Assigned Sub-Agents:**
  - `ui-ux-specialist`: Anti-boxiness enforcement, typographic hierarchy, clean whitespace, accessibility.
  - `glass-material-specialist`: Physical glassmorphism, SVG refraction filters, dark-mode blur tuning.
  - `performance-specialist`: React 19 render budgets, virtualized lists, batching terminal 16ms output frames.
- **Domain Scope (`OWNERSHIP.json`):**
  - `src/renderer/**` (except `src/renderer/src/components/Review*`)
- **Strict Invariants:**
  - **Zero White Borders:** Never introduce white, light gray, or glowing borders (`border`, `border-white/*`, `ring-1`).
  - **No Backgrounds on Numbers & Counts:** Muted typographic numbers only.
  - **Icon-Only Toolbars:** Action buttons in headers and toolbars must be icon-only with accessible hover tooltips.
- **Local Validation Stack:**
  - `npm run typecheck`
  - `npx vitest run tests/ui/`
- **Autonomy Boundaries:**
  - May freely restructure components, Zustand stores, and visual styles within `src/renderer/**`.
  - Must consume existing IPC channels; cannot invoke undeclared IPC channels.

---

## 3. Git & Review Worktree Team

- **Worktree Directory:** `C:/Users/gonca/orca/workspaces/Orbito/orbito-git-review`
- **Git Branch:** `agent/git-review`
- **Team Lead:** `git-specialist`
- **Assigned Sub-Agents:**
  - `code-quality-specialist`: Ponytail simplicity ladder compliance, DRY enforcement, cyclomatic complexity.
  - `security-specialist`: Git argument injection prevention, worktree path confinement, secrets leakage.
  - `critical-thinking-specialist`: Adversarial review of diffs, edge case regression detection.
- **Domain Scope (`OWNERSHIP.json`):**
  - `src/main/services/git/**`
  - `src/main/services/code-review/**`
  - `src/renderer/src/components/Review*`
  - `tests/git/**`
- **Local Validation Stack:**
  - `npx vitest run tests/git/`
  - `npm run typecheck`
- **Autonomy Boundaries:**
  - Operates review pipeline, diff visualizer, and Git worktree isolation verification.
  - Asserts that worktrees do not cross boundary constraints before MAIN integration.

---

## 4. Workflows Worktree Team

- **Worktree Directory:** `C:/Users/gonca/orca/workspaces/Orbito/orbito-workflows`
- **Git Branch:** `agent/ai-workflows`
- **Team Lead:** `workflows-specialist`
- **Assigned Sub-Agents:**
  - `documentation-specialist`: Technical specifications, AI context synchronization, indexing.
  - `research-specialist`: Technology evaluations, competitive benchmarks, ecosystem telemetry.
- **Domain Scope (`OWNERSHIP.json`):**
  - `.agents/workflows/**`
  - `.agents/skills/**`
  - `scripts/ai/**`
- **Local Validation Stack:**
  - `node scripts/validate-coordination.js`
  - `npm run validate:structure`
- **Autonomy Boundaries:**
  - Develops workflow automation, orchestration rules, and agent skill configurations.
  - Keeps workflow definitions aligned with Antigravity and multi-agent standards.

---

## 5. Main Worktree Team (Central Hub)

- **Primary Repository:** `C:/Users/gonca/OneDrive/Documents/Projects/Orbito/Orbito`
- **Git Branch:** `master`
- **Team Lead:** `lead-architect`
- **Global Sub-Agents:**
  - `qa-specialist`: Full-suite Vitest validation, automated regression testing, typecheck gatekeeper.
  - `critical-thinking-specialist`: Anti-overengineering, cross-layer contract verification.
  - `product-strategy-specialist`: Strategic alignment, developer velocity, feature prioritization.
- **Domain Scope:**
  - Central Coordination Hub (`.agents/coordination/`)
  - Protected Shared Contracts (`src/shared/ipc.ts`, `package.json`, `src/main/db/schema.ts`)
  - Repository-wide integration, conflict resolution, release tagging.
- **Integration Gates:**
  - Gate 1: `npm run typecheck` (0 errors)
  - Gate 2: `npm test` (100% pass)
  - Gate 3: `git rebase master` (clean branch rebase)
  - Gate 4: `node scripts/validate-coordination.js` (compliance signoff)
