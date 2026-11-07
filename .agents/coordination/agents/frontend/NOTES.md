# Frontend Specialist — Working Notes

## Worktree Context
- **Path:** `C:/Users/gonca/orca/workspaces/Orbito/orbito-frontend`
- **Branch:** `agent/frontend-ui`
- **Baseline Commit:** `b9fe0dfcda307258717987f5a09a454ad5e73d62`

## Ownership Boundaries
- Primary: React 19 UI, Tailwind CSS styling, Zustand stores, view components, tabs, terminal UI (`src/renderer/**`).
- Excluded: Review components (`src/renderer/src/components/Review*` owned by Git Specialist), shared contracts (`src/shared/**`).

## Core UI Principles
- Strict Anti-Boxiness (Rule 4 in AGENTS.md): Never wrap every metric or section in cards or borders.
- Icon-Only Toolbars: No redundant text labels on toolbar buttons. Tooltips via `title` / `aria-label`.
- Borderless numbers: Counts and metrics must never have rounded pill backgrounds.

## Notes & State
- Worktree synchronized to baseline commit `b9fe0df`.
- Currently IDLE awaiting task assignment from Lead Architect.
