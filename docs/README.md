# Orbito — Documentation Index

Welcome to the central documentation index for **Orbito** (Orc AI Workspace). This index provides categorized access to all architecture specifications, development guides, audit reports, and reference manuals.

---

## 1. System & Engine Architecture (`docs/architecture/`)

Core system design, security models, intelligence engine, and execution specifications:

- [Core System Architecture](./architecture/ARCHITECTURE.md) — Comprehensive system architecture, Electron IPC bridge, and state models.
- [Architectural Decision Records (ADRs)](./architecture/DECISIONS.md) — Historical and active architectural decisions and rationale.
- [Security Model & Defense-in-Depth](./architecture/SECURITY_MODEL.md) — Sandboxing, IPC isolation, path traversal prevention, and privilege boundaries.
- [Intelligence Engine Architecture](./architecture/INTELLIGENCE_ENGINE.md) — Multi-model cognitive routing, skill matching, and execution pipelines.
- [Prompt Assembly Specification](./architecture/PROMPT_ASSEMBLY.md) — Canonical 8-section assembly algorithm, compression, and budget enforcement.
- [Token Optimization Architecture](./architecture/TOKEN_OPTIMIZATION.md) — AST pruning, context caching, and token budget strategies.
- [Skills Engine Specification](./architecture/SKILLS_ENGINE.md) — Domain skill contracts, AST schema parsers, and execution hooks.
- [Workflow Execution Engine](./architecture/WORKFLOW_ENGINE.md) — DAG graph execution, node evaluation, and error handling.
- [Flow Builder Architecture](./architecture/FLOW_BUILDER.md) — Visual automation canvas, node connections, and UX principles.

---

## 2. Development Guides & Governance (`docs/development/`)

Guides for human developers and AI engineering agents:

- [Development Guide & Knowledge Base](./development/DEVELOPMENT_GUIDE.md) — Setup instructions, development workflows, and codebase conventions.
- [AI Context & Architecture Overview](./development/AI_CONTEXT.md) — Essential architectural summary and guidelines for AI coding agents.
- [Testing Strategy & QA Architecture](./development/TESTING_STRATEGY.md) — Vitest test runner configuration, coverage standards, and mock conventions.
- [Permanent Repository Organisation Policy](./development/REPOSITORY_ORGANISATION.md) — Root organization rules, documentation guidelines, and validator configuration.

---

## 3. Multi-Agent System (`docs/agents/`)

Autonomous multi-agent engineering coordination and orchestration:

- [Agent Orchestration Architecture](./agents/AGENT_ORCHESTRATION.md) — Orchestrator contracts, event loops, and multi-agent coordination models.
- [Multi-Agent System Specification & Dynamic Orchestration](./agents/MULTI_AGENT_SYSTEM_SPECIFICATION.md) — Complete 15-agent development team, dynamic delegation tiers, and proactive orchestration protocols.
- Operational infrastructure is managed under the primary workspace directory:
  - `.agents/coordination/` — Multi-agent Git worktree registry, single writer protocol, and task queue.
  - `.agents/agents/` — Specialist agent definitions and domain boundaries.
  - `.agents/rules/` — Multi-agent rules (file ownership, git safety, communication protocol).
  - `.agents/workflows/` — Standard workflows (task lifecycle, handoff, code review).

---

## 4. Code Editor Architecture (`docs/editor/`)

Editing surface, performance benchmarks, and language server roadmap:

- [Editor Architecture & Integration Specification](./editor/EDITOR_ARCHITECTURE.md) — High-performance tokenized editing surface, resource boundaries, and Monaco/LSP roadmap.

---

## 5. Plugin Ecosystem (`docs/plugins/`)

Building and distributing custom extensions and plugins for Orbito:

- [Custom Extension SDK Architecture](./plugins/ECOSYSTEM_SDK.md) — Extension API, manifest specification, runtime interfaces, and event bus.
- [Plugin Developer Guide & CLI Reference](./plugins/PLUGIN_GUIDE.md) — Quickstart tutorial, CLI commands (`orbito plugins`), and packaging instructions.

---

## 6. Technical Audits & Verification Reports (`docs/audits/`)

Historical and verification reports across all development phases:

- [Full Project Architecture & Multi-Agent Readiness Audit](./audits/ORBITO_ARCHITECTURE_AUDIT.md)
- [Baseline Commit Readiness Review](./audits/ORBITO_BASELINE_REVIEW.md)
- [Final Baseline Manifest Verification Report](./audits/ORBITO_FINAL_BASELINE_MANIFEST.md)
- [Pre-Worktree Operational Verification Report](./audits/ORBITO_PRE_WORKTREE_CHECK.md)
- [Extension Isolation Security Remediation Report](./audits/EXTENSION_ISOLATION_REMEDIATION_REPORT.md)
- [OS-Level Extension Sandboxing Report](./audits/OS_LEVEL_EXTENSION_SANDBOX_REPORT.md)
- [Security Audit & Vulnerability Assessment Report](./audits/SECURITY_AUDIT_REPORT.md)
- [Full Integration & Reliability Audit](./audits/FULL_INTEGRATION_RELIABILITY_AUDIT.md)
- [Token Optimization Benchmarks & Quality Evaluation](./audits/OPTIMIZATION_BENCHMARKS.md)
- [Empirical Performance & Scalability Audit Report](./audits/PERFORMANCE_AUDIT_REPORT.md)
- [Discord Rich Presence Implementation Report](./audits/DISCORD_RICH_PRESENCE_IMPLEMENTATION_REPORT.md)
- [Phase 6 System Hardening & Wiring Report](./audits/PHASE_6_SYSTEM_HARDENING_REPORT.md)
- [Phase 6.1 Security Verification Report](./audits/PHASE_6_1_SECURITY_VERIFICATION_REPORT.md)
- [Phase 7 Completion Report: Ecosystem Hardening](./audits/PHASE_7_COMPLETION_REPORT.md)
- [Phase 7 Product Readiness Report](./audits/PHASE_7_PRODUCT_READINESS_REPORT.md)
- [Phase 8 Real Usage & UX Refinement Report](./audits/PHASE_8_REAL_USAGE_REPORT.md)
- [Phase 8.1 Intelligence Validation Report](./audits/PHASE_8_1_VALIDATION_REPORT.md)
- [Phase 8 Completion Report](./audits/PHASE_8_COMPLETION_REPORT.md)
- [Autonomous Development Mission Report](./audits/AUTONOMOUS_DEVELOPMENT_MISSION_REPORT.md)
- [Production Readiness Report](./audits/PRODUCTION_READINESS_REPORT.md)
- [Phase 1.4 Glass Material Foundation Report](./audits/PHASE_1_4_GLASS_FOUNDATION_REPORT.md)
- [Phase 2 Glass Material Implementation Report](./audits/PHASE_2_GLASS_MATERIAL_REPORT.md)
- [Phase 2.1 Glass Refraction Verification Report](./audits/PHASE_2_1_REFRACTION_VERIFICATION_REPORT.md)
- [Glassmorphism Visual Reset Report](./audits/GLASSMORPHISM_VISUAL_RESET_REPORT.md)
- [Phase 3 Glass Transparency Report](./audits/PHASE_3_GLASS_TRANSPARENCY_REPORT.md)
- [Phase 4 Glass Material Polish Report](./audits/PHASE_4_MATERIAL_POLISH_REPORT.md)
- [Phase 5 Material Reliability & DWM Stability Report](./audits/PHASE_5_MATERIAL_RELIABILITY_REPORT.md)
- [Phase 6 Final Glassmorphism Polish Verification Report](./audits/PHASE_6_FINAL_GLASSMORPHISM_POLISH_REPORT.md)
- [Post Implementation Audit](./audits/POST_IMPLEMENTATION_AUDIT.md)
- [Repository Structure Refactor Audit](./audits/REPOSITORY_STRUCTURE_REFACTOR.md)
- [Settings Restructure Completion Report](./audits/SETTINGS_RESTRUCTURE_COMPLETION_REPORT.md)
- [Settings Independent Visual & Functional Audit Report](./audits/SETTINGS_INDEPENDENT_AUDIT_REPORT.md)
- [Appearance Settings UX Redesign & Complete Light Theme Implementation Report](./audits/APPEARANCE_LIGHT_THEME_AUDIT_REPORT.md)
- [Multi-Agent System Audit, Expansion & Continuous Orchestration Report](./audits/MULTI_AGENT_AUDIT_EXPANSION_REPORT.md)
- [Multi-Agent Real-World Stress Test & Performance Benchmark Report](./audits/MULTI_AGENT_BENCHMARK_REPORT.md)
- [Post-Benchmark Findings, Security Hardening & Implementation Report](./audits/POST_BENCHMARK_IMPLEMENTATION_REPORT.md)

---

## 7. Releases & Changelog (`docs/releases/`)

Version history and release processes:

- [Changelog & Version History](./releases/CHANGELOG.md) — Comprehensive log of features, fixes, and architectural milestones.
- [Release Guide & Checklist](./releases/RELEASE_GUIDE.md) — Release preparation, signing, and artifact packaging guidelines.

---

## 8. Technical Reference (`docs/reference/`)

Product requirements and technical specifications:

- [Product Requirements Document (PRD)](./reference/PRD.md) — Core vision, persona definitions, and feature matrix.
- [Product & Engineering Roadmap](./reference/ROADMAP.md) — Strategic phases, deliverables, and long-term milestones.
- [Workflow Node Specification](./reference/WORKFLOW_NODE_SPECIFICATION.md) — Complete parameter schema for visual workflow nodes.
