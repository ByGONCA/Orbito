<p align="center">
  <img src=".github/assets/orbito-banner.jpg" alt="Orbito" width="680" />
</p>

# ORBITO

**The unified, local-first development workspace for projects, terminals, processes, and agentic workflows.**

Orbito brings your repositories, terminal processes, AI CLI providers, and multi-agent automations into a single, cohesive developer cockpit. Designed from the ground up for speed, offline privacy, and deep control over AI context.

---

[![CI Matrix](https://img.shields.io/github/actions/workflow/status/ByGONCA/Orbito/test.yml?branch=master&label=CI%20Matrix&style=flat-square)](https://github.com/ByGONCA/Orbito/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://github.com/ByGONCA/Orbito)
[![Electron](https://img.shields.io/badge/Electron-34.5-47848F?logo=electron&logoColor=white&style=flat-square)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black&style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org/)
[![Platform Support](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)](https://github.com/ByGONCA/Orbito)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/ByGONCA/Orbito/pulls)

---

## About Orbito

Modern software engineering with AI is fragmented. Developers juggle disjointed CLI tools, multiplexed terminal windows, separate code editors, and fragile copy-paste workflows. Context windows fill with irrelevant files, local changes risk getting overwritten by autonomous scripts, and proprietary code is often leaked to unvetted cloud endpoints without oversight.

**Orbito** solves this fragmentation by uniting your development environment under a single local-first architecture:

- **Unified Developer Cockpit:** Manage repositories, worktrees, active terminals, and model sessions side-by-side without context switching.
- **Context-Aware Intelligence:** Automatically parse syntax trees via Tree-sitter and retrieve code snippets with sub-millisecond SQLite FTS5 BM25 search.
- **Air-Gapped Privacy:** Run fully local models through Ollama with zero external telemetry and kernel-level network isolation guardrails.
- **Safe Agent Orchestration:** Execute autonomous multi-agent pipelines in dedicated Git worktrees, complete with human-in-the-loop review gates and diff inspection before merging.

Whether you are debugging a microservice, running local LLMs offline, or orchestrating multi-agent refactoring pipelines, Orbito provides the tooling and safety boundaries necessary for serious engineering.

---

## Main Capabilities

### Workspace & Process Control
- **Project-Centric Navigation:** Manage multiple repositories, task branches, and recent projects with an instant virtualized file tree.
- **Git Worktree Isolation:** Run parallel tasks and agent experiments in isolated Git worktrees without touching your working directory.
- **Unified Terminal & CLI Sessions:** High-performance terminal execution supporting PowerShell, Bash, and native PTY streams with clean process tree cleanup.

### Multi-Provider AI Integration
- **CLI Adapter Engine:** Native adapters for Anthropic Claude Code (`claude`), OpenAI Codex (`codex`), Google Gemini (`gemini`), local Ollama (`ollama`), and 25+ community CLIs.
- **Interactive Stream Parsers:** Real-time terminal streaming with ANSI handling, markdown formatting, thought tag extraction (`<thought>`), and tool invocation tracking.
- **Air-Gap Mode:** One-click enforcement of zero external network access, redirecting all requests to local model endpoints.

### Context Intelligence & Token Optimization
- **AST Symbol Extraction:** Incremental Tree-sitter WASM parser indexing functions, classes, and methods across TypeScript, JavaScript, Python, Go, and Rust.
- **Hybrid Lexical Search:** SQLite FTS5 full-text search with BM25 ranking for fast symbol and fragment lookup (< 2ms).
- **Token Efficiency Pipeline:** Centralized prompt assembly, dynamic skill instruction leveling, and intelligent model routing to maximize context window value.

### Multi-Agent Orchestration & Automation
- **Specialist Agent System:** Coordinated engineering team roles (Architect, Backend, Frontend, Testing, Security, Quality).
- **Automated Verification Gates:** Type integrity, test suites, and review gates on worktree branches before merging.
- **Visual Flow Builder:** Drag-and-drop workflow canvas powered by `@xyflow/react` with 29 built-in node types and production templates.

---

## Documentation & Knowledge Base

Orbito maintains a centralized, categorized documentation hierarchy under [`docs/`](./docs/):

👉 **[Browse Full Documentation Index (`docs/README.md`)](./docs/README.md)**

- **[System Architecture](./docs/architecture/)** — System specifications, security models, intelligence engine, and prompt assembly.
- **[Development & Governance](./docs/development/)** — Development guide, testing strategy, AI context, and repository organization policy.
- **[Multi-Agent System](./docs/agents/)** — Agent orchestration, worktrees, and coordination protocols.
- **[Code Editor](./docs/editor/)** — High-performance tokenized editing surface, performance limits, and Monaco/LSP roadmap.
- **[Plugin Ecosystem](./docs/plugins/)** — Extension SDK, CLI commands, manifest schema, and isolation boundaries.
- **[Technical Audits](./docs/audits/)** — Historical phase audits, security verifications, benchmarks, and refactor reports.
- **[Releases & Changelog](./docs/releases/)** — Version history and release preparation guides.
- **[Reference & Specs](./docs/reference/)** — Product Requirements Document (PRD) and Workflow Node specifications.

---

## Installation & Quickstart

### Prerequisites

Ensure the following tools are installed on your host machine:

1. **Node.js:** `v22.12.0` LTS or later
2. **Package Manager:** `npm` v10+
3. **Git:** `v2.30.0` or later
4. **C++ Native Build Toolchain:**
   - **Windows:** Visual Studio Build Tools (C++ workload)
   - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
   - **Linux:** `build-essential`, `python3`, `libsqlite3-dev`

### Setup Instructions

```bash
# 1. Clone repository
git clone https://github.com/ByGONCA/Orbito.git
cd Orbito

# 2. Install dependencies & compile native SQLite bindings
npm install

# 3. Launch application in development mode
npm run dev
```

---

## Key Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Starts Vite dev servers and launches Electron with HMR. |
| `npm run build` | Compiles production assets for Main, Preload, and Renderer into `out/`. |
| `npm start` | Previews the production build via `electron-vite preview`. |
| `npm test` | Runs the full automated test suite inside Electron's Node runtime. |
| `npm run test:host` | Runs tests on the host Node runtime via Vitest. |
| `npm run typecheck` | Validates TypeScript types across Main, Preload, and Renderer. |
| `npm run validate:structure` | Validates repository structure and root cleanliness against policy. |
| `npm run validate:coordination`| Validates multi-agent coordination hub, registry, and worktrees. |
| `npm run lint` | Runs ESLint across TypeScript and React source files. |
| `npm run format` | Formats all code files using Prettier. |

---

## Project Structure

```text
Orbito/
├── .agents/                   # Multi-agent coordination hub, rules, and workflows
├── .ai-workspace-data/        # Local persistent SQLite databases & installed extensions (gitignored)
├── .github/                   # GitHub Actions CI matrix and assets
├── bin/                       # Orbito CLI executable (bin/orbito.js)
├── docs/                      # Centralized documentation hierarchy
│   ├── README.md              # Documentation navigation index
│   ├── architecture/          # System design, intelligence engine, security model
│   ├── audits/                # Historical security, performance, and architecture audits
│   ├── development/           # Development setup, testing, and repository policy
│   ├── agents/                # Agent orchestration and coordination specs
│   ├── editor/                # Editor architecture and Monaco/LSP roadmap
│   ├── plugins/               # Extension SDK and plugin developer guides
│   ├── releases/              # Changelog and release guides
│   └── reference/             # PRD, engineering roadmap, and node specifications
├── plugins/                   # Reference and example plugins (e.g., example-clock-panel)
├── resources/                 # Application icons and packaging assets
├── scripts/                   # Build, test, and governance validation scripts
├── src/                       # Application source code
│   ├── main/                  # Electron Main Process (PTY, SQLite, IPC, CLI adapters)
│   ├── preload/               # Secure contextBridge exposure
│   ├── renderer/              # React 19 Frontend (Tailwind, Zustand, Flow canvas)
│   └── shared/                # Typed IPC contracts, domain models, and plugin SDK
└── tests/                     # Unit, integration, and security test suites
```

---

## Contributing

Contributions to Orbito are welcome. Please read our [Development Guide](./docs/development/DEVELOPMENT_GUIDE.md) and [Permanent Repository Organisation Policy](./docs/development/REPOSITORY_ORGANISATION.md) before submitting changes.

1. **Fork & Branch:** Create a feature branch (`git checkout -b feature/my-feature`).
2. **Quality Standards:**
   - Adhere to the Ponytail simplicity ladder (reuse existing utilities, minimal diffs).
   - Maintain anti-boxiness UI design guidelines (clean typography, no pill counts or boxed wrappers).
   - Ensure boundary isolation and typed IPC contracts.
3. **Verification:** Ensure `npm run typecheck`, `npm test`, and `npm run validate:structure` pass cleanly.
4. **Pull Request:** Submit PR to `master` with clear descriptions and verification steps.

---

## Community & Support

- **Issue Tracker:** Report bugs or suggest features on [GitHub Issues](https://github.com/ByGONCA/Orbito/issues).
- **Discussions:** Architectural discussions and workflow sharing on [GitHub Discussions](https://github.com/ByGONCA/Orbito/discussions).
- **Support:** Voluntary support is welcome on [Ko-fi](https://ko-fi.com/baptista).

---

## License

This project is licensed under the [MIT License](https://github.com/ByGONCA/Orbito), as declared in `package.json`.
