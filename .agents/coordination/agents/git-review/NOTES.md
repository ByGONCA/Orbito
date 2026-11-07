# Git & Review Specialist — Working Notes

## Worktree Context
- **Path:** `C:/Users/gonca/orca/workspaces/Orbito/orbito-git-review`
- **Branch:** `agent/git-review`
- **Baseline Commit:** `b9fe0dfcda307258717987f5a09a454ad5e73d62`

## Ownership Boundaries
- Primary: Git operations service (`src/main/services/git/**`), Code review engine (`src/main/services/code-review/**`), Diff & Review UI components (`src/renderer/src/components/Review*`).
- Excluded: General backend PTY/DB (`src/main/terminal/**`, `src/main/db/**`), general UI components (`src/renderer/src/components/Terminal*`).

## Git Safety Rules
- Absolute prohibition against destructive commands (`git reset --hard`, `git clean -fd`, `git push --force`).
- Atomic commits with clear semantic prefixes.
- Zero cross-branch contamination.

## Notes & State
- Worktree synchronized to baseline commit `b9fe0df`.
- Currently IDLE awaiting task assignment from Lead Architect.
