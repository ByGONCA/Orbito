# Workflow Node Specification — AI Workspace

**Phase:** Phase 6 — Visual Automation & Flow Builder  
**Version:** 1.0.0  
**Status:** Canonical Reference  

Every workflow node in AI Workspace adheres to a strict contract declaring its Category, Inputs, Outputs, Configuration defaults, and Required Permissions.

---

## 1. Category Summary

| Category | Count | Primary Function | Default Styling |
|---|---|---|---|
| **AI Nodes** | 6 | Multi-provider LLM prompt execution, specialist agents, transforms, and classifiers | Purple (`#8b5cf6`) |
| **Context Nodes** | 5 | AST search, lexical BM25 indexing, file reading, and token budgeting | Cyan (`#06b6d4`) |
| **Logic Nodes** | 6 | Conditional routing, branch switches, merges, bounded loops, and delays | Amber (`#f59e0b`) |
| **Input / Output** | 6 | Manual triggers, text/file inputs, global variables, and desktop notifications | Emerald (`#10b981`) |
| **Development** | 6 | Typechecking, test suites, packaging builds, Git status, diffs, and commits | Rose (`#f43f5e`) |

---

## 2. Node Specifications Catalog

### 2.1 AI Nodes

#### 1. `ai_agent`
* **Purpose:** Execute a specialist persona agent task using a selected provider.
* **Inputs:** `trigger` (any), `prompt` (string, required), `context` (string, optional).
* **Outputs:** `result` (string), `success` (boolean), `tokens` (number).
* **Config:** `role` ('architect' | 'backend' | 'frontend' | 'testing' | 'security' | 'documentation'), `provider` ('claude' | 'codex' | 'gemini'), `taskPrompt` (string).
* **Permissions:** Filesystem Read/Write: true, Terminal Execute: true, Network Allowed: true.

#### 2. `multi_agent_task`
* **Purpose:** Delegate an epic or high-level goal to the Multi-Agent Orchestrator (Phase 5 DAG).
* **Inputs:** `trigger` (any), `goal` (string, required).
* **Outputs:** `orchestrationId` (string), `summary` (string), `success` (boolean).
* **Config:** `goal` (string), `mode` ('manual' | 'supervised' | 'autonomous').
* **Permissions:** Filesystem Read/Write: true, Terminal Execute: true, Network Allowed: true.

#### 3. `ai_prompt`
* **Purpose:** Execute a single prompt template through the CLI Engine.
* **Inputs:** `input` (any, required), `system` (string, optional).
* **Outputs:** `output` (string), `success` (boolean).
* **Config:** `provider` ('claude' | 'codex' | 'gemini'), `template` (string with `{{input}}` substitution).
* **Permissions:** Filesystem Read: true, Network Allowed: true.

#### 4. `ai_review`
* **Purpose:** Adversarially review generated code against quality and security criteria.
* **Inputs:** `content` (string, required), `criteria` (string, optional).
* **Outputs:** `passed` (boolean), `feedback` (string), `issues` (array).
* **Config:** `criteria` (string), `strictMode` (boolean).
* **Permissions:** Filesystem Read: true, Network Allowed: true.

#### 5. `ai_transform`
* **Purpose:** Transform text into structured JSON, Markdown, or tables.
* **Inputs:** `input` (any, required).
* **Outputs:** `transformed` (json), `success` (boolean).
* **Config:** `targetFormat` ('json' | 'markdown' | 'text').
* **Permissions:** Network Allowed: true.

#### 6. `ai_classifier`
* **Purpose:** Categorize input text into one of a discrete set of predefined categories.
* **Inputs:** `text` (string, required).
* **Outputs:** `category` (string), `confidence` (number).
* **Config:** `categories` (array of strings).
* **Permissions:** Network Allowed: true.

---

### 2.2 Context Nodes

#### 7. `search_workspace`
* **Purpose:** Lexical full-text search across indexed chunks using SQLite FTS5 BM25.
* **Inputs:** `query` (string, optional).
* **Outputs:** `results` (array), `formatted` (string), `count` (number).
* **Config:** `query` (string), `maxResults` (number, default 10).
* **Permissions:** Filesystem Read: true.

#### 8. `read_file`
* **Purpose:** Read a selected project file within workspace chroot boundary.
* **Inputs:** `filePath` (string, optional).
* **Outputs:** `content` (string), `exists` (boolean), `lineCount` (number).
* **Config:** `filePath` (string).
* **Permissions:** Filesystem Read: true.

#### 9. `search_files`
* **Purpose:** Locate project files matching a glob pattern or extension.
* **Inputs:** `pattern` (string, optional).
* **Outputs:** `filePaths` (array), `count` (number).
* **Config:** `pattern` (string, e.g. `*.ts`).
* **Permissions:** Filesystem Read: true.

#### 10. `get_project_info`
* **Purpose:** Retrieve active workspace metadata (package.json, active Git branch, path).
* **Inputs:** `trigger` (any, optional).
* **Outputs:** `projectPath` (string), `name` (string), `branch` (string), `isGit` (boolean), `info` (object).
* **Permissions:** Filesystem Read: true.

#### 11. `build_context`
* **Purpose:** Assemble multi-tier context with token budgeting via `ContextEngineService`.
* **Inputs:** `taskQuery` (string, required), `targetFiles` (array, optional).
* **Outputs:** `assembledPrompt` (string), `tokenCount` (number), `chunksUsed` (number).
* **Config:** `maxTokens` (number, default 16000).
* **Permissions:** Filesystem Read: true.

---

### 2.3 Logic Nodes

#### 12. `condition`
* **Purpose:** Evaluate boolean expression and route to `true` or `false` branch.
* **Inputs:** `value` (any), `secondary` (any).
* **Outputs:** `true` (any), `false` (any), `result` (boolean).
* **Config:** `expression` (string, e.g. `value == true`).

#### 13. `switch`
* **Purpose:** Route to matching branch label or default.
* **Inputs:** `value` (any, required).
* **Outputs:** Named case handles (`case_1`, `case_2`, etc.) and `default`.
* **Config:** `cases` (array of string values).

#### 14. `merge`
* **Purpose:** Combine multiple parallel inputs into a unified output object.
* **Inputs:** `in_1`, `in_2`, `in_3` (any).
* **Outputs:** `combined` (object), `first` (any).

#### 15. `loop`
* **Purpose:** Iterate over an array with strict safety bounds (max 50).
* **Inputs:** `items` (array, required).
* **Outputs:** `item` (any), `index` (number), `done` (array).
* **Config:** `maxIterations` (number, default 10, clamped to 50).

#### 16. `delay`
* **Purpose:** Pause workflow execution for configured duration (clamped to 60s).
* **Inputs:** `input` (any, optional).
* **Outputs:** `output` (any).
* **Config:** `delayMs` (number, default 1000).

#### 17. `parallel`
* **Purpose:** Fork dataflow to execute up to 3 parallel branches simultaneously.
* **Inputs:** `input` (any, optional).
* **Outputs:** `branch_1`, `branch_2`, `branch_3` (any).

---

### 2.4 Input and Output Nodes

#### 18. `manual_trigger`
* **Purpose:** Starts the workflow on demand.
* **Outputs:** `trigger` (boolean), `timestamp` (number).

#### 19. `text_input`
* **Purpose:** Pass static or user-configured text into the graph.
* **Outputs:** `text` (string).
* **Config:** `text` (string).

#### 20. `file_input`
* **Purpose:** Supply a validated project file path.
* **Outputs:** `filePath` (file_ref).
* **Config:** `filePath` (string).
* **Permissions:** Filesystem Read: true.

#### 21. `variable`
* **Purpose:** Read or set global workflow variables.
* **Inputs:** `newValue` (any, optional).
* **Outputs:** `value` (any).
* **Config:** `varName` (string), `operation` ('get' | 'set').

#### 22. `output`
* **Purpose:** Capture final workflow outcome or report.
* **Inputs:** `value` (any, required).
* **Outputs:** `value` (any).
* **Config:** `title` (string).

#### 23. `notification`
* **Purpose:** Log desktop notifications in activity log.
* **Inputs:** `message` (any, required).
* **Outputs:** `acknowledged` (boolean).
* **Config:** `level` ('info' | 'warning' | 'error' | 'success').

---

### 2.5 Development Nodes

#### 24. `run_tests`
* **Purpose:** Execute project test suite (`npm test`).
* **Inputs:** `trigger` (any).
* **Outputs:** `passed` (boolean), `output` (string), `exitCode` (number).
* **Config:** `timeoutSeconds` (number, default 120).
* **Permissions:** Filesystem Read: true, Terminal Execute: true.

#### 25. `run_typecheck`
* **Purpose:** Run TypeScript compiler in strict typecheck mode (`npm run typecheck`).
* **Inputs:** `trigger` (any).
* **Outputs:** `clean` (boolean), `output` (string), `exitCode` (number).
* **Config:** `timeoutSeconds` (number, default 60).
* **Permissions:** Filesystem Read: true, Terminal Execute: true.

#### 26. `run_build`
* **Purpose:** Execute project production build (`npm run build`).
* **Inputs:** `trigger` (any).
* **Outputs:** `success` (boolean), `output` (string), `exitCode` (number).
* **Config:** `timeoutSeconds` (number, default 180).
* **Permissions:** Filesystem Read/Write: true, Terminal Execute: true.

#### 27. `git_status`
* **Purpose:** Inspect working tree for modified and untracked files.
* **Inputs:** `trigger` (any).
* **Outputs:** `clean` (boolean), `modifiedFiles` (array), `branch` (string), `rawStatus` (string).
* **Permissions:** Filesystem Read: true.

#### 28. `git_diff`
* **Purpose:** Retrieve unified diff output against HEAD or target branch.
* **Inputs:** `trigger` (any).
* **Outputs:** `diff` (string), `hasChanges` (boolean), `changedFiles` (array).
* **Config:** `targetBranch` (string, default 'HEAD').
* **Permissions:** Filesystem Read: true.

#### 29. `create_git_commit`
* **Purpose:** Stage modified files and create a local commit.
* **Inputs:** `message` (string, optional), `trigger` (any).
* **Outputs:** `success` (boolean), `commitHash` (string), `error` (string).
* **Config:** `commitMessage` (string).
* **Permissions:** Filesystem Read/Write: true.
