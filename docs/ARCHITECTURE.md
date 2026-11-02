# System Architecture Specification — AI Workspace

**Document Version:** 1.2.0  
**Status:** Approved for Phase 1 Implementation  
**Architecture Classification:** Local-First Multi-Process Desktop Application  

---

## 1. System Topology & Process Boundary Model

To guarantee both high security and responsive UI rendering (60 FPS without event loop starvation), AI Workspace implements a multi-boundary process architecture utilizing Electron, Node.js Worker Threads, and dedicated PTY processes.

```
+---------------------------------------------------------------------------------------------------------+
|                                           RENDERER PROCESS                                              |
|                                       (Chromium Sandbox, 60 FPS)                                        |
|                                                                                                         |
|  +--------------------+   +---------------------+   +---------------------+   +----------------------+  |
|  | React 19 UI Engine |   |  Zustand Stores     |   |  xterm.js (WebGL)   |   | React Flow Canvas    |  |
|  | - Simple Mode      |   |  - WorkspaceState   |   |  - ANSI Stream      |   | - Workflow Designer  |  |
|  | - Advanced Mode    |   |  - AgentTaskState   |   |  - Terminal Addons  |   | - Dynamic DAG View   |  |
|  +--------------------+   +---------------------+   +---------------------+   +----------------------+  |
+---------------------------------------------------------------------------------------------------------+
                                                     |
                     contextBridge (Typed IPC Bridge, Zero Raw Node/Electron Objects)
                                                     |
+---------------------------------------------------------------------------------------------------------+
|                                          MAIN PROCESS (Node.js)                                         |
|                                                                                                         |
|  +--------------------------------+  +--------------------------------+  +---------------------------+  |
|  | Workspace & Project Manager    |  | CLI Engine (Provider Adapters) |  | Security Kernel           |  |
|  | - File Watching (@parcel/watch)|  | - Claude Code Adapter          |  | - Canonical Path Resolver |  |
|  | - Git Lifecycle & Worktrees    |  | - OpenAI Codex Adapter         |  | - Symlink Defense         |  |
|  | - Dirty File Overlay (Fresh)   |  | - Google Gemini Adapter        |  | - safeStorage Keyring     |  |
|  +--------------------------------+  +--------------------------------+  +---------------------------+  |
|                                                                                                         |
|  +--------------------------------+  +--------------------------------+  +---------------------------+  |
|  | AI Experience Engine           |  | Multi-Agent Orchestrator       |  | Skills Security & Engine  |  |
|  | - Intent Classifier (Tiers)   |  | - Coordinator DAG Planner      |  | - Runtime Permission Gate |  |
|  | - Model Router & Health        |  | - Worktree Task Isolation      |  | - SHA-256 Hash Verifier   |  |
|  | - Plan Evaluation Engine       |  | - Diff & Merge Reviewer        |  | - Static Pattern Scanner  |  |
|  +--------------------------------+  +--------------------------------+  +---------------------------+  |
|                                                                                                         |
|  +---------------------------------------------------------------------------------------------------+  |
|  | App Persistence: app.sqlite (better-sqlite3 + Drizzle ORM) [WAL Mode, App State & Settings]       |  |
|  +---------------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------------+
                    |                                                         |
          MessageChannel IPC                                        Direct Process Spawn (PTY)
                    |                                                         |
+--------------------------------------+                  +-----------------------------------------------+
|       INDEXER WORKER THREAD          |                  |           SPAWNED CLI / PTY PROCESSES         |
|  (Dedicated background thread)       |                  |                                               |
|  - Tree-sitter AST Parsing           |                  |  +-----------------------------------------+  |
|  - Incremental Hashing (xxHash64)    |                  |  | node-pty: ConPTY (Win) / OpenPTY (POSIX)|  |
|  - Interruption & Resume Engine      |                  |  | - Claude Code interactive sessions      |  |
|  - Optional Local Embeddings (ONNX)  |                  |  | - Codex CLI / Gemini CLI processes      |  |
|  - Direct writes to index.sqlite     |                  |  | - User Shell (PowerShell / Bash / Zsh)  |  |
|    (FTS5 Lexical Search Table)       |                  |  +-----------------------------------------+  |
+--------------------------------------+                  +-----------------------------------------------+
```

---

## 2. Dependency Stability & Compatibility Matrix

To avoid native C++ binary ABI mismatches between Node.js and Electron, the following exact compatibility tiers are established:

| Package | Homologated Version | Target ABI / Node Version | Status & Maintenance Risk Analysis |
|---|---|---|---|
| `electron` | `^34.0.0` (or `^44.0.0` LTS) | Node.js `22.x` / Chromium | **STABLE (Production)**. Pin to major version. Use `@electron/rebuild`. |
| `react` / `react-dom` | `^19.0.0` | Client-only SPA mode | **STABLE (Production)**. Pure client-side SPA with Vite. (Fallback: `18.3.1` if older canvas plugin issues arise). |
| `vite` | `^6.0.7` | Node.js `>= 18` | **STABLE (Production)**. Lightning-fast compilation. Paired with `vite-plugin-electron` `^1.2.0` or `electron-vite` `^6.0.0`. |
| `typescript` | `^5.7.2` | esbuild / tsc | **STABLE (Production)**. Strict type-checking enabled (`strict: true`). |
| `better-sqlite3` | `^11.8.0` | Node 22 / Electron ABI | **STABLE (Production)**. Requires C++ Build Tools on Windows for native compilation. |
| `node-pty` | `^1.1.0` | Node 22 / Electron ABI | **STABLE (Production)**. Official 1.1.0 release (replaces deprecated/beta tags). Native ConPTY on Windows. |
| `@parcel/watcher` | `^2.5.0` | N-API Prebuilt | **STABLE (Production)**. High-performance C++ directory watcher with prebuilt cross-platform binaries. |
| `drizzle-orm` | `^0.38.3` | Pure TypeScript | **STABLE (Production)**. Zero-runtime SQL query builder. |
| `@xterm/xterm` | `^5.5.0` | WebGL Addon `^0.16.0` | **STABLE (Production)**. Industry-standard terminal emulator. |
| `@tanstack/react-virtual` | `^3.11.2` | Pure JS | **STABLE (Production)**. Virtualizes large DOM trees in file explorer and log views. |

**Known Windows Native Build Requirements:**
Native dependencies (`better-sqlite3`, `node-pty`) require Node-gyp build prerequisites on Windows:
```powershell
# Visual Studio 2022 Desktop C++ Workload or Windows Build Tools
npm config set msvs_version 2022
```
An automated npm lifecycle script (`"postinstall": "electron-rebuild"`) ensures all native C++ binaries match the exact Electron ABI runtime.

---

## 3. SQLite Architecture & Worker Thread Concurrency

### 3.1 Split Database Architecture: `app.sqlite` vs `index.sqlite`

`better-sqlite3` is a synchronous C++ binding. Concurrent writes to the same database file from different threads trigger `SQLITE_BUSY` errors. To completely eliminate write contention between the user interface and background indexing, AI Workspace implements a **Dual-Database Architecture**:

```
[AppData Directory]
├── app.sqlite          <--- Owned by MAIN PROCESS (Read/Write)
│   ├── workspaces
│   ├── projects
│   ├── settings
│   ├── memories (5 tiers)
│   ├── agent_tasks
│   └── execution_history
│
└── index.sqlite        <--- Owned by INDEXER WORKER (Read/Write)
    ├── file_hashes
    ├── file_chunks
    ├── symbols (Tree-sitter AST)
    └── fts_chunks (FTS5 Virtual Table)
```

1. **`app.sqlite` (Application State):**
   * Managed exclusively by the Main Process.
   * Handles user actions, preferences, memory records, and workflow configurations.
   * Zero risk of indexing slowdowns impacting user interaction.
2. **`index.sqlite` (Codebase Index):**
   * Managed exclusively by the Indexer Worker Thread for writes.
   * Main Process opens `index.sqlite` in **read-only mode** (`readonly: true`) to execute user search queries.
   * Completely isolates heavy batch insert transactions during project re-indexing.

### 3.2 WAL Configuration, Transactions & Concurrency Control
Both database connections apply high-reliability SQLite PRAGMAs:
```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;         -- Wait up to 5 seconds before throwing SQLITE_BUSY
PRAGMA synchronous = NORMAL;        -- Safe in WAL mode; eliminates disk flush stalls
PRAGMA cache_size = -32000;         -- 32 MB cache limit per DB (conserves RAM)
PRAGMA temp_store = MEMORY;         -- Temp tables and indices stored in RAM
```

### 3.3 Transaction Batching & Crash Recovery
* **Batch Transactions:** The Indexer Worker never executes individual inserts. File chunks and FTS5 entries are committed in batches of 500 records inside an explicit `db.transaction()` wrapper.
* **Checkpointing & Crash Recovery:**
  * In the event of a sudden power loss or process kill, WAL files guarantee zero database corruption.
  * On idle, the application runs `PRAGMA wal_checkpoint(PASSIVE);`.
  * During graceful application shutdown, `PRAGMA wal_checkpoint(TRUNCATE);` flushes WAL logs back into the primary database files.

---

## 4. Context Engine Reliability & Hybrid Retrieval

To guarantee that AI agents never operate on stale code, hallucinated files, or incomplete index data, the Context Engine implements a **Three-Tier Freshness Architecture**:

```
                              [Agent Context Request]
                                         |
                                         v
                         [Context Engine Hybrid Resolver]
                                         |
        +--------------------------------+--------------------------------+
        |                                |                                |
        v                                v                                v
 [Tier 1: index.sqlite]        [Tier 2: Dirty Overlay]          [Tier 3: Live Disk Read]
 (FTS5 BM25 Lexical Index)     (In-Flight Modified Files)       (fs.readFileSync Fresh)
 - High-speed symbol lookup    - Files changed during task      - Always reads real disk
 - Structural AST chunks       - Git uncommitted diffs          - Overrides stale chunks
        \                                |                                /
         +-------------------------------+-------------------------------+
                                         |
                                         v
                            [Synthesized Prompt Context]
                            (100% Up-to-Date Codebase)
```

### 4.1 Incremental Indexing & Fast Hashing
1. **Two-Tier Modification Detection:**
   * **Stage 1 (mtime + size):** In-memory cache compares file metadata (`stat.mtimeMs` and `stat.size`). If identical, the file is skipped in <0.05ms without disk reads.
   * **Stage 2 (Content Hashing):** If metadata differs, a fast 64-bit content hash (`xxhash64` or `SHA-256`) is computed in the Worker. If the hash matches the previous index record, AST re-parsing is bypassed (avoiding false invalidations caused by `git checkout` timestamp touches).
2. **Selective AST Invalidation:**
   * Only files with verified content changes have their old AST symbols and FTS5 records pruned and re-indexed.

### 4.2 Handling Unindexed Files, Modified Files & Interrupted Indexing
* **Unindexed Files & Cold Starts:** If an agent requests a file that has not yet been indexed (e.g. during an in-progress background indexing run), the Context Engine executes a **Just-In-Time (JIT) parse** directly from disk in <10ms for that specific file.
* **In-Flight Modifications:** While an agent or human is editing files, `@parcel/watcher` flags those files in an in-memory `DirtyFileSet`. When context is assembled, the Context Engine reads these files directly from disk (`fs.readFileSync`), ensuring the model always sees live code.
* **Interruption & Resumption:** The Indexer persists a checkpoint table `indexing_progress (file_path, status, last_indexed_at)` in `index.sqlite`. If the application exits or crashes mid-indexing, the next startup resumes only from unindexed or dirty files without restarting from scratch.

---

## 5. Security Kernel: Runtime Enforcement & Defense-in-Depth

Static analysis of skills is a useful linting step, but it is **not a security boundary**. AI Workspace enforces security through an unbypassable **Runtime Security Kernel** in the Main Process.

```
[Agent / Skill Action Request]
               |
               v
  [Security Kernel Gatekeeper]
               |
  +------------+------------+------------+
  |                         |            |
  v                         v            v
[Filesystem Guard]    [Terminal Guard] [Network Guard]
- Canonical Path      - shell: false   - Domain Allowlist
- Symlink Resolution  - Command Parse  - Outbound Filter
- Boundary Check      - Tier Approval  - safeStorage
```

### 5.1 Filesystem Runtime Enforcement & Symlink Defense
* **Canonical Path Resolution:** Every requested file path is resolved to its physical canonical path using `fs.realpathSync(targetPath)` before any read or write operation.
* **Symlink Traversal Attack Prevention:** If a symlink points to a file outside the workspace root (e.g., `.worktrees/link -> C:\Windows` or `/etc/passwd`), the canonical resolution detects the target path and immediately aborts the operation with a `SecurityViolationException`.
* **Path Boundary Check:**
  ```typescript
  function assertWithinWorkspace(targetPath: string, workspaceRoot: string): void {
    const canonicalTarget = fs.realpathSync(path.resolve(targetPath));
    const canonicalRoot = fs.realpathSync(path.resolve(workspaceRoot));
    const relative = path.relative(canonicalRoot, canonicalTarget);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new SecurityViolationException('Access denied: path traverses outside workspace boundary');
    }
  }
  ```

### 5.2 Terminal, Command Chaining & Indirect Execution Guard
* **No Raw Shell Interpretation:** CLI subprocesses are spawned with `shell: false` using explicit argument arrays (`child_process.spawn(executable, args)`), eliminating argument injection vulnerabilities.
* **Command Chaining Defense:** Shell operators (`&&`, `;`, `|`, `` ` ``, `$()`, `>`, `<`) are intercepted and rejected unless the user explicitly grants approval in **Full Access Mode**.
* **Indirect Execution Gating:** Scripts like `npm run <script>`, `make`, or `python` can execute arbitrary commands defined in local files. These executions are categorized as **Standard / Full Access** and require user approval if not pre-authorized in the workspace policy.

### 5.3 Impossibility of Autonomous Privilege Escalation
* The permission tier of an active task (`Restricted`, `Standard`, `Full Access`) is set by the user and held in an immutable memory record in the Main Process.
* An AI agent or skill **cannot alter its own permission token**. If an action exceeds the current tier, the Main Process halts execution and triggers a native modal confirmation dialog requiring explicit human interaction.

---

## 6. CLI Engine Architecture & Robust Integration

```
                         +-----------------------------+
                         |      CLI Engine Manager     |
                         +-----------------------------+
                                        |
               +------------------------+------------------------+
               |                        |                        |
+-----------------------------+ +-----------------------------+ +-----------------------------+
|     Claude Code Adapter     | |     Codex CLI Adapter       | |     Gemini CLI Adapter      |
|                             | |                             | |                             |
| - Binary: claude / claude-code| - Binary: codex / openai    | | - Binary: gemini / genai    |
| - Strategy: Interactive PTY + | - Strategy: Subprocess stream | | - Strategy: Subprocess stream |
|   Non-interactive `-p`      |   with JSON lines             |   with structured output    |
| - Auth: ~/.claude.json /    | - Auth: ~/.codex/config.json /| - Auth: Google Cloud ADC /    |
|   ANTHROPIC_API_KEY         |   OPENAI_API_KEY              |   GEMINI_API_KEY            |
+-----------------------------+ +-----------------------------+ +-----------------------------+
```

### 6.1 Multi-Strategy Installation Detection
Rather than relying on a naive system `PATH` lookup, the CLI Engine executes a multi-stage search:
1. **System Path Probe:** Executes platform-native lookups (`where.exe <binary>` on Windows, `which <binary>` on macOS/Linux).
2. **Version Manager Scanning:** Inspects known global binary locations:
   * Node Version Managers: NVM (`~/.nvm/versions/node/*/bin`), FNM (`~/.local/share/fnm/current/bin`), Volta, Corepack.
   * Package Managers: npm global (`%AppData%\npm`, `/usr/local/bin`), pnpm global, yarn global.
3. **Status Reporting:** Returns structured metadata to the UI (`isInstalled`, `resolvedPath`, `version`, `isCompatible`, `requiresUpdate`).

### 6.2 Process Lifecycle Management & Clean Tree Termination
* **Windows Process Tree Clean Kill:** Spawning a CLI that invokes child processes often leaves orphan processes running. On Windows, the system executes `taskkill /pid <PID> /T /F` to terminate the root process and all child processes recursively.
* **POSIX:** Sends `SIGINT` to the process group, waits a grace period of 2.5 seconds, escalates to `SIGTERM`, and finally issues `SIGKILL` if unresponsive.

---

## 7. Performance Engineering & Empirical Validation

### 7.1 Reference Hardware Baseline
All performance specifications are empirical targets validated against the **Standard Reference Client**:
* **CPU:** 4-Core / 8-Thread modern x86_64 or Apple Silicon ARM64.
* **Memory:** 16 GB DDR4/DDR5.
* **Storage:** PCIe NVMe SSD.
* **OS:** Windows 11 (23H2+), macOS Sonoma (14+), Ubuntu 22.04 LTS.

### 7.2 Separation of Mandatory Requirements vs. Empirical Targets
* **Mandatory Functional Requirements (Must pass in Phase 1):**
  * Process isolation intact (`window.require` is undefined in Renderer).
  * Dual SQLite databases initialize and run migrations without error in WAL mode.
  * Project open dialog validates paths and prevents directory traversal.
  * Virtualized file explorer loads without UI freeze.
  * Clean process termination kills all child processes without zombies.
* **Empirical Performance Targets (Subject to hardware profiling):**
  * Cold startup time ≤ 3.0s.
  * Total idle RAM ≤ 300 MB across all processes.
  * Idle CPU < 1%.
  * FTS5 search latency ≤ 15ms.
