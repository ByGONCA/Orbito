# Rule: Strict File and Domain Ownership

## 1. Domain Ownership Authority
Codebase boundaries in Orbito are strictly enforced to enable parallel agent work without merge conflicts or architectural divergence.
The single source of truth for ownership is `.agents/coordination/OWNERSHIP.json`.

## 2. Core Domain Boundaries
- **Backend Specialist (`orbito-backend` / `agent/backend-core`):**
  - Allowed: `src/main/**`, `src/preload/**`, `tests/main/**`, `tests/pty-terminal.test.ts`
  - Excluded: `src/main/services/git/**`, `src/main/services/code-review/**`, `src/main/db/schema.ts`, `src/shared/**`
- **Frontend Specialist (`orbito-frontend` / `agent/frontend-ui`):**
  - Allowed: `src/renderer/**`
  - Excluded: `src/renderer/src/components/Review*`, `src/shared/**`
- **Git & Review Specialist (`orbito-git-review` / `agent/git-review`):**
  - Allowed: `src/main/services/git/**`, `src/main/services/code-review/**`, `src/renderer/src/components/Review*`, `tests/git/**`
  - Excluded: `src/shared/**`
- **AI Workflows Specialist (`orbito-workflows` / `agent/ai-workflows`):**
  - Allowed: `.agents/workflows/**`, `.agents/skills/**`, `scripts/ai/**`
  - Excluded: `src/**`

## 3. Explicitly Protected Shared Files & Responsible Ownership
The following files are strictly protected. Each has an assigned responsible owner, proposer scope, approval requirement, and conflict prevention policy defined in `OWNERSHIP.json`:

1. `package.json` — Owner: **Lead Architect**. Proposers: Any specialist via ADR. Must verify zero conflict with Electron 34 / native modules.
2. `package-lock.json` — Owner: **Lead Architect**. Regenerated solely on master; specialists execute `npm ci` without touching lockfile.
3. `src/shared/ipc.ts` — Owner: **Lead Architect**. Single source of truth for IPC channels; requires cross-agent ADR before changes.
4. `src/shared/types.ts` — Owner: **Lead Architect**. Additive-only shared types; platform-agnostic.
5. `src/shared/cli.ts` — Owner: **Backend Specialist**. Shared CLI schemas for 30+ agent adapters.
6. `src/preload/index.ts` — Owner: **Backend Specialist**. Preload context bridge. Frontend requests additions via RFC, never directly edits preload.
7. `src/main/ipc/register.ts` — Owner: **Backend Specialist**. Main process IPC handler registration hub.
8. `src/main/db/database.service.ts` — Owner: **Backend Specialist**. SQLite WAL database service and cached prepared statements.
9. `src/main/db/schema.ts` — Owner: **Lead Architect**. Drizzle ORM schema; requires ADR and non-destructive migration scripts.
10. `src/renderer/src/stores/workspace.store.ts` — Owner: **Frontend Specialist**. Central Zustand UI store; must follow anti-boxiness and shallow selector rules.
11. `AGENTS.md` — Owner: **Lead Architect**. Core operational rulebook; read-only for all specialists.
12. Coordination Manifests (`REGISTRY.json`, `OWNERSHIP.json`, `INTEGRATION_QUEUE.json`) — Owner: **Lead Architect**. Single Writer Protocol strictly enforced.

## 4. Protected File Rule
Specialists must NEVER modify protected shared files directly in their feature branches without an approved Architectural Decision Record (ADR) issued by the Lead Architect. Any direct modification to protected files in a specialist branch will result in an immediate rejection at Integration Gate 3.
