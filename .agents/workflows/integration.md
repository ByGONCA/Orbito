# Workflow: Branch Integration and Merge Protocol

## Purpose
Safe integration protocol for merging verified specialist branches into the `master` integration branch.

## Pre-Integration Prerequisites
An item may only enter the integration sequence if:
1. It is registered in `.agents/coordination/INTEGRATION_QUEUE.json`.
2. It has received full Gate 1–4 signoff in `.agents/workflows/code-review.md`.
3. The specialist branch is fully rebased onto current `master`.
4. **Explicit Human Approval has been granted for the merge.** No automated merges are permitted.

## Integration Execution Steps (Lead Architect with Human Authorization)

```mermaid
sequenceDiagram
    autonumber
    actor Human as Human Owner
    actor LA as Lead Architect
    participant Master as master Branch
    participant Spec as Specialist Worktree
    participant Queue as INTEGRATION_QUEUE.json

    LA->>Spec: Verify clean status & rebase against master
    LA->>Human: Present diff, Quality Gate evidence, and request merge authorization
    Human->>LA: Grant explicit merge approval
    LA->>Master: Check out master & verify clean tree
    LA->>Master: Merge specialist branch (atomic fast-forward or squash)
    LA->>Master: Run npm run typecheck & npm test
    LA->>Master: Run npm run validate:coordination
    alt Validation Passes
        LA->>Queue: Mark queue item MERGED
        LA->>Master: Update REGISTRY.json (last_updated, active_tasks)
    else Post-Merge Failure
        LA->>Master: Revert merge immediately
        LA->>Queue: Mark queue item FAILED
        LA->>Spec: Issue blocker report
    end
```

### Post-Integration Synchronization
After merging into `master`:
1. The Lead Architect notifies all active specialists to rebase their worktrees onto the new `master` commit:
   ```bash
   git fetch origin master
   git rebase master
   ```
2. The task specification file is moved to `.agents/coordination/tasks/completed/`.
3. The specialist's `STATUS.json` is reset to `IDLE` (`current_task: null`, `progress: 0`).
