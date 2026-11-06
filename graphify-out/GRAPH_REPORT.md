# Graph Report - Orc  (2026-11-06)

## Corpus Check
- 248 files · ~223,338 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 38 file(s) not represented in the graph (top: .csv 35, (none) 2, .css 1)

## Summary
- 2261 nodes · 5136 edges · 146 communities (125 shown, 21 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 269 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `590a3280`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- workflows.ts
- useWorkspaceStore
- skill-registry.ts
- design_system.py
- CLIProvider
- execution-engine.ts
- databaseService
- Full Integration & Reliability Audit — AI Workspace (Phase 5)
- register.ts
- database.service.ts
- parsers/index.ts
- DesignSystemGenerator
- tokenCounterService
- phase8-intelligence-validation.test.ts
- compilerOptions
- package.json
- bug-fixing/manifest.json
- bug-investigation/manifest.json
- code-explanation/manifest.json
- code-review/manifest.json
- documentation/manifest.json
- performance-analysis/manifest.json
- project-understanding/manifest.json
- refactoring/manifest.json
- security-review/manifest.json
- test-generation/manifest.json
- MultiTierCacheService
- WorktreeManager
- compilerOptions
- .getIndexDb
- dependencies
- devDependencies
- ExtensionRecord
- SkillPermissions
- Detailed Task Breakdown
- extensionHostManager
- Architectural Decision Records (ADRs) — AI Workspace
- 2. Layer-by-Layer Verification & Mitigations
- executionEngine
- ExpressionEvaluator
- ast-parser.service.ts
- osSandboxPolicy
- scripts
- IElectronAPI
- ErrorBoundary
- Multi-Agent Orchestration Architecture & Implementation — AI Workspace
- AI Workspace — Comprehensive Security Audit Report
- allowScripts
- workspace.store.ts
- persistent-workspace-phase4.test.ts
- OrchestrationTask
- System Architecture Specification — AI Workspace
- Extension Isolation Security Remediation Report: Replacing node:vm with Process-Level Isolation
- WorkspaceConfig
- 2.1 AI Nodes
- context-assembly.service.ts
- tsconfig.json
- 3. Product Architecture & Functional Modules
- executionEngine
- workspaceService
- IndexStats
- AI Workspace — Open-Source Production Release Guide
- IntelligenceGraphWorkspace.tsx
- main/index.ts
- Frontend Design Pro
- AI Workspace — Empirical Performance & Scalability Audit Report
- AI Workspace — Phase 8 Completion Report: Intelligence & Token Optimization Engine
- Custom Extension SDK & Plugin Architecture — AI Workspace
- 1. Comprehensive Subsystem Audit Findings
- IntelligenceGraphWorkspace.tsx
- appLogger
- core.py
- AirGapViolationException
- workflow-generator.ts
- AI Workspace — Extension Security 2.0: OS-Level Sandboxing Report
- 1. Audit Findings & Implemented Hardening
- BM25
- ArcLauncherModal.tsx
- AI Coding Agent Instructions — Orc AI Workspace
- AI Workspace — Project Context & Engineering Architecture
- Workflow Execution Engine Specification — AI Workspace
- cli.ts
- CodeEditor.tsx
- PromptAssemblyService
- RightPanel.tsx
- Ponytail
- generate_design_system
- Testing Strategy & Quality Assurance Architecture — AI Workspace
- CLISessionRecord
- SkillCompositionService
- Pre-Delivery Checklist (canonical — the only one)
- Surgical Bug Fixer Guidelines
- Bug Investigator & Diagnostics Guidelines
- Code Explainer & Mental Model Builder Guidelines
- Code Review Specialist Guidelines
- Technical Documentation Specialist Guidelines
- Performance & Bottleneck Analyst Guidelines
- Project Architecture & Onboarding Guide Guidelines
- Refactoring & Clean Code Engineer Guidelines
- Security & Vulnerability Auditor Guidelines
- Test Suite Generator Guidelines
- Quick Reference
- intelligence.ts
- AI Workspace — Production Readiness & Release Engineering Report
- 6. OS-Level Isolation & Platform Boundaries
- test_core.py
- AgentScheduler
- WorkflowExecutionRecord
- WorkflowRecord
- 5. Summary of Roadmap Phases (Phases 2 to 7)
- validate_data.py
- search
- auditService
- skill-execution-engine.ts
- 6. CLI Engine Architecture & Robust Integration
- ProjectCustomizeModal.tsx
- reviewer-agent.ts
- IntelligenceRouter
- file-scanner.ts
- Flow Builder Architecture & User Experience — AI Workspace
- generate_design_system
- FlowBuilderWorkspace.tsx
- fileWatcher
- app-logger.ts
- 4. Context Engine Reliability & Hybrid Retrieval
- 9. Multi-Agent Orchestration Architecture (Phase 5 Completed)
- workflowEngine
- AgentWorker
- agentOrchestrator
- manifest-validator.ts
- node-executors.ts
- ProjectDescriptor
- 5. Security Kernel: Runtime Enforcement & Defense-in-Depth
- 10. Security Audit
- 3. Complete Feature Inventory
- 15. Prioritized Remediation Roadmap
- Intelligence Engine Architecture — AI Workspace
- agent-orchestrator.ts
- safeStorageService
- 2.2 Implemented OS-Level Sandboxing Architecture (Extension Security 2.0)
- AppLayoutConfig
- ApprovalRequest
- MemoryRecord
- electron.vite.config.ts

## God Nodes (most connected - your core abstractions)
1. `databaseService` - 147 edges
2. `IElectronAPI` - 68 edges
3. `useWorkspaceStore` - 65 edges
4. `CLIProvider` - 64 edges
5. `vitest` - 50 edges
6. `react` - 48 edges
7. `lucide-react` - 38 edges
8. `airGapManager` - 32 edges
9. `OrchestrationTask` - 32 edges
10. `workspaceService` - 29 edges

## Surprising Connections (you probably didn't know these)
- `ADR-010: Independent Adversarial Reviewer Agent Quality Gates` --references--> `ReviewerAgent`  [INFERRED]
  docs/DECISIONS.md → src/main/agents/reviewer-agent.ts
- `2.7 Human-in-the-Loop Multi-Agent Execution Modes` --references--> `ReviewerAgent`  [INFERRED]
  docs/SECURITY_MODEL.md → src/main/agents/reviewer-agent.ts
- `9.3 Git Worktree Isolation & Lifecycle (`WorktreeManager`)` --references--> `WorktreeManager`  [INFERRED]
  docs/ARCHITECTURE.md → src/main/agents/worktree-manager.ts
- `6.1 Unified Adapter Interface (`ICLIAdapter`)` --references--> `ICLIAdapter`  [INFERRED]
  docs/ARCHITECTURE.md → src/main/cli/adapter.interface.ts
- `ADR-003: Unified Adapter Pattern for AI CLI Providers` --references--> `ICLIAdapter`  [INFERRED]
  docs/DECISIONS.md → src/main/cli/adapter.interface.ts

## Import Cycles
- None detected.

## Communities (146 total, 21 thin omitted)

### Community 0 - "workflows.ts"
Cohesion: 0.12
Nodes (17): WorkflowCapability, NodeDefinition, FlowDataType, FlowEdgeSchema, FlowNodeDataSchema, FlowNodeSchema, NodeCategory, NodePortSchema (+9 more)

### Community 1 - "useWorkspaceStore"
Cohesion: 0.13
Nodes (26): 1. Original Phase 7 Objectives & Work Packages, Core Files Updated for Phase 7 Integration, lucide-react, AgentsWorkspace(), AnalyticsDashboard(), BottomStatusBar(), CenterArea(), CLIConsole() (+18 more)

### Community 2 - "skill-registry.ts"
Cohesion: 0.14
Nodes (14): A. Executive Summary, WorkerExecutionResult, CustomSkillsService, ImportCustomSkillResult, SkillDiscovery, SkillLoader, skillRegistry, SKILL_RULES (+6 more)

### Community 3 - "design_system.py"
Cohesion: 0.12
Nodes (7): _detect_page_type(), format_master_md(), format_page_override_md(), _generate_intelligent_overrides(), persist_design_system(), safe_slug(), format_output()

### Community 4 - "CLIProvider"
Cohesion: 0.08
Nodes (31): 10. Conclusion & Project Milestone, 3. Implemented Architecture, 4. New Components and Modified Files, 5. Integrations with Previous Phases, 6. Security Measures, 7.1 Automated Quality Gates, 7. Quality Assurance & Verification Results, 8. Git Commits & Changes (+23 more)

### Community 5 - "execution-engine.ts"
Cohesion: 0.15
Nodes (11): OverlapCheckResult, WorktreeInfo, buildSanitizedCLIEnv(), securityService, SecurityViolationException, DEFAULT_IGNORED_DIRS, PermissionLevel, PersistedTerminalSession (+3 more)

### Community 7 - "Full Integration & Reliability Audit — AI Workspace (Phase 5)"
Cohesion: 0.09
Nodes (23): 12. UI and UX Findings, 13. Test Coverage Analysis, 14. Critical Issues (Root Causes), 16. Recommended Next Development Phase, 17. Verification Results, 1. Executive Summary, 2. Actual Architecture Overview, 6. Agent and Orchestration Audit (+15 more)

### Community 8 - "register.ts"
Cohesion: 0.09
Nodes (43): COMMON_DEV_PORTS, AssemblePromptSchema, CancelWorkflowSchema, ClearCacheSchema, ComposeSkillsSchema, CreateProjectSchema, DeleteMemorySchema, DeleteWorkflowSchema (+35 more)

### Community 9 - "database.service.ts"
Cohesion: 0.09
Nodes (19): better-sqlite3, vitest, FileScannerOptions, ScannedFileInfo, incrementalIndexer, IndexingProgressCallback, RetrievalOptions, hybridSearchService (+11 more)

### Community 10 - "parsers/index.ts"
Cohesion: 0.14
Nodes (14): 6.4 Stream Parser Architecture & Deduplication, 1. Claude Code (`claude-code.adapter.ts`), 2. OpenAI Codex CLI (`codex.adapter.ts`), 3. Google Gemini CLI (`gemini.adapter.ts`), 4. Ollama Local Adapter (`ollama.adapter.ts`) — **CRITICAL DEFECT IDENTIFIED**, 5. AI Provider Integration Audit, Detailed Provider Findings:, ClaudeStreamParser (+6 more)

### Community 11 - "DesignSystemGenerator"
Cohesion: 0.13
Nodes (3): DesignSystemGenerator, _resolve_dial(), TestReasoningMatch

### Community 12 - "tokenCounterService"
Cohesion: 0.16
Nodes (9): 1. Model & Provider Context Calibration, 3. Empirical Scale Benchmarks, B. Phase 3 Audit & Technical Hardening, 11. `build_context`, 2.2 Context Nodes, 7. `search_workspace`, 8. `read_file`, 9. `search_files` (+1 more)

### Community 13 - "phase8-intelligence-validation.test.ts"
Cohesion: 0.18
Nodes (10): 1.5 Tool Output Normalization & Raw Audit Trail, NormalizeOptions, ToolOutputNormalizer, NormalizedToolOutput, BenchmarkReport, 1. Semantic Whitespace & Formatting Compression, 2. Progressive Skill Loading (3 Levels), 3. Cross-Section Deduplication (+2 more)

### Community 14 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, allowImportingTsExtensions, baseUrl, composite, isolatedModules, jsx, lib, module (+17 more)

### Community 15 - "package.json"
Cohesion: 0.07
Nodes (27): author, description, license, main, name, version, autoprefixer, chokidar (+19 more)

### Community 16 - "bug-fixing/manifest.json"
Cohesion: 0.08
Nodes (23): author, category, contextRequirements, indexingNeeded, maxContextTokens, description, executionConstraints, maxRetries (+15 more)

### Community 17 - "bug-investigation/manifest.json"
Cohesion: 0.08
Nodes (23): author, category, contextRequirements, indexingNeeded, maxContextTokens, description, executionConstraints, maxRetries (+15 more)

### Community 18 - "code-explanation/manifest.json"
Cohesion: 0.08
Nodes (23): author, category, contextRequirements, indexingNeeded, maxContextTokens, description, executionConstraints, maxRetries (+15 more)

### Community 19 - "code-review/manifest.json"
Cohesion: 0.08
Nodes (23): author, category, contextRequirements, indexingNeeded, maxContextTokens, description, executionConstraints, maxRetries (+15 more)

### Community 20 - "documentation/manifest.json"
Cohesion: 0.08
Nodes (23): author, category, contextRequirements, indexingNeeded, maxContextTokens, description, executionConstraints, maxRetries (+15 more)

### Community 21 - "performance-analysis/manifest.json"
Cohesion: 0.08
Nodes (23): author, category, contextRequirements, indexingNeeded, maxContextTokens, description, executionConstraints, maxRetries (+15 more)

### Community 22 - "project-understanding/manifest.json"
Cohesion: 0.08
Nodes (23): author, category, contextRequirements, indexingNeeded, maxContextTokens, description, executionConstraints, maxRetries (+15 more)

### Community 23 - "refactoring/manifest.json"
Cohesion: 0.08
Nodes (23): author, category, contextRequirements, indexingNeeded, maxContextTokens, description, executionConstraints, maxRetries (+15 more)

### Community 24 - "security-review/manifest.json"
Cohesion: 0.08
Nodes (23): author, category, contextRequirements, indexingNeeded, maxContextTokens, description, executionConstraints, maxRetries (+15 more)

### Community 25 - "test-generation/manifest.json"
Cohesion: 0.08
Nodes (23): author, category, contextRequirements, indexingNeeded, maxContextTokens, description, executionConstraints, maxRetries (+15 more)

### Community 26 - "MultiTierCacheService"
Cohesion: 0.16
Nodes (6): 1.2 Deterministic Response Cache Safety & Isolation Boundary, registerIpcHandlers(), LRUCache, MultiTierCacheService, 4. Multi-Tier Intelligent Caching & Security Boundary, Cache Invalidation, Workspace Isolation & Safety

### Community 27 - "WorktreeManager"
Cohesion: 0.25
Nodes (3): execFileAsync, WorktreeManager, TEST_DIR

### Community 28 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, baseUrl, composite, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noImplicitAny (+9 more)

### Community 30 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, better-sqlite3, chokidar, clsx, drizzle-orm, @glass-sdk/liquid-glass, js-tiktoken, lucide-react (+9 more)

### Community 31 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, autoprefixer, drizzle-kit, electron, @electron/rebuild, electron-vite, postcss, tailwindcss (+8 more)

### Community 32 - "ExtensionRecord"
Cohesion: 0.10
Nodes (24): 11.2 Custom Extension SDK & Sandboxed Lifecycle Engine, ExtensionHostInstance, ExtensionLoader, extensionRegistry, OSPlatform, OSSandboxCapabilities, OSSandboxMode, OSSandboxSpawnOptions (+16 more)

### Community 33 - "SkillPermissions"
Cohesion: 0.15
Nodes (13): 1. Executive Summary & Vision, 2. Skills Engine Architecture Diagram, 3. Skill Manifest Specification (`manifest.json`), 4. Built-in Skills Catalog, 5. Security & Permission Enforcement Model, 6. Custom Skills Import Lifecycle, Core Architecture Principles, Policy Tiers: (+5 more)

### Community 34 - "Detailed Task Breakdown"
Cohesion: 0.17
Nodes (11): 1. Code Explanation, 2. Bug Investigation (Verbose Terminal Logs), 3. Multi-Skill Code Generation, 4. Deterministic Response Caching, 5. Large Git Diff Review, Benchmark Overview, Benchmark Results Summary, Detailed Task Breakdown (+3 more)

### Community 36 - "Architectural Decision Records (ADRs) — AI Workspace"
Cohesion: 0.07
Nodes (21): ADR-001: Desktop Framework Stack — Electron 34, React 19, Vite 6, TypeScript Strict, ADR-002: Dual-Database SQLite Architecture (`app.sqlite` and `index.sqlite`), ADR-003: Unified Adapter Pattern for AI CLI Providers, ADR-004: Tree-sitter WASM ABI 14 for Cross-Platform AST Parsing, ADR-005: SQLite FTS5 with BM25 Ranking as Primary Search Engine, ADR-006: Three-Tier Context Freshness with Race-Resilient Live Disk Reads, ADR-007: Declarative Skills Manifests with Progressive Dynamic Loading, ADR-008: Git Worktree Sandboxing for Multi-Agent Orchestration (+13 more)

### Community 37 - "2. Layer-by-Layer Verification & Mitigations"
Cohesion: 0.17
Nodes (11): 1. Security Philosophy: Local-First Zero-Trust, 2.1 Electron Renderer Sandbox, 2.3 Shell Injection Immunity, 2.4 Token Exfiltration & Keyring Safeguards, 2.5 Skills Engine Permissions, 2.6 Git Worktree Isolation & Host Protection, 2.7 Human-in-the-Loop Multi-Agent Execution Modes, 2.8 Visual Workflow & Expression Evaluation Security Guardrails (+3 more)

### Community 38 - "executionEngine"
Cohesion: 0.31
Nodes (3): executionEngine, activeSession, checkPortOpen()

### Community 40 - "ast-parser.service.ts"
Cohesion: 0.23
Nodes (6): web-tree-sitter, astParserService, ParseResult, CodeChunk, FileSymbol, SymbolKind

### Community 42 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, format, lint, postinstall, start, test (+2 more)

### Community 43 - "IElectronAPI"
Cohesion: 0.08
Nodes (34): zod, api, Window, Window, ApprovalType, CancelOrchestrationSchema, GetOrchestrationSchema, GetWorktreeDiffSchema (+26 more)

### Community 44 - "ErrorBoundary"
Cohesion: 0.20
Nodes (3): ErrorBoundary, Props, State

### Community 45 - "Multi-Agent Orchestration Architecture & Implementation — AI Workspace"
Cohesion: 0.12
Nodes (16): 10.1 Invocations (`window.api`), 10.2 Live Broadcast Events (`agents:event`), 10. IPC API & Event Contracts, 11. Verification & Automated Test Coverage, 1. Vision & Core Problem Statement, 2. High-Level Orchestration Architecture, 3.1 Node Structure, 3.2 Topological Scheduling (+8 more)

### Community 46 - "AI Workspace — Comprehensive Security Audit Report"
Cohesion: 0.12
Nodes (16): 3.1 BrowserWindow Security Configuration, 3.2 External Navigation & Protocol Restraints, 3.3 Strict Content Security Policy (CSP), 3.4 IPC Contract & Input Validation, 3. Electron, WebContents & IPC Hardening, 4.1 Path Traversal & Symlink Escapes, 4.3 Permission Tier Enforcement, 4. Multi-Agent, Workflow & Filesystem Security (+8 more)

### Community 47 - "allowScripts"
Cohesion: 0.33
Nodes (6): allowScripts, better-sqlite3@11.10.0, electron@34.5.8, esbuild@0.18.20, esbuild@0.19.12, esbuild@0.25.12

### Community 48 - "workspace.store.ts"
Cohesion: 0.12
Nodes (23): NewProjectModalProps, TEMPLATES, FlatNode, TerminalSurfaceProps, AppSection, FileSymbolItem, flushSaveWorkspaceState(), GitStatusData (+15 more)

### Community 49 - "persistent-workspace-phase4.test.ts"
Cohesion: 0.12
Nodes (10): CreateDirectorySchema, CreateFileSchema, DeleteItemSchema, GetProjectWorkspaceStateSchema, MoveItemSchema, RenameItemSchema, RevealInFileManagerSchema, SaveAppLayoutSchema (+2 more)

### Community 50 - "OrchestrationTask"
Cohesion: 0.19
Nodes (10): 9. Implemented Component Inventory, ADR-009: Directed Acyclic Graph (DAG) with Topological Concurrency Scheduling, CoordinatorAgent, PlanOptions, DAGValidationResult, DAGValidator, SpecialistDefinition, ROLE_COLORS (+2 more)

### Community 51 - "System Architecture Specification — AI Workspace"
Cohesion: 0.11
Nodes (18): 10.1 System Architecture, 10.2 Node Architecture & Categories, 10.3 Execution Semantics & Data Mapping, 10. Visual Automation & Flow Builder Architecture (Phase 6 Completed), 1. System Topology & Process Boundary Model, 2. Dependency Stability & Compatibility Matrix, 3.1 Split Database Architecture: `app.sqlite` vs `index.sqlite`, 3.2 WAL Configuration, Transactions & Concurrency Control (+10 more)

### Community 52 - "Extension Isolation Security Remediation Report: Replacing node:vm with Process-Level Isolation"
Cohesion: 0.12
Nodes (15): 1.1 The Vulnerability of `node:vm`, 1.2 Remediated Architecture, 1. Executive Summary & Root Cause Analysis, 3.1 Child Process Isolation Boundaries, 3. Process-Level Isolation Architecture, 4.1 Capability Specification, 4.2 Server-Side Authorization Rules in Main Process, 4. Capability-Based Extension API (+7 more)

### Community 54 - "2.1 AI Nodes"
Cohesion: 0.06
Nodes (30): 12. `condition`, 13. `switch`, 14. `merge`, 15. `loop`, 16. `delay`, 17. `parallel`, 18. `manual_trigger`, 19. `text_input` (+22 more)

### Community 55 - "context-assembly.service.ts"
Cohesion: 0.26
Nodes (6): 2. Race-Condition-Free Live Disk Reads, 2. Repository Audit Findings (Phases 1–6), AssemblyOptions, contextAssemblyService, contextRetrievalService, ContextFragment

### Community 57 - "3. Product Architecture & Functional Modules"
Cohesion: 0.07
Nodes (27): 1.1 Vision Statement, 1.2 Core Product Principles, 1. Executive Summary & Vision, 2.1 Persona A: The Aspiring Creator / Beginner ("Alex"), 2.2 Persona B: The Senior Software Engineer / Power User ("Elena"), 2. Target Personas & User Journeys, 3.10 Module 10: Custom Extension SDK & Sandboxed Lifecycle Engine, 3.1 Module 1: Workspace Manager (+19 more)

### Community 60 - "executionEngine"
Cohesion: 0.18
Nodes (10): 1. Engine Architecture & Components, 2. Built-in Skills Catalog, 3. Skills Manager UI, Automated Quality Gates, Autonomous Development Mission Report: AI Workspace, C. Phase 4 Implementation Details: Skills Engine, D. Phase 5 Preparation: Multi-Agent Orchestration Specification, E. Verification & Quality Assurance Results (+2 more)

### Community 61 - "workspaceService"
Cohesion: 0.11
Nodes (5): 4. Feature Status Matrix, [HIGH] SEC-02: TOCTOU Symlink / Path Traversal Race in Filesystem Operations, execFileAsync, workspaceService, ProjectWorkspaceState

### Community 63 - "AI Workspace — Open-Source Production Release Guide"
Cohesion: 0.12
Nodes (15): 1.1 Developer & Build Machine Requirements, 1.2 Optional AI Provider Integrations, 1. System Requirements & Prerequisites, 2. Production Build Pipeline, 3.1 Windows Distribution, 3.2 macOS Distribution, 3.3 Linux Distribution, 3. Cross-Platform Packaging with Electron Builder (+7 more)

### Community 64 - "IntelligenceGraphWorkspace.tsx"
Cohesion: 0.20
Nodes (15): react, App(), AppLoadingScreen(), AppLoadingScreenProps, InitStep, BottomPanel(), CommandPalette(), GraphControlsProps (+7 more)

### Community 65 - "main/index.ts"
Cohesion: 0.17
Nodes (8): electron, electronExecutable, path, result, { spawnSync }, vitestArgs, vitestEntry, gotTheLock

### Community 66 - "Frontend Design Pro"
Cohesion: 0.11
Nodes (18): 1. Learn the Product Before Styling, 2. Set a Concrete Visual Direction, 3. Use the Design-Intelligence Search, 4. Implement the Complete Experience, 5. Verify, Then Refine, Color and Surfaces, Frontend Design Pro, Icons and Assets (+10 more)

### Community 67 - "AI Workspace — Empirical Performance & Scalability Audit Report"
Cohesion: 0.11
Nodes (17): 1.1 Process Memory Footprint, 1.2 Resource Separation, 1. Measured Resource Footprint, 2.1 Benchmark Results, 2. Storage & SQLite Database Performance, 3.1 Workspace Indexing Throughput, 3.2 Context Assembly Latency, 3. Context Intelligence Engine Benchmarks (+9 more)

### Community 68 - "AI Workspace — Phase 8 Completion Report: Intelligence & Token Optimization Engine"
Cohesion: 0.15
Nodes (12): 1. Executive Summary, 2. Key Optimization Results & Benchmarks, 3.1 Centralized Prompt Assembly, 3.2 Progressive Skill Loading, 3.3 Multi-Tier Intelligent Caching, 3.4 Capability & Cost Model Routing, 3.5 Tool & Diff Normalization, 3. Architecture & Service Implementations (+4 more)

### Community 69 - "Custom Extension SDK & Plugin Architecture — AI Workspace"
Cohesion: 0.08
Nodes (21): 1. Overview & Philosophy, 2. Extension Directory Layout, 3. Extension Manifest Specification (`extension.json`), 4. Permission Scopes & Guardrails, 5.1 Architecture & Runtime Sandboxing Properties, 5.2 Capability Namespaces (`ExtensionContext`), 5.3 Extension Entrypoint Lifecycle (`index.js`), 5. OS-Level Sandboxing & Capability-Based API (Extension Security 2.0) (+13 more)

### Community 70 - "1. Comprehensive Subsystem Audit Findings"
Cohesion: 0.17
Nodes (12): 1.10 Air-Gap Isolation Engine, 1.11 Sandboxed Extension SDK (Extension Security 2.0), 1.12 Analytics & Audit Kernel, 1.1 Electron Main, Preload & Renderer Architecture, 1.2 IPC Contracts & Validation, 1.4 CLI Engine & Provider Adapters, 1.5 Context Intelligence Engine, 1.6 Skills Engine & Dynamic Loading (+4 more)

### Community 71 - "IntelligenceGraphWorkspace.tsx"
Cohesion: 0.36
Nodes (9): GraphCanvas(), GraphCanvasProps, SimNode, GraphControls(), IntelligenceGraphWorkspace(), NodeDetailsPanel(), NodeDetailsPanelProps, ProjectGraphEdge (+1 more)

### Community 72 - "appLogger"
Cohesion: 0.19
Nodes (5): 6.3 Seven Normalized Authentication States, 2.11 Immutable Enterprise Audit Logging, 10. `get_project_info`, 29. `create_git_commit`, appLogger

### Community 73 - "core.py"
Cohesion: 0.21
Nodes (5): _domain_keywords(), _load_csv(), _load_product_keywords(), _normalize(), _search_csv()

### Community 74 - "AirGapViolationException"
Cohesion: 0.22
Nodes (9): 11.1 Local Model & Air-Gap Isolation Engine, 11.3 Advanced Analytics, Cost Attribution & Enterprise Audit, 11. Phase 7 Architecture: Ecosystem, Air-Gap & Enterprise Hardening, ADR-015: Local Model (Ollama) Air-Gap Isolation Architecture, 1.1 Architecture & Enforced Controls, 1.2 Loopback Allowlisting Verification, 1.3 Threat Model & Explicit Guarantees, 1. Air-Gap Mode & Network Isolation Audit (+1 more)

### Community 75 - "workflow-generator.ts"
Cohesion: 0.25
Nodes (12): 3. Natural Language Workflow Generation, WorkflowGenerator, buildTemplate(), WORKFLOW_TEMPLATES, WorkflowValidationResult, WorkflowValidator, createNodeData(), NODE_REGISTRY (+4 more)

### Community 76 - "AI Workspace — Extension Security 2.0: OS-Level Sandboxing Report"
Cohesion: 0.20
Nodes (9): 1. Audit Findings & Threat Model: Standard Child Process vs OS Sandboxing, 2. Multi-Layer OS & Runtime Sandboxing Architecture, 3. Platform-by-Platform Security Comparison, 4. Resource Limits & Quotas, 5. Graceful Degradation & Untrusted Third-Party Gating, 6. Security Testing & Adversarial Verification, AI Workspace — Extension Security 2.0: OS-Level Sandboxing Report, Executive Summary (+1 more)

### Community 77 - "1. Audit Findings & Implemented Hardening"
Cohesion: 0.20
Nodes (8): 1.1 Tokenizer Accuracy & Model-Aware Evaluation, 1. Audit Findings & Implemented Hardening, 2. Unbundled Optimization Metrics: Disaggregating the 67.7% Claim, 3. Verification & Test Suite Summary, 4. Release Readiness Conclusion, AI Workspace — Phase 8.1: Intelligence Validation & Optimization Hardening Report, Executive Summary, Summary of Disaggregated Measurement:

### Community 78 - "BM25"
Cohesion: 0.18
Nodes (3): BM25, _get_bm25(), TestTokenizer

### Community 79 - "ArcLauncherModal.tsx"
Cohesion: 0.35
Nodes (14): ArcLauncherModal(), ArcLauncherModalProps, AntigravityLogo(), BashLogo(), ClaudeLogo(), CmdLogo(), CodexLogo(), GeminiLogo() (+6 more)

### Community 80 - "AI Coding Agent Instructions — Orc AI Workspace"
Cohesion: 0.20
Nodes (7): 1. Core Operating Principles: Graphify + Ponytail, 2. Non-Negotiable Quality & Security Standards, 3. Context & Token Conservation, 4. Design & UX System Rules (Anti-Boxiness & Clean Typography), AI Coding Agent Instructions — Orc AI Workspace, Graphify (Codebase Intelligence), Ponytail (Simplicity-First Engineering)

### Community 81 - "AI Workspace — Project Context & Engineering Architecture"
Cohesion: 0.22
Nodes (8): 1. Project Purpose, 2. Technology Stack, 3. High-Level Architecture, 4. Key Directories, 5. Core Modules & Responsibilities, 6. Implementation & Development Commands, 7. Known Constraints & Conventions, AI Workspace — Project Context & Engineering Architecture

### Community 82 - "Workflow Execution Engine Specification — AI Workspace"
Cohesion: 0.14
Nodes (11): K. Persistence and Recovery, 1. Engine Architecture & Responsibilities, 2. Graph Validation & Cycle Detection, 3.1 Parameter Mapping, 3.2 Conditional Pruning & Skipping, 3.3 Sandboxed Expression Evaluator, 3. Dataflow & Branching Semantics, 4. Trigger Management & Automation (+3 more)

### Community 83 - "cli.ts"
Cohesion: 0.17
Nodes (11): AuthType, CancelCLISessionSchema, CheckCLIAuthSchema, CLIAuthDetailedState, CLIProviderEnum, CLISessionMessage, CLIStreamEvent, DetectCLIsSchema (+3 more)

### Community 84 - "CodeEditor.tsx"
Cohesion: 0.18
Nodes (14): 11. Performance and Reliability Findings, D. Editor, CodeEditor(), highlightCode(), ShareCodeModal(), ShareCodeModalProps, TopTabBar(), Devicon() (+6 more)

### Community 85 - "PromptAssemblyService"
Cohesion: 0.12
Nodes (15): H. Skills Engine, 1.3 Prompt Assembly Correctness & Mandatory Section Protection, 1. XML Tags (`providerFormat: 'xml_tags'`), 2. Structured Markdown (`providerFormat: 'markdown'`), Canonical 8-Section Hierarchy, Centralized Prompt Engineering & Assembly Specification, Deterministic Fingerprinting & Caching, Overview (+7 more)

### Community 86 - "RightPanel.tsx"
Cohesion: 0.18
Nodes (16): FileExplorer(), CreateFileOrFolderModal(), CreateModalProps, DeleteConfirmModal(), DeleteModalProps, RenameModal(), RenameModalProps, CLOUD_PROVIDER_MODELS (+8 more)

### Community 87 - "Ponytail"
Cohesion: 0.33
Nodes (5): Bug Fixes, Ponytail, Quality and Security Non-Negotiables, Rules, The Ladder

### Community 88 - "generate_design_system"
Cohesion: 0.22
Nodes (4): ansi_ljust(), format_ascii_box(), hex_to_ansi(), section_header()

### Community 89 - "Testing Strategy & Quality Assurance Architecture — AI Workspace"
Cohesion: 0.33
Nodes (5): 1. Testing Philosophy & Quality Principles, 2. Test Suite Hierarchy, 3. Automated Quality Gates, 4. Empirical Performance Benchmarks Summary, Testing Strategy & Quality Assurance Architecture — AI Workspace

### Community 91 - "SkillCompositionService"
Cohesion: 0.25
Nodes (6): 1.4 Skill Composition Quality & Conflict Resolution, BUILTIN_OPERATIONAL_SUMMARIES, SkillCompositionService, ComposedSkillInstructions, SkillLoadingLevel, SkillOperationalSummary

### Community 92 - "Pre-Delivery Checklist (canonical — the only one)"
Cohesion: 0.15
Nodes (12): Accessibility, Common Rules for Professional UI + Pre-Delivery Checklist, Icons & Visual Elements, Interaction, Interaction (App), Layout, Layout & Spacing, Light/Dark Mode (+4 more)

### Community 93 - "Surgical Bug Fixer Guidelines"
Cohesion: 0.50
Nodes (3): Core Rules, Output Format, Surgical Bug Fixer Guidelines

### Community 94 - "Bug Investigator & Diagnostics Guidelines"
Cohesion: 0.50
Nodes (3): Bug Investigator & Diagnostics Guidelines, Investigation Methodology, Output Format

### Community 95 - "Code Explainer & Mental Model Builder Guidelines"
Cohesion: 0.50
Nodes (3): Code Explainer & Mental Model Builder Guidelines, Explanation Strategy, Output Format

### Community 96 - "Code Review Specialist Guidelines"
Cohesion: 0.50
Nodes (3): Code Review Specialist Guidelines, Output Format, Review Methodology

### Community 97 - "Technical Documentation Specialist Guidelines"
Cohesion: 0.50
Nodes (3): Documentation Principles, Output Format, Technical Documentation Specialist Guidelines

### Community 98 - "Performance & Bottleneck Analyst Guidelines"
Cohesion: 0.50
Nodes (3): Output Format, Performance Analysis Dimensions, Performance & Bottleneck Analyst Guidelines

### Community 99 - "Project Architecture & Onboarding Guide Guidelines"
Cohesion: 0.50
Nodes (3): Architecture Exploration Steps, Output Format, Project Architecture & Onboarding Guide Guidelines

### Community 100 - "Refactoring & Clean Code Engineer Guidelines"
Cohesion: 0.50
Nodes (3): Output Format, Refactoring & Clean Code Engineer Guidelines, Refactoring Tenets

### Community 101 - "Security & Vulnerability Auditor Guidelines"
Cohesion: 0.50
Nodes (3): Audit Focus Areas, Output Format, Security & Vulnerability Auditor Guidelines

### Community 102 - "Test Suite Generator Guidelines"
Cohesion: 0.50
Nodes (3): Output Format, Test Suite Generator Guidelines, Testing Principles

### Community 103 - "Quick Reference"
Cohesion: 0.15
Nodes (12): 10. Charts & Data (LOW), 1. Accessibility (CRITICAL), 2. Touch & Interaction (CRITICAL), 3. Performance (HIGH), 4. Style Selection (HIGH), 5. Layout & Responsive (HIGH), 6. Typography & Color (MEDIUM), 7. Animation (MEDIUM) (+4 more)

### Community 104 - "intelligence.ts"
Cohesion: 0.33
Nodes (8): PromptAssemblyOptions, RouteTaskOptions, IntelligenceConfig, IntelligenceConfigSchema, OptimizationMode, PromptAssemblyResult, PromptSectionType, TaskCategory

### Community 105 - "AI Workspace — Production Readiness & Release Engineering Report"
Cohesion: 0.20
Nodes (8): 2. Security Audit Summary, 3. Performance & Resource Audit Summary, 4. Cross-Platform Compatibility Matrix, 5. Explicit Limitations & Boundaries, 6. Release Verification Checklist, AI Workspace — Production Readiness & Release Engineering Report, Executive Summary & Final Classification, Final Verdict: **READY WITH LIMITATIONS**

### Community 106 - "6. OS-Level Isolation & Platform Boundaries"
Cohesion: 0.40
Nodes (5): 6.1 Windows, 6.2 Linux, 6.3 macOS, 6.4 Explicit System Boundary Notice, 6. OS-Level Isolation & Platform Boundaries

### Community 109 - "WorkflowExecutionRecord"
Cohesion: 0.20
Nodes (3): NodeExecutionRecord, WorkflowExecutionRecord, TEST_DB_DIR

### Community 111 - "5. Summary of Roadmap Phases (Phases 2 to 7)"
Cohesion: 0.22
Nodes (8): 1. Roadmap Overview & Strategic Phases, 2. Phase Execution Status & Work Packages, 3.1 Cross-Platform Matrix, 3.2 Mandatory Functional & Security Gates (Release Blockers), 3.3 Empirical Performance Targets (Reference Hardware: 4C/8T, 16GB RAM, NVMe), 3. Objective Acceptance Tests for Phase 1, 4. Technical Risk Register, Product & Engineering Roadmap — AI Workspace

### Community 112 - "validate_data.py"
Cohesion: 0.36
Nodes (3): _check_file(), main(), _read_rows()

### Community 113 - "search"
Cohesion: 0.21
Nodes (4): search(), search_stack(), _suggest_terms(), TestSearchDomains

### Community 114 - "auditService"
Cohesion: 0.18
Nodes (11): AirGapConfigSchema, AnalyticsEvent, AnalyticsFeature, AnalyticsStatus, AnalyticsSummary, AuditLogEntry, AuditLogFilter, AuditSeverity (+3 more)

### Community 115 - "skill-execution-engine.ts"
Cohesion: 0.14
Nodes (12): MODEL_WINDOW_CONFIGS, ModelWindowConfig, TokenCountConfidence, TokenCountMethod, TokenCountResult, TokenEvaluationResult, CacheEntry, CacheStats (+4 more)

### Community 116 - "6. CLI Engine Architecture & Robust Integration"
Cohesion: 0.40
Nodes (5): 6.1 Unified Adapter Interface (`ICLIAdapter`), 6.2 Provider Capability & Reality Matrix, 6.5 Process Lifecycle & Clean Tree Termination, 6.6 Session Management & Local Persistence, 6. CLI Engine Architecture & Robust Integration

### Community 117 - "ProjectCustomizeModal.tsx"
Cohesion: 0.22
Nodes (15): LeftSidebar(), NewProjectModal(), COLOR_PRESETS, ICON_PRESETS, ProjectCustomizeModal(), ProjectIconRenderer(), ProjectSettingsModal(), PROVIDERS (+7 more)

### Community 118 - "reviewer-agent.ts"
Cohesion: 0.43
Nodes (4): execAsync, ReviewerAgent, ReviewResult, TEST_DIR

### Community 119 - "IntelligenceRouter"
Cohesion: 0.15
Nodes (14): 12.1 Canonical Prompt Assembly (`PromptAssemblyService`), 12.2 Progressive Skill Composition (`SkillCompositionService`), 12.3 Multi-Tier Intelligent Caching (`MultiTierCacheService`), 12.4 Intelligent Model & Provider Routing (`IntelligenceRouter`), 12.5 Tool Output Normalization (`ToolOutputNormalizer`), 12. Phase 8 Architecture: Intelligence & Token Optimization Engine, 5. Summary of Roadmap Phases (Phases 2 to 7), 1. Task Classification Matrix (+6 more)

### Community 121 - "Flow Builder Architecture & User Experience — AI Workspace"
Cohesion: 0.25
Nodes (7): 1. Overview & Vision, 2.1 Central Infinite Canvas, 2.2 Node Library, 2.3 Dual Experience: Simple Mode vs. Advanced Mode, 2. Interface Topology & Visual Components, 4. Built-in Production Templates, Flow Builder Architecture & User Experience — AI Workspace

### Community 122 - "generate_design_system"
Cohesion: 0.33
Nodes (3): format_markdown(), generate_design_system(), TestPersistence

### Community 123 - "FlowBuilderWorkspace.tsx"
Cohesion: 0.32
Nodes (6): @xyflow/react, CATEGORY_COLORS, CustomFlowNode, NODE_ICONS, nodeTypes, FlowNodeData

### Community 125 - "app-logger.ts"
Cohesion: 0.50
Nodes (3): LogLevel, SENSITIVE_PATTERNS, SystemLogEntry

### Community 126 - "4. Context Engine Reliability & Hybrid Retrieval"
Cohesion: 0.33
Nodes (6): 4.1 Incremental Indexing & Fast Hashing, 4.2 Handling Unindexed Files, Modified Files & Interrupted Indexing, 4.3 Structural Code Intelligence with Tree-sitter (WASM Runtime), 4.4 Token Optimization & Precise Budgeting, 4.5 Context Inspector UI, 4. Context Engine Reliability & Hybrid Retrieval

### Community 127 - "9. Multi-Agent Orchestration Architecture (Phase 5 Completed)"
Cohesion: 0.33
Nodes (6): 9.1 Orchestration Subsystem Structure, 9.2 Specialized Agent Personas & Skill Bindings, 9.3 Git Worktree Isolation & Lifecycle (`WorktreeManager`), 9.4 State Persistence & Crash Recovery (`databaseService`), 9.5 Agents Workspace UI (`AgentsWorkspace.tsx`), 9. Multi-Agent Orchestration Architecture (Phase 5 Completed)

### Community 128 - "workflowEngine"
Cohesion: 0.36
Nodes (4): 8. Workflow Builder Audit, Verdict: REAL EXECUTION ENGINE (Not a visual mockup), workflowEngine, NodeExecutionStatus

### Community 129 - "AgentWorker"
Cohesion: 0.22
Nodes (8): 9. End-to-End Integration Findings, Workflow 1 — Project to AI Execution, Workflow 2 — Multi-Agent Execution, Workflow 3 — File Changes, Workflow 4 — Restart Recovery, Workflow 5 — Skills and Context, AgentWorker, TEST_DIR

### Community 130 - "agentOrchestrator"
Cohesion: 0.29
Nodes (3): agentOrchestrator, OrchestrationEvent, OrchestrationRecord

### Community 131 - "manifest-validator.ts"
Cohesion: 0.36
Nodes (5): ManifestValidator, ValidationResult, SkillsCapability, SkillManifest, SkillManifestSchema

### Community 132 - "node-executors.ts"
Cohesion: 0.13
Nodes (11): SPECIALIST_ROLES, airGapManager, EvaluationContext, execFileAsync, NODE_EXECUTORS, NodeExecutionContext, NodeExecutionHandler, NodeExecutionOutput (+3 more)

### Community 133 - "ProjectDescriptor"
Cohesion: 0.31
Nodes (3): ProjectCustomizeModalProps, ProjectSettingsModalProps, ProjectDescriptor

### Community 134 - "5. Security Kernel: Runtime Enforcement & Defense-in-Depth"
Cohesion: 0.50
Nodes (4): 5.1 Filesystem Runtime Enforcement & Symlink Defense, 5.2 Terminal, Command Chaining & Indirect Execution Guard, 5.3 Impossibility of Autonomous Privilege Escalation, 5. Security Kernel: Runtime Enforcement & Defense-in-Depth

### Community 135 - "10. Security Audit"
Cohesion: 0.25
Nodes (7): 10. Security Audit, C. File Explorer, [HIGH] SEC-01: Terminal Shell Execution Bypasses Project Permission Tier, [HIGH] SEC-03: SafeStorage Plaintext Base64 Fallback without OS Keychain, [MEDIUM] SEC-04: Full Parent Process Environment Leak to CLI Processes, [MEDIUM] SEC-05: Dev Mode Content Security Policy Allows Unsafe-Eval and Inline Scripts, 2.2 Path Traversal & Symlink Escapes

### Community 136 - "3. Complete Feature Inventory"
Cohesion: 0.25
Nodes (8): 3. Complete Feature Inventory, A. Application Foundation, B. Project Management, E. Terminals, F. AI Provider Integrations, G. Agents and Orchestration, I. Context Engine, J. Workflow Builder

### Community 137 - "15. Prioritized Remediation Roadmap"
Cohesion: 0.33
Nodes (5): 15. Prioritized Remediation Roadmap, P0 — Critical (Security & Blocker Fixes), P1 — High (Core Integration Gaps & Test Infrastructure), P2 — Medium (Usability & Mock Removal), P3 — Low (Polish & Optimization)

### Community 138 - "Intelligence Engine Architecture — AI Workspace"
Cohesion: 0.33
Nodes (5): Architecture Diagram, Intelligence Engine Architecture — AI Workspace, Progressive Skill Composition & Conflict Resolution, Security Boundaries & Safety Guarantees, System Overview

### Community 139 - "agent-orchestrator.ts"
Cohesion: 0.53
Nodes (4): StartOrchestrationParams, SchedulerOptions, ExecutionMode, OrchestrationEventType

### Community 141 - "2.2 Implemented OS-Level Sandboxing Architecture (Extension Security 2.0)"
Cohesion: 0.40
Nodes (5): 2.10 Custom Extension Security 2.0: OS-Level Sandboxing & Capability Gate, 2.1 Critical Vulnerability Finding: Insecurity of node:vm, 2.2 Implemented OS-Level Sandboxing Architecture (Extension Security 2.0), 2. Extension SDK & Untrusted Code Execution Boundary, exec()

## Knowledge Gaps
- **17 isolated node(s):** `clsx`, `drizzle-orm`, `tailwind-merge`, `tree-sitter-wasms`, `@electron/rebuild` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 926 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Multi-Agent Orchestration Architecture & Implementation — AI Workspace` connect `Multi-Agent Orchestration Architecture & Implementation — AI Workspace` to `executionEngine`, `AgentScheduler`, `OrchestrationTask`, `reviewer-agent.ts`, `WorktreeManager`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `databaseService` (e.g. with `14. Critical Issues (Root Causes)` and `Root Cause of Test Failures:`) actually correct?**
  _`databaseService` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `clsx`, `drizzle-orm`, `tailwind-merge` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `workflows.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Why does `7. Permission Tiers & Human-in-the-Loop Safeguards` connect `Multi-Agent Orchestration Architecture & Implementation — AI Workspace` to `validate_data.py`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Should `useWorkspaceStore` be split into smaller, more focused modules?**
  _Cohesion score 0.1251778093883357 - nodes in this community are weakly interconnected._
- **Why does `executionEngine` connect `executionEngine` to `skill-registry.ts`, `CLIProvider`, `execution-engine.ts`, `10. Security Audit`, `Full Integration & Reliability Audit — AI Workspace (Phase 5)`, `register.ts`, `database.service.ts`, `Multi-Agent Orchestration Architecture & Implementation — AI Workspace`, `skill-execution-engine.ts`, `executionEngine`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._