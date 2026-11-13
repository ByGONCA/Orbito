# Orbito Multi-Agent Engineering Roster

This directory contains the persistent configuration, identity profiles, and capability matrices for the Orbito multi-agent engineering and research team.

## 1. Agent Directory & Capabilities

| Agent Identifier | Display Name | Tier | Tools Config | Primary Focus |
| :--- | :--- | :--- | :--- | :--- |
| `lead-architect` | Lead Architect & Development Orchestrator | Orchestrator | Subagent, MCP, Write | Coordination, dynamic delegation, wave planning, integration, skill discovery |
| `frontend-specialist` | Frontend Specialist | Primary | MCP, Write | React 19, Tailwind, Zustand, Anti-boxiness, clean typography, icon-only toolbars |
| `glass-material-specialist` | Glass Material Specialist | Primary | MCP, Write | Physical glass materials, refraction, SVG displacement filters, blur tokens |
| `backend-specialist` | Backend & Infrastructure Specialist | Primary | Write | Electron main, IPC, SQLite (`better-sqlite3`, Drizzle), PTY, filesystem |
| `git-specialist` | Git & Version Control Specialist | Primary | Write | Git worktrees, atomic commits, diffs, conflict prevention |
| `architecture-specialist` | Software Architecture Specialist | Primary | Write (Docs/ADRs) | System topology, cross-layer contracts, state models, dependency decoupling, ADRs |
| `critical-thinking-specialist` | Critical Thinking & Problem-Solving Specialist | Primary | Read-only | Adversarial analysis, assumption challenge, hypothesis testing, anti-overengineering |
| `research-specialist` | Research & Intelligence Specialist | Primary | MCP, Write (Docs) | Technology evaluation, official docs analysis, library benchmarking, intelligence |
| `product-strategy-specialist` | Product Strategy & UX Research Specialist | Primary | Write (Specs) | Developer velocity, workflow ergonomics, competitor benchmarking, feature pruning |
| `ui-ux-specialist` | UI/UX & Design Systems Specialist | Primary | MCP, Write (Docs) | Design system tokens, surface elevation, visual hierarchy, ergonomics, accessibility |
| `security-specialist` | Security Specialist | Primary | Read-only | IPC security, Electron sandboxing, path traversal, secrets protection |
| `qa-specialist` | QA & Visual Testing Specialist | Primary | MCP, Write | Vitest tests, typecheck (`tsc`), screenshot visual QA, 6-dimension scoring |
| `performance-specialist` | Performance Specialist | Primary | Write | CPU/memory profiling, React re-renders, DB indexes, IPC throughput |
| `code-quality-specialist` | Code Quality Specialist | Primary | Write | SOLID, clean code, DRY, Ponytail simplicity ladder |
| `documentation-specialist` | Documentation & Knowledge Specialist | Primary | Write | Specs, `AI_CONTEXT.md` synchronization, documentation index (`docs/README.md`) |

## 2. Machine-Readable Registry
The complete configuration matrix is stored in [`roster.json`](./roster.json).

## 3. How to Register & Invoke
In any Antigravity conversation session:
1. The Lead Architect reads `roster.json` or activates `.agents/rules/multi-agent-system.md`.
2. For any specialist not yet loaded in the current conversation, call `define_subagent` using the configuration parameters in `roster.json`.
3. Launch tasks via `invoke_subagent` with the standard task brief.
4. For complex or research tasks, dispatch independent subagents in parallel waves, wait for reports, and synthesize results.
