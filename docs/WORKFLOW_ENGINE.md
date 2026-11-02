# Workflow Execution Engine Specification — AI Workspace

**Phase:** Phase 6 — Visual Automation & Flow Builder  
**Status:** Fully Implemented & Verified in Production  
**Component:** `src/main/workflows/workflow-engine.ts`  

---

## 1. Engine Architecture & Responsibilities

The **WorkflowEngine** converts React Flow visual graphs into deterministic Directed Acyclic Graphs (DAGs) and executes them across bounded worker pools in the Electron Main process:

```
[WorkflowRecord]
       │
       ▼
[WorkflowValidator] ─────────► (Acyclicity via Kahn's algorithm, port type checks, bounds)
       │
       ▼
[Topological Levels] ────────► (Batches of independent nodes executed concurrently)
       │
       ▼
[Node Executor Registry] ────► (Real handlers for AI, Context, Logic, IO, and Dev nodes)
       │
       ├─ Data Mapping ──────► (Source output handle -> Target input handle)
       ├─ Expression Evaluator► (Sandboxed grammar: comparisons, functions, NO eval)
       ├─ Branch Skipping ───► (Prunes unselected conditional branches)
       ├─ Variable Registry ──► (In-memory scoped variable get/set)
       │
       ▼
[Database Persistence] ──────► (Writes execution & node metrics to app.sqlite)
       │
       ▼
[Live IPC Stream] ───────────► (Broadcasts events to Renderer via workflows:event)
```

---

## 2. Graph Validation & Cycle Detection

Prior to execution, `WorkflowValidator.validate(nodes, edges)` asserts:
1. **Connectivity**: All edges reference valid source and target nodes that exist in the workflow.
2. **Cycle Prevention**: Employs **Kahn's Algorithm** to compute in-degrees and verify acyclicity. Cyclic graphs are rejected with informative error messages listing the involved nodes.
3. **Topological Level Batches**: Groups nodes into parallel execution tiers (`levels: string[][]`). Nodes in the same tier have no interdependencies and execute concurrently.
4. **Port Type Compatibility**: Compares output and input data types (`string`, `number`, `boolean`, `file_ref`, `json`, `agent_result`, `any`), logging warnings on severe mismatches.
5. **Safety Constraints**: Clamps loops to a maximum of 50 iterations and delays to 60,000ms.

---

## 3. Dataflow & Branching Semantics

### 3.1 Parameter Mapping
- When an edge connects `sourceNode.outputHandle` to `targetNode.inputHandle`, the engine extracts the source node's output value and maps it directly into `inputs[targetHandle]`.
- Nodes with multiple incoming edges combine their inputs.

### 3.2 Conditional Pruning & Skipping
- Nodes such as `condition` and `switch` return `selectedBranch` (e.g. `'true'` or `'false'`).
- The engine marks all target nodes connected to non-selected handles as `skipped`.
- Skipped statuses cascade down dependent downstream branches unless rejoined by a `merge` node.
- Skipped nodes consume 0 milliseconds of execution time and emit `node_skipped` events.

### 3.3 Sandboxed Expression Evaluator
- `ExpressionEvaluator.evaluate(expr, context)` evaluates boolean routing without `eval()` or `Function()` constructors.
- Supported operations:
  - Equality and ordering: `==`, `!=`, `<`, `<=`, `>`, `>=`
  - Logical connectors: `&&`, `||`, `!`
  - Property navigation: `result.exitCode == 0`, `output.passed == true`
  - Built-in helpers: `contains(str, substr)`, `startsWith(str, prefix)`, `length(list_or_str)`, `isEmpty(val)`

---

## 4. Trigger Management & Automation

The `WorkflowTriggerManager` provides event-driven and scheduled automation without polling loops:
- `manual`: On-demand trigger from user UI or API.
- `app_startup`: Fires once after the application shell is initialized.
- `file_change`: Monitors project filesystem with recursive debounce (`debounceSeconds`, default 5s) and automatic ignoring of `.git`, `node_modules`, and `.worktrees`.
- `git_event`: Triggered on local commits, branch switches, or worktree merges.
- `scheduled`: Timezone-aware interval timers (minimum 1 minute) persisted across sessions.
- **Event Deduplication**: Memory cache prevents rapid-fire identical triggers from triggering duplicate executions.

---

## 5. Persistence & Crash Recovery

All workflow data resides in `app.sqlite`:
- `workflows`: Graph structure, node positions, port configs, and variables.
- `workflow_versions`: Version snapshots capturing history.
- `workflow_executions`: Run duration, trigger type, root inputs, root outputs, final status.
- `workflow_node_executions`: Per-node duration, inputs, outputs, error messages.
- **Crash Recovery**: `recoverWorkflowExecutionsOnStartup()` transitions any execution left in `'running'` during an abrupt crash into `'failed'`, recording an explicit diagnostic note.
