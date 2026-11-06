# AI Workspace — Project Context & Engineering Architecture

## 1. Project Purpose
Orc AI Workspace is a local-first, session-aware desktop application for AI-assisted software development. It bridges local developer environments with AI agent orchestration, terminal execution (PTY), and Git worktree management, providing project-centric navigation and contextual control over agents, models, context, and skills.

## 2. Technology Stack
- **Desktop Framework:** Electron 34 (`electron-vite` 6.0)
- **UI Engine:** React 19, Tailwind CSS 3.4.17, Zustand 5, `@tanstack/react-virtual`, `@xyflow/react` (Flow Builder)
- **Icons & Styling:** `lucide-react`, `clsx`, `tailwind-merge`
- **Native / Database:** `better-sqlite3` 11.8 (compiled for Electron 34 ABI), Drizzle ORM
- **AST & Lexical:** `web-tree-sitter`, `js-tiktoken`
- **Language / Tooling:** TypeScript 5.7 strict, Vite 6, Vitest 3.2, Prettier, ESLint
- **AI Coding Integration:** Graphify (knowledge graph & codebase navigation), Ponytail (minimalism & simplicity-first development)

## 3. High-Level Architecture
The system operates across distinct process boundaries:
1. **Renderer Process (Chromium Sandbox):** React 19 UI, Zustand state stores, project navigation, tab management, contextual inspector panels.
2. **Main Process (Node.js):** Workspace management, Git worktrees, CLI provider adapters (Claude Code, OpenAI Codex, Google Gemini, Ollama), Security Kernel (path containment, safeStorage), SQLite persistence.
3. **Indexer Worker Thread:** Tree-sitter AST parsing, lexical indexing into `index.sqlite` (FTS5).
4. **PTY Subprocesses:** Spawned CLI and terminal execution sessions via `node-pty`.

## 4. Key Directories
- `src/main/`: Electron main process services, IPC handlers, database service, security kernel, and extension/agent engines.
- `src/preload/`: Secure `contextBridge` exposure (`window.api`).
- `src/renderer/`: React 19 frontend components, UI stores, hooks, styles.
- `src/shared/`: Shared TypeScript types, IPC channel contracts, schemas (`ipc.ts`, `agents.ts`, `skills.ts`, `workflows.ts`, `context.ts`).
- `docs/`: Architectural specifications, PRD, security model, and implementation decisions.
- `graphify-out/`: Graphify generated knowledge graph (`graph.json`, `graph.html`, `GRAPH_REPORT.md`).
- `.agents/`: Project rules (`.agents/rules/`) and workflows (`.agents/workflows/`).

## 5. Core Modules & Responsibilities
- **Workspace Store (`src/renderer/src/stores/workspace.store.ts`):** Central reactive state for projects, tabs, active session, terminal context, agent inspection, and layout preferences.
- **Left Sidebar (`src/renderer/src/components/LeftSidebar.tsx`):** Project-centric navigation (projects, repositories, branches, tasks, activity).
- **Top Tab Bar (`src/renderer/src/components/TopTabBar.tsx`):** Open workspace tabs (terminal sessions, file editors, tools).
- **Right Contextual Panel (`src/renderer/src/components/RightPanel.tsx` / `FileExplorer.tsx`):** Tabbed contextual controls (Files, Outline, Agents, Context, Skills, Models/Providers, Changes).
- **Bottom Panel / Status Bar:** Terminal/agent execution output, system logs, operational health, and branch/model indicators.
- **Database Service (`src/main/db/database.service.ts`):** `app.sqlite` (app settings, workflows) and `index.sqlite` (code search & symbols).

## 6. Implementation & Development Commands
- Dev Server: `npm run dev`
- Build Application: `npm run build`
- Type Check: `npm run typecheck`
- Unit & Integration Tests: `npm run test`
- Rebuild Native SQLite for Electron: `npm run postinstall`
- Graphify Query: `graphify query "<question>"`
- Graphify Update: `graphify update .`

## 7. Known Constraints & Conventions
- `better-sqlite3` native binaries are compiled targeting Electron 34 ABI (NODE_MODULE_VERSION 132); running Vitest under host Node.js requires compatible node version or electron environment.
- Strict security boundary: no raw Node.js access in renderer; all operations route through typed IPC in `src/preload/index.ts` and `src/main/ipc/register.ts`.
- Ponytail rule: Reuse existing utilities, standard library, and existing dependencies before adding new abstractions. Keep diffs focused and minimal.
- Graphify rule: Consult `graphify-out/graph.json` via `graphify query` or MCP tools before wide-ranging file scans.
