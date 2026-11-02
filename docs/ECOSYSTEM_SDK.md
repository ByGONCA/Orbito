# Custom Extension SDK & Plugin Architecture — AI Workspace

**Phase:** Phase 7 — Ecosystem & Enterprise Hardening  
**Document Version:** 1.0.0  
**Target:** Third-Party Developers & Enterprise Teams  

---

## 1. Overview & Philosophy

The **AI Workspace Extension SDK** allows developers to extend the application without compromising its local-first, zero-trust security architecture. Extensions can contribute:
1. **Custom React Flow Visual Workflow Nodes** for the Flow Builder canvas.
2. **Specialized Domain Skills** for the Skills Engine.
3. **Automated Workspace Commands** and custom lifecycle hooks.

Every extension is strictly sandboxed: permissions must be declared upfront in a static `extension.json` manifest, validated by Zod schemas, and verified with SHA-256 integrity checksums. Under active **Air-Gap Mode**, extensions requesting external network egress are automatically blocked from loading.

---

## 2. Extension Directory Layout

A standard AI Workspace extension has the following structure:

```
my-extension/
├── extension.json        # Required: Declarative extension manifest
├── README.md             # Required: Extension documentation & usage guide
├── icon.svg              # Optional: Extension icon for UI display
└── index.js              # Optional: CommonJS entrypoint for lifecycle hooks
```

Extensions are stored locally in:
- Global user directory: `~/.ai-workspace-data/extensions/<extension-id>/`
- Project-local directory: `<project-root>/.extensions/<extension-id>/`

---

## 3. Extension Manifest Specification (`extension.json`)

The manifest is validated against `ExtensionManifestSchema`:

```json
{
  "id": "code-metrics-analyzer",
  "name": "Code Metrics Analyzer",
  "displayName": "Code Metrics & Cyclomatic Complexity",
  "version": "1.0.0",
  "description": "Calculates cyclomatic complexity and maintainability index across workspace code.",
  "author": "Acme Corp DevTools",
  "license": "MIT",
  "permissions": {
    "filesystem": {
      "read": true,
      "write": false
    },
    "network": {
      "allowedHosts": ["127.0.0.1", "localhost"],
      "allowExternal": false
    },
    "shell": false
  },
  "contributes": {
    "nodes": [
      {
        "type": "calculate_cyclomatic_complexity",
        "category": "dev",
        "name": "Cyclomatic Complexity",
        "description": "Computes complexity scores for functions in active files",
        "icon": "BarChart3",
        "inputs": [
          { "id": "code", "name": "Source Code", "type": "string" }
        ],
        "outputs": [
          { "id": "complexity", "name": "Score", "type": "number" },
          { "id": "report", "name": "Report", "type": "string" }
        ],
        "defaultData": {}
      }
    ],
    "skills": [
      {
        "id": "complexity-audit",
        "name": "Complexity Audit",
        "version": "1.0.0",
        "description": "Audit and flag complex methods exceeding thresholds",
        "category": "refactor"
      }
    ]
  }
}
```

---

## 4. Permission Scopes & Guardrails

| Scope | Type | Default | Description |
|---|---|---|---|
| `filesystem.read` | `boolean` or `string[]` | `false` | Read access to files within the authorized workspace. |
| `filesystem.write` | `boolean` or `string[]` | `false` | Write access to files (subject to workspace permission tier). |
| `network.allowedHosts` | `string[]` | `[]` | Explicit list of permitted network hosts (e.g. `['127.0.0.1']`). |
| `network.allowExternal` | `boolean` | `false` | Whether outbound internet egress is requested. **Blocked under Air-Gap Mode**. |
| `shell` | `boolean` | `false` | Authority to execute subprocesses (subject to human approval gates). |

---

## 5. OS-Level Sandboxing & Capability-Based API (Extension Security 2.0)

Third-party extensions execute **exclusively inside an operating-system and runtime-sandboxed child process** (`ExtensionHostManager`). Node.js `node:vm` has been completely eliminated as a security boundary, and child processes are constrained by the Node.js Permission Model and OS-level enforcement.

### 5.1 Architecture & Runtime Sandboxing Properties
- **Node.js Permission Model Enforcement (`--permission`)**: Extension host processes are launched with Node runtime permission flags. Node denies `require('child_process')`, `require('worker_threads')`, native `.node` C++ binary addons, and WASI directly at the engine level.
- **Strict Filesystem Whitelisting**: Filesystem access is locked at the runtime layer using `--allow-fs-read` and `--allow-fs-write`. Extensions can only read/write their own installation directory and dedicated isolated storage folder (`~/.ai-workspace-data/extensions/<id>/.storage`). Direct Node `fs` calls targeting the workspace or application files (`data/app.db`) are blocked with `ERR_ACCESS_DENIED`. All workspace access must occur via `context.workspace` capability APIs mediated by the Main process.
- **Network Prototype Interception & Air-Gap Defense**: The worker process traps and freezes `net.Socket.prototype.connect`, `dgram.Socket.prototype.send`, global `fetch`, and `WebSocket`. Unpermitted raw sockets, SSRF attempts to private networks (`10.*`, `192.168.*`, `172.16-31.*`, `169.254.169.254`), and local loopback access (`127.0.0.1`, `localhost`) are denied. In Air-Gap Mode, all outbound traffic is dropped.
- **Resource Quotas & Concurrency Limits**: Memory is capped at 128MB per host (`--max-old-space-size=128`), maximum concurrent active hosts is capped at 5 (`MAX_CONCURRENT_HOSTS = 5`), and IPC frame sizes are strictly enforced at a 5MB maximum to prevent memory exhaustion attacks.
- **Process Tree Cleanup**: Extension host shutdown uses `taskkill /F /T /PID` on Windows and process group `SIGKILL` on Unix to ensure all spawned descendants are reliably cleaned up.
- **Graceful Degradation & Untrusted Extensions**: Built-in, vetted extensions are permitted. Third-party extensions on platforms without sandboxing support are blocked by default unless explicitly configured by the user with security warnings.
- **Environment Sanitization**: All host credentials, API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`), tokens, and database secrets are purged from the child process environment before launch.
- **Strict Capability RPC**: All interactions with the workspace and host application must route through structured, validated RPC messages to the trusted Main process.
- **Crash & Hang Resilience**: If an extension process crashes (`process.exit`) or hangs in an infinite loop, the Main process traps the event, triggers a deterministic timeout, force-terminates the rogue host tree, and logs an audit security event without crashing or freezing the application.

### 5.2 Capability Namespaces (`ExtensionContext`)

Extensions interact with the application via narrow, strongly typed capability namespaces:

```typescript
export interface ExtensionContext {
  extensionId: string;
  storagePath: string;
  permissions: ExtensionPermissions;
  workspacePath?: string;
  log: (message: string, level?: 'info' | 'warn' | 'error') => void;

  // Workspace filesystem access (strictly confined to active workspace boundaries)
  workspace: {
    readFile: (relativePath: string) => Promise<{ content: string }>;
    listFiles: (relativePath?: string) => Promise<{ files: string[] }>;
    writeFile: (relativePath: string, content: string) => Promise<{ success: boolean; bytesWritten: number }>;
  };

  // Extension-isolated persistent key-value storage
  storage: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<boolean>;
  };

  // Declarative workflow node registration
  workflow: {
    registerNode: (node: NodeDefinition) => Promise<void>;
  };

  // Domain skill registration
  skills: {
    register: (skill: SkillManifest) => Promise<void>;
  };

  // User notifications
  notifications: {
    show: (message: string, type?: 'info' | 'warning' | 'error') => Promise<void>;
  };
}
```

### 5.3 Extension Entrypoint Lifecycle (`index.js`)

```javascript
module.exports = {
  activate: async (context) => {
    context.log('Activating custom extension...');

    // Read a project file inside the authorized workspace
    const { content } = await context.workspace.readFile('package.json');
    const pkg = JSON.parse(content);

    // Persist extension-scoped state
    await context.storage.set('last_scanned_pkg', pkg.name);

    // Register a declarative workflow node
    await context.workflow.registerNode({
      type: 'ext_pkg_auditor',
      category: 'dev',
      name: 'Package Auditor',
      description: 'Audits dependencies',
      icon: 'Shield',
      inputs: [{ id: 'in', name: 'Input', type: 'string' }],
      outputs: [{ id: 'out', name: 'Output', type: 'string' }],
      defaultData: {}
    });
  },

  // Invoked when custom workflow nodes execute
  executeNode: async (nodeType, inputs, config) => {
    if (nodeType === 'ext_pkg_auditor') {
      return { out: `Audited ${inputs.in}` };
    }
    throw new Error('Unknown node type: ' + nodeType);
  },

  deactivate: async () => {
    // Cleanup hooks
  }
};
```

---

## 6. Contributing Custom Workflow Nodes

To contribute custom visual nodes to the React Flow canvas:
1. Define the node in `contributes.nodes` within `extension.json`.
2. Assign a unique node `type` (e.g., `ext_<name>`).
3. Select a category: `ai`, `context`, `logic`, `io`, or `dev`.
4. Specify typed input and output handles (`string`, `number`, `boolean`, `any`, `flow`).

Upon extension activation, `ExtensionLoader` calls `registerCustomNode(node)`, making it immediately searchable and draggable in the **Flow Builder** node palette.

---

## 6. Contributing Custom Domain Skills

To contribute domain skills:
1. Define the skill in `contributes.skills`.
2. Provide a `README.md` or dedicated instructions markdown file detailing system prompts and guidelines.
3. Upon activation, `ExtensionLoader` registers the skill in `skillRegistry`, enabling it in the Skills Manager UI and for intent classification.

---

## 7. Air-Gap Isolation Compliance

If the user activates **Air-Gap Mode**:
1. Any extension with `permissions.network.allowExternal: true` will fail validation and be refused execution.
2. An enterprise security violation is logged to SQLite `audit_logs`.
3. Extensions can still perform local calculations, file transformations, and invoke local Ollama inference models via loopback (`127.0.0.1:11434`).

---

## 8. Management via User Interface

Extensions can be installed, inspected, enabled, and removed from the **Extensions** tab in the main application header:
- **Card Catalog:** View name, version, author, and description.
- **Permission Badges:** Visual indicators of filesystem, shell, and network privileges.
- **Enable/Disable Switch:** Instant toggle without restarting the desktop application.
- **Install Folder:** One-click directory picker to load local plugins into `.ai-workspace-data/extensions/`.
