# Workflow: Specialist Handoff Submission

## Purpose
Standardized protocol for a specialist to submit completed work to the Lead Architect for verification and integration.

## Specialist Pre-Submission Checklist
Before submitting a handoff, the specialist must verify:
- [ ] All changes are committed in the specialist branch.
- [ ] `git status --short` is completely clean.
- [ ] No files outside `OWNERSHIP.json` or `scope.allowed_files` have been touched.
- [ ] No protected shared files were modified without an approved ADR.
- [ ] `npm run typecheck` produces 0 errors.
- [ ] `npm test` passes 100% with no regressions.

## Handoff Preparation
1. Copy or update `.agents/coordination/agents/<agent-id>/HANDOFF.md` with:
   - Current commit hash.
   - Summary of implemented functionality.
   - List of all modified/created files.
   - Verification logs (stdout excerpts from typecheck and test runs).
   - Any architectural notes, limitations, or downstream impacts.
2. Update `.agents/coordination/agents/<agent-id>/STATUS.json`:
   ```json
   {
     "status": "WAITING",
     "progress": 100,
     "last_handoff": "2026-11-07T21:00:00Z"
   }
   ```
3. Await Lead Architect review. The specialist must not begin a new task or make further modifications until review is completed or revision instructions are provided.
