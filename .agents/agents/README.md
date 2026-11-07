# Orbito Multi-Agent Engineering Roster

This directory contains the persistent configuration, identity profiles, and capability matrices for the Orbito multi-agent development system.

## 1. Agent Directory & Capabilities

| Agent Identifier | Display Name | Tier | Tools Config | Primary Focus |
| :--- | :--- | :--- | :--- | :--- |
| `lead-architect` | Lead Architect & Development Orchestrator | Orchestrator | Subagent, MCP, Write | Coordination, decomposition, wave planning, integration |
| `frontend-specialist` | Frontend Specialist | Primary | MCP, Write | React 19, Tailwind, Zustand, Anti-boxiness, virtualized UI |
| `backend-specialist` | Backend & Infrastructure Specialist | Primary | Write | Electron main, IPC, SQLite (better-sqlite3), PTY, filesystem |
| `git-specialist` | Git & Version Control Specialist | Primary | Write | Git worktrees, atomic commits, diffs, conflict resolution |
| `security-specialist` | Security Specialist | Primary | Read-only | IPC security, Electron sandboxing, path traversal, secrets |
| `qa-specialist` | QA & Testing Specialist | Primary | Write | Vitest tests, typecheck (`tsc`), build validation, bug repro |
| `performance-specialist` | Performance Specialist | Primary | Write | CPU/memory profiling, React re-renders, DB indexes, IPC |
| `code-quality-specialist` | Code Quality Specialist | Primary | Write | SOLID, clean code, DRY, Ponytail simplicity ladder |
| `documentation-specialist` | Documentation Specialist | Optional | Write | Specs, `README.md`, changelogs, API documentation |
| `research-specialist` | Research & Technology Specialist | Optional | Read-only | Tech evaluations, library comparisons, feasibility studies |

## 2. Machine-Readable Registry
The complete configuration matrix is stored in [`roster.json`](./roster.json).

## 3. How to Register & Invoke
In any Antigravity conversation session:
1. The Lead Architect reads `roster.json` or activates `.agents/rules/multi-agent-system.md`.
2. For any specialist not yet loaded in the current conversation, call `define_subagent` using the configuration parameters in `roster.json`.
3. Launch tasks via `invoke_subagent` with the standard task brief.
