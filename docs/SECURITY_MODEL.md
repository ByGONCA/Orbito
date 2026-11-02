# Security Model & Defense-in-Depth — AI Workspace

**Version:** 1.0.0  
**Status:** Approved Reference  
**Applicability:** Full Architecture (Phases 1 through 5)  

---

## 1. Security Philosophy: Local-First Zero-Trust

AI Workspace is built on the principle that AI assistants must never possess unchecked or opaque access to the user's host operating system. Every layer—from the Electron IPC boundary to the CLI execution engine, skills loader, and multi-agent worktrees—operates under **Defense-in-Depth**.

```
+---------------------------------------------------------------------------------+
| 1. Electron Shell Layer                                                         |
|    • contextIsolation: true                                                     |
|    • nodeIntegration: false                                                     |
|    • sandbox: true                                                              |
|    • Strict Content-Security-Policy (CSP)                                       |
+---------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------+
| 2. IPC & API Gateway Boundary                                                   |
|    • Zod schema validation on 100% of IPC parameters                            |
|    • Rejection of unknown properties & type coercion attacks                     |
|    • Explicit channel whitelisting (preload script only)                         |
+---------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------+
| 3. Security Kernel & Path Guards (`SecurityService`)                            |
|    • Realpath resolution via `fs.realpathSync`                                  |
|    • Chroot containment: `assertWithinWorkspace(target, root)`                  |
|    • Path traversal prevention (symlink escapes, `..` bypasses)                 |
+---------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------+
| 4. Subprocess Execution Guardrails (`ExecutionEngine`)                          |
|    • Direct binary spawning: `shell: false` (Zero shell operator injection)     |
|    • Parameter array encapsulation (args never concatenated into command string)|
|    • Recursive process tree cleanup (`taskkill /T /F` or POSIX process group)   |
|    • Hard watchdog timeouts (default 120s) preventing denial-of-service hangs   |
+---------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------+
| 5. Skills Permission Manager (`SkillPermissionManager`)                         |
|    • Declarative permission manifests (`filesystem`, `terminal`, `network`)     |
|    • Strict, Standard, and Permissive policy enforcement                        |
|    • Custom skills disabled by default with explicit security notices           |
|    • Cryptographic SHA-256 checksum validation preventing file tampering       |
+---------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------+
| 6. Credentials & Storage Security (`safeStorageService`, `databaseService`)    |
|    • OS-level DPAPI (Windows) / Keychain (macOS) / SecretService (Linux)        |
|    • Zero plain-text API keys or session tokens in SQLite or logs               |
|    • 100% Parameterized SQLite statements (Zero SQL injection)                  |
+---------------------------------------------------------------------------------+
```

---

## 2. Layer-by-Layer Verification & Mitigations

### 2.1 Electron Renderer Sandbox
- **Renderer Isolation**: The UI has zero direct access to Node.js `fs`, `child_process`, or `net`. All interaction happens over strongly typed `window.api` bridges.
- **CSP**: Restricts script execution strictly to `'self'`, blocking remote code execution (RCE) via malicious Markdown rendering or third-party web content.

### 2.2 Path Traversal & Symlink Escapes
- When reading or indexing files, `securityService.assertWithinWorkspace` resolves symbolic links using `fs.realpathSync`.
- If an agent or craftily structured repository attempts to escape via symlinks (e.g. `../../etc/passwd` or `..\..\Windows\System32`), the operation throws an uncatchable security violation error.

### 2.3 Shell Injection Immunity
- Commands are spawned via `node:child_process.spawn` with `shell: false`.
- Arguments are passed as an array of strings, preventing meta-character injection (`;`, `&&`, `|`, `` ` ``, `$()`).

### 2.4 Token Exfiltration & Keyring Safeguards
- CLI auth detection (Claude, Codex, Gemini) only inspects credential files for presence and validity flags, **never** reading out or streaming raw API keys or tokens to the renderer.
- User-provided tokens are encrypted via Electron `safeStorage` before persisting to SQLite `secrets_store`.

### 2.5 Skills Engine Permissions
- Manifests declare exact permissions.
- In `strict` mode, any skill requesting write access or network egress is denied immediately.
- Custom skills imported from third-party repositories require explicit human opt-in and toggle before they can execute.

### 2.6 Git Worktree Isolation & Host Protection
- **No Direct Edits to Active Branch**: Tasks with write intent run in isolated ephemeral Git Worktrees (`.worktrees/agent-task-<id>`) on dedicated task branches (`agent/task-<id>`).
- **Concurrent Overlap Defense**: Prior to scheduling a modifying task, `WorktreeManager.checkOverlaps` compares predicted modified files against currently active worktrees to prevent destructive parallel race conditions.
- **Atomic Cleanup**: Upon task failure, cancellation, or rejection, worktrees are pruned (`git worktree remove --force`) and branches deleted, preventing filesystem pollution.

### 2.7 Human-in-the-Loop Multi-Agent Execution Modes
To guarantee appropriate human oversight, three execution safety tiers are enforced:
1. **Manual Mode**: Every single task transition, command execution, and file modification requires explicit human approval in the Approval Center.
2. **Supervised Mode (Default)**: Specialist workers execute read and worktree write operations autonomously; merges into the main branch, system package installations, or high-risk commands pause for human approval with side-by-side diff inspection.
3. **Autonomous Mode**: Safe workflow execution where tasks that pass automated `ReviewerAgent` gates (typecheck + test suite passes) merge automatically. High-risk system actions or failed verification gates still escalate to human intervention.
