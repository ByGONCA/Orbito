# Orbito — Plugin Developer Guide & CLI Reference

## 1. Overview

Orbito includes a complete plugin architecture allowing developers to extend the workspace with custom panels, commands, status bar items, and AI workflow tools.

Plugins run in isolated sandbox environments adhering to the [Security Model](../architecture/SECURITY_MODEL.md) and [Extension SDK Specification](./ECOSYSTEM_SDK.md).

---

## 2. Plugin Anatomy

A standard Orbito plugin consists of:
```text
my-plugin/
├── extension.json      # Plugin manifest specifying permissions, entry point, and contribution points
├── index.js            # Plugin entry point (CommonJS/ES module bundled for the plugin runtime)
└── README.md           # Documentation and usage instructions
```

### 2.1 Manifest Specification (`extension.json`)
```json
{
  "id": "com.example.clock-panel",
  "name": "Clock Panel Extension",
  "version": "1.0.0",
  "description": "Displays a real-time world clock in the Orbito workspace.",
  "main": "index.js",
  "author": "Community Developer",
  "permissions": [
    "ui:panel",
    "storage:local"
  ],
  "contributes": {
    "panels": [
      {
        "id": "clock-panel",
        "title": "World Clock",
        "icon": "clock"
      }
    ]
  }
}
```

---

## 3. Orbito CLI Plugin Commands

The Orbito CLI (`bin/orbito.js`) provides comprehensive commands to manage, validate, and package plugins:

| Command | Description | Example |
| :--- | :--- | :--- |
| `orbito plugins list` | List all installed plugins in `.ai-workspace-data/extensions` | `node bin/orbito.js plugins list` |
| `orbito plugins search <query>` | Search the discovery catalog | `node bin/orbito.js plugins search clock` |
| `orbito plugins info <id>` | Inspect plugin metadata | `node bin/orbito.js plugins info com.example.clock` |
| `orbito plugins install <path\|id>` | Install a local plugin directory or archive | `node bin/orbito.js plugins install ./plugins/example-clock-panel` |
| `orbito plugins uninstall <id>` | Remove an installed plugin | `node bin/orbito.js plugins uninstall com.example.clock` |
| `orbito plugins validate <dir>` | Validate manifest schema and entry point integrity | `node bin/orbito.js plugins validate ./plugins/example-clock-panel` |
| `orbito plugins package <dir>` | Package directory into a distributed archive | `node bin/orbito.js plugins package ./plugins/example-clock-panel` |

---

## 4. Example Plugins

A canonical reference plugin is provided in the repository at:
[`plugins/example-clock-panel/`](file:///C:/Users/gonca/OneDrive/Documents/Projects/Orbito/Orbito/plugins/example-clock-panel/)
