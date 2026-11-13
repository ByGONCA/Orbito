---
name: orchestrate
description: Dynamic multi-agent planning, delegation, parallel execution, and verification workflow for Orbito
---

# Multi-Agent Dynamic Orchestration Workflow

Follow this procedure to plan, delegate, execute, and verify tasks across the Orbito multi-agent engineering and research ecosystem.

---

## Phase 1: Intake, Triage & Reconnaissance
1. **Understand Intent & Scope:**
   - Read the incoming task, feature, or bug report thoroughly.
   - Query the codebase knowledge graph:
     `graphify query "<feature, module or architectural question>"`
   - Inspect active git status to ensure working tree safety and zero interference with parallel operations.
2. **Evaluate Delegation Tier:**
   - **Tier 1 (Simple):** Text changes, trivial bug fixes, small config tweaks.
     → *Action:* Lead Architect executes directly.
   - **Tier 2 (Medium):** Single-domain feature or bug (UI component, backend service, test fix).
     → *Action:* Dispatch to 1–2 specialists (`frontend-specialist`, `backend-specialist`, `qa-specialist`).
   - **Tier 3 (Complex):** Cross-subsystem features (UI + IPC + Database + Main process).
     → *Action:* Formulate disjoint parallel wave execution plan.
   - **Tier 4 (Research-Heavy):** Investigating new libraries, external APIs, or competitor features.
     → *Action:* Dispatch `research-specialist` and `critical-thinking-specialist` for evidence gathering before coding.
   - **Tier 5 (Critical Decision):** System-wide refactorings, security model changes, or major architecture shifts.
     → *Action:* Convene Council (`lead-architect`, `architecture-specialist`, `critical-thinking-specialist`, `research-specialist`).

---

## Phase 2: Planning & Wave Formation (For Tiers 2–5)
1. **Decompose the Epic:**
   - Break the objective into single-responsibility, bounded subtasks.
2. **Define Ownership & File Sets:**
   - For every subtask, designate:
     - `Specialist`: [from `.agents/agents/roster.json`]
     - `Assigned Files`: [strictly disjoint file paths or globs]
     - `Depends-on`: [preceding task IDs]
3. **Contract-First Freezing (Phase 2.5):**
   - Before launching parallel backend/frontend waves, author and freeze shared IPC contracts and interfaces in `src/shared/`. Concurrent specialists consume frozen contracts and must never modify shared types independently.
4. **Form Parallel Waves:**
   - **Wave Formation Invariant:** Two tasks belong in the same parallel wave **if and only if**:
     1. Neither depends on the other (`Depends-on` chain is disjoint).
     2. Their `Files` sets are strictly disjoint (no overlapping files or globs).
     3. Their runtime resources (ports, DB locks, build outputs) do not collide.
   - If tasks share files or have sequential dependencies, serialize them into consecutive waves.

---

## Phase 3: Registration & Subagent Dispatch
1. **Runtime Subagent Check:**
   - Check if the designated specialist is already registered in the active session.
   - If not yet defined, register the agent via `define_subagent` using the specification from `.agents/agents/roster.json`.
2. **Dispatch Delegation Brief:**
   - Launch the subagent via `invoke_subagent` using the Standard Delegation Brief schema:
     ```markdown
     ### Task Brief: [Task Title]
     - **Specialist:** [specialist identifier]
     - **Objective:** [single-responsibility goal]
     - **Project Context:** [relevant files, existing helpers, conventions]
     - **Assigned Files:** [exclusive paths/globs]
     - **Constraints:** [Orbito rules: Anti-boxiness, zero white borders, Ponytail ladder]
     - **Acceptance Criteria:** [measurable outcomes]
     - **Verification Requirements:** [exact test commands]
     ```

---

## Phase 4: Specialist Execution
1. The specialist works within its assigned files and scope.
2. The specialist runs verification commands relevant to its domain (`npm run typecheck`, unit tests, etc.).
3. The specialist produces a structured report adhering to the Standard Specialist Report schema.

---

## Phase 5: Integration & Barrier Synchronization
1. **Lead Architect Review:**
   - Pause execution at the wave boundary.
   - Inspect diffs produced by all specialists in the wave.
   - Verify that no specialist touched files outside its assigned boundary.
   - Resolve any contract mismatches or cross-boundary integration issues.
2. **Working Tree Stability:**
   - Confirm TypeScript typechecks pass cleanly (`npm run typecheck`).

---

## Phase 6: Independent QA, Security & Visual Verification
1. **Automated Testing:**
   - Dispatch `qa-specialist` to run automated test suites (`npm run test` or `npm run test:host`) and type checks (`npm run typecheck`).
2. **Visual QA Gate (For UI/Visual Work):**
   - For any frontend, UI, or glass material change, enforce the 14-step Visual Engineering Protocol.
   - Capture rendered screenshots via Chrome DevTools MCP.
   - Calculate 6-dimension scores. Require independent **PASS** verdict (>= 90/100).
3. **Security Audit Gate (For Sensitive Changes):**
   - For IPC, auth, storage, or filesystem changes, dispatch `security-specialist` for read-only audit.

---

## Phase 7: Knowledge Sync & Final Delivery
1. **Documentation Synchronization:**
   - Dispatch `documentation-specialist` to update `docs/development/AI_CONTEXT.md` and `docs/README.md`.
   - Run `npm run validate:structure` to ensure zero misplaced documents.
2. **Final Delivery Report:**
   - Lead Architect delivers comprehensive report including:
     - Verified functionality.
     - Files modified.
     - Exact test and QA outputs.
     - Known limitations or follow-up items.
