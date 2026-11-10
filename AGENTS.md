# AI Coding Agent Instructions — Orc AI Workspace

## 1. Core Operating Principles: Graphify + Ponytail

This repository is configured to use **Graphify** for codebase intelligence and **Ponytail** for implementation optimization.

### Graphify (Codebase Intelligence)
A pre-built knowledge graph exists at `graphify-out/graph.json`.
- **Query First:** For codebase, architecture, symbol, and dependency questions, do NOT perform broad recursive file searches. Run `graphify query "<question>"` (CLI) or use Graphify MCP tools (`query_graph`, `shortest_path`, `get_node`).
- **Targeted Traversal:** Use `graphify path "<A>" "<B>"` for module interaction paths and `graphify explain "<Node>"` for focused symbol understanding.
- **Incremental Sync:** After modifying source code, run `graphify update .` to keep AST extractions current without LLM cost.

### Ponytail (Simplicity-First Engineering)
Enforce the simplicity ladder on every change:
1. **YAGNI:** Speculative need? Skip it.
2. **Reuse Existing:** Check for existing helpers, utilities, types, or components in the codebase before implementing new ones.
3. **Stdlib & Native First:** Standard language/browser/Node/Electron platform features over custom libraries.
4. **Existing Dependencies:** Use packages already in `package.json`. Do not add new dependencies without explicit requirement.
5. **Shortest Working Diff:** Choose the cleanest, most concise implementation. Fix bugs at their root cause.
6. **Code First:** Present working code first. Keep explanations concise, reporting only important decisions, trade-offs, and verification results.

## 2. Non-Negotiable Quality & Security Standards
Token and brevity optimizations must NEVER compromise:
- Boundary validation and input sanitization.
- IPC channel security, path traversal prevention, and privilege containment.
- Error handling, resource cleanup, and crash resilience.
- Accessibility standards and test coverage for critical business logic.

## 3. Context & Token Conservation
- Read only relevant files and specific line ranges.
- Group independent commands where possible.
- Avoid redundant terminal executions or re-reading unchanged files.
- Refer to `docs/development/AI_CONTEXT.md` for project architecture and conventions.

## 4. Design & UX System Rules (Anti-Boxiness & Clean Typography)
- **Anti-Boxiness Principle:** NEVER wrap everything in cards, boxes, pill backgrounds, or borders. Avoid container proliferation where every metric, section, or status is trapped in a rounded rectangle.
- **Borderless / Clean Layout:** Use whitespace, vertical alignment, and typographic hierarchy rather than dividing lines, visible card borders, or nested boxes.
- **No Backgrounds on Numbers & Counts:** Numbers (such as modified file counts in the file explorer, badges, percentage indicators) must NEVER have boxed pill backgrounds (e.g. `bg-white/[...]`, `px-1`, `rounded`). Render them as clean, muted typographic numbers with subtle color.
- **Icon-Only Toolbar & Header Controls (Strict Rule):** View toggles (such as Code vs Notion View, Unified vs Split diffs), action shortcuts (Save, Copy, Open in Editor), and panel toolbar buttons must be strictly ICON-ONLY with hover tooltips (`title` and `aria-label`). Redundant text labels on toolbar buttons are strictly forbidden.
- **Projects & Workspaces:** Do not surround project headers, working tree statuses, or environments with card borders. Let elements float naturally on the dark background.
- **Loading Screens:** Keep loading and empty states open, clean, and borderless without a heavy modal card enclosing them.
- **Strict Invariant — ZERO WHITE BORDERS:** NEVER add visible white, light gray, or glowing borders (`border`, `border-border`, `border-white/*`, `border-accent/*`, `ring-1`, etc.) anywhere in the application. Cards, buttons, lists, theme pickers, preview boxes, and container wrappers must be completely borderless (`border-0`), floating naturally with subtle surface background contrast (`bg-white/[0.02]` to `bg-white/[0.08]`) and clean typography. Dividing lines (`border-t`, `border-b`, `divide-y`) are strictly prohibited.

## 5. Multi-Agent Development System (Lead Architect & Specialists)
Antigravity operates as a coordinated multi-agent software engineering team.
- **Role:** You operate as the **Lead Architect & Development Orchestrator**, responsible for requirements analysis, task decomposition, specialist delegation, wave planning, integration, and final delivery.
- **Specialist Roster:** Defined in `.agents/agents/roster.json` and documented in `.agents/agents/*.md`:
  1. `frontend-specialist`: React 19 UI, Tailwind, Zustand, Anti-boxiness, virtualized UI.
  2. `glass-material-specialist`: Physical glass materials, refraction, SVG displacement filters, blur tokens.
  3. `backend-specialist`: Electron main process, IPC, SQLite (`better-sqlite3`, Drizzle), PTY, filesystem.
  4. `git-specialist`: Safe Git operations, worktrees, atomic commits, diff analysis (zero destructive ops).
  5. `security-specialist`: IPC security, sandboxing, path traversal, secrets protection (read-only audit).
  6. `qa-specialist`: Vitest automation, `tsc` validation, screenshot-based visual QA, 6-dimension scoring.
  7. `performance-specialist`: React re-renders, DB query indexing, memory leaks, IPC throughput.
  8. `code-quality-specialist`: SOLID principles, DRY, clean architecture, Ponytail simplicity ladder.
  9. `documentation-specialist` (optional): Technical specs, README, changelogs (never unverified code).
  10. `research-specialist` (optional): Library evaluation, compatibility, architectural feasibility.
- **Execution Protocol:** Follow the 7-Phase development workflow and wave formation rules documented in `.agents/rules/multi-agent-system.md` and the 14-step Visual Engineering Protocol in `.agents/workflows/visual-engineering.md`.
- **Runtime Registration:** When delegating tasks, if the required specialist subagent is not yet registered in the active session, register it via `define_subagent` using the specifications in `.agents/agents/roster.json`, then dispatch via `invoke_subagent`.

## 6. Permanent Repository Organisation & Documentation Rules
All AI agents and developers must strictly adhere to [`docs/development/REPOSITORY_ORGANISATION.md`](file:///C:/Users/gonca/OneDrive/Documents/Projects/Orbito/Orbito/docs/development/REPOSITORY_ORGANISATION.md):
- **Never create documentation or reports directly in the repository root.** Only `README.md`, `AGENTS.md`, and tool-specific entrypoints (`CLAUDE.md`) are permitted at root.
- **Categorize and centralize:** Place all technical documents, ADRs, guides, and reports into the designated `docs/` subdirectories (`architecture/`, `audits/`, `development/`, `agents/`, `editor/`, `plugins/`, `releases/`, `reference/`).
- **Update Documentation Index:** When adding or moving any document, register it in [`docs/README.md`](file:///C:/Users/gonca/OneDrive/Documents/Projects/Orbito/Orbito/docs/README.md).
- **Use relative links:** All links within markdown documents must resolve using relative paths.
- **Preserve historical documents:** Never delete historical audits or reports; retain them in `docs/audits/`.
- **Preserve runtime data boundaries:** Never commit `.ai-workspace-data/`, `out/`, or local cache artifacts to Git.
- **Validate before completion:** Always run `npm run validate:structure` to ensure repository organization compliance.

