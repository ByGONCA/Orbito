# Skills Engine Specification & Architecture — AI Workspace

**Status:** Completed & Integrated (Phase 4)  
**Version:** 1.0.0  
**Authors:** AI Workspace Architecture & Engineering Team  

---

## 1. Executive Summary & Vision

The **Skills Engine** is the modular intelligence layer of AI Workspace. Rather than relying on generic, monolithic LLM prompts that lack domain rigor or repository context, the Skills Engine equips AI agents with specialized, declarative capabilities.

Each skill pairs a strict, validated **manifest** (`manifest.json`) defining capabilities, permissions, and metadata, with an expert **instruction set** (`instructions.md`) and automatic integration with the **Context Engine** and **CLI Engine**.

### Core Architecture Principles
1. **Local-First & Declarative**: Skills are stored on disk as declarative JSON manifests and Markdown instructions.
2. **Progressive Dynamic Loading**: Only metadata is resident in memory at startup (~5 KB total). Heavy Markdown instructions and AST queries are loaded on-demand during resolution and execution.
3. **Strict Sandbox Permissions**: Skills declare required filesystem, terminal, and network permissions. The application's `SkillPermissionManager` blocks unauthorized privilege escalation.
4. **Context-Aware Specialization**: Skills automatically query the Context Engine for relevant code chunks and symbols matching the task, keeping context focused and token-efficient.
5. **Multi-Provider Agnostic**: Skills define supported providers (`claude`, `codex`, `gemini`) and adapt to provider-specific context limits.

---

## 2. Skills Engine Architecture Diagram

```
+---------------------------------------------------------------------------------------------------+
|                                      RENDERER PROCESS (UI)                                        |
|  [SkillsManager Component]                                                                        |
|    ├── Simple Mode: Card Grid, Category Filters, Search Input, Enable/Disable Toggles            |
|    ├── Advanced Mode: Permissions Inspector, Manifest JSON, Live Run Trigger, Execution History  |
|    └── Skill Detail Modal: Dynamic Instructions Preview, Security Review, Custom Prompt Run       |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  │ IPC (`skills:list`, `skills:toggle`, `skills:execute`)
                                                  ▼
+---------------------------------------------------------------------------------------------------+
|                                       MAIN PROCESS (NODE.JS)                                      |
|                                                                                                   |
|  +--------------------+        +---------------------+        +--------------------------------+  |
|  |   SkillDiscovery   | -----> |    SkillLoader      | -----> |         SkillRegistry          |  |
|  | - Built-in Scan    |        | - Zod Validation    |        | - In-Memory Fast Cache         |  |
|  | - User Custom Scan |        | - Checksum (SHA-256)|        | - SQLite Toggle Sync           |  |
|  +--------------------+        | - Progressive Load  |        | - Collision Protection         |  |
|                                +---------------------+        +--------------------------------+  |
|                                                                                │                  |
|  +-----------------------------------------------------------------------------+                  |
|  │                                                                                                |
|  ▼                                                                                                |
|  +---------------------+        +--------------------+        +--------------------------------+  |
|  |    SkillResolver    | -----> | PermissionManager  | -----> |      SkillExecutionEngine      |  |
|  | - Intent Classifier|        | - Policy Evaluator |        | 1. Retrieve Context (FTS5/AST) |  |
|  | - Keyword Scoring   |        | - Strict / Standard|        | 2. Assemble Composite Prompt   |  |
|  | - Confidence Rank   |        | - Permissive Tier  |        | 3. Spawn Subprocess via CLI    |  |
|  +---------------------+        +--------------------+        | 4. Record to SQLite Executions |  |
|                                                               +--------------------------------+  |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
+---------------------------------------------------------------------------------------------------+
|                                    PERSISTENCE (app.sqlite)                                       |
|  - `skills`: id, name, category, enabled, manifest_json, instructions_path, checksum, updated_at  |
|  - `skill_executions`: id, skill_id, project_id, provider, status, tokens, duration, error      |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Skill Manifest Specification (`manifest.json`)

All skills must provide a `manifest.json` conforming strictly to the Zod schema (`src/shared/skills.ts`):

```json
{
  "id": "code-review",
  "name": "Code Review Specialist",
  "description": "Comprehensive review of code changes, spotting antipatterns, static defects, security vulnerabilities, edge-case bugs, and readability issues.",
  "version": "1.0.0",
  "author": "Orc AI Workspace",
  "category": "quality",
  "tags": ["code-review", "quality", "clean-code", "antipatterns", "best-practices"],
  "supportedProviders": ["claude", "codex", "gemini"],
  "requiredCapabilities": ["context-retrieval", "ast-awareness"],
  "requiredPermissions": {
    "filesystem": {
      "read": true,
      "write": false
    },
    "terminal": {
      "execute": false
    },
    "network": {
      "allowed": false
    }
  },
  "contextRequirements": {
    "indexingNeeded": true,
    "maxContextTokens": 16000
  },
  "executionConstraints": {
    "timeoutMs": 120000,
    "maxRetries": 0
  }
}
```

### Schema Fields Reference
- `id`: Unique lowercase slug matching `^[a-z0-9-_]+$` (e.g. `test-generation`).
- `name`: Display name of the skill (max 100 chars).
- `description`: Clear summary of what the capability performs (10-500 chars).
- `version`: Strict SemVer string (`1.0.0`).
- `category`: Must be one of:
  - `analysis`: Computational and conceptual analysis.
  - `quality`: Static code review, hygiene, and standards.
  - `debugging`: Root-cause diagnosis and reproduction.
  - `refactoring`: Structural remodeling preserving invariant behavior.
  - `documentation`: JSDoc, API guides, and architecture references.
  - `testing`: Unit, integration, and property test generation.
  - `security`: Vulnerability auditing and secrets detection.
  - `architecture`: Topology mapping and codebase onboarding.
- `supportedProviders`: Array of compatible CLI providers (`claude`, `codex`, `gemini`).
- `requiredPermissions`:
  - `filesystem`: `{ read: boolean; write: boolean; allowedPaths?: string[] }`.
  - `terminal`: `{ execute: boolean; allowedCommands?: string[] }`.
  - `network`: `{ allowed: boolean; domains?: string[] }`.
- `contextRequirements`:
  - `indexingNeeded`: Whether Context Engine retrieval should be performed.
  - `maxContextTokens`: Ceiling for assembled context fragments.

---

## 4. Built-in Skills Catalog

The system includes 10 production-grade built-in skills located at `src/main/skills/builtin/`:

| Skill ID | Name | Category | Permissions (FS/Term/Net) | Supported Providers | Primary Focus |
|---|---|---|---|---|---|
| `code-review` | Code Review Specialist | `quality` | R / ✕ / ✕ | Claude, Codex, Gemini | Antipatterns, edge cases, contracts, clean code |
| `bug-investigation` | Bug Investigator & Diagnostics | `debugging` | R / ✕ / ✕ | Claude, Codex, Gemini | Root-cause analysis, stack trace inspection |
| `bug-fixing` | Surgical Bug Fixer | `debugging` | RW / ✕ / ✕ | Claude, Codex, Gemini | Minimal blast-radius patches, regression tests |
| `refactoring` | Refactoring & Clean Code | `refactoring` | RW / ✕ / ✕ | Claude, Codex, Gemini | SOLID, decoupling, dead code removal |
| `documentation` | Technical Documentation | `documentation` | RW / ✕ / ✕ | Claude, Codex, Gemini | JSDoc/TSDoc, README, API references |
| `test-generation` | Test Suite Generator | `testing` | RW / ✕ / ✕ | Claude, Codex, Gemini | Vitest/Jest unit & boundary test suites |
| `security-review` | Security & Vulnerability Auditor | `security` | R / ✕ / ✕ | Claude, Codex, Gemini | OWASP Top 10, injections, secret leaks |
| `project-understanding`| Project Architecture Guide | `architecture` | R / ✕ / ✕ | Claude, Codex, Gemini | Topology mapping, mental model onboarding |
| `performance-analysis` | Performance & Bottleneck Analyst| `analysis` | R / ✕ / ✕ | Claude, Codex, Gemini | Complexity, memory leaks, query optimization |
| `code-explanation` | Code Explainer & Mental Models | `analysis` | R / ✕ / ✕ | Claude, Codex, Gemini | Beginner-friendly walkthroughs & diagrams |

---

## 5. Security & Permission Enforcement Model

The `SkillPermissionManager` applies workspace policy constraints:

### Policy Tiers:
1. **Strict Tier**:
   - Filesystem write: **BLOCKED**.
   - Terminal command execution: **BLOCKED**.
   - Network egress: **BLOCKED**.
   - *Use case:* Untrusted projects, third-party skills, sensitive codebases.
2. **Standard Tier (Default)**:
   - Filesystem write: Allowed with user awareness.
   - Terminal command execution: **BLOCKED**.
   - Network egress: Requires explicit approval.
   - *Use case:* Daily development workflow.
3. **Permissive Tier**:
   - Filesystem write: Allowed.
   - Terminal execution: Supervised command execution allowed.
   - Network egress: Allowed.
   - *Use case:* Autonomous multi-agent worktree execution.

---

## 6. Custom Skills Import Lifecycle

1. User clicks **Import Custom Skill** in Advanced Mode.
2. User selects an external directory containing `manifest.json` and `instructions.md`.
3. `ManifestValidator` verifies schema compliance and computes SHA-256 checksum.
4. Name collision guard prevents overriding any built-in skill ID.
5. Directory is copied into `.ai-workspace-data/custom-skills/<skill-id>/`.
6. Skill is registered in SQLite with `enabled = 0` (disabled by default).
7. UI alerts user to review permissions before manually enabling the skill.
