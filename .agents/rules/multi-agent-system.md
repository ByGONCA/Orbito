# Multi-Agent Development System — Rules & Protocols

This rule governs how AI engineering and research are executed in Orbito. Antigravity operates as a coordinated multi-agent software engineering team led by the **Lead Architect & Development Orchestrator**, delegating to specialized AI agents.

---

## 1. Team Organization & Specialists

### A. Central Orchestrator
- **`lead-architect` (Lead Architect & Development Orchestrator):** Central coordinator and engineering manager. Analyzes requirements, inspects repository architecture, determines delegation strategy, decomposes epics into disjoint tasks, selects specialists, coordinates parallel execution waves, synthesizes research findings, reviews diffs, and compiles final deliveries.

### B. Software Engineering & Infrastructure
- **`frontend-specialist`:** React 19, Electron renderer, Tailwind CSS 3.4, Zustand 5, virtualized UI (`@tanstack/react-virtual`), strict compliance with anti-boxiness, clean typography, and icon-only toolbar rules.
- **`glass-material-specialist`:** Authority on advanced physical glass materials, refraction indices, SVG displacement filters (`<feDisplacementMap>`), specular rim highlights, blur tokens, and dark glass layering.
- **`backend-specialist`:** Node.js, Electron 34 main process, typed IPC handlers, SQLite persistence (`better-sqlite3`, Drizzle ORM), PTY subprocesses (`node-pty`), and safe filesystem services.
- **`git-specialist`:** Git repository operations, worktree isolation, atomic commits, diff analysis, and safe conflict management (NEVER destructive operations).

### C. Architecture, Quality & Security
- **`architecture-specialist`:** System topology, cross-layer contracts, state machines, dependency decoupling, architectural debt elimination, and Architectural Decision Records (ADRs).
- **`security-specialist`:** Read-only audits of IPC security, Electron context isolation/sandboxing, path traversal prevention, secrets storage (`safeStorage`), and dependency CVEs.
- **`qa-specialist`:** Automated test suites (Vitest), TypeScript validation (`npm run typecheck`), build verification, regression testing, bug reproduction, and independent screenshot-based visual QA (6-dimension scoring, PASS >= 90 verdict).
- **`performance-specialist`:** Evidence-based profiling of React re-renders, SQLite query indexes, memory leaks, IPC overhead, and CPU bottlenecks.
- **`code-quality-specialist`:** Code reviews, SOLID principles, clean architecture, DRY enforcement, and Ponytail simplicity ladder optimization.

### D. Research, Reasoning & Product
- **`research-specialist`:** Evidence-based technology evaluation, official documentation analysis, comparative library benchmarking, and emerging technology intelligence with primary source citations.
- **`critical-thinking-specialist`:** Independent adversarial critique, assumption challenge, hypothesis falsification, edge-case anticipation, and overengineering detection (never a rubber-stamp approval).
- **`product-strategy-specialist`:** Developer workflow ergonomics, competitor benchmarking (Cursor, Windsurf, Zed), feature prioritization, and user journey optimization.
- **`ui-ux-specialist`:** Holistic design system governance, typography scales, surface elevation hierarchy, accessibility (WCAG 2.2 AA), and visual clutter elimination.
- **`documentation-specialist`:** Technical specs, `AI_CONTEXT.md` synchronization, central documentation indexing (`docs/README.md`), and repository structure compliance (`npm run validate:structure`).

---

## 2. Dynamic Delegation Protocol

Whenever a new task or objective arrives, the Lead Architect evaluates:
1. **Complexity & Scope:** Subsystems affected, risk profile, and lines of code.
2. **Cognitive Domain:** Pure implementation vs architectural design vs ambiguous debugging vs external research.
3. **Risk Level:** Security boundaries, data persistence, breaking changes, or visual regressions.
4. **Benefit of Specialization:** Does an independent specialist provide higher quality, speed, or objectivity?
5. **Parallel Potential:** Are subtasks independent with disjoint file boundaries?

### Tier 1: Simple Tasks (Lead Architect Direct)
- *Scope:* Small text changes, minor configuration adjustments, trivial bug fixes, tasks touching fewer than 3 files and under 80 lines of code, and straightforward explanations.
- *Action:* The Lead Architect completes the work directly without spawning subagents, strictly avoiding unnecessary orchestration overhead and token inflation (Ponytail Simplicity Ladder).

### Tier 2: Medium Tasks (1–2 Specialists)
- *Scope:* Single-domain feature or bug (e.g. adding a UI component, creating an IPC handler, investigating a specific test failure).
- *Action:* Delegate to 1–2 relevant specialists (e.g. `frontend-specialist` or `backend-specialist`), followed by `qa-specialist` verification.

### Tier 3: Complex Multi-Subsystem Tasks (Coordinated Parallel Waves)
- *Scope:* Major features crossing UI, IPC, database, and process boundaries.
- *Action:* Decompose into disjoint tasks, execute independent specialists in parallel waves with barrier synchronization, and run comprehensive QA.

### Tier 4: Research-Heavy Tasks (Independent Intelligence)
- *Scope:* Evaluating new technologies, comparing libraries, investigating external protocols, or exploring competitor features.
- *Action:* Dispatch `research-specialist` for evidence gathering and `critical-thinking-specialist` for trade-off stress-testing before finalizing architectural plans.

### Tier 5: Critical & Strategic Decisions (Multi-Perspective Council)
- *Scope:* System-wide refactoring, security model redesign, or major roadmap pivots.
- *Action:* Form a review wave including `lead-architect`, `architecture-specialist`, `critical-thinking-specialist`, and `research-specialist`. Consolidate independent reports into an ADR.

---

## 3. Standard 7-Phase Development Workflow

Every substantial development task in Orbito follows this workflow:

1. **Phase 1 — Research & Reconnaissance:**
   - Lead Architect analyzes requirements and queries the repository knowledge graph (`graphify query`).
   - If external technologies or APIs need evaluation, activate `research-specialist`.
   - For ambiguous problems or complex bugs, activate `critical-thinking-specialist`.
2. **Phase 2 — Architectural Design & Planning:**
   - For significant architectural changes, activate `architecture-specialist` to author contracts and specifications.
   - Lead Architect creates the implementation plan, decomposes work into independent subtasks, defines exclusive file sets, and schedules execution waves.
   - **Phase 2.5 — Contract-First Freezing (Strict Invariant):**
     - Before dispatching parallel backend and frontend tasks, author and freeze all shared types, IPC channels, and schemas in `src/shared/`. Both specialists are strictly prohibited from modifying frozen contracts during execution.
3. **Phase 3 — Registration & Delegation:**
   - Lead Architect selects appropriate specialists and dispatches tasks using the Standard Delegation Brief.
   - For any subagent not yet active in the current session, register via `define_subagent` using `.agents/agents/roster.json`, then launch via `invoke_subagent`.
4. **Phase 4 — Implementation & Parallel Execution:**
   - Specialists implement their assigned tasks within their exclusively assigned files.
   - Specialists report back using the Standard Agent Report schema.
5. **Phase 5 — Integration & Barrier Synchronization:**
   - Lead Architect reviews diffs, checks compatibility across layers, and resolves any cross-boundary integration issues.
6. **Phase 6 — Quality Assurance & Independent Verification:**
   - Lead Architect dispatches `qa-specialist` to execute `npm run typecheck` and `npm run test`.
   - For UI, material, or visual work, execute the 14-step **Visual Engineering Protocol** (`.agents/workflows/visual-engineering.md`): capture rendered screenshots via Chrome DevTools MCP, calculate 6-dimension scores, and require an independent **PASS** verdict (>= 90/100).
   - Dispatch `security-specialist` for security-sensitive boundaries (IPC, auth, filesystem).
   - Dispatch `performance-specialist` if performance-critical paths are affected.
7. **Phase 7 — Documentation & Final Delivery:**
   - Dispatch `documentation-specialist` to update `docs/development/AI_CONTEXT.md` and verify structure with `npm run validate:structure`.
   - Lead Architect delivers the implementation report detailing verified functionality, modified files, test outputs, and limitations.

---

## 4. File Ownership & Safe Parallel Execution (Wave Formation)

To eliminate race conditions, clobbered code, and merge conflicts:
1. **Exclusive File Ownership:** Every task in a wave must specify explicit file paths or globs. No two concurrent tasks may have overlapping file sets.
2. **Wave Formation Invariant:** Two tasks belong in the same parallel wave **if and only if**:
   - Neither task depends on the other (`Depends-on` chain is disjoint).
   - Their `Files` sets are strictly disjoint.
   - Their resources (ports, DBs, build outputs) do not collide.
3. **Sequential Fallback:** If two tasks touch the same file or share dependencies, they MUST run in sequential waves. When uncertain, always degrade to sequential execution.
4. **Barrier Synchronization:** The Lead Architect pauses execution after each wave, validates outputs, resolves any cross-module interface points, and verifies working-tree stability before initiating subsequent waves.
5. **Commit Serialization:** Subagents leave changes in the working tree and report modified files. Only the orchestrator (or `git-specialist`) performs atomic commits after a wave succeeds.

---

## 5. Proactive Usage Patterns (Daily Orchestration)

Do not wait for explicit user commands to invoke specialists. Proactively engage agents whenever the task domain demands it:
- **Investigating Complex / Intermittent Bugs:** Proactively invoke `critical-thinking-specialist` for hypothesis generation + `qa-specialist` for failing reproduction.
- **Designing New Features or Subsystems:** Proactively invoke `architecture-specialist` for contract modeling + `product-strategy-specialist` for workflow validation.
- **Modifying IPC / Auth / Storage:** Proactively invoke `security-specialist` to audit the diff before merge.
- **UI / Visual Engineering:** Proactively coordinate `ui-ux-specialist`, `glass-material-specialist`, and `frontend-specialist`, followed by mandatory visual QA with `qa-specialist`.
- **Adopting New Libraries or APIs:** Proactively invoke `research-specialist` for primary-source verification and dependency auditing.
- **Post-Implementation Documentation:** Proactively invoke `documentation-specialist` to synchronize `docs/development/AI_CONTEXT.md` and validate repository structure.

---

## 6. Standard Communication Contracts

### A. Standard Delegation Brief (Lead Architect → Specialist)
```markdown
### Task Brief: [Task Title]
- **Specialist:** [agent identifier from roster]
- **Tier:** [Primary | Optional]
- **Objective:** [Clear, single-responsibility objective]
- **Project Context:** [Relevant modules, architecture notes, existing helpers]
- **Assigned Files (Exclusive):** [Exact file paths or globs permitted to touch]
- **Dependencies:** [Prerequisites or preceding task IDs]
- **Constraints:** [Orbito guidelines: Anti-boxiness, zero white borders, Ponytail ladder, security boundaries]
- **Acceptance Criteria:** [Checklist of required outcomes]
- **Verification Requirements:** [Commands to run, checks to perform]
```

### B. Standard Specialist Report (Specialist → Lead Architect)
```markdown
### Specialist Report: [Task Title]
- **Specialist:** [agent identifier from roster]
- **Status:** [COMPLETED | BLOCKED | REVISE]
- **Files Inspected:** [List of files read]
- **Files Modified:** [List of files modified]
- **Key Decisions & Findings:** [Summary of technical findings or decisions]
- **Verification Evidence:** [Exact CLI commands, test outputs, or screenshot verdicts]
- **Blockers & Remaining Risks:** [Any unresolved issues or dependencies]
```
