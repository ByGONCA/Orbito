# Rule: Integration Policy & Quality Gates

## 1. Integration Authority & Human Authorization Gate
The Lead Architect is the sole integrator for the Orbito repository. Specialist feature branches are merged into `master` only after passing all four mandatory Quality Gates and receiving explicit human owner authorization.

**Strict Prohibition on Automated Git State Alteration:**
Under no circumstances may any agent (including the Lead Architect) perform:
- Automatic Git merge operations
- Automatic cherry-picks
- Automatic remote pushes
- Automatic branch deletion or pruning
- Automatic worktree removal or recreation
- Automatic conflict resolution

Every integration into `master` requires explicit human review and authorization.

## 2. The Four Quality Gates

```text
┌────────────────┐     ┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│     GATE 1     │     │     GATE 2     │     │     GATE 3     │     │     GATE 4     │
│ TypeScript OK  │ ──> │   All Tests    │ ──> │   Git & Diff   │ ──> │ Lead Architect │
│ (0 type errors)│     │   (0 failures) │     │ Clean Rebase   │     │ Simplicity Sign│
└────────────────┘     └────────────────┘     └────────────────┘     └────────────────┘
```

### Gate 1: Type Integrity
- **Command:** `npm run typecheck`
- **Pass Criteria:** Both `tsconfig.node.json` and `tsconfig.web.json` compile with zero errors. Any `any` cast without explicit justification is rejected.

### Gate 2: Automated Test Suite
- **Command:** `npm test`
- **Pass Criteria:** 100% of test suites pass (Vitest). New business logic, IPC channels, and state stores must include dedicated unit or integration tests. Zero test regressions.

### Gate 3: Git & Conflict Integrity
- **Condition:** Clean rebase onto the latest `master`.
- **Pass Criteria:**
  - Zero merge conflict markers.
  - Zero cross-domain ownership violations against `OWNERSHIP.json`.
  - Zero unauthorized changes to protected shared files.
  - Commit history is clean, atomic, and properly formatted.

### Gate 4: Lead Architect Review & Ponytail Simplicity Audit
- **Review Criteria:**
  - **Ponytail Simplicity Ladder:** Is this the shortest working diff? Has speculative code been pruned?
  - **Anti-Boxiness:** Does the UI strictly comply with Rule 4 in `AGENTS.md` (no boxed pill counts, borderless cards, icon-only toolbars)?
  - **Security & IPC Safety:** Are IPC arguments validated? Is path traversal prevented?
  - **Error Handling:** Are errors caught and logged without crashing the process?

## 3. Rejection Protocol
If any gate fails:
1. The Lead Architect notes the exact failure reasons in `.agents/coordination/reviews/` or task notes.
2. The task status is returned to `IN_PROGRESS` or `BLOCKED`.
3. The specialist is instructed to remediate the defect in its worktree and resubmit via `HANDOFF.md`.
