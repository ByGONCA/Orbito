---
name: orchestrate
description: Multi-agent planning, delegation, and execution workflow for Orbito
---

# Multi-Agent Orchestration Workflow

Follow this procedure to plan, delegate, execute, and verify tasks using the Orbito multi-agent engineering team.

## Phase 1: Reconnaissance & Research
1. Read the user request thoroughly.
2. Query the codebase knowledge graph:
   `graphify query "<feature or system question>"`
3. If external tech/libraries must be evaluated, invoke `research-specialist`.

## Phase 2: Planning & Wave Formation
1. Decompose the goal into single-responsibility tasks.
2. For each task, define:
   - `Specialist`: [from `.agents/agents/roster.json`]
   - `Files`: [exact paths or globs with disjoint ownership]
   - `Depends-on`: [preceding task IDs]
3. Group independent tasks with disjoint files into parallel execution waves. If dependencies or files overlap, serialize into sequential waves.

## Phase 3: Registration & Delegation
1. Ensure required specialists are registered in the session using `define_subagent` if not already defined.
2. Dispatch tasks to specialists using `invoke_subagent` with the Standard Delegation Brief.

## Phase 4: Implementation
1. Specialists implement within their assigned files.
2. Specialists report back using the Standard Agent Report schema.

## Phase 5: Integration
1. Review modified files and diffs.
2. Resolve any integration conflicts at module boundaries.

## Phase 6: QA & Security Audit
1. Dispatch `qa-specialist` to run:
   - `npm run typecheck`
   - `npm run test`
2. For security-sensitive changes (IPC, file access, secrets), dispatch `security-specialist`.
3. For performance-critical changes, dispatch `performance-specialist`.

## Phase 7: Delivery
1. Compile the final implementation report with verified facts, modified files, and test outputs.
