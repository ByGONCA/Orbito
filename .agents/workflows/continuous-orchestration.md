---
name: continuous-orchestration
description: Daily proactive orchestration patterns, trigger matrix, and recurring review protocols for Orbito
---

# Continuous & Proactive Multi-Agent Orchestration Protocol

This protocol guides the **Lead Architect** in proactively invoking specialized subagents during everyday engineering workflows, without waiting for explicit prompt instructions from the user.

---

## 1. Proactive Trigger Matrix

When any development scenario occurs, activate the pre-configured specialist squad:

| Development Scenario | Primary Squad | Proactive Invocations | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **Complex or Intermittent Bug** | Root-Cause & Verification Squad | 1. `critical-thinking-specialist` (hypothesis generation & falsification)<br>2. Engineering specialist (`backend-` or `frontend-specialist`)<br>3. `qa-specialist` (minimal failing reproduction) | Verified fix addressing true root cause with regression test |
| **New Feature / Subsystem** | Architecture & Product Squad | 1. `product-strategy-specialist` (developer workflow validation)<br>2. `architecture-specialist` (IPC & state contract modeling)<br>3. Implementation specialists<br>4. `qa-specialist` (test coverage) | Clean implementation adhering to architectural boundaries |
| **Technology Evaluation / New Library** | Intelligence & Feasibility Squad | 1. `research-specialist` (primary source docs, benchmark, CVE)<br>2. `critical-thinking-specialist` (adversarial trade-off analysis)<br>3. `architecture-specialist` (system fit & integration) | Fact-checked recommendation matrix with Ponytail justification |
| **Authentication, IPC, or Storage Changes** | Security & Integrity Squad | 1. `backend-specialist` (implementation)<br>2. `security-specialist` (OWASP, path traversal, sandbox review)<br>3. `qa-specialist` (negative test assertions) | Hardened implementation with zero privilege escalation |
| **UI/UX Overhaul or Component Redesign** | Visual & Ergonomics Squad | 1. `ui-ux-specialist` (design system tokens, spatial hierarchy)<br>2. `glass-material-specialist` (refraction, blur, rim highlights)<br>3. `frontend-specialist` (React 19 implementation)<br>4. `qa-specialist` (screenshot visual QA, score >= 90) | Refined, borderless, dark glass UI passing visual verdict |
| **Performance Degradation or Slow UI** | Profiling & Optimization Squad | 1. `performance-specialist` (CPU/memory profiling, query plans)<br>2. Engineering specialist (targeted optimization diff)<br>3. `performance-specialist` (re-benchmark with quantified proof) | Quantified latency/memory improvement with zero contract break |
| **Code Refactoring & Debt Elimination** | Code Quality & Architecture Squad | 1. `architecture-specialist` (topology & boundary check)<br>2. `code-quality-specialist` (Ponytail simplicity ladder, DRY, SOLID)<br>3. `qa-specialist` (regression suite execution) | Simplified codebase with zero behavioral regression |
| **Phase / Milestone Completion** | Knowledge & Integrity Squad | 1. `documentation-specialist` (sync `AI_CONTEXT.md`, update `docs/README.md`)<br>2. Structure validator (`npm run validate:structure`) | Up-to-date shared context and compliant documentation |

---

## 2. Dynamic Decision Tree for Incoming Tasks

```
                     [ Incoming User Task ]
                               │
               Is it simple / trivial?
              ┌────────────────┴────────────────┐
             YES                                NO
              │                                 │
    [ Lead Architect Direct ]         Analyze task domain:
    (Quick edit / small fix)                    │
                     ┌──────────────────────────┼──────────────────────────┐
                     ▼                          ▼                          ▼
             [ Research / Tech ]         [ Architecture / Epic ]     [ Bug / Failure ]
                     │                          │                          │
           Dispatch:                  Dispatch:                  Dispatch:
           • research-specialist      • architecture-specialist  • critical-thinking-specialist
           • critical-thinking        • product-strategy         • engineering specialist
                     │                          │                • qa-specialist
                     ▼                          ▼                          │
             [ Findings Matrix ]        [ Phased Wave Plan ]               ▼
                     │                          │                  [ Verified Fix ]
                     └──────────────────────────┼──────────────────────────┘
                                                ▼
                                    [ Barrier Sync & QA Gate ]
                                    • qa-specialist (Vitest/tsc)
                                    • visual QA (if UI affected)
                                    • security audit (if sensitive)
                                                ▼
                                    [ Knowledge Sync & Report ]
                                    • documentation-specialist
                                    • Lead Architect final report
```

---

## 3. Recurring Review Protocols

During active development sessions, the Lead Architect periodically initiates specialized review sweeps:
1. **Architecture & Dependency Check:**
   - Run `graphify query` on recently modified modules to ensure zero circular dependencies or unexpected cross-layer imports.
2. **Security & Sandbox Audit:**
   - Scan modified IPC channels and preload bridges for argument validation and path traversal vulnerabilities.
3. **Design System & Anti-Boxiness Check:**
   - Verify that no UI changes introduced visible white borders, container nesting, or boxed number pills.
4. **Context Synchronization:**
   - Run `npm run validate:structure` to ensure all new documents are indexed and all links resolve.
