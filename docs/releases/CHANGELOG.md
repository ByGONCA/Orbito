# Orbito — Changelog & Version History

All notable changes to the Orbito project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-11-08

### Added
- **Repository Infrastructure & Documentation Governance:**
  - Reorganised repository root and consolidated documentation into categorized `docs/` hierarchy (`architecture/`, `audits/`, `development/`, `agents/`, `editor/`, `plugins/`, `releases/`, `reference/`).
  - Implemented automated repository structure validator (`scripts/validate-structure.js`) with npm script `npm run validate:structure`.
  - Added Central Documentation Index at `docs/README.md`.
  - Established permanent repository organisation policy at `docs/development/REPOSITORY_ORGANISATION.md`.
- **Plugin System & Custom Extensions:**
  - Process-level isolated extension sandbox replacing `node:vm`.
  - Orbito CLI plugin commands (`bin/orbito.js plugins [list|search|info|install|uninstall|validate|package]`).
  - Example clock panel extension (`plugins/example-clock-panel`).
  - Full Plugin SDK and API contracts (`src/shared/plugin-sdk/`).
- **Multi-Agent Coordination Hub:**
  - Shared Git Coordination Hub with single-writer registry protocol (`.agents/coordination/`).
  - Orca Worktree orchestration with automated gates and task specifications.
  - Automated coordination validation script (`scripts/validate-coordination.js`).
- **Workspace & Editor Features:**
  - High-performance tokenized code editor surface with search, replace, and tab management.
  - Interactive multi-tab native terminal service powered by `node-pty` and `@xterm/xterm`.
  - Support for 30 AI CLI agents (Claude Code, Codex, Gemini CLI, Aider, OpenCode, etc.).
  - Visual Flow Builder canvas powered by `@xyflow/react`.
  - SQLite persistent storage with WAL mode (`better-sqlite3`, Drizzle ORM).
