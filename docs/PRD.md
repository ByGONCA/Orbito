# Product Requirements Document (PRD) — AI Workspace

**Document Version:** 1.7.0  
**Status:** Phases 1–6 Fully Implemented & Verified | Phase 7 Ecosystem & Hardening Next  
**Target:** Local-First Desktop AI Workspace  
**Document Author:** Architecture Team  

---

## 1. Executive Summary & Vision

### 1.1 Vision Statement
> *"One Workspace. Every AI. Total Control."*

**AI Workspace** is an intelligent, local-first desktop application engineered to transform human-AI collaboration. Unlike conventional AI code editors or single-model wrapper interfaces, AI Workspace unites leading command-line AI tools (Claude Code, OpenAI Codex CLI, Google Gemini CLI), local context indexing, built-in domain skills, visual workflow automation, and multi-agent coordination into a unified, secure, and resource-conscious desktop environment.

### 1.2 Core Product Principles
1. **Local-First Architecture:** User files, project repositories, indexing databases, memory layers, and execution histories reside entirely on the local machine. No external servers or cloud accounts are mandatory.
2. **Lightweight & High Performance:** Engineered for minimal idle footprint (RAM ≤ 300 MB, near 0% CPU, startup ≤ 3s on reference hardware). Agent processes are isolated and bounded.
3. **Built-in Capabilities (Zero-Friction):** Advanced domain skills and workflows are pre-packaged. Users do not need to hunt down, configure, or manually inject prompts or agent configs.
4. **Intelligent Context Optimization:** The system actively guards the model's context window through AST indexing, lexical search, and dynamic token budgets—preventing cost and token bloat.
5. **Deterministic Multi-Agent Orchestration:** Agent tasks run under explicit parent-child plans, isolated via Git worktrees to prevent destructive parallel file operations.
6. **Visual Transparency & Explainability:** Every file read, command executed, diff generated, and skill triggered is surfaced through the Live Intelligence View. The application never claims to expose private model weights/reasoning tokens, focusing strictly on observable actions.
7. **Dual-Mode Experience:** Tailored interfaces for both beginners ("Simple Mode") and power users ("Advanced Mode").
8. **Provider Agnostic & Non-Invasive:** Respects official vendor authentication, licensing, and CLI interfaces. Never bypasses provider subscriptions or implements spoofed protocols.
9. **Zero-Trust Local Security:** Strict sandboxing, path traversal prevention, declarative skill permissions, and OS-level credential encryption (`safeStorage`).

---

## 2. Target Personas & User Journeys

### 2.1 Persona A: The Aspiring Creator / Beginner ("Alex")
* **Background:** Product manager, designer, or junior developer who wants to build features and automate tasks with AI but lacks deep terminal fluency and CLI configuration knowledge.
* **Pain Points:** 
  * Overwhelmed by complex CLI arguments, shell environments, and token budgeting.
  * Afraid of destructive changes to repositories.
  * Does not know which AI model or skill prompt is best for their specific task.
* **Needs in AI Workspace:**
  * **Simple Mode** interface with intuitive natural language prompts and guided suggestions.
  * Automatic CLI installation detection and setup guides.
  * Clear, plain-language summaries of what the AI is about to execute before running.
  * One-click rollback and visual approvals for file changes.

### 2.2 Persona B: The Senior Software Engineer / Power User ("Elena")
* **Background:** Senior architect or full-stack engineer juggling multiple codebases, complex migrations, and multiple AI toolchains.
* **Pain Points:**
  * Context pollution and token waste when models read unrelated files.
  * Race conditions and file conflicts when running parallel agent tasks.
  * Fragmented workflow switching between terminal, IDE, browser, and AI tools.
* **Needs in AI Workspace:**
  * **Advanced Mode** with full xterm.js terminal integration, raw PTY access, and direct CLI command flags.
  * Multi-agent execution isolated in parallel Git worktrees.
  * Granular inspection and editing of memory layers (Global, Workspace, Project, Task, Session).
  * Fine-grained permission configurations and custom visual DAG workflows.

---

## 3. Product Architecture & Functional Modules

```
+---------------------------------------------------------------------------------------+
|                                    RENDERER (UI)                                      |
|  [Simple Mode / Advanced Mode]  |  [File Explorer]  |  [Chat & Plan]  |  [Flow Builder] |
|  [Live Intelligence Stream]     |  [Task Center]    |  [xterm.js WebGL Terminal]     |
+---------------------------------------------------------------------------------------+
                                           | Secure IPC Bridge (Preload)
+---------------------------------------------------------------------------------------+
|                                  MAIN PROCESS (CORE)                                  |
|  +--------------------+   +---------------------+   +-------------------------------+  |
|  | Workspace Manager  |   | AI Experience Engine|   | Multi-Agent Orchestrator      |  |
|  | File & Project Ops |   | Intent & Routing    |   | Coordinator / Worktrees       |  |
|  +--------------------+   +---------------------+   +-------------------------------+  |
|  +--------------------+   +---------------------+   +-------------------------------+  |
|  | Context Engine     |   | Skills Engine       |   | CLI Engine (Adapters)         |  |
|  | AST / FTS5 Engine  |   | Sandboxed Loader    |   | Claude / Codex / Gemini       |  |
|  +--------------------+   +---------------------+   +-------------------------------+  |
|  +--------------------+   +---------------------+   +-------------------------------+  |
|  | Workflow Engine    |   | Security Manager    |   | Model & Analytics Manager     |  |
|  | DAG Runner         |   | Sandboxing & Keyring|   | Usage & Benchmarks            |  |
|  +--------------------+   +---------------------+   +-------------------------------+  |
+---------------------------------------------------------------------------------------+
                                           |
+---------------------------------------------------------------------------------------+
|                                 LOCAL STORAGE (PERSISTENCE)                           |
|  app.sqlite (App State) | index.sqlite (FTS5 / AST) | OS safeStorage | Git Worktrees  |
+---------------------------------------------------------------------------------------+
```

### 3.1 Module 1: Workspace Manager
* **Project Organization:** Support opening any local directory as a project or grouping multiple projects into named workspaces.
* **Non-Destructive Operations:** Original files remain strictly in place on the host filesystem. AI Workspace only creates metadata records in SQLite.
* **File Explorer:** Virtualized file tree supporting drag-and-drop, real-time file watcher updates (via `@parcel/watcher`), file filtering (honoring `.gitignore`), and inline file preview.
* **Integrated Terminal:** Powered by `xterm.js` and hardware-accelerated WebGL addon, attached to local shells (PowerShell, Bash, Zsh) via `node-pty`.
* **Git Versioning:** Native Git integration supporting branch switching, diff visualization, commit staging, stash operations, and worktree creation.

### 3.2 Module 2: AI Experience Engine
* **Intent Analysis:** Intercepts user requests and parses task complexity into three tiers:
  * *Direct Query (Tier 1):* Code explanation, question answering, simple refactor. Routed directly to a single model/CLI. No multi-agent overhead.
  * *Assisted Task (Tier 2):* Single-file modification or bug fix. Invokes targeted skill instructions and local context retrieval.
  * *Complex Workflow (Tier 3):* Multi-file refactor, architecture creation, full-stack feature. Hands off to the Multi-Agent Coordinator.
* **Plan Formulation:** Generates step-by-step observable execution milestones before touching files.
* **Result Verification:** Evaluates agent output against user acceptance criteria and automated test execution.

### 3.3 Module 3: Context Engine & Semantic Search Strategy
* **AST Code Indexing:** High-performance code chunking and symbol extraction using `tree-sitter` grammars running in a dedicated Node.js background Worker Thread.
* **Lexical Foundation (Default):** SQLite FTS5 for lightning-fast token, symbol, and keyword lookup with BM25 ranking. Minimal RAM (<5 MB) and microsecond latency.
* **Optional Local Semantic Search (Opt-in):**
  * Local embedding model via ONNX Runtime (`@xenova/transformers` with `all-MiniLM-L6-v2`).
  * Explicitly disabled by default due to RAM (+150-250 MB) and CPU overhead. Can be enabled by users on qualified hardware (>8 GB RAM, multi-core CPU) or configured with remote embedding API keys.
* **Five-Level Memory System:**
  1. *Global Memory:* User preferences, coding standards, global tool configurations.
  2. *Workspace Memory:* Inter-project relationships, team conventions.
  3. *Project Memory:* Architecture decisions, tech stack specs, build instructions.
  4. *Task Memory:* Transient goals, active file lists, intermediate hypotheses.
  5. *Session Memory:* Recent chat history, active token count, immediate context cache.
* **Memory Management:** Every memory record is inspectable, editable, and deletable by the user through a visual dashboard.
* **Context Budget Manager:** Dynamically computes available context limits per target CLI/model. Truncates non-essential files, strips comments or boilerplate if requested, and injects only top-ranked chunks.

### 3.4 Module 4: Built-in & Custom Skills Engine
* **Curated Built-in Library:** Ships with production-tested domain guidelines (Frontend, Backend, Database, UI/UX, Security, Testing, Debugging, Architecture, Docs, SEO, Planning, Data Analysis).
* **On-Demand Progressive Disclosure:**
  * Stage 1: Load skill names, tags, and trigger summaries into the router (minimal tokens).
  * Stage 2: When a task matches a skill, load only the specific markdown instructions for that skill into the active prompt.
* **Skill Security & Sandboxing:**
  * Built-in skills are cryptographically verified by SHA-256 integrity hashes.
  * Custom and imported skills must declare a static manifest with required permission scopes (`fs:read`, `fs:write`, `net:outbound`, `shell:exec`).
  * Skills are strictly forbidden from modifying global application security permissions or executing unprompted shell commands.
  * Automated static analysis scans imported skills for prompt injection markers and destructive command patterns (`rm -rf`, curl piping).

### 3.5 Module 5: Agent Manager & Multi-Agent Orchestration
* **Agent Archetypes:**
  * *Coordinator:* Breaks user prompts into directed acyclic task graphs (DAGs), assigns specialists, manages dependencies.
  * *Specialist:* Executes focused coding, testing, or drafting within assigned file boundaries.
  * *Reviewer:* Inspects diffs, runs test suites, checks security rules and style consistency.
  * *Autonomous:* Executes pre-approved, non-destructive automated pipelines.
* **Isolation via Git Worktrees:**
  * Parallel agent runs are executed in temporary Git worktrees (`.git/worktrees/ai-workspace-<taskId>`).
  * Prevents concurrent file write conflicts and file locks on the main branch.
  * Once the task completes, the Reviewer validates the branch, shows the visual diff to the user, and initiates a clean merge upon user approval.

### 3.6 Module 6: CLI Engine & Provider Adapters
* **Unified Adapter Interface:**
  ```typescript
  interface CLIAdapter {
    readonly provider: 'claude' | 'codex' | 'gemini';
    detectInstallation(): Promise<CLIInstallationStatus>;
    getAuthenticationStatus(): Promise<CLIAuthStatus>;
    getAvailableModels(): Promise<ModelDescriptor[]>;
    discoverCapabilities(): Promise<CLICapabilities>;
    spawnSession(options: SpawnOptions): Promise<CLISession>;
    cancel(sessionId: string): Promise<void>;
  }
  ```
* **Official Provider Integrations & Reality Matrix:**
  * **Claude Code (`@anthropic-ai/claude-code`):** Interactive Node.js terminal utility. Interfaced via `node-pty` for interactive human-in-the-loop sessions, or non-interactive batch prompt (`-p`) where authorized. Respects `~/.claude.json` and `ANTHROPIC_API_KEY`.
  * **OpenAI Codex CLI (`codex` / `openai`):** Command-line tool interfaced via child process stdout streaming. Respects `~/.codex/config.json` and `OPENAI_API_KEY`.
  * **Google Gemini CLI (`gemini` / Google GenAI):** Interfaced via child process streaming. Respects Application Default Credentials (ADC) or `GEMINI_API_KEY`.
* **Zero-Credential Hijacking:** Does not intercept, alter, or proxy provider tokens. Sensitive keys added directly into AI Workspace are stored strictly in the OS native keychain via Electron `safeStorage`.
* **Process Lifecycle & Error Recovery:** Process trees are cleanly terminated across Windows (`taskkill /T /F`) and POSIX (`SIGINT` -> `SIGTERM` -> `SIGKILL`). Exit codes are translated into clear, actionable UI recovery prompts. Outdated CLI versions are detected and surfaced with official update commands.

### 3.7 Module 7: Visual Flow Builder
* **Drag-and-Drop Node Graph:** Visual automation builder powered by React Flow (`@xyflow/react`).
* **Node Types:** `Start`, `Agent`, `Skill`, `Model`, `Condition (Branching)`, `File Operation`, `Human Approval`, `Loop`, `Delay`, `End`.
* **Natural Language Generation:** Users can type plain-language workflow goals, and the engine drafts the corresponding visual graph for review before execution.

### 3.8 Module 8: Task Center & Live Intelligence View
* **Task Center:** Central queue tracking pending, running, paused, completed, and failed tasks with CPU/duration metrics and cancellation controls.
* **Live Intelligence View:** Real-time stream of observable events:
  * File paths read/written.
  * Shell commands executed with exit codes.
  * Git diffs created.
  * Active skill modules loaded.
  * *Strict Policy:* Explicitly labeled as observable process outputs, never claiming to expose private chain-of-thought tokens from third-party closed APIs.

### 3.9 Module 9: Analytics & Performance Benchmarks
* Tracks estimated token counts and API costs based on known model rate cards.
* Flags metrics as **Vendor Reported** (exact from CLI stdout) vs **Locally Estimated** (heuristic token count).
* Displays per-process CPU, RAM, and disk utilization of application, background worker threads, and spawned CLI agents.

---

## 4. Performance Engineering & Non-Functional Requirements (NFR)

### 4.1 Reference Hardware & Benchmarking Strategy
Performance targets are treated as empirical benchmarks to be validated against a standardized **Reference Client**:
* **CPU:** 4-Core / 8-Thread x86_64 or Apple Silicon ARM64.
* **RAM:** 16 GB DDR4/DDR5.
* **Storage:** NVMe SSD.
* **Operating Systems:** Windows 11 (23H2+), macOS Sonoma (14+), Ubuntu 22.04 LTS.

### 4.2 Engineering Targets

| Metric | Target Specification | Measurement Harness |
|---|---|---|
| **Idle Memory (Application)** | ≤ 300 MB total (Main + Renderer + Preload) | Process monitoring via OS APIs and Vitest automated harness |
| **Active Workspace Memory** | ≤ 500 MB (excluding external CLI agent processes) | Active test with 5,000 files open in virtualized tree |
| **Idle CPU Usage** | < 1% sustained CPU | Windows Performance Monitor / macOS Activity Monitor |
| **Cold Startup Time** | ≤ 3.0 seconds to interactive window | High-resolution performance timer (`performance.mark`) |
| **Background Indexing** | Non-blocking UI (consistent 60 FPS) | Worker thread offloading; zero frame drops on Chromium DevTools |
| **Terminal Log Throughput** | 10,000 lines/sec without UI hang | xterm.js WebGL canvas GPU rendering with 5,000-line scrollback buffer |
| **Context Retrieval Latency** | ≤ 50ms for FTS5 lexical symbol query | In-memory SQLite FTS5 benchmark on 10,000 indexed chunks |
| **Agent Process Overhead** | Isolated & bounded memory per CLI session | Separate process tracking; automatic teardown on completion |

### 4.3 Security & Reliability Specifications
* **Process Isolation:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
* **Credential Security:** OS Keychain encryption (`safeStorage`); zero plaintext keys in DB or logs.
* **Command Execution:** Strict allowlist/approval prompts for high-risk shell commands.
* **Reliability:** 100% of editor, search, workflow, and indexing works offline.
* **Git Safety:** All autonomous code edits require worktree isolation or stash backup.

---

## 5. UI/UX Specifications

### 5.1 Primary Navigation
* **Global Sidebar:**
  1. `Home` (Recent projects, system health, quick actions)
  2. `Projects` (Multi-project browser, active workspace)
  3. `Agents` (Agent registry, coordinator status, team profiles)
  4. `Flows` (Visual Flow Builder & saved DAGs)
  5. `Tasks` (Task Center, queue management, execution history)
  6. `Models` (Provider health, active CLIs, model cards)
  7. `Analytics` (Token consumption, cost estimations, resource stats)
  8. `Settings` (Preferences, paths, security approvals, keyring)

### 5.2 Workspace 4-Pane Grid
* **Left Pane (20-25%):** Project tree, active Git branch, Agent status pills.
* **Center Pane (45-50%):** Tabbed interface toggling between Chat/Plan, Monaco Code Editor, Web Preview, and Flow Designer.
* **Right Pane (20-25%):** Active Context Inspector, Loaded Skills, Live File Diffs, Task Details.
* **Bottom Pane (Collapsible 25%):** xterm.js WebGL Terminal, Live Intelligence execution log, Test Runner output.

---

## 6. Scope Boundaries & Anti-Goals
* **Not a cloud SaaS:** There will be no compulsory remote synchronization server, subscription paywall, or mandatory telemetry in Phase 1.
* **Not an unauthorized proxy:** The application will never tunnel API requests through third-party unvetted proxies or attempt to reverse-engineer private model endpoints.
* **Not an IDE clone:** Does not attempt to replicate all of VS Code's extension ecosystem immediately; focuses on deep AI agent orchestration, context engineering, and visual automation.
