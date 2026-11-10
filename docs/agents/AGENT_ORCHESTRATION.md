# Multi-Agent Orchestration Architecture & Implementation — AI Workspace

**Phase:** Phase 5 — Multi-Agent Orchestration  
**Status:** Fully Implemented, Integrated & Verified in Production  
**Version:** 1.5.0  

> [!NOTE]
> **Implementation Complete:** Phase 5 is fully realized with real subprocess execution via `ExecutionEngine`, real Git worktree sandboxing via `WorktreeManager`, independent automated verification via `ReviewerAgent`, DAG dependency scheduling via `AgentScheduler`, persistent SQLite storage in `app.sqlite`, and a dedicated `AgentsWorkspace.tsx` dashboard. Zero superficial UI mocks.

---

## 1. Vision & Core Problem Statement

Current AI coding tools typically run as a single sequential loop: one prompt, one response, one active file edit. When tackling complex epics—such as migrating a database, adding OAuth2 authentication, or refactoring an entire submodule—this monolithic paradigm fails due to:
1. **Context Window Contamination**: Single agents get overwhelmed by hundreds of files, leading to hallucinations.
2. **File Race Conditions**: Two concurrent tasks editing the same working directory corrupt each other's changes.
3. **Lack of Critical Verification**: An agent reviewing its own code suffers from severe cognitive bias (blind spots).

AI Workspace solves this via **Multi-Agent Orchestration**: a team of specialized agents operating across isolated **Git Worktrees**, governed by a deterministic **Coordinator DAG** and verified by an adversarial **Reviewer Agent**.

---

## 2. High-Level Orchestration Architecture

```
                                  [ USER GOAL / EPIC ]
                                           │
                                           ▼
                            +-------------------------------+
                            |       COORDINATOR AGENT       |
                            | - Decomposes task into subtasks|
                            | - Compiles Directed Acyclic   |
                            |   Graph (DAG) with dependencies|
                            +-------------------------------+
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
              [Task 1: Spec & Schema]                [Task 2: UI Wireframe]
                        │                                     │
                        ▼                                     ▼
             Worker 1 (Arch Agent)                  Worker 2 (Frontend Agent)
           +-----------------------+              +-----------------------+
           | Git Worktree:         |              | Git Worktree:         |
           | `.worktrees/wt-task-1`|              | `.worktrees/wt-task-2`|
           | Branch: `agent/task-1`|              | Branch: `agent/task-2`|
           +-----------------------+              +-----------------------+
                        │                                     │
                        └──────────────────┬──────────────────┘
                                           ▼
                                [Task 3: Backend Logic]
                                           │
                                           ▼
                               Worker 3 (Backend Agent)
                             +---------------------------+
                             | Git Worktree:             |
                             | `.worktrees/wt-task-3`    |
                             | Branch: `agent/task-3`    |
                             +---------------------------+
                                           │
                                           ▼
                            +-------------------------------+
                            |        REVIEWER AGENT         |
                            | - Runs Automated Test Suite   |
                            | - Static Security & OWASP Scan|
                            | - Compares Diff against Spec  |
                            +-------------------------------+
                                           │
                                           ├──────────────┐
                                [PASSED]   │              │ [FAILED]
                                           ▼              ▼
                            +--------------------+  +--------------------+
                            | USER APPROVAL GATE |  | REMEDIATION LOOP   |
                            | Side-by-side diff  |  | Returns to worker  |
                            | One-click merge    |  | with exact failures|
                            +--------------------+  +--------------------+
```

---

## 3. Coordinator DAG (Directed Acyclic Graph)

The Coordinator compiles user requests into an execution graph where nodes represent discrete tasks and edges represent prerequisite dependencies.

### 3.1 Node Structure
```typescript
export interface DAGNode {
  id: string; // e.g. "task-db-migration"
  title: string;
  role: 'architect' | 'backend' | 'frontend' | 'test-engineer' | 'security';
  skillsRequired: string[]; // e.g. ["refactoring", "test-generation"]
  dependencies: string[]; // e.g. ["task-schema-spec"]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  worktreePath?: string;
  branchName?: string;
  timeoutMs: number;
  retryCount: number;
  outputArtifacts?: string[];
}
```

### 3.2 Topological Scheduling
1. **Ready Queue**: All nodes with in-degree 0 (no uncompleted dependencies) are pushed to the worker execution pool.
2. **Concurrency Ceiling**: Max 3 concurrent worker processes to maintain system responsiveness and respect CPU/RAM thresholds (< 500 MB RAM per active worker).
3. **Failure Cascades**: If a prerequisite node fails after max retries, downstream dependent nodes transition to `blocked`.

---

## 4. Specialist Agent Roles & Personas

Rather than generic prompts, each worker is instantiated with a dedicated persona and bound skills:

| Role | Core Purpose | Bound Built-in Skills | Write Authority |
|---|---|---|---|
| **Architect Agent** | Requirements analysis, contract definition, database schemas | `project-understanding`, `code-explanation` | Docs, Interfaces, Schemas |
| **Backend Agent** | Server logic, services, database repositories, API endpoints | `refactoring`, `bug-fixing`, `performance-analysis` | Backend source modules |
| **Frontend Agent** | React components, UI styling, user workflows, client state | `refactoring`, `code-review` | Renderer source modules |
| **Test Engineer Agent** | Unit tests, mock suites, integration tests, fuzzing | `test-generation`, `bug-investigation` | Test files (`tests/**`) |
| **Reviewer Agent** | Objective verification, adversarial code review, diff audit | `code-review`, `security-review` | Read-only (Zero file writes) |

---

## 5. Git Worktree Isolation Architecture

To enable multiple agents to edit code concurrently without merge conflicts or dirty working tree corruption:

### 5.1 Worktree Lifecycle
1. **Creation**:
   ```bash
   git worktree add -b agent/task-<id> .worktrees/wt-task-<id> main
   ```
2. **Execution**:
   The specialist agent's CLI session is spawned with `workingDirectory: path.join(projectPath, '.worktrees', 'wt-task-<id>')`.
3. **Commit**:
   When the worker completes its task, changes are staged and committed in the task branch:
   ```bash
   git add -A
   git commit -m "feat(agent): task <id> implementation"
   ```
4. **Merge Assessment**:
   Coordinator attempts an automated merge or flags three-way merge conflicts.
5. **Teardown & Cleanup**:
   Upon task completion and merge (or user cancellation), worktrees are removed:
   ```bash
   git worktree remove --force .worktrees/wt-task-<id>
   git branch -D agent/task-<id> # if rejected
   ```

---

## 6. Reviewer Agent & Quality Gates

The **Reviewer Agent** is the gatekeeper between agent execution and the user's codebase:

1. **Test Verification**: Executes test runner in the worktree (`npm test`). If any test fails, the task is rejected immediately.
2. **Static Defect & Security Audit**: Runs `code-review` and `security-review` skills over the git diff (`git diff main...HEAD`).
3. **Spec Alignment Assertion**: Verifies that every acceptance criterion requested by the user was fulfilled.
4. **Remediation Loop**:
   If rejected, feedback is fed back into the worker agent with exact line numbers and failed assertions (maximum 2 remediation attempts before escalating to user).

---

## 7. Permission Tiers & Human-in-the-Loop Safeguards

| Tier | Autonomy Level | Capabilities | Human Approval Required? |
|---|---|---|---|
| **Tier 1 (Observer)** | Read-Only | AST indexing, symbol lookup, read files | No |
| **Tier 2 (Supervised Worker)** | Worktree Workspace | Create files, edit code within isolated worktree | No (isolated in branch) |
| **Tier 3 (Merge & System)** | Host Integration | Merging worktree to `main`, installing npm dependencies, executing terminal scripts | **YES** (Interactive Modal with visual diff) |

---

## 8. Failure Handling & Cancellation

- **Process Watchdogs**: Each agent process is tracked by `activeSessions` with dedicated timeout timers.
- **Cascading Cancel**: Cancelling a parent node in the DAG immediately sends `SIGTERM`/`taskkill` to all active worker processes and recursively cancels pending subtasks.
- **Resource Recovery**: `git worktree prune` and directory deletion ensure zero orphaned disk state or dangling Git locks (`index.lock`).

---

## 9. Implemented Component Inventory

| Component | Source File | Responsibilities |
|---|---|---|
| `AgentOrchestrator` | `src/main/agents/agent-orchestrator.ts` | Central orchestration lifecycle facade, IPC bridging, startup crash recovery. |
| `CoordinatorAgent` | `src/main/agents/coordinator-agent.ts` | Decomposes goals into a structured DAG of specialized tasks. |
| `DAGValidator` | `src/main/agents/dag-validator.ts` | Validates graph acyclicity (Kahn's algorithm), dependencies, and state machine transitions. |
| `AgentScheduler` | `src/main/agents/agent-scheduler.ts` | Concurrency-bounded task scheduler (max 3 workers), failure cascading, dependency triggers. |
| `AgentWorker` | `src/main/agents/agent-worker.ts` | Executes tasks with persona prompts and bound skills in isolated Git worktrees. |
| `ReviewerAgent` | `src/main/agents/reviewer-agent.ts` | Independent verification gate: runs typecheck, test suites, and evaluates criteria. |
| `WorktreeManager` | `src/main/agents/worktree-manager.ts` | Manages real Git worktrees: add, diff, check file overlap, commit, merge, teardown. |
| `SpecialistRoles` | `src/main/agents/specialist-roles.ts` | Defines 6 specialist personas + Coordinator and Reviewer system instructions. |
| `AgentsWorkspace` | `src/renderer/src/components/AgentsWorkspace.tsx` | UI dashboard: Visual DAG, Agent Monitor, Approval Center, Run History. |

---

## 10. IPC API & Event Contracts

The Multi-Agent Orchestration subsystem exposes the following strongly-typed IPC channels:

### 10.1 Invocations (`window.api`)
- `agents:startOrchestration`: Decomposes goal and begins DAG scheduling in chosen execution mode.
- `agents:cancelOrchestration`: Recursively terminates all running processes and cleans worktrees.
- `agents:getOrchestration`: Retrieves full DAG state, active tasks, and status.
- `agents:listOrchestrations`: Lists recent orchestration runs for the active project.
- `agents:resolveApproval`: Approves or rejects a pending human gate with optional remediation feedback.
- `agents:getPendingApprovals`: Retrieves all unreviewed diffs or approval requests.

### 10.2 Live Broadcast Events (`agents:event`)
- `orchestration_started`, `orchestration_completed`, `orchestration_failed`, `orchestration_cancelled`
- `task_scheduled`, `task_started`, `task_output`, `task_reviewing`, `task_completed`, `task_failed`, `task_blocked`
- `approval_requested`, `approval_resolved`
- `worktree_created`, `worktree_merged`, `worktree_removed`

---

## 11. Verification & Automated Test Coverage

The multi-agent orchestration architecture is verified by 6 dedicated test suites:
1. `tests/agents-dag-validator.test.ts` (Cycle detection, valid DAGs, topological level assignment, status transitions).
2. `tests/agents-worktree-manager.test.ts` (Worktree lifecycle, diff extraction, merge, safe deletion).
3. `tests/agents-scheduler.test.ts` (Topological scheduling, bounded concurrency, dependency progression).
4. `tests/agents-reviewer-gate.test.ts` (Automated review, criteria assessment, remediation loops).
5. `tests/agents-state-persistence.test.ts` (SQLite schema persistence, task updates, crash recovery).
6. `tests/agents-orchestrator-integration.test.ts` (End-to-end orchestration lifecycle, event streaming, cancellation).
