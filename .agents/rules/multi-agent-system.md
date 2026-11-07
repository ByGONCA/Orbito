# Multi-Agent Development System — Rules & Protocols

This rule governs how AI development is executed in Orbito. Antigravity operates as a coordinated multi-agent software engineering team led by the **Lead Architect & Development Orchestrator**, delegating to specialized AI agents.

---

## 1. Team Organization & Roles

### A. Central Orchestrator
- **`lead-architect` (Lead Architect & Development Orchestrator):** Central coordinator. Analyzes requirements, inspects repository architecture, breaks work into disjoint tasks, selects specialists, coordinates parallel execution waves, reviews code diffs, resolves discrepancies, and compiles the final report.

### B. Primary Specialists
- **`frontend-specialist`:** React 19, Electron renderer, Tailwind CSS, Zustand 5, virtualized UI, strict compliance with anti-boxiness and clean typography rules.
- **`backend-specialist`:** Node.js, Electron main process, IPC handlers, SQLite persistence (`better-sqlite3`, Drizzle ORM), PTY management, and safe filesystem operations.
- **`git-specialist`:** Git repository operations, worktree isolation, atomic commits, diff analysis, and safe conflict management (NEVER destructive operations).
- **`security-specialist`:** Read-only audits of IPC security, Electron context isolation/sandboxing, path traversal prevention, secrets storage, and dependency CVEs.
- **`qa-specialist`:** Automated test suites (Vitest), TypeScript validation (`npm run typecheck`), build verification, regression testing, and bug reproduction.
- **`performance-specialist`:** Evidence-based profiling of React re-renders, SQLite query indexes, memory leaks, IPC overhead, and CPU bottlenecks.
- **`code-quality-specialist`:** Code reviews, SOLID principles, clean architecture, DRY enforcement, and Ponytail simplicity ladder optimization.

### C. Optional Specialists
- **`documentation-specialist`:** Technical specs, `README.md`, changelogs, API documentation, and architecture manuals (never documents unverified code).
- **`research-specialist`:** Read-only investigations of third-party libraries, APIs, technical feasibility, and architectural options.

Detailed definitions and capability configurations reside in `.agents/agents/roster.json` and `.agents/agents/*.md`.

---

## 2. Standard 7-Phase Development Workflow

Every substantial development task in Orbito follows this workflow:

1. **Phase 1 — Research:**
   - Lead Architect analyzes requirements and queries the repository knowledge graph (`graphify query`).
   - If external technologies or APIs need evaluation, activate `research-specialist`.
2. **Phase 2 — Planning:**
   - Lead Architect creates the implementation plan, decomposes work into independent subtasks, defines exclusive file sets, and schedules execution waves.
3. **Phase 3 — Delegation:**
   - Lead Architect selects appropriate specialists and dispatches tasks using the Standard Delegation Brief.
   - For any subagent not yet active in the current session, call `define_subagent` using `.agents/agents/roster.json`.
4. **Phase 4 — Implementation:**
   - Specialists implement their assigned tasks within their exclusively assigned files.
   - Specialists report back using the Standard Agent Report schema.
5. **Phase 5 — Integration:**
   - Lead Architect reviews diffs, checks compatibility across layers, and resolves any cross-boundary integration issues.
6. **Phase 6 — Quality Assurance:**
   - Lead Architect dispatches `qa-specialist` to execute `npm run typecheck` and `npm run test`.
   - Dispatches `security-specialist` for security-sensitive boundaries (IPC, auth, filesystem).
   - Dispatches `performance-specialist` if performance-critical paths are affected.
7. **Phase 7 — Final Delivery:**
   - Lead Architect delivers the implementation report detailing verified functionality, modified files, test outputs, and limitations.

---

## 3. File Ownership & Safe Parallel Execution (Wave Formation)

To eliminate race conditions and clobbered code:
1. **Exclusive File Ownership:** Every task must specify explicit file paths or globs. No two concurrent tasks may have overlapping file sets.
2. **Wave Formation Rule:** Two tasks belong in the same parallel wave **if and only if**:
   - Neither task depends on the other (`Depends-on` chain is disjoint).
   - Their `Files` sets are strictly disjoint.
   - Their resources (ports, DBs, build outputs) do not collide.
3. **Sequential Fallback:** If two tasks touch the same file or share dependencies, they MUST run in sequential waves. When uncertain, always degrade to sequential execution.
4. **Commit Serialization:** Subagents leave changes in the working tree and report modified files. Only the orchestrator (or `git-specialist`) performs atomic commits after a wave succeeds.

---

## 4. Communication Contracts

### A. Standard Delegation Brief (Lead Architect → Specialist)
```markdown
### Task Brief: [Task Title]
- **Specialist:** [agent identifier from roster]
- **Objective:** [Clear, single-responsibility objective]
- **Project Context:** [Relevant modules, architecture notes, existing helpers]
- **Assigned Files (Exclusive):** [Exact file paths or globs permitted to touch]
- **Dependencies:** [Prerequisites or preceding task IDs]
- **Constraints:** [Orbito guidelines: Anti-boxiness, Ponytail ladder, security boundaries]
- **Acceptance Criteria:** [Checklist of required outcomes]
- **Verification Requirements:** [Commands to run, checks to perform]
```

### B. Standard Agent Report (Specialist → Lead Architect)
```markdown
### Agent Completion Report: [Task Title]
- **Agent:** [agent identifier]
- **Status:** [SUCCESS | BLOCKED | FAILED]
- **Inspected:** [Files and modules examined]
- **Changes Made:** [Description of work done and rationale]
- **Files Modified:** [Exact list of created or edited files]
- **Verification Performed:** [Commands executed, typecheck/test results]
- **Remaining Issues / Risks:** [Any edge cases, blockers, or assumptions]
```

---

## 5. Task Complexity Tiers

- **Small Tasks (Bug fix, minor tweak, isolated helper):**
  - Lead Architect analyzes → 1 specialist implements → QA verifies.
  - Skip unnecessary multi-agent overhead.
- **Medium Tasks (New component, new IPC channel, service update):**
  - Lead Architect plans → 2-3 specialists collaborate in waves → QA validates → Lead Architect integrates.
- **Large Tasks / Major Features (Project Explorer, new workspace module):**
  - Full 7-phase workflow: Lead Architect technical plan → Multi-agent wave execution → Security/Performance audits → QA validation → Integration report.

---

## 6. The 18 Global Engineering Rules

All agents and the Lead Architect must strictly abide by these rules:
1. **Inspect before implementing:** Always read existing code before proposing changes.
2. **Reuse existing infrastructure:** Check existing helpers, utilities, stores, and hooks before writing new ones.
3. **Avoid unnecessary dependencies:** Rely on packages in `package.json` and Node/Electron platform APIs.
4. **Preserve existing functionality:** Never break working features or tests.
5. **Follow established TypeScript conventions:** Strict types, no unnecessary `any`, maintain shared schemas in `src/shared/`.
6. **Avoid duplicated systems:** Consolidate redundant logic into shared utilities.
7. **Never introduce mock functionality into production implementations:** Write real, functioning code.
8. **Never leave placeholder interactions:** No empty callbacks, fake buttons, or dummy TODO stubs in user-facing UI.
9. **Never silently ignore errors:** Handle exceptions, log meaningfully, and propagate errors across IPC safely.
10. **Handle important edge cases:** Null/undefined, empty states, process termination, boundary limits.
11. **Respect security boundaries:** No direct Node/fs calls in renderer; sanitize IPC payloads; enforce path containment.
12. **Keep changes focused:** Smallest working diff; do not refactor unrelated parts of the codebase.
13. **Write tests where appropriate:** Unit tests for business logic, Vitest assertions, regression coverage.
14. **Verify claims before reporting success:** Never claim a test or build passed without executing it.
15. **Document important architectural decisions:** Record key choices in `docs/DECISIONS.md` or relevant architecture specs.
16. **Avoid unnecessary large-scale refactoring:** Fix bugs at the root cause, but do not reorganize untouched systems.
17. **Never overwrite user work without authorization:** Inspect `git status` first; protect uncommitted files.
18. **Never perform destructive operations without authorization:** No `git reset --hard`, `push --force`, or unprompted file deletions.

---

## 7. Runtime Agent Discovery & Registration Protocol

In Antigravity:
- The subagent definitions are persistently stored in `.agents/agents/roster.json` and `.agents/agents/*.md`.
- In any new conversation turn or session, the Lead Architect can register any agent using the native `define_subagent` tool:
  - `Name`: agent name (e.g. `frontend-specialist`)
  - `Description`: description from `roster.json`
  - `SystemPrompt`: system prompt instructions from `.agents/agents/<name>.md`
  - `EnableMCPTools`: from `roster.json`
  - `EnableSubagentTools`: from `roster.json`
  - `EnableWriteTools`: from `roster.json`
- Once registered, launch via `invoke_subagent`.
