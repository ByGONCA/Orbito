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
- Refer to `docs/AI_CONTEXT.md` for project architecture and conventions.

## 4. Design & UX System Rules (Anti-Boxiness & Clean Typography)
- **Anti-Boxiness Principle:** NEVER wrap everything in cards, boxes, pill backgrounds, or borders. Avoid container proliferation where every metric, section, or status is trapped in a rounded rectangle.
- **Borderless / Clean Layout:** Use whitespace, vertical alignment, and typographic hierarchy rather than dividing lines, visible card borders, or nested boxes.
- **No Backgrounds on Numbers & Counts:** Numbers (such as modified file counts in the file explorer, badges, percentage indicators) must NEVER have boxed pill backgrounds (e.g. `bg-white/[...]`, `px-1`, `rounded`). Render them as clean, muted typographic numbers with subtle color.
- **Projects & Workspaces:** Do not surround project headers, working tree statuses, or environments with card borders. Let elements float naturally on the dark background.
- **Loading Screens:** Keep loading and empty states open, clean, and borderless without a heavy modal card enclosing them.
