# Rule: Git Safety & Worktree Discipline

## 1. Zero-Destructive Git Operations (Absolute Prohibition)
The following commands are strictly prohibited in all Orbito worktrees:
- `git reset --hard` (unless explicitly authorized by human owner for disaster recovery)
- `git clean -fd` / `git clean -f`
- `git push --force`
- `git branch -D`
- `git checkout -- .` (discarding working tree)

## 2. Worktree Isolation Rules
- Never commit directly to `master`. Only the Lead Architect performs integration merges to `master`.
- Every specialist works exclusively in its designated Orca worktree:
  - Backend: `orbito-backend` (`agent/backend-core`)
  - Frontend: `orbito-frontend` (`agent/frontend-ui`)
  - Git & Review: `orbito-git-review` (`agent/git-review`)
  - Workflows: `orbito-workflows` (`agent/ai-workflows`)
- Specialists must never touch or modify the working tree of another specialist.

## 3. Atomic and Semantic Commits
- Commits must be small, focused, and self-contained.
- Use conventional commit messages:
  - `feat(scope): ...`
  - `fix(scope): ...`
  - `refactor(scope): ...`
  - `test(scope): ...`
- Never group unrelated modifications across multiple domains into a single commit.

## 4. Pre-Task and Post-Task Verification
Before starting any task, the specialist must verify clean state:
```bash
git status --short --branch
git rev-parse HEAD
```
Before submitting a handoff, the specialist must verify that only owned files have been modified.
