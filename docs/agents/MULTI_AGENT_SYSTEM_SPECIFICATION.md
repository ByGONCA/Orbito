# Orbito Multi-Agent Engineering & Research System — Specification

**Version:** 2.0.0  
**Status:** Implemented & Operationally Active  
**Governance:** Lead Architect & Development Orchestrator  
**Applicability:** All technical implementation, software architecture, technical reasoning, product research, security, QA, and documentation activities in Orbito.

---

## 1. Executive Summary & Vision

Orbito operates as an integrated multi-agent software engineering and research organization. The Lead Architect functions as engineering manager and chief architect, orchestrating a squad of 14 specialized agents across software engineering, cognitive reasoning, product strategy, design systems, security, and quality assurance.

The system is designed for **continuous collaboration**: the Lead Architect proactively delegates work to specialized subagents whenever specialization provides higher velocity, greater analytical rigor, or objective verification.

```
                                  [ INCOMING TASK / GOAL ]
                                             │
                                             ▼
                             +-------------------------------+
                             |        LEAD ARCHITECT         |
                             |   Reconnaissance & Triage     |
                             |   Dynamic Delegation Tier     |
                             +-------------------------------+
                                             │
      ┌──────────────────┬───────────────────┼───────────────────┬──────────────────┐
      ▼                  ▼                   ▼                   ▼                  ▼
[Tier 1: Simple]  [Tier 2: Medium]   [Tier 3: Complex]   [Tier 4: Research] [Tier 5: Council]
  Lead Direct      1-2 Specialists    Parallel Wave Plan  Evidence Gathering  Multi-Agent ADR
                   (Frontend/Back)    (Disjoint Files)    (Research+Critical) (Lead+Arch+Crit)
                         │                   │                   │                  │
                         └───────────────────┼───────────────────┴──────────────────┘
                                             ▼
                             +-------------------------------+
                             |    BARRIER SYNCHRONIZATION    |
                             |  Review Diffs & Boundaries    |
                             +-------------------------------+
                                             │
                                             ▼
                             +-------------------------------+
                             |     INDEPENDENT QA GATE       |
                             | - Vitest / tsc Validation     |
                             | - Visual QA Score (PASS >= 90)|
                             | - Security & Sandbox Audit    |
                             +-------------------------------+
                                             │
                                             ▼
                             +-------------------------------+
                             |   KNOWLEDGE & CONTEXT SYNC    |
                             | - Sync docs/AI_CONTEXT.md     |
                             | - validate:structure Check    |
                             +-------------------------------+
```

---

## 2. Agent Roster & Capability Matrix

The system comprises 1 Orchestrator and 14 Specialized Agents. Tool permissions follow the principle of **least privilege**:

| Identifier | Display Name | Domain | Tools Configuration | Primary Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| `lead-architect` | Lead Architect & Orchestrator | Coordination | Subagent, MCP, Write | Task decomposition, dynamic delegation, parallel wave planning, integration, final sign-off. |
| `frontend-specialist` | Frontend Specialist | Engineering | MCP, Write | React 19, Tailwind CSS, Zustand stores, virtualized lists, anti-boxiness, icon-only toolbars. |
| `glass-material-specialist` | Glass Material Specialist | Engineering | MCP, Write | Optical physics, refraction indices, SVG displacement maps, blur tokens, rim highlights. |
| `backend-specialist` | Backend & Infra Specialist | Engineering | Write | Electron 34 main process, typed IPC handlers, SQLite / Drizzle ORM, PTY subprocesses, filesystem. |
| `git-specialist` | Git & Version Specialist | Engineering | Write | Worktree sandboxing, atomic commits, diff analysis, conflict prevention (zero destructive commands). |
| `architecture-specialist` | Software Architecture Specialist | Architecture | Write (Docs/ADRs) | System topology, cross-layer contracts, state machines, dependency decoupling, ADR authoring. |
| `critical-thinking-specialist`| Critical Thinking Specialist | Reasoning | Read-only | Adversarial analysis, assumption challenge, hypothesis testing, anti-overengineering, devil's advocate. |
| `research-specialist` | Research & Intelligence Specialist | Research | MCP, Write (Docs) | Technology evaluation, official documentation analysis, library benchmarking, emerging tech radar. |
| `product-strategy-specialist` | Product Strategy Specialist | Product | Write (Specs) | Developer velocity, workflow ergonomics, competitor benchmarking (Cursor, Windsurf, Zed), feature pruning. |
| `ui-ux-specialist` | UI/UX & Design Systems Specialist | Design | MCP, Write (Docs) | Design system governance, spatial hierarchy, typography scales, accessibility (WCAG 2.2 AA), zero white borders. |
| `security-specialist` | Security Specialist | Security | Read-only | IPC security, Electron sandboxing, path traversal prevention, secrets protection (`safeStorage`). |
| `qa-specialist` | QA & Visual Testing Specialist | Quality | MCP, Write | Vitest test suites, `tsc` compilation checks, screenshot-based visual QA (6-dimension score >= 90). |
| `performance-specialist` | Performance Specialist | Optimization | Write | CPU/memory profiling, React re-renders, DB query execution plans, IPC throughput optimization. |
| `code-quality-specialist` | Code Quality Specialist | Quality | Write | SOLID principles, DRY enforcement, Ponytail simplicity ladder, localized clean code refactoring. |
| `documentation-specialist` | Documentation Specialist | Knowledge | Write | Technical specs, `AI_CONTEXT.md` synchronization, central documentation indexing (`docs/README.md`). |

---

## 3. Dynamic Delegation Tiers

The Lead Architect triages every incoming task into one of five operational tiers:

### Tier 1: Simple Tasks (Lead Direct)
- **Scope:** Minor text changes, trivial bug fixes, small configuration adjustments, quick explanations.
- **Protocol:** Executed directly by the Lead Architect without spawning subagents. Eliminates context-switching overhead and orchestration latency.

### Tier 2: Medium Tasks (1–2 Specialists)
- **Scope:** Single-domain feature or bug (e.g., creating a React component, registering an IPC channel, fixing an isolated test failure).
- **Protocol:** Lead Architect dispatches the task to the designated specialist, receives the specialist report, reviews the diff, and runs QA.

### Tier 3: Complex Multi-Subsystem Tasks (Coordinated Parallel Waves)
- **Scope:** Major features crossing UI, IPC, database, and process boundaries.
- **Protocol:** Decompose into disjoint tasks, execute independent specialists in parallel waves with barrier synchronization, and run comprehensive QA.

### Tier 4: Research-Heavy Tasks (Independent Intelligence)
- **Scope:** Evaluating candidate libraries, benchmarking frameworks, investigating external protocols, or analyzing competitor features.
- **Protocol:** Dispatch `research-specialist` for evidence gathering and `critical-thinking-specialist` for trade-off stress-testing before finalizing architectural plans.

### Tier 5: Critical & Strategic Decisions (Multi-Perspective Council)
- **Scope:** System-wide refactoring, security model redesign, or major roadmap pivots.
- **Protocol:** Form a review wave including `lead-architect`, `architecture-specialist`, `critical-thinking-specialist`, and `research-specialist`. Consolidate independent reports into an ADR.

---

## 4. Parallel Wave Execution & Barrier Synchronization

To guarantee project integrity during parallel execution:
1. **Exclusive File Ownership:** Every concurrent task must declare strictly disjoint file sets. No two agents in the same wave may touch the same file.
2. **Disjoint Wave Rule:** Two tasks belong in the same wave if and only if:
   - Neither depends on the other.
   - Their assigned file sets are completely disjoint.
   - Their runtime resources (ports, DB locks, build outputs) do not collide.
3. **Barrier Synchronization:** At the conclusion of each wave, the Lead Architect pauses execution, reviews specialist reports, verifies diffs, resolves boundary mismatches, and confirms typecheck passes before initiating subsequent waves.
4. **Commit Serialization:** Specialists leave changes in the working tree. Atomic Git commits are serialized by the Lead Architect or `git-specialist`.

---

## 5. Daily Proactive Orchestration Matrix

The Lead Architect proactively engages specialized squads across daily engineering scenarios:

| Development Trigger | Active Squad | Workflow Steps | Quality Gate |
| :--- | :--- | :--- | :--- |
| **Complex Bug** | Critical Thinking + Engineering + QA | 1. Hypothesis generation<br>2. Failing reproduction<br>3. Root-cause fix | Regression test passes |
| **New Subsystem** | Product Strategy + Architecture + Engineering | 1. Workflow validation<br>2. Contract modeling<br>3. Phased implementation | Typecheck + Vitest suite |
| **Tech Adoption** | Research + Critical Thinking + Architecture | 1. Official docs analysis<br>2. Adversarial critique<br>3. Compatibility check | Ponytail justification |
| **IPC / Auth / DB** | Backend + Security + QA | 1. Implementation<br>2. Sandbox & OWASP audit<br>3. Negative assertions | Security sign-off |
| **UI / Visual** | UI/UX + Glass Material + Frontend + QA | 1. Token & hierarchy spec<br>2. Refraction & blur filters<br>3. React implementation<br>4. Visual QA | PASS verdict (>= 90/100) |
| **Doc Sync** | Documentation Specialist | 1. Update `AI_CONTEXT.md`<br>2. Update `docs/README.md`<br>3. Run `validate:structure` | 0 errors, 0 warnings |

---

## 6. Communication Contracts & Reporting Schemas

### Standard Delegation Brief (Lead Architect → Specialist)
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

### Standard Specialist Report (Specialist → Lead Architect)
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

---

## 7. Quality Gates & Non-Negotiable Invariants

1. **Zero Blind Trust:** Every implementation must be independently validated via `npm run typecheck`, automated test suites, or visual QA. Self-reported success is insufficient.
2. **Anti-Boxiness & Zero White Borders:** NEVER add visible white, light gray, or glowing borders anywhere in the application. Cards, buttons, and panels must be completely borderless (`border-0`), floating naturally on dark surfaces (`bg-white/[0.02]` to `bg-white/[0.08]`).
3. **No Backgrounds on Numbers & Counts:** File counts, badges, and counters must render as clean, muted typographic numbers with zero pill backgrounds.
4. **Icon-Only Toolbars:** Header and panel controls must be strictly icon-only with accessible hover tooltips.
5. **Permanent Repository Organisation:** All documentation belongs under `docs/` subdirectories. Root directory documentation additions are forbidden.
