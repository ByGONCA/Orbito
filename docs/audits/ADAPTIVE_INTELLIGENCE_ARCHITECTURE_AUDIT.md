# Adaptive Intelligence Architecture Audit

## 1. Executive Summary & Objective

This audit evaluates the architecture of Orbito (Orc AI Workspace) to design and integrate **Orbito Adaptive Intelligence** — an intelligent model orchestration engine that dynamically selects, combines, evaluates, and transitions between individual AI models throughout task execution.

Unlike a static provider selector or a global model dropdown, Adaptive Intelligence treats models as specialized cognitive workers. It operates under the guiding principle:
**Model-first. Provider-aware. Subscription-aware. Capability-driven. Cost-conscious. Quality-oriented.**

---

## 2. Comprehensive System Audit

### 2.1 Core Architecture & Shared Contracts
- **Shared Contracts (`src/shared/`)**:
  - `intelligence.ts`: Currently defines `TaskCategory`, `ModelRoutingDecision`, and token optimization flags. Defines `IntelligenceConfig` with `defaultModelTarget: 'claude'`.
  - `agents.ts`: Defines `OrchestrationRecord`, `OrchestrationTask`, `SpecialistRole`, and `ExecutionMode`. Note that `OrchestrationTask` has fields `assignedProvider?: CLIProvider` and `assignedModel?: string`, but these are statically assigned at task creation.
  - `cli.ts`: Defines 30 `CLIProvider` types, `CLISessionRecord`, `CLISessionMessage`, and `CLICapabilities`.
  - `ipc.ts`: Defines Zod validation schemas for all Electron IPC channels.
- **Database Architecture (`src/main/db/database.service.ts`)**:
  - SQLite backend using `better-sqlite3` in WAL mode with two databases: `app.sqlite` (workspace state, sessions, orchestrations, tasks, audit logs) and `index.sqlite` (AST symbol graph, code chunks).
  - Schema includes tables for `orchestrations`, `orchestration_tasks`, `task_traces`, and `cli_sessions`.
  - Existing query interfaces allow querying task traces, retries, and session statuses.

### 2.2 Agent Infrastructure & Multi-Agent Execution
- **Agent Orchestrator (`src/main/agents/agent-orchestrator.ts`)**:
  - Starts orchestrations, invokes `CoordinatorAgent.plan`, creates tasks in SQLite, and initializes `AgentScheduler`.
- **Coordinator Agent (`src/main/agents/coordinator-agent.ts`)**:
  - Decomposes natural language prompts into a DAG of specialist tasks (`architect`, `backend`, `frontend`, `testing`, `security`, `reviewer`).
  - **Limitation**: Currently copies the single `provider` and `model` passed from `startOrchestration` to *every* task in the DAG.
- **Agent Worker (`src/main/agents/agent-worker.ts`)**:
  - Sets up isolated Git worktrees for modifying tasks.
  - Injects bound skills and authorized MCP tools.
  - Dispatches execution to `executionEngine.execute(task.assignedProvider, ...)`.
  - Executes quality check via `ReviewerAgent.reviewTask`.
  - If review fails, calls `executeRemediation` with the *same* model up to `maxRetries`.
  - **Limitation**: No dynamic model switching between DAG stages, no context handoff package, and no model escalation upon remediation.
- **Agent Scheduler (`src/main/agents/agent-scheduler.ts`)**:
  - Concurrency management (up to 3 parallel workers), dependency topological resolution, and worktree conflict prevention.

### 2.3 CLI Infrastructure & Provider Adapters
- **CLI Manager & Adapters (`src/main/cli/`)**:
  - 30 CLI adapters implement `ICLIAdapter` (`claude`, `codex`, `gemini`, `ollama`, `opencode`, `hermes`, etc.).
  - `ICLIAdapter.buildCommand(prompt, workingDirectory, resumeSessionId)` builds the CLI arguments.
  - **Limitation**: `buildCommand` does not accept a specific target `model?: string` parameter, even though Claude (`--model`), Codex (`-m`), Gemini (`-m`), and Ollama support model flags.
- **Authentication & Availability Detection (`src/main/cli/detector.utils.ts`, adapters)**:
  - Adapters detect installation on system `PATH` and verify auth via config files (`~/.claude.json`, `~/.codex/config.json`, ADC) or environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.).
  - However, model-level availability (which individual models are accessible on the current subscription or quota) is not evaluated.

### 2.4 Existing Routing Engine
- **Intelligence Router (`src/main/services/intelligence-router.service.ts`)**:
  - A static utility class with a hardcoded `MODEL_SPECS` dictionary containing 7 models.
  - Routes a task once at the start based on regex keyword matching.
  - Checks provider installation and context window limits.
  - Supports Air-Gap isolation override to local Ollama.
  - **Missing**: Dynamic model discovery, subscription tier awareness, in-flight model transitions, stage-specific context handoff, and quality-driven escalation.

### 2.5 User Interface & Settings
- **Settings Registry & Pages (`src/renderer/src/components/settings/`)**:
  - `ProvidersPage.tsx` manages API keys stored securely via safe storage.
  - `OrchestrationPage.tsx` displays execution architecture and pending human approvals.
  - Visual system follows strict **Anti-Boxiness** and **Zero-White-Border** rules: dark floating cards, subtle backgrounds (`bg-white/[0.02]` to `bg-white/[0.06]`), muted typography, and icon-only toolbars.

---

## 3. Gap Analysis & Key Technical Requirements

| Area | Current Implementation | Adaptive Intelligence Requirement |
|---|---|---|
| **Model Registry** | Static dictionary in `IntelligenceRouter` | Centralized, model-first registry (`src/main/ai/model-registry.ts`) with dynamic discovery, family groupings, aliases, and real metadata. |
| **User Access Awareness** | Binary provider install check | Differentiates public catalog vs. authenticated CLI vs. API key vs. local installation. Zero cross-provider requirement for single-provider users. |
| **Task Intelligence** | Basic regex categorization | Pre-execution complexity analysis, capability profiling, and operation pipeline decomposition (`src/main/ai/task-intelligence-engine.ts`). |
| **Model Selection** | Single-shot routing | Multi-mode dynamic routing (`manual`, `adaptive`, `advanced`), least-cost capable model selection, and fallback chains (`src/main/ai/adaptive-model-router.ts`). |
| **In-Flight Switching** | Non-existent; single model per task | Structured context handoff (`model-context-handoff.ts`), stage-to-stage transition, token pruning, loop prevention. |
| **Quality Evaluation** | Binary reviewer check | Deterministic compiler, test, and diff validation gates; intelligent escalation to higher-capability models upon failure. |
| **Cost Intelligence** | Static token rates | Exact, estimated, and unknown cost tracking, task/project budgets, cost approval thresholds (`model-cost-engine.ts`). |
| **CLI & Desktop UI** | No model commands | `orbito models` and `orbito intelligence` CLI suites; minimal, borderless Settings panel. |

---

## 4. Proposed Module Architecture

```
src/
├── main/
│   ├── ai/
│   │   ├── model-registry.ts           # Central Model Registry & dynamic discovery
│   │   ├── model-capability-engine.ts  # Capability profiles, scoring, and benchmarks
│   │   ├── task-intelligence-engine.ts # Task analysis, complexity, and pipeline decomposition
│   │   ├── adaptive-model-router.ts    # Dynamic routing engine (Manual, Adaptive, Advanced)
│   │   ├── model-context-handoff.ts    # Structured context handoff packages & loop prevention
│   │   ├── model-evaluation-engine.ts  # Quality evaluation & deterministic verification gates
│   │   ├── model-cost-engine.ts        # Token tracking, cost estimation, and budget enforcement
│   │   └── multi-model-collaboration.ts# Independent review, competition, and consensus
│   ├── agents/
│   │   ├── coordinator-agent.ts        # Extended to plan multi-model DAGs
│   │   └── agent-worker.ts             # Extended with context handoff & model switching
│   └── cli/
│       ├── adapter.interface.ts        # buildCommand extended with target model parameter
│       └── adapters/*.ts               # Adapter command builders updated for model flags
├── shared/
│   ├── model-registry.ts               # Shared model schemas, interfaces, and types
│   ├── intelligence.ts                 # Extended intelligence contracts and routing types
│   └── ipc.ts                          # IPC channels for model registry and adaptive routing
└── renderer/
    └── src/components/settings/pages/
        └── AdaptiveIntelligencePage.tsx# Settings view (Anti-Boxiness, Zero-White-Border)
```

---

## 5. Worktree Distribution & Safety Strategy

All development will proceed following Orbito's Multi-Agent Orchestration Protocol:
- **Zero White Borders**: All UI components must use borderless floating panels with subtle contrast.
- **Safety**: Safe git operations, atomic commits, and preservation of user modifications.
- **Validation**: TypeScript verification (`npm run typecheck`) and documentation hierarchy verification (`npm run validate:structure`) at every step.
