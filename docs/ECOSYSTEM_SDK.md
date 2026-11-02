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

## 5. Contributing Custom Workflow Nodes

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
