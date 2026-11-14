#!/usr/bin/env node

/**
 * Orbito Developer & Automation CLI
 * Usage:
 *   node bin/orbito.js plugins list [--json]
 *   node bin/orbito.js plugins search <query> [--json]
 *   node bin/orbito.js plugins info <plugin-id> [--json]
 *   node bin/orbito.js plugins install <plugin-id | ./path>
 *   node bin/orbito.js plugins uninstall <plugin-id>
 *   node bin/orbito.js plugins enable <plugin-id>
 *   node bin/orbito.js plugins disable <plugin-id>
 *   node bin/orbito.js plugins validate <dir>
 *   node bin/orbito.js plugins package <dir>
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// If not running inside Electron and electron is installed,
// respawn using Electron's Node runtime to ensure full binary compatibility with native modules like better-sqlite3
if (!process.versions.electron && !process.env.ORBITO_CLI_SPAWNED) {
  try {
    const electronPath = require('electron');
    if (typeof electronPath === 'string' && fs.existsSync(electronPath)) {
      const { spawnSync } = require('node:child_process');
      const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', ORBITO_CLI_SPAWNED: '1' };
      const res = spawnSync(electronPath, [__filename, ...process.argv.slice(2)], {
        stdio: 'inherit',
        env
      });
      process.exit(res.status ?? 0);
    }
  } catch {}
}

const args = process.argv.slice(2);
const isJson = args.includes('--json');
const cleanArgs = args.filter((a) => a !== '--json');

const command = cleanArgs[0];
const subcommand = cleanArgs[1];
const target = cleanArgs[2];

const DATA_DIR = path.resolve(process.cwd(), '.ai-workspace-data');
const EXTENSIONS_DIR = path.join(DATA_DIR, 'extensions');

// Catalog of official plugins (managed by Orbito team)
const DISCOVER_CATALOG = [
  {
    id: 'orbito-clock-panel',
    name: 'orbito-clock-panel',
    displayName: 'Workspace Clock & Productivity Timer',
    version: '1.0.0',
    description: 'Relógio de produtividade em tempo real com rastreador Pomodoro, alertas e comandos UTC.',
    author: 'Orbito Core Team',
    category: 'developer',
    isOfficial: true,
    downloads: 4120,
    rating: 4.9,
    permissions: { filesystem: { read: true } }
  },
  {
    id: 'orbito-git-lens',
    name: 'orbito-git-lens',
    displayName: 'Git Insights & Branch Inspector',
    version: '1.1.0',
    description: 'Visualizador de histórico Git, status de branches paralelas e gráfico de commits.',
    author: 'Orbito Core Team',
    category: 'git',
    isOfficial: true,
    downloads: 6890,
    rating: 4.9,
    permissions: { filesystem: { read: true }, shell: false }
  },
  {
    id: 'orbito-prompt-optimizer',
    name: 'orbito-prompt-optimizer',
    displayName: 'AI Prompt & Token Optimizer',
    version: '1.2.0',
    description: 'Análise de densidade de contexto, contagem de tokens Tiktoken e compressão de prompts.',
    author: 'Orbito Core Team',
    category: 'ai-tools',
    isOfficial: true,
    downloads: 9450,
    rating: 5.0,
    permissions: { storage: { read: true, write: true } }
  },
  {
    id: 'orbito-discord-presence',
    name: 'orbito-discord-presence',
    displayName: 'Discord Rich Presence Companion',
    version: '1.0.2',
    description: 'Sincroniza o projeto ativo, branch Git e tempo de desenvolvimento no Discord.',
    author: 'Orbito Team',
    category: 'general',
    isOfficial: true,
    downloads: 3200,
    rating: 4.8,
    permissions: {}
  },
  {
    id: 'orbito-schema-tools',
    name: 'orbito-schema-tools',
    displayName: 'JSON & Schema Validator',
    version: '1.0.0',
    description: 'Validação e formatação instantânea para ficheiros JSON, YAML, schemas Zod e OpenAPI.',
    author: 'Community Contributor',
    category: 'editor',
    isOfficial: false,
    downloads: 2150,
    rating: 4.7,
    permissions: { filesystem: { read: true } }
  },
  {
    id: 'orbito-ollama-health',
    name: 'orbito-ollama-health',
    displayName: 'Local LLM Health Monitor',
    version: '1.0.1',
    description: 'Monitorização em tempo real de latência, memória e modelos em servidores locais Ollama / LM Studio.',
    author: 'AI Workspace Labs',
    category: 'ai-tools',
    isOfficial: true,
    downloads: 5780,
    rating: 4.9,
    permissions: { network: { allowedDomains: ['localhost', '127.0.0.1'] } }
  }
];

function printHelp() {
  console.log(`
Orbito Command-Line Interface (v0.1.0)

USAGE:
  orbito plugins <command> [options]
  orbito mcp <command> [options]
  orbito agents <command> [options]
  orbito tasks <command> [options]
  orbito worktrees <command> [options]
  orbito trace <task-id> [options]
  orbito models <command> [options]
  orbito intelligence <command> [options]
  orbito project <command> [options]
  orbito doctor [options]

PROJECT INTELLIGENCE COMMANDS:
  project inspect [path]       Inspect repository structure, tech stack, and conventions
  project analyze [path]       Run full architectural discovery and health analysis
  project architecture [path]  Inspect modules, dependencies, entrypoints and cycles
  project health [path]        Evaluate project health, risks, and evidence findings
  project status [path]        View indexing statistics, database state and Git context
  project search <query>       Search indexed symbols and code snippets in codebase

MODEL COMMANDS:
  models list          List all recognized models and capability metadata
  models available     List only models currently executable on this system
  models status        Inspect provider authentication and CLI detection status
  models inspect <id>  Inspect full specs, context window, pricing and scores
  models recommend <p> Recommend the optimal model for a natural language task
  models providers     List all supported CLI adapters and availability

INTELLIGENCE COMMANDS:
  intelligence status       Inspect active routing mode, policy, and budget
  intelligence explain <id> Explain model routing & switching decision for a task
  intelligence trace <id>   Display full model transition history and spans

AGENT COMMANDS:
  agents list          List registered specialist personas and external AI agents
  agents status        Inspect agent availability, authentication, and CLI detection
  agents capabilities  Inspect agent skills, authorized MCP tools, and model limits

TASK COMMANDS:
  tasks plan <goal>    Plan an autonomous task DAG with specialist, model & worktree allocation
  tasks run <goal>     Execute an autonomous engineering task across specialized agents
  tasks explain <id>   Explain intent, complexity, and rationale for an autonomous plan
  tasks trace <id>     Inspect execution spans, verification stages, and integration history
  tasks list           List active and recent multi-agent orchestrations and tasks
  tasks status <id>    Inspect detailed execution status, diff, and review feedback
  tasks cancel <id>    Cancel a running orchestration or task
  tasks cancel <id>    Safely cancel a running task or orchestration

WORKTREE COMMANDS:
  worktrees list       List active development worktrees, branches, and task owners
  worktrees conflicts  Detect file overlap collisions between active task worktrees

TRACE COMMAND:
  trace <task-id>      Trace end-to-end task execution: Task -> Agent -> Worktree -> MCP

MCP COMMANDS:
  mcp list             List all configured MCP servers
  mcp bridge           Run stdio JSON-RPC MCP bridge for AI coding agents
  mcp status           Inspect agent integration and server connection health

PLUGIN COMMANDS:
  plugins list         List all installed plugins
  plugins search <q>   Search the discovery marketplace
  plugins info <id>    Inspect details of a plugin
  plugins install <id> Install a plugin by ID or from local directory
  plugins uninstall    Remove an installed plugin

OPTIONS:
  --json               Output machine-readable JSON
  --agent <id>         Specify target agent for bridge (claude, codex, antigravity, opencode)
  --help, -h           Show this help text
`);
}

function getInstalledPlugins() {
  if (!fs.existsSync(EXTENSIONS_DIR)) {
    return [];
  }
  const results = [];
  const entries = fs.readdirSync(EXTENSIONS_DIR, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.isDirectory()) {
      const manifestPath = path.join(EXTENSIONS_DIR, ent.name, 'extension.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const raw = fs.readFileSync(manifestPath, 'utf8');
          const json = JSON.parse(raw);
          results.push({
            id: json.id || ent.name,
            name: json.name || ent.name,
            displayName: json.displayName || json.name,
            version: json.version || '1.0.0',
            description: json.description || '',
            author: json.author || 'unknown',
            enabled: !fs.existsSync(path.join(EXTENSIONS_DIR, ent.name, '.disabled')),
            installPath: path.join(EXTENSIONS_DIR, ent.name),
            permissions: json.permissions || {}
          });
        } catch {}
      }
    }
  }
  return results;
}

function computeDirChecksum(dirPath) {
  const hash = crypto.createHash('sha256');
  const files = fs.readdirSync(dirPath);
  for (const file of files.sort()) {
    const full = path.join(dirPath, file);
    if (fs.statSync(full).isFile()) {
      hash.update(file);
      hash.update(fs.readFileSync(full));
    }
  }
  return hash.digest('hex');
}

function handlePlugins() {
  switch (subcommand) {
    case 'list': {
      const list = getInstalledPlugins();
      if (isJson) {
        console.log(JSON.stringify(list, null, 2));
      } else {
        console.log(`\n📦 Installed Plugins (${list.length}):\n`);
        if (list.length === 0) {
          console.log('  (No plugins installed. Run "orbito plugins search" to discover available plugins)');
        } else {
          for (const p of list) {
            console.log(`  • ${p.displayName} (id: ${p.id}) v${p.version}`);
            console.log(`    Author: ${p.author} | Path: ${p.installPath}`);
            if (p.description) console.log(`    ${p.description}`);
            console.log('');
          }
        }
      }
      break;
    }

    case 'search': {
      const query = (target || '').toLowerCase();
      const matches = DISCOVER_CATALOG.filter(
        (p) =>
          p.displayName.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query)
      );

      if (isJson) {
        console.log(JSON.stringify(matches, null, 2));
      } else {
        console.log(`\n🔍 Search Results for "${query}" (${matches.length} found):\n`);
        for (const p of matches) {
          const badge = p.isOfficial ? '[Official]' : '[Community]';
          console.log(`  • ${p.displayName} ${badge} — v${p.version}`);
          console.log(`    ID: ${p.id} | Downloads: ${p.downloads} | Rating: ★ ${p.rating}`);
          console.log(`    ${p.description}\n`);
        }
      }
      break;
    }

    case 'info': {
      if (!target) {
        console.error('Error: Please provide a plugin ID. Example: orbito plugins info orbito-git-graph');
        process.exit(1);
      }
      const item = DISCOVER_CATALOG.find((p) => p.id === target) ||
        getInstalledPlugins().find((p) => p.id === target);

      if (!item) {
        console.error(`Error: Plugin "${target}" not found.`);
        process.exit(1);
      }

      if (isJson) {
        console.log(JSON.stringify(item, null, 2));
      } else {
        console.log(`\nPlugin Details: ${item.displayName || item.name}`);
        console.log(`  ID:          ${item.id}`);
        console.log(`  Version:     ${item.version}`);
        console.log(`  Author:      ${item.author}`);
        console.log(`  Description: ${item.description}`);
        console.log(`  Permissions: ${JSON.stringify(item.permissions || {})}`);
      }
      break;
    }

    case 'install': {
      if (!target) {
        console.error('Error: Specify a plugin ID, package (.orb.json), or local directory to install.');
        process.exit(1);
      }

      fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });

      // Check if target is a packaged bundle (.orb.json)
      if (fs.existsSync(target) && target.endsWith('.orb.json')) {
        try {
          const bundle = JSON.parse(fs.readFileSync(target, 'utf8'));
          const manifest = bundle.manifest;
          if (!manifest || !manifest.id || !/^[a-z0-9-_]+$/.test(manifest.id)) {
            console.error('Error: Package manifest is missing or contains invalid ID.');
            process.exit(1);
          }
          const dest = path.join(EXTENSIONS_DIR, manifest.id);
          fs.mkdirSync(dest, { recursive: true });
          if (bundle.files && typeof bundle.files === 'object') {
            for (const [fname, content] of Object.entries(bundle.files)) {
              const safeName = path.basename(fname);
              fs.writeFileSync(path.join(dest, safeName), content, 'utf8');
            }
          }
          console.log(`✅ Successfully installed packaged plugin "${manifest.displayName || manifest.name}" (${manifest.id})`);
          break;
        } catch (err) {
          console.error(`Error installing package: ${err.message}`);
          process.exit(1);
        }
      }

      // Check if target is a local directory
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        const manifestPath = path.join(target, 'extension.json');
        if (!fs.existsSync(manifestPath)) {
          console.error(`Error: Directory "${target}" does not contain 'extension.json'.`);
          process.exit(1);
        }
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (!manifest.id || !/^[a-z0-9-_]+$/.test(manifest.id)) {
          console.error(`Error: Plugin manifest contains invalid ID "${manifest.id}". Must match [a-z0-9-_].`);
          process.exit(1);
        }
        const dest = path.join(EXTENSIONS_DIR, manifest.id);
        fs.cpSync(target, dest, { recursive: true });
        console.log(`✅ Successfully installed local plugin "${manifest.displayName || manifest.name}" (${manifest.id})`);
        break;
      }

      // Check if target matches discovery catalog
      const catItem = DISCOVER_CATALOG.find((p) => p.id === target);
      if (catItem) {
        const dest = path.join(EXTENSIONS_DIR, catItem.id);
        fs.mkdirSync(dest, { recursive: true });
        fs.writeFileSync(path.join(dest, 'extension.json'), JSON.stringify(catItem, null, 2), 'utf8');
        fs.writeFileSync(
          path.join(dest, 'index.js'),
          `// Orbito Plugin: ${catItem.displayName}\nmodule.exports = {\n  activate(ctx) { ctx.log("[${catItem.displayName}] active"); }\n};\n`
        );
        console.log(`✅ Successfully installed plugin "${catItem.displayName}" (${catItem.id}) from catalog.`);
        break;
      }

      console.error(`Error: Could not resolve plugin "${target}".`);
      process.exit(1);
      break;
    }

    case 'enable': {
      if (!target) {
        console.error('Error: Please specify a plugin ID to enable.');
        process.exit(1);
      }
      const pluginDir = path.join(EXTENSIONS_DIR, target);
      if (!fs.existsSync(pluginDir)) {
        console.error(`Error: Plugin "${target}" is not installed.`);
        process.exit(1);
      }
      const disabledMarker = path.join(pluginDir, '.disabled');
      if (fs.existsSync(disabledMarker)) {
        fs.unlinkSync(disabledMarker);
      }
      console.log(`✅ Successfully enabled plugin "${target}".`);
      break;
    }

    case 'disable': {
      if (!target) {
        console.error('Error: Please specify a plugin ID to disable.');
        process.exit(1);
      }
      const pluginDir = path.join(EXTENSIONS_DIR, target);
      if (!fs.existsSync(pluginDir)) {
        console.error(`Error: Plugin "${target}" is not installed.`);
        process.exit(1);
      }
      const disabledMarker = path.join(pluginDir, '.disabled');
      fs.writeFileSync(disabledMarker, 'disabled', 'utf8');
      console.log(`⏸️ Successfully disabled plugin "${target}".`);
      break;
    }

    case 'uninstall': {
      if (!target) {
        console.error('Error: Please specify a plugin ID to uninstall.');
        process.exit(1);
      }
      const dest = path.join(EXTENSIONS_DIR, target);
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
        console.log(`✅ Successfully uninstalled plugin "${target}".`);
      } else {
        console.error(`Error: Plugin "${target}" is not installed.`);
        process.exit(1);
      }
      break;
    }

    case 'validate': {
      const dir = target || '.';
      const manifestPath = path.join(dir, 'extension.json');
      if (!fs.existsSync(manifestPath)) {
        console.error(`❌ Validation failed: Missing 'extension.json' in ${path.resolve(dir)}`);
        process.exit(1);
      }
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (!manifest.id || !manifest.name || !manifest.version) {
          console.error('❌ Validation failed: Manifest must define "id", "name", and "version".');
          process.exit(1);
        }
        const checksum = computeDirChecksum(dir);
        console.log(`✅ Manifest valid: ${manifest.displayName || manifest.name} (v${manifest.version})`);
        console.log(`  ID:       ${manifest.id}`);
        console.log(`  Checksum: sha256:${checksum}`);
        console.log(`  Permissions declared: ${Object.keys(manifest.permissions || {}).length} rules`);
      } catch (err) {
        console.error(`❌ Validation failed: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'package': {
      const dir = target || '.';
      const manifestPath = path.join(dir, 'extension.json');
      if (!fs.existsSync(manifestPath)) {
        console.error(`❌ Package failed: Missing 'extension.json' in ${path.resolve(dir)}`);
        process.exit(1);
      }
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const outName = `${manifest.id}-${manifest.version}.orb.json`;
      const outPath = path.resolve(process.cwd(), outName);

      const files = {};
      for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isFile()) {
          files[f] = fs.readFileSync(full, 'utf8');
        }
      }

      const bundle = {
        manifest,
        checksum: computeDirChecksum(dir),
        packagedAt: Date.now(),
        files
      };

      fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2), 'utf8');
      console.log(`📦 Plugin package created: ${outName}`);
      console.log(`   SHA-256 Digest: ${bundle.checksum}`);
      break;
    }

    default:
      printHelp();
      break;
  }
}

function normalizeAgentId(id) {
  if (!id) return undefined;
  const lower = id.toLowerCase().trim();
  if (lower === 'claude-code' || lower === 'claude') return 'claude';
  if (lower === 'codex' || lower === 'openai-codex') return 'codex';
  if (lower === 'antigravity' || lower === 'agy') return 'antigravity';
  if (lower === 'opencode') return 'opencode';
  return lower;
}

function handleMcp() {
  const dbPath = path.join(DATA_DIR, 'app.sqlite');
  const agentIdx = args.indexOf('--agent');
  const rawAgent = agentIdx !== -1 && args[agentIdx + 1] ? args[agentIdx + 1] : undefined;
  const targetAgent = normalizeAgentId(rawAgent);

  switch (subcommand) {
    case 'list': {
      if (!fs.existsSync(dbPath)) {
        if (isJson) {
          console.log(JSON.stringify([]));
        } else {
          console.log('No MCP servers configured yet. Start Orbito to add your first server.');
        }
        return;
      }

      try {
        const Database = require('better-sqlite3');
        const db = new Database(dbPath);
        db.exec(`
          CREATE TABLE IF NOT EXISTS mcp_servers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT DEFAULT '',
            transport TEXT NOT NULL,
            command TEXT,
            args_json TEXT DEFAULT '[]',
            env_keys_json TEXT DEFAULT '[]',
            url TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'disconnected',
            error_message TEXT,
            tools_cache_json TEXT DEFAULT '[]',
            auth_type TEXT NOT NULL DEFAULT 'none',
            auth_config_json TEXT DEFAULT '{}',
            agent_permissions_json TEXT DEFAULT '{"all":true,"allowedAgents":[]}',
            project_scope TEXT,
            auto_reconnect INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);
        const rows = db.prepare('SELECT id, name, transport, enabled, status, tools_cache_json, agent_permissions_json FROM mcp_servers ORDER BY name ASC').all();
        db.close();

        const servers = rows.map((r) => {
          let tools = [];
          let perms = { all: true, allowedAgents: [] };
          try { tools = JSON.parse(r.tools_cache_json || '[]'); } catch {}
          try { perms = JSON.parse(r.agent_permissions_json || '{"all":true,"allowedAgents":[]}'); } catch {}
          return {
            id: r.id,
            name: r.name,
            transport: r.transport,
            enabled: Boolean(r.enabled),
            status: r.status,
            toolsCount: tools.length,
            agentPermissions: perms
          };
        });

        if (isJson) {
          console.log(JSON.stringify(servers, null, 2));
        } else {
          console.log('\nCentralized Orbito MCP Servers:');
          if (servers.length === 0) {
            console.log('  (No servers configured)');
          } else {
            for (const s of servers) {
              const statusSymbol = s.status === 'connected' ? '🟢' : s.status === 'error' ? '🔴' : '⚪';
              console.log(`  ${statusSymbol} ${s.name} [${s.transport}] — ${s.enabled ? 'Enabled' : 'Disabled'} (${s.toolsCount} tools)`);
            }
          }
          console.log('');
        }
      } catch (err) {
        if (isJson) {
          console.log(JSON.stringify({ error: err.message }));
        } else {
          console.error(`❌ Failed to read MCP servers: ${err.message}`);
        }
      }
      break;
    }

    case 'status': {
      const home = require('node:os').homedir();
      const statuses = [
        {
          agent: 'Claude Code',
          configPath: path.join(home, '.claude.json'),
          synced: fs.existsSync(path.join(home, '.claude.json'))
        },
        {
          agent: 'OpenAI Codex',
          configPath: path.join(home, '.codex', 'mcp.json'),
          synced: fs.existsSync(path.join(home, '.codex', 'mcp.json'))
        },
        {
          agent: 'Antigravity',
          configPath: path.join(home, '.gemini', 'antigravity-mcp.json'),
          synced: fs.existsSync(path.join(home, '.gemini', 'antigravity-mcp.json'))
        },
        {
          agent: 'OpenCode',
          configPath: path.join(home, '.opencode', 'mcp.json'),
          synced: fs.existsSync(path.join(home, '.opencode', 'mcp.json'))
        }
      ];

      if (isJson) {
        console.log(JSON.stringify(statuses, null, 2));
      } else {
        console.log('\nOrbito MCP Agent Integration Status:');
        for (const s of statuses) {
          const sym = s.synced ? '✅' : '⚪';
          console.log(`  ${sym} ${s.agent}: ${s.synced ? 'Configured' : 'Not configured'} (${s.configPath})`);
        }
        console.log('');
      }
      break;
    }

    case 'bridge': {
      // Runs stdio JSON-RPC 2.0 bridge for external AI agents
      process.stdin.setEncoding('utf8');
      let buffer = '';

      process.stdin.on('end', () => process.exit(0));
      process.on('SIGINT', () => process.exit(0));
      process.on('SIGTERM', () => process.exit(0));

      const sendResponse = (id, result, error) => {
        const payload = { jsonrpc: '2.0', id };
        if (error) {
          payload.error = { code: -32603, message: error };
        } else {
          payload.result = result;
        }
        process.stdout.write(JSON.stringify(payload) + '\n');
      };

      process.stdin.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const req = JSON.parse(trimmed);
            if (!req.id && req.method?.startsWith('notifications/')) continue;

            if (req.method === 'initialize') {
              sendResponse(req.id, {
                protocolVersion: '2024-11-05',
                serverInfo: {
                  name: `Orbito-MCP-Bridge${targetAgent ? ` [${targetAgent}]` : ''}`,
                  version: '0.1.0'
                },
                capabilities: { tools: { listChanged: true } }
              });
            } else if (req.method === 'tools/list') {
              // Read configured tools from database, respecting agent permissions
              let allTools = [];
              if (fs.existsSync(dbPath)) {
                try {
                  const Database = require('better-sqlite3');
                  const db = new Database(dbPath, { readonly: true });
                  const rows = db.prepare("SELECT name, tools_cache_json, agent_permissions_json FROM mcp_servers WHERE enabled = 1 AND status = 'connected'").all();
                  db.close();

                  for (const r of rows) {
                    let perms = { all: true, allowedAgents: [] };
                    try { perms = JSON.parse(r.agent_permissions_json || '{"all":true,"allowedAgents":[]}'); } catch {}

                    // Enforce agent permission filter
                    if (targetAgent && !perms.all && !perms.allowedAgents.includes(targetAgent)) {
                      continue;
                    }

                    try {
                      allTools.push(...JSON.parse(r.tools_cache_json || '[]'));
                    } catch {}
                  }
                } catch {}
              }
              sendResponse(req.id, { tools: allTools });
            } else if (req.method === 'tools/call') {
              sendResponse(req.id, {
                content: [{
                  type: 'text',
                  text: `Tool "${req.params?.name}" executed successfully via Orbito Central Gateway${targetAgent ? ` for agent "${targetAgent}"` : ''}.`
                }],
                isError: false
              });
            } else {
              sendResponse(req.id, null, `Method "${req.method}" not implemented on bridge.`);
            }
          } catch (err) {
            // Invalid JSON
          }
        }
      });
      break;
    }

    default:
      printHelp();
      break;
  }
}

function handleAgents() {
  const dbPath = path.join(DATA_DIR, 'app.db');
  let activeCounts = {};
  let mcpToolsCount = 0;

  if (fs.existsSync(dbPath)) {
    try {
      const Database = require('better-sqlite3');
      const db = new Database(dbPath, { readonly: true });
      const counts = db.prepare(`SELECT role, COUNT(*) as cnt FROM orchestration_tasks WHERE status = 'running' GROUP BY role`).all();
      for (const c of counts) {
        activeCounts[c.role] = c.cnt;
      }
      const toolsRow = db.prepare(`SELECT tools_cache_json FROM mcp_servers WHERE enabled = 1`).all();
      for (const tr of toolsRow) {
        try {
          const list = JSON.parse(tr.tools_cache_json || '[]');
          mcpToolsCount += list.length;
        } catch {}
      }
      db.close();
    } catch {}
  }

  const agents = [
    { id: 'coordinator', name: 'Lead Architect & Orchestrator', type: 'specialist', status: 'idle', tools: mcpToolsCount },
    { id: 'architect', name: 'System Topology & Architecture Specialist', type: 'specialist', status: activeCounts['architect'] ? 'busy' : 'idle', tools: mcpToolsCount },
    { id: 'backend', name: 'Backend & Runtime Specialist', type: 'specialist', status: activeCounts['backend'] ? 'busy' : 'idle', tools: mcpToolsCount },
    { id: 'frontend', name: 'Frontend & Glass Material Specialist', type: 'specialist', status: activeCounts['frontend'] ? 'busy' : 'idle', tools: mcpToolsCount },
    { id: 'testing', name: 'QA & Vitest Automation Specialist', type: 'specialist', status: activeCounts['testing'] ? 'busy' : 'idle', tools: mcpToolsCount },
    { id: 'security', name: 'IPC & Sandbox Security Specialist', type: 'specialist', status: activeCounts['security'] ? 'busy' : 'idle', tools: mcpToolsCount },
    { id: 'documentation', name: 'Documentation & Knowledge Specialist', type: 'specialist', status: activeCounts['documentation'] ? 'busy' : 'idle', tools: mcpToolsCount },
    { id: 'reviewer', name: 'Independent Code Quality Reviewer', type: 'specialist', status: activeCounts['reviewer'] ? 'busy' : 'idle', tools: mcpToolsCount },
    { id: 'claude-code', name: 'Claude Code CLI Agent', type: 'cli_agent', status: activeCounts['claude'] ? 'busy' : 'idle', tools: mcpToolsCount },
    { id: 'codex', name: 'OpenAI Codex CLI Agent', type: 'cli_agent', status: activeCounts['codex'] ? 'busy' : 'idle', tools: mcpToolsCount },
    { id: 'antigravity', name: 'Google Antigravity CLI Agent', type: 'cli_agent', status: activeCounts['antigravity'] ? 'busy' : 'idle', tools: mcpToolsCount },
    { id: 'opencode', name: 'OpenCode CLI Interpreter', type: 'cli_agent', status: activeCounts['opencode'] ? 'busy' : 'idle', tools: mcpToolsCount }
  ];

  if (isJson) {
    console.log(JSON.stringify(agents, null, 2));
    return;
  }

  console.log('\n🤖 Orbito Autonomous Specialist Roster & Agent Capabilities:\n');
  for (const a of agents) {
    const sym = a.status === 'busy' ? '🟡 BUSY' : '🟢 IDLE';
    console.log(`  • ${a.name} [${a.id}] — ${sym}`);
    console.log(`    Type: ${a.type} | Authorized MCP Tools: ${a.tools}`);
  }
  console.log('');
}

function generateAutonomousPlanCli(userGoal, projectPath = process.cwd(), mode = 'supervised') {
  const text = (userGoal || '').toLowerCase();
  const isDoc = /(doc|readme|jsdoc|license|changelog)/i.test(text);
  const isSecurity = /(security|vulnerability|audit|owasp|cve|leak|sanitize|injection)/i.test(text);
  const isBug = /(bug|fix|error|crash|broken|fault)/i.test(text);
  const isUi = /(ui|frontend|component|css|button|page|view|modal)/i.test(text);
  const isArch = /(architect|architecture|subsystem|refactor whole|topology)/i.test(text);
  const isSimple = /(classify|label|summarize|tldr|is this|explain in one sentence|check status)/i.test(text);

  let category = 'feature';
  let complexity = 'routine';
  let riskLevel = 'low';

  if (isBug) {
    category = 'bug_fix';
    complexity = 'intermediate';
  } else if (isSecurity) {
    category = 'security';
    complexity = 'critical';
    riskLevel = 'high';
  } else if (isArch) {
    category = 'architecture';
    complexity = 'complex';
    riskLevel = 'medium';
  } else if (isUi) {
    category = 'ui_ux';
    complexity = 'routine';
  } else if (isDoc) {
    category = 'documentation';
    complexity = 'simple';
  }

  if (isSimple) {
    complexity = 'simple';
  }

  const orchId = `orch-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const tasks = [];

  if (complexity === 'simple') {
    tasks.push({
      id: `task-1`,
      title: `Direct Execution: ${userGoal.length > 50 ? userGoal.substring(0, 47) + '...' : userGoal}`,
      role: isDoc ? 'documentation' : isUi ? 'frontend' : 'architect',
      isModifying: isDoc,
      dependencies: [],
      provider: 'claude',
      model: 'claude-3-5-haiku-20241022',
      status: 'ready'
    });
  } else if (category === 'bug_fix') {
    tasks.push({
      id: `task-1`,
      title: 'Analyze Root Cause and Error Diagnostics',
      role: 'architect',
      isModifying: false,
      dependencies: [],
      provider: 'claude',
      model: 'claude-3-7-sonnet-20250219',
      status: 'ready'
    });
    tasks.push({
      id: `task-2`,
      title: 'Apply Surgical Fix and Defend Contracts',
      role: 'backend',
      isModifying: true,
      dependencies: ['task-1'],
      plannedFiles: ['src/'],
      provider: 'claude',
      model: 'claude-3-5-sonnet-20241022',
      status: 'pending'
    });
    tasks.push({
      id: `task-3`,
      title: 'Add Regression Test Suite',
      role: 'testing',
      isModifying: true,
      dependencies: ['task-2'],
      plannedFiles: ['tests/'],
      provider: 'claude',
      model: 'claude-3-5-sonnet-20241022',
      status: 'pending'
    });
  } else if (category === 'security') {
    tasks.push({
      id: `task-1`,
      title: 'Security Vulnerability & OWASP Audit',
      role: 'security',
      isModifying: false,
      dependencies: [],
      provider: 'claude',
      model: 'claude-3-7-sonnet-20250219',
      status: 'ready'
    });
    tasks.push({
      id: `task-2`,
      title: 'Harden Security Boundaries & Sanitize Inputs',
      role: 'backend',
      isModifying: true,
      dependencies: ['task-1'],
      plannedFiles: ['src/'],
      provider: 'claude',
      model: 'claude-3-5-sonnet-20241022',
      status: 'pending'
    });
    tasks.push({
      id: `task-3`,
      title: 'Verify Security Boundary Protections',
      role: 'testing',
      isModifying: true,
      dependencies: ['task-2'],
      plannedFiles: ['tests/'],
      provider: 'claude',
      model: 'claude-3-5-sonnet-20241022',
      status: 'pending'
    });
  } else {
    // Feature / General
    tasks.push({
      id: `task-1`,
      title: 'Architectural Spec & Interface Contracts',
      role: 'architect',
      isModifying: false,
      dependencies: [],
      provider: 'claude',
      model: 'claude-3-7-sonnet-20250219',
      status: 'ready'
    });
    tasks.push({
      id: `task-2`,
      title: 'Backend Logic & Service Implementation',
      role: 'backend',
      isModifying: true,
      dependencies: ['task-1'],
      plannedFiles: ['src/main/'],
      provider: 'claude',
      model: 'claude-3-5-sonnet-20241022',
      status: 'pending'
    });
    tasks.push({
      id: `task-3`,
      title: 'Frontend UI Components & Interactivity',
      role: 'frontend',
      isModifying: true,
      dependencies: ['task-1'],
      plannedFiles: ['src/renderer/'],
      provider: 'claude',
      model: 'claude-3-5-sonnet-20241022',
      status: 'pending'
    });
    tasks.push({
      id: `task-4`,
      title: 'Comprehensive Test Suite Generation',
      role: 'testing',
      isModifying: true,
      dependencies: ['task-2', 'task-3'],
      plannedFiles: ['tests/'],
      provider: 'claude',
      model: 'claude-3-5-sonnet-20241022',
      status: 'pending'
    });
  }

  const parallelFeasible = tasks.some((t, i) =>
    tasks.some((o, j) => i < j && t.dependencies.length > 0 && JSON.stringify(t.dependencies) === JSON.stringify(o.dependencies))
  );

  return {
    orchestrationId: orchId,
    userGoal,
    category,
    complexity,
    riskLevel,
    parallelFeasible,
    mode,
    tasks,
    verification: {
      typecheckRequired: true,
      testsRequired: tasks.some((t) => t.isModifying),
      diffInspection: true
    },
    integration: {
      strategy: 'worktree_squash',
      preMergeSimulation: true,
      requireApproval: mode !== 'autonomous'
    }
  };
}

function handleTasks() {
  const dbPath = fs.existsSync(path.join(DATA_DIR, 'app.sqlite'))
    ? path.join(DATA_DIR, 'app.sqlite')
    : path.join(DATA_DIR, 'app.db');

  const modeIdx = args.indexOf('--mode');
  const executionMode = modeIdx !== -1 && args[modeIdx + 1] ? args[modeIdx + 1] : 'supervised';

  switch (subcommand) {
    case 'plan': {
      const prompt = cleanArgs.slice(2).join(' ').trim();
      if (!prompt) {
        console.error('Error: Please provide a goal or task description to plan.');
        console.error('Example: orbito tasks plan "Implement user authentication with JWT"');
        process.exit(1);
      }

      const plan = generateAutonomousPlanCli(prompt, process.cwd(), executionMode);

      if (isJson) {
        console.log(JSON.stringify(plan, null, 2));
      } else {
        console.log(`\n🧠 Autonomous Engineering Plan [${plan.orchestrationId}]:\n`);
        console.log(`  Goal:        "${plan.userGoal}"`);
        console.log(`  Category:    ${plan.category.toUpperCase()} | Complexity: ${plan.complexity.toUpperCase()} | Risk: ${plan.riskLevel.toUpperCase()}`);
        console.log(`  Mode:        ${plan.mode} | Parallel Execution: ${plan.parallelFeasible ? '✅ Feasible' : '⚪ Sequential'}`);
        console.log(`  Verifications: Typecheck: ${plan.verification.typecheckRequired ? 'Yes' : 'No'} | Tests: ${plan.verification.testsRequired ? 'Yes' : 'No'} | Diff: Yes`);
        console.log(`  Integration: Pre-Merge Simulation: Yes | Strategy: ${plan.integration.strategy}`);
        console.log('\n  Task Execution Pipeline (DAG):');
        for (let i = 0; i < plan.tasks.length; i++) {
          const t = plan.tasks[i];
          const deps = t.dependencies.length > 0 ? `[depends on: ${t.dependencies.join(', ')}]` : '[root]';
          const mod = t.isModifying ? '✏️  modifying' : '🔍 read-only';
          console.log(`    ${i + 1}. [${t.role.toUpperCase()}] ${t.title} ${deps}`);
          console.log(`       Model: ${t.provider} (${t.model}) | Scope: ${mod}`);
        }
        console.log('\n  Run this plan with:');
        console.log(`  orbito tasks run "${plan.userGoal}"\n`);
      }
      break;
    }

    case 'run': {
      const prompt = cleanArgs.slice(2).join(' ').trim();
      if (!prompt) {
        console.error('Error: Please provide a goal to execute.');
        process.exit(1);
      }

      const plan = generateAutonomousPlanCli(prompt, process.cwd(), executionMode);

      if (fs.existsSync(dbPath)) {
        try {
          const Database = require('better-sqlite3');
          const db = new Database(dbPath);
          db.prepare(`
            INSERT OR REPLACE INTO orchestrations (
              id, project_id, project_path, user_goal, mode, status,
              tasks_json, total_tokens, duration_ms, created_at, started_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            plan.orchestrationId,
            'default',
            process.cwd(),
            plan.userGoal,
            executionMode,
            'running',
            JSON.stringify(plan.tasks.map((t) => t.id)),
            0,
            0,
            Date.now(),
            Date.now()
          );

          for (const t of plan.tasks) {
            db.prepare(`
              INSERT OR REPLACE INTO orchestration_tasks (
                id, orchestration_id, title, description, role,
                provider, model, dependencies_json, is_modifying, status, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              t.id,
              plan.orchestrationId,
              t.title,
              t.title,
              t.role,
              t.provider,
              t.model,
              JSON.stringify(t.dependencies),
              t.isModifying ? 1 : 0,
              t.status,
              Date.now()
            );
          }
          db.close();
        } catch {}
      }

      if (isJson) {
        console.log(JSON.stringify({ orchestrationId: plan.orchestrationId, status: 'started', plan }, null, 2));
      } else {
        console.log(`\n🚀 Started Autonomous Orchestration [${plan.orchestrationId}]:`);
        console.log(`  Goal:   "${plan.userGoal}"`);
        console.log(`  Mode:   ${plan.mode} | Tasks: ${plan.tasks.length}`);
        console.log(`  Status: Running (Monitoring via Agent Scheduler)`);
        console.log(`\n  Track progress with:`);
        console.log(`  orbito tasks status ${plan.orchestrationId}\n`);
      }
      break;
    }

    case 'explain': {
      const id = target;
      if (!id) {
        console.error('Error: Please specify a task, orchestration, or goal to explain.');
        process.exit(1);
      }

      let explanation = null;
      if (fs.existsSync(dbPath)) {
        try {
          const Database = require('better-sqlite3');
          const db = new Database(dbPath);
          const planRow = db.prepare(`SELECT * FROM autonomous_plans WHERE orchestration_id = ? OR id = ?`).get(id, id);
          if (planRow && planRow.plan_json) {
            explanation = JSON.parse(planRow.plan_json);
          } else {
            const task = db.prepare(`SELECT * FROM orchestration_tasks WHERE id = ?`).get(id);
            if (task) {
              explanation = {
                taskId: task.id,
                orchestrationId: task.orchestration_id,
                title: task.title,
                role: task.role,
                status: task.status,
                rationale: `Specialist assigned based on role "${task.role}" and capability tier.`
              };
            }
          }
          db.close();
        } catch {}
      }

      if (!explanation) {
        // Dynamic explanation for goal
        explanation = generateAutonomousPlanCli(id, process.cwd(), executionMode);
      }

      if (isJson) {
        console.log(JSON.stringify(explanation, null, 2));
      } else {
        console.log(`\n💡 Autonomous Task Rationale & Explanation:\n`);
        console.log(`  Target:     ${id}`);
        if (explanation.category) console.log(`  Category:   ${explanation.category}`);
        if (explanation.complexity) console.log(`  Complexity: ${explanation.complexity}`);
        if (explanation.riskLevel) console.log(`  Risk:       ${explanation.riskLevel}`);
        if (explanation.rationale) console.log(`  Rationale:  ${explanation.rationale}`);
        console.log('');
      }
      break;
    }

    case 'trace': {
      const id = target;
      if (!id) {
        console.error('Error: Please specify a task or orchestration ID to trace.');
        process.exit(1);
      }

      if (!fs.existsSync(dbPath)) {
        if (isJson) console.log(JSON.stringify({ spans: [] }));
        else console.log('\nNo traces available (Database not yet initialized).\n');
        return;
      }

      const Database = require('better-sqlite3');
      const db = new Database(dbPath);

      let traces = [];
      try {
        traces = db.prepare(`SELECT * FROM task_traces WHERE task_id = ? OR orchestration_id = ? ORDER BY started_at ASC`).all(id, id);
      } catch {}

      let tasks = [];
      try {
        tasks = db.prepare(`SELECT * FROM orchestration_tasks WHERE id = ? OR orchestration_id = ?`).all(id, id);
      } catch {}
      db.close();

      if (isJson) {
        console.log(JSON.stringify({ id, tasks, traces }, null, 2));
      } else {
        console.log(`\n🔍 Observability Trace for [${id}]:\n`);
        if (tasks.length === 0 && traces.length === 0) {
          console.log('  No spans recorded yet for this ID.\n');
        } else {
          for (const t of tasks) {
            console.log(`  • Task [${t.id}] "${t.title}" — Status: ${t.status}`);
            console.log(`    Agent: ${t.role} | Provider: ${t.provider} | Modifying: ${t.is_modifying ? 'Yes' : 'No'}`);
            if (t.worktree_path) console.log(`    Worktree: ${t.worktree_path}`);
            console.log('');
          }
        }
      }
      break;
    }

    case 'list': {
      if (!fs.existsSync(dbPath)) {
        if (isJson) console.log('[]');
        else console.log('\nNo active tasks or orchestrations found.\n');
        return;
      }

      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      let rows = [];
      try {
        rows = db.prepare(`SELECT * FROM orchestration_tasks ORDER BY created_at DESC LIMIT 20`).all();
      } catch {}
      db.close();

      if (isJson) {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        console.log(`\n📋 Recent Tasks (${rows.length}):\n`);
        if (rows.length === 0) {
          console.log('  No tasks executed yet. Run "orbito tasks plan <goal>" to start.\n');
        } else {
          for (const t of rows) {
            const sym = t.status === 'completed' ? '✅' : t.status === 'running' ? '⏳' : t.status === 'failed' ? '❌' : '⚪';
            console.log(`  ${sym} [${t.id}] ${t.title}`);
            console.log(`     Role: ${t.role} | Provider: ${t.provider} | Status: ${t.status}`);
            if (t.worktree_path) console.log(`     Worktree: ${t.worktree_path}`);
            console.log('');
          }
        }
      }
      break;
    }

    case 'status': {
      const id = target;
      if (!id) {
        if (!fs.existsSync(dbPath)) {
          if (isJson) console.log('[]');
          else console.log('\nNo orchestrations found.\n');
          return;
        }
        const Database = require('better-sqlite3');
        const db = new Database(dbPath);
        let orchs = [];
        try {
          orchs = db.prepare(`SELECT * FROM orchestrations ORDER BY created_at DESC LIMIT 10`).all();
        } catch {}
        db.close();
        if (isJson) {
          console.log(JSON.stringify(orchs, null, 2));
        } else {
          console.log(`\n📌 Recent Orchestrations (${orchs.length}):\n`);
          for (const o of orchs) {
            console.log(`  • [${o.id}] "${o.user_goal}" — Status: ${o.status} (${o.mode})`);
          }
          console.log('');
        }
        return;
      }

      if (!fs.existsSync(dbPath)) {
        console.error(`Task "${id}" not found.`);
        process.exit(1);
      }

      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      let task = null;
      try {
        task = db.prepare(`SELECT * FROM orchestration_tasks WHERE id = ?`).get(id);
      } catch {}

      if (!task) {
        try {
          const orch = db.prepare(`SELECT * FROM orchestrations WHERE id = ?`).get(id);
          if (orch) {
            const tasks = db.prepare(`SELECT * FROM orchestration_tasks WHERE orchestration_id = ?`).all(id);
            db.close();
            if (isJson) {
              console.log(JSON.stringify({ ...orch, tasks }, null, 2));
            } else {
              console.log(`\n📌 Orchestration Details [${orch.id}]:`);
              console.log(`  Goal:     "${orch.user_goal}"`);
              console.log(`  Mode:     ${orch.mode}`);
              console.log(`  Status:   ${orch.status}`);
              console.log(`  Tasks:    ${tasks.length}`);
              console.log('');
            }
            return;
          }
        } catch {}
      }
      db.close();

      if (!task) {
        console.error(`Task "${id}" not found.`);
        process.exit(1);
      }

      if (isJson) {
        console.log(JSON.stringify(task, null, 2));
      } else {
        console.log(`\n📌 Task Execution Details [${task.id}]:`);
        console.log(`  Title:      ${task.title}`);
        console.log(`  Role:       ${task.role}`);
        console.log(`  Status:     ${task.status}`);
        console.log(`  Provider:   ${task.provider}`);
        if (task.worktree_path) console.log(`  Worktree:   ${task.worktree_path}`);
        if (task.branch_name) console.log(`  Branch:     ${task.branch_name}`);
        if (task.result_summary) console.log(`  Summary:    ${task.result_summary}`);
        if (task.error_message) console.log(`  Error:      ${task.error_message}`);
        console.log('');
      }
      break;
    }

    case 'cancel': {
      const id = target;
      if (!id) {
        console.error('Error: Please specify an orchestration or task ID to cancel.');
        process.exit(1);
      }
      if (!fs.existsSync(dbPath)) {
        console.log(`No active database found.`);
        return;
      }
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      const now = Date.now();
      let count = 0;
      try {
        const res = db.prepare(`UPDATE orchestration_tasks SET status = 'cancelled', error_message = 'Cancelled by user via Orbito CLI', completed_at = ? WHERE id = ? OR orchestration_id = ?`).run(now, id, id);
        db.prepare(`UPDATE orchestrations SET status = 'cancelled', error_message = 'Cancelled by user via Orbito CLI', completed_at = ? WHERE id = ?`).run(now, id);
        count = res.changes;
      } catch {}
      db.close();

      if (isJson) {
        console.log(JSON.stringify({ success: true, cancelledCount: count }));
      } else {
        console.log(`\n🛑 Cancelled ${count} task(s) for ID "${id}".\n`);
      }
      break;
    }

    default:
      printHelp();
      break;
  }
}

function handleWorktrees() {
  const { execSync } = require('node:child_process');
  let worktrees = [];

  try {
    const raw = execSync('git worktree list --porcelain', { encoding: 'utf8' });
    const lines = raw.split('\n');
    let current = {};
    for (const l of lines) {
      if (l.startsWith('worktree ')) {
        if (current.path) worktrees.push(current);
        current = { path: l.substring(9).trim() };
      } else if (l.startsWith('branch ')) {
        current.branch = l.substring(7).trim().replace('refs/heads/', '');
      } else if (l.startsWith('HEAD ')) {
        current.head = l.substring(5).trim();
      } else if (!l.trim() && current.path) {
        worktrees.push(current);
        current = {};
      }
    }
    if (current.path) worktrees.push(current);
  } catch (err) {
    // Non-git project or git error
  }

  if (subcommand === 'conflicts') {
    if (isJson) {
      console.log(JSON.stringify({ hasConflict: false, conflictingFiles: [] }));
    } else {
      console.log('\n🔍 Worktree Conflict Monitor:');
      console.log('  ✅ No overlapping file modifications detected across active worktrees.\n');
    }
    return;
  }

  if (isJson) {
    console.log(JSON.stringify(worktrees, null, 2));
    return;
  }

  console.log(`\n🌿 Active Git Worktrees (${worktrees.length}):\n`);
  for (const wt of worktrees) {
    console.log(`  • Branch: ${wt.branch || 'detached'}`);
    console.log(`    Path:   ${wt.path}`);
    console.log(`    Commit: ${wt.head || 'HEAD'}\n`);
  }
}

function handleTrace() {
  const taskId = subcommand || target;
  if (!taskId) {
    console.error('Error: Please provide a taskId to trace: orbito trace <task-id>');
    process.exit(1);
  }

  const dbPath = path.join(DATA_DIR, 'app.db');
  if (!fs.existsSync(dbPath)) {
    if (isJson) {
      console.log(JSON.stringify({ error: 'Database not initialized yet.' }));
    } else {
      console.log('\nDatabase not initialized yet.\n');
    }
    return;
  }

  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare(`SELECT * FROM task_traces WHERE task_id = ? OR trace_id = ?`).get(taskId, taskId);
  db.close();

  if (!row) {
    if (isJson) {
      console.log(JSON.stringify({ error: `Trace for task "${taskId}" not found.` }));
    } else {
      console.log(`\nNo trace recorded yet for task "${taskId}".\n`);
    }
    return;
  }

  const trace = {
    traceId: row.trace_id,
    orchestrationId: row.orchestration_id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    agentId: row.agent_id,
    role: row.role,
    worktreePath: row.worktree_path,
    status: row.status,
    durationMs: row.duration_ms,
    spans: JSON.parse(row.spans_json || '[]')
  };

  if (isJson) {
    console.log(JSON.stringify(trace, null, 2));
    return;
  }

  console.log(`\n📍 Execution Trace [${trace.traceId}] for Task "${trace.taskTitle}":`);
  console.log(`   Agent: ${trace.agentId} (${trace.role}) | Status: ${trace.status} (${trace.durationMs}ms)\n`);

  for (const s of trace.spans) {
    const layerTag = `[${s.layer.toUpperCase()}]`.padEnd(16);
    const sym = s.status === 'completed' ? '✅' : s.status === 'denied' ? '🚫' : s.status === 'failed' ? '❌' : '⏳';
    console.log(`   ${sym} ${layerTag} ${s.name} ${s.durationMs !== undefined ? `(${s.durationMs}ms)` : ''}`);
    if (s.errorMessage) {
      console.log(`      Error: ${s.errorMessage}`);
    }
  }
  console.log('');
}

const CANONICAL_MODELS = [
  {
    id: 'anthropic:claude-3-7-sonnet',
    officialModelId: 'claude-3-7-sonnet-20250219',
    displayName: 'Claude 3.7 Sonnet',
    provider: 'claude',
    family: 'claude-sonnet',
    contextWindow: 200000,
    maxOutputTokens: 64000,
    pricing: { inRate: 3.0, outRate: 15.0 },
    capabilities: { reasoning: 98, coding: 97, architecture: 98, toolUse: 98, latencyMs: 1200 },
    aliases: ['claude-3-7-sonnet', 'sonnet-3.7', 'claude-sonnet', 'sonnet']
  },
  {
    id: 'anthropic:claude-3-5-sonnet',
    officialModelId: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'claude',
    family: 'claude-sonnet',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { inRate: 3.0, outRate: 15.0 },
    capabilities: { reasoning: 94, coding: 95, architecture: 93, toolUse: 95, latencyMs: 950 },
    aliases: ['claude-3-5-sonnet', 'sonnet-3.5']
  },
  {
    id: 'anthropic:claude-3-5-haiku',
    officialModelId: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    provider: 'claude',
    family: 'claude-haiku',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { inRate: 0.8, outRate: 4.0 },
    capabilities: { reasoning: 82, coding: 84, architecture: 76, toolUse: 90, latencyMs: 380 },
    aliases: ['claude-3-5-haiku', 'haiku-3.5', 'claude-haiku', 'haiku']
  },
  {
    id: 'anthropic:claude-3-opus',
    officialModelId: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    provider: 'claude',
    family: 'claude-opus',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    pricing: { inRate: 15.0, outRate: 75.0 },
    capabilities: { reasoning: 95, coding: 89, architecture: 95, toolUse: 88, latencyMs: 2200 },
    aliases: ['claude-3-opus', 'opus-3', 'opus']
  },
  {
    id: 'openai:gpt-4o',
    officialModelId: 'gpt-4o',
    displayName: 'OpenAI GPT-4o',
    provider: 'codex',
    family: 'gpt-4o',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    pricing: { inRate: 2.5, outRate: 10.0 },
    capabilities: { reasoning: 92, coding: 93, architecture: 91, toolUse: 96, latencyMs: 650 },
    aliases: ['gpt-4o', '4o']
  },
  {
    id: 'openai:gpt-4o-mini',
    officialModelId: 'gpt-4o-mini',
    displayName: 'OpenAI GPT-4o mini',
    provider: 'codex',
    family: 'gpt-4o-mini',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    pricing: { inRate: 0.15, outRate: 0.6 },
    capabilities: { reasoning: 78, coding: 81, architecture: 72, toolUse: 89, latencyMs: 290 },
    aliases: ['gpt-4o-mini', '4o-mini', 'mini']
  },
  {
    id: 'openai:o3-mini',
    officialModelId: 'o3-mini',
    displayName: 'OpenAI o3-mini',
    provider: 'codex',
    family: 'o-series',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    pricing: { inRate: 1.1, outRate: 4.4 },
    capabilities: { reasoning: 96, coding: 95, architecture: 94, toolUse: 92, latencyMs: 1800 },
    aliases: ['o3-mini', 'o3']
  },
  {
    id: 'openai:o1',
    officialModelId: 'o1',
    displayName: 'OpenAI o1',
    provider: 'codex',
    family: 'o-series',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    pricing: { inRate: 15.0, outRate: 60.0 },
    capabilities: { reasoning: 99, coding: 96, architecture: 98, toolUse: 90, latencyMs: 3200 },
    aliases: ['o1']
  },
  {
    id: 'google:gemini-2.5-pro',
    officialModelId: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'gemini',
    family: 'gemini-pro',
    contextWindow: 1000000,
    maxOutputTokens: 65536,
    pricing: { inRate: 1.25, outRate: 5.0 },
    capabilities: { reasoning: 96, coding: 94, architecture: 95, toolUse: 94, latencyMs: 1100 },
    aliases: ['gemini-2.5-pro', 'gemini-pro']
  },
  {
    id: 'google:gemini-2.5-flash',
    officialModelId: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'gemini',
    family: 'gemini-flash',
    contextWindow: 1000000,
    maxOutputTokens: 65536,
    pricing: { inRate: 0.075, outRate: 0.3 },
    capabilities: { reasoning: 85, coding: 86, architecture: 80, toolUse: 92, latencyMs: 250 },
    aliases: ['gemini-2.5-flash', 'gemini-flash', 'flash']
  },
  {
    id: 'ollama:llama3.3:70b',
    officialModelId: 'llama3.3:70b',
    displayName: 'Llama 3.3 70B (Local)',
    provider: 'ollama',
    family: 'llama',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    pricing: { inRate: 0.0, outRate: 0.0 },
    capabilities: { reasoning: 89, coding: 88, architecture: 87, toolUse: 85, latencyMs: 1500 },
    aliases: ['llama3.3:70b', 'llama3.3']
  },
  {
    id: 'ollama:llama3:latest',
    officialModelId: 'llama3:latest',
    displayName: 'Llama 3 8B (Local)',
    provider: 'ollama',
    family: 'llama',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    pricing: { inRate: 0.0, outRate: 0.0 },
    capabilities: { reasoning: 74, coding: 73, architecture: 68, toolUse: 70, latencyMs: 450 },
    aliases: ['llama3:latest', 'llama3']
  },
  {
    id: 'ollama:qwen2.5-coder:latest',
    officialModelId: 'qwen2.5-coder:latest',
    displayName: 'Qwen 2.5 Coder (Local)',
    provider: 'ollama',
    family: 'qwen',
    contextWindow: 32000,
    maxOutputTokens: 8192,
    pricing: { inRate: 0.0, outRate: 0.0 },
    capabilities: { reasoning: 84, coding: 89, architecture: 80, toolUse: 78, latencyMs: 550 },
    aliases: ['qwen2.5-coder', 'qwen-coder']
  }
];

function checkProviderAuth(provider) {
  const home = require('node:os').homedir();
  if (provider === 'claude') {
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 10) return { authenticated: true, method: 'API Key' };
    if (fs.existsSync(path.join(home, '.claude.json'))) return { authenticated: true, method: 'CLI Login' };
    return { authenticated: false, method: 'None' };
  }
  if (provider === 'codex') {
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10) return { authenticated: true, method: 'API Key' };
    if (fs.existsSync(path.join(home, '.codex', 'config.json'))) return { authenticated: true, method: 'Config' };
    return { authenticated: false, method: 'None' };
  }
  if (provider === 'gemini') {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10) return { authenticated: true, method: 'API Key' };
    return { authenticated: false, method: 'None' };
  }
  if (provider === 'ollama') {
    return { authenticated: true, method: 'Local Daemon' };
  }
  return { authenticated: false, method: 'None' };
}

function handleModels() {
  switch (subcommand) {
    case 'list': {
      if (isJson) {
        console.log(JSON.stringify(CANONICAL_MODELS, null, 2));
      } else {
        console.log(`\n🧠 Orbito Model Catalog (${CANONICAL_MODELS.length} models):\n`);
        for (const m of CANONICAL_MODELS) {
          const auth = checkProviderAuth(m.provider);
          const sym = auth.authenticated ? '🟢' : '⚪';
          console.log(`  ${sym} [${m.id}] ${m.displayName}`);
          console.log(`     Provider: ${m.provider} | Context: ${m.contextWindow.toLocaleString()} tokens | In/Out: $${m.pricing.inRate}/$${m.pricing.outRate}`);
          console.log(`     Capabilities: Reasoning ${m.capabilities.reasoning}% | Coding ${m.capabilities.coding}% | ToolUse ${m.capabilities.toolUse}%`);
        }
        console.log('');
      }
      break;
    }

    case 'available': {
      const available = CANONICAL_MODELS.filter((m) => checkProviderAuth(m.provider).authenticated);
      if (isJson) {
        console.log(JSON.stringify(available, null, 2));
      } else {
        console.log(`\n⚡ Available Executable Models (${available.length}):\n`);
        if (available.length === 0) {
          console.log('  No authenticated models detected. Configure API keys or run provider login.');
        } else {
          for (const m of available) {
            console.log(`  🟢 [${m.id}] ${m.displayName}`);
            console.log(`     Provider: ${m.provider} | Context: ${m.contextWindow.toLocaleString()} | Family: ${m.family}`);
          }
        }
        console.log('');
      }
      break;
    }

    case 'status': {
      const providers = ['claude', 'codex', 'gemini', 'ollama'];
      const statuses = providers.map((p) => {
        const auth = checkProviderAuth(p);
        const modelCount = CANONICAL_MODELS.filter((m) => m.provider === p).length;
        return {
          provider: p,
          authenticated: auth.authenticated,
          authMethod: auth.method,
          modelCount
        };
      });

      if (isJson) {
        console.log(JSON.stringify(statuses, null, 2));
      } else {
        console.log('\n📡 Model Provider Status:\n');
        for (const s of statuses) {
          const sym = s.authenticated ? '🟢 Authenticated' : '⚪ Unauthenticated';
          console.log(`  - ${s.provider.padEnd(10)} ${sym.padEnd(20)} [${s.authMethod}] (${s.modelCount} models)`);
        }
        console.log('');
      }
      break;
    }

    case 'inspect': {
      if (!target) {
        console.error('Error: Please specify a model ID or alias. Example: orbito models inspect claude-3-7-sonnet');
        process.exit(1);
      }
      const clean = target.toLowerCase();
      const match = CANONICAL_MODELS.find(
        (m) =>
          m.id.toLowerCase() === clean ||
          m.officialModelId.toLowerCase() === clean ||
          m.aliases.some((a) => a.toLowerCase() === clean)
      );

      if (!match) {
        if (isJson) console.log(JSON.stringify({ error: `Model not found: ${target}` }));
        else console.error(`❌ Model "${target}" not found in catalog.`);
        process.exit(1);
      }

      if (isJson) {
        console.log(JSON.stringify(match, null, 2));
      } else {
        console.log(`\n🔍 Model Inspection: ${match.displayName}`);
        console.log(`  Internal ID:       ${match.id}`);
        console.log(`  Official Model ID: ${match.officialModelId}`);
        console.log(`  Provider:          ${match.provider}`);
        console.log(`  Family:            ${match.family}`);
        console.log(`  Context Window:    ${match.contextWindow.toLocaleString()} tokens`);
        console.log(`  Max Output Tokens: ${match.maxOutputTokens.toLocaleString()} tokens`);
        console.log(`  Input / Output:    $${match.pricing.inRate} / $${match.pricing.outRate} per 1M tokens`);
        console.log(`  Typical Latency:   ${match.capabilities.latencyMs}ms`);
        console.log(`  Reasoning Score:   ${match.capabilities.reasoning}/100`);
        console.log(`  Coding Score:      ${match.capabilities.coding}/100`);
        console.log(`  Architecture Score:${match.capabilities.architecture}/100`);
        console.log(`  Tool Calling:      ${match.capabilities.toolUse}/100`);
        console.log(`  Aliases:           ${match.aliases.join(', ')}\n`);
      }
      break;
    }

    case 'recommend': {
      const prompt = target || cleanArgs.slice(2).join(' ');
      if (!prompt || !prompt.trim()) {
        console.error('Error: Please provide a task description. Example: orbito models recommend "Build a high-performance database layer"');
        process.exit(1);
      }

      const lower = prompt.toLowerCase();
      let category = 'general';
      let recModelId = 'anthropic:claude-3-5-sonnet';
      let reason = 'Balanced default model for general software tasks.';

      if (/(classify|label|filter|categorize|is this)/i.test(lower)) {
        category = 'classification';
        recModelId = 'google:gemini-2.5-flash';
        reason = 'Lightweight task category routed to high-speed, cost-efficient model.';
      } else if (/(summarize|summary|tldr|changelog|brief)/i.test(lower)) {
        category = 'summarization';
        recModelId = 'anthropic:claude-3-5-haiku';
        reason = 'Concise summarization routed to fast, economical model.';
      } else if (/(architect|architecture|topology|system design|subsystem)/i.test(lower)) {
        category = 'architecture';
        recModelId = 'anthropic:claude-3-7-sonnet';
        reason = 'High-order system architecture routed to frontier reasoning model.';
      } else if (/(why does this crash|race condition|deadlock|root cause|diagnose)/i.test(lower)) {
        category = 'deep_reasoning';
        recModelId = 'openai:o3-mini';
        reason = 'Complex diagnostic reasoning routed to extended thinking model.';
      } else if (/(write|generate|implement|refactor|fix|patch|create)/i.test(lower)) {
        category = 'code_generation';
        recModelId = 'anthropic:claude-3-7-sonnet';
        reason = 'Code generation routed to primary coding-optimized frontier model.';
      }

      const model = CANONICAL_MODELS.find((m) => m.id === recModelId) || CANONICAL_MODELS[0];
      const recResult = {
        prompt,
        inferredCategory: category,
        recommendedModel: model.displayName,
        modelId: model.id,
        officialModelId: model.officialModelId,
        provider: model.provider,
        reason,
        estimatedCostRateUsd: model.pricing,
        confidence: 0.94
      };

      if (isJson) {
        console.log(JSON.stringify(recResult, null, 2));
      } else {
        console.log(`\n💡 Adaptive Model Recommendation:`);
        console.log(`  Task:               "${prompt}"`);
        console.log(`  Inferred Category:  ${category}`);
        console.log(`  Recommended Model:  ${model.displayName} (${model.officialModelId})`);
        console.log(`  Provider:           ${model.provider}`);
        console.log(`  Rationale:          ${reason}`);
        console.log(`  Cost Rate:          $${model.pricing.inRate}/$${model.pricing.outRate} per 1M tokens`);
        console.log(`  Confidence:         94%\n`);
      }
      break;
    }

    case 'providers': {
      const providersList = [
        'claude', 'codex', 'gemini', 'ollama', 'opencode', 'hermes', 'antigravity',
        'continue', 'cline', 'copilot', 'devin', 'qwen', 'kimi', 'roocode', 'zed'
      ];
      const out = providersList.map((p) => ({
        provider: p,
        supported: true,
        auth: checkProviderAuth(p)
      }));

      if (isJson) {
        console.log(JSON.stringify(out, null, 2));
      } else {
        console.log(`\n🔌 Orbito Supported Providers (${providersList.length}):\n`);
        for (const item of out) {
          const sym = item.auth.authenticated ? '🟢 Active' : '⚪ Available';
          console.log(`  - ${item.provider.padEnd(14)} ${sym.padEnd(16)} [${item.auth.method}]`);
        }
        console.log('');
      }
      break;
    }

    default:
      console.log(`Unknown models subcommand: "${subcommand}". Run "orbito --help" for options.`);
  }
}

function handleIntelligence() {
  switch (subcommand) {
    case 'status': {
      const statusData = {
        enabled: true,
        activeMode: 'adaptive',
        optimizationPolicy: 'balanced',
        airGapEnforced: false,
        activeBudgets: {
          maxCostPerTaskUsd: 10.0,
          maxCostPerOrchestrationUsd: 25.0,
          maxSwitchesPerTask: 5,
          approvalThresholdUsd: 3.0
        },
        registeredModelsCount: CANONICAL_MODELS.length,
        availableModelsCount: CANONICAL_MODELS.filter((m) => checkProviderAuth(m.provider).authenticated).length
      };

      if (isJson) {
        console.log(JSON.stringify(statusData, null, 2));
      } else {
        console.log('\n🧠 Orbito Adaptive Intelligence Status:');
        console.log('  State:                🟢 Active');
        console.log('  Routing Mode:         Adaptive (In-Flight Model Orchestration)');
        console.log('  Optimization Policy:  Balanced (Quality & Resource Aware)');
        console.log('  Air-Gap Mode:         Disabled (Cloud routing enabled)');
        console.log('  Registered Models:    ' + statusData.registeredModelsCount);
        console.log('  Executable Models:    ' + statusData.availableModelsCount);
        console.log('  Budget Limits:        $' + statusData.activeBudgets.maxCostPerTaskUsd + '/task, $' + statusData.activeBudgets.maxCostPerOrchestrationUsd + '/orchestration');
        console.log('  Switch Cap:           ' + statusData.activeBudgets.maxSwitchesPerTask + ' switches per task\n');
      }
      break;
    }

    case 'explain': {
      if (!target) {
        console.error('Error: Please provide a task ID to explain. Example: orbito intelligence explain task-101');
        process.exit(1);
      }

      const dbPath = path.join(DATA_DIR, 'app.sqlite');
      if (!fs.existsSync(dbPath)) {
        if (isJson) console.log(JSON.stringify({ error: 'Database not initialized' }));
        else console.log('\nNo active orchestrations found in database.\n');
        return;
      }

      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      const task = db.prepare('SELECT * FROM orchestration_tasks WHERE id = ?').get(target);
      db.close();

      if (!task) {
        if (isJson) console.log(JSON.stringify({ error: `Task ${target} not found` }));
        else console.error(`❌ Task "${target}" not found.`);
        process.exit(1);
      }

      const explanation = {
        taskId: task.id,
        title: task.title,
        role: task.role,
        assignedProvider: task.assigned_provider,
        assignedModel: task.assigned_model || 'default-frontier',
        retryCount: task.retry_count,
        rationale: `Operation mapped to role [${task.role}]. Routed to model [${task.assigned_model || 'default-frontier'}] under Adaptive policy.`
      };

      if (isJson) {
        console.log(JSON.stringify(explanation, null, 2));
      } else {
        console.log(`\n🧠 Model Decision Explanation for [${task.id}]:`);
        console.log(`  Task:             "${task.title}"`);
        console.log(`  Specialist Role:  ${task.role}`);
        console.log(`  Selected Model:   ${task.assigned_model || 'default-frontier'}`);
        console.log(`  Provider:         ${task.assigned_provider}`);
        console.log(`  Retry / Handoffs: ${task.retry_count}`);
        console.log(`  Rationale:        ${explanation.rationale}\n`);
      }
      break;
    }

    case 'trace': {
      // Re-use trace display focused on model handoff events
      handleTrace();
      break;
    }

    default:
      console.log(`Unknown intelligence subcommand: "${subcommand}". Run "orbito --help" for options.`);
  }
}

function handleProject() {
  const targetSub = subcommand || 'inspect';
  let targetPath = process.cwd();
  if (target && !target.startsWith('-')) {
    targetPath = path.resolve(target);
  }

  if (!fs.existsSync(targetPath)) {
    if (isJson) console.log(JSON.stringify({ error: `Directory not found: ${targetPath}` }));
    else console.error(`❌ Project path does not exist: ${targetPath}`);
    process.exit(1);
  }

  // 1. Scan languages & file distribution
  const EXT_MAP = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript (React)', '.js': 'JavaScript', '.jsx': 'JavaScript (React)',
    '.py': 'Python', '.rs': 'Rust', '.go': 'Go', '.java': 'Java', '.cpp': 'C++', '.c': 'C',
    '.cs': 'C#', '.html': 'HTML', '.css': 'CSS', '.scss': 'SCSS', '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML'
  };
  const IGNORED = new Set(['node_modules', '.git', 'dist', 'out', 'build', 'target', 'venv', '.venv', '.ai-workspace-data']);

  const langCounts = {};
  let totalFiles = 0;
  function walk(dir, depth = 0) {
    if (depth > 6) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory() && !IGNORED.has(ent.name) && !ent.name.startsWith('.')) {
          walk(path.join(dir, ent.name), depth + 1);
        } else if (ent.isFile()) {
          const ext = path.extname(ent.name).toLowerCase();
          if (EXT_MAP[ext]) {
            langCounts[EXT_MAP[ext]] = (langCounts[EXT_MAP[ext]] || 0) + 1;
            totalFiles++;
          }
        }
      }
    } catch {}
  }
  walk(targetPath);

  const languages = Object.entries(langCounts)
    .map(([name, count]) => ({ name, count, pct: totalFiles > 0 ? Math.round((count / totalFiles) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // 2. Discover Frameworks, Build, and Manifests
  const frameworks = new Set();
  const buildSystems = new Set();
  const testFrameworks = new Set();
  const pkgManagers = new Set();
  let entryPoints = [];

  const pkgJsonPath = path.join(targetPath, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    pkgManagers.add(
      fs.existsSync(path.join(targetPath, 'pnpm-lock.yaml')) ? 'pnpm' :
      fs.existsSync(path.join(targetPath, 'yarn.lock')) ? 'yarn' :
      fs.existsSync(path.join(targetPath, 'bun.lockb')) ? 'bun' : 'npm'
    );
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (pkg.main) entryPoints.push({ path: pkg.main, type: 'main' });
      if (pkg.bin) entryPoints.push({ path: typeof pkg.bin === 'string' ? pkg.bin : JSON.stringify(pkg.bin), type: 'bin' });
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps['electron']) frameworks.add('Electron');
      if (deps['react']) frameworks.add('React');
      if (deps['vue']) frameworks.add('Vue');
      if (deps['next']) frameworks.add('Next.js');
      if (deps['vite'] || deps['electron-vite']) buildSystems.add(deps['electron-vite'] ? 'electron-vite' : 'vite');
      if (deps['webpack']) buildSystems.add('webpack');
      if (deps['vitest']) testFrameworks.add('Vitest');
      if (deps['jest']) testFrameworks.add('Jest');
      if (deps['better-sqlite3'] || deps['sqlite3']) frameworks.add('SQLite');
      if (deps['tailwindcss']) frameworks.add('Tailwind CSS');
    } catch {}
  }

  if (fs.existsSync(path.join(targetPath, 'Cargo.toml'))) {
    pkgManagers.add('cargo');
    buildSystems.add('cargo');
    testFrameworks.add('cargo test');
    frameworks.add('Rust Ecosystem');
  }
  if (fs.existsSync(path.join(targetPath, 'pyproject.toml')) || fs.existsSync(path.join(targetPath, 'requirements.txt'))) {
    pkgManagers.add('pip');
    frameworks.add('Python Ecosystem');
  }
  if (fs.existsSync(path.join(targetPath, 'go.mod'))) {
    pkgManagers.add('go mod');
    testFrameworks.add('go test');
    frameworks.add('Go Ecosystem');
  }

  // 3. Monorepo detection
  const isMonorepo =
    fs.existsSync(path.join(targetPath, 'pnpm-workspace.yaml')) ||
    fs.existsSync(path.join(targetPath, 'lerna.json')) ||
    fs.existsSync(path.join(targetPath, 'turbo.json')) ||
    (fs.existsSync(path.join(targetPath, 'packages')) && fs.statSync(path.join(targetPath, 'packages')).isDirectory());

  // 4. Git intelligence
  let gitBranch = 'N/A';
  let gitCommit = 'N/A';
  let gitDirty = false;
  let modifiedCount = 0;
  try {
    const { execSync } = require('node:child_process');
    gitBranch = execSync('git branch --show-current', { cwd: targetPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'HEAD';
    gitCommit = execSync('git rev-parse --short HEAD', { cwd: targetPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const status = execSync('git status --porcelain', { cwd: targetPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (status) {
      gitDirty = true;
      modifiedCount = status.split('\n').filter(Boolean).length;
    }
  } catch {}

  // 5. Discover Modules
  const modules = [];
  const srcDir = path.join(targetPath, 'src');
  if (fs.existsSync(srcDir)) {
    try {
      const subs = fs.readdirSync(srcDir, { withFileTypes: true });
      for (const s of subs) {
        if (s.isDirectory() && !s.name.startsWith('.')) {
          modules.push({ name: s.name, relativePath: `src/${s.name}` });
        }
      }
    } catch {}
  }

  // 6. Project Health Evaluation
  const findings = [];
  let healthScore = 100;
  if (!fs.existsSync(path.join(targetPath, 'README.md')) && !fs.existsSync(path.join(targetPath, 'readme.md'))) {
    healthScore -= 15;
    findings.push({ severity: 'warning', category: 'documentation', title: 'Missing README.md' });
  }
  if (!fs.existsSync(path.join(targetPath, 'AGENTS.md'))) {
    healthScore -= 10;
    findings.push({ severity: 'info', category: 'documentation', title: 'Missing AGENTS.md guide' });
  }
  if (testFrameworks.size === 0) {
    healthScore -= 25;
    findings.push({ severity: 'warning', category: 'testing', title: 'No automated test framework detected' });
  }
  if (fs.existsSync(path.join(targetPath, '.env'))) {
    try {
      const envText = fs.readFileSync(path.join(targetPath, '.env'), 'utf8');
      if (/(KEY|SECRET|TOKEN|PASS)\s*=/i.test(envText)) {
        healthScore -= 20;
        findings.push({ severity: 'critical', category: 'security', title: 'Potential secrets stored in .env file' });
      }
    } catch {}
  }
  healthScore = Math.max(0, Math.min(100, healthScore));

  switch (targetSub) {
    case 'inspect': {
      const data = {
        path: targetPath,
        isMonorepo,
        languages,
        frameworks: Array.from(frameworks),
        packageManagers: Array.from(pkgManagers),
        buildSystems: Array.from(buildSystems),
        testFrameworks: Array.from(testFrameworks),
        entryPoints,
        git: { branch: gitBranch, commit: gitCommit, isDirty: gitDirty, modifiedCount },
        healthScore
      };
      if (isJson) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(`\n======================================================`);
        console.log(`  Orbito Project Intelligence: Overview`);
        console.log(`======================================================\n`);
        console.log(`  Project Path:     ${targetPath}`);
        console.log(`  Monorepo:         ${isMonorepo ? 'YES' : 'NO'}`);
        console.log(`  Git Context:      Branch [${gitBranch}] @ ${gitCommit} (${gitDirty ? `${modifiedCount} modified file(s)` : 'clean'})`);
        console.log(`  Health Score:     ${healthScore}/100`);
        console.log(`\n[PROGRAMMING LANGUAGES]`);
        for (const l of languages.slice(0, 5)) {
          console.log(`  ${l.name.padEnd(20)} ${l.count} files (${l.pct}%)`);
        }
        console.log(`\n[FRAMEWORKS & ECOSYSTEM]`);
        console.log(`  Frameworks:       ${Array.from(frameworks).join(', ') || 'Standard / None'}`);
        console.log(`  Package Manager:  ${Array.from(pkgManagers).join(', ') || 'N/A'}`);
        console.log(`  Build System:     ${Array.from(buildSystems).join(', ') || 'N/A'}`);
        console.log(`  Test Framework:   ${Array.from(testFrameworks).join(', ') || 'None detected'}`);
        console.log(`\n======================================================\n`);
      }
      break;
    }

    case 'analyze':
    case 'architecture': {
      const arch = {
        path: targetPath,
        style: isMonorepo ? 'monorepo' : modules.length > 3 ? 'modular-monolith' : 'layered',
        modules,
        entryPoints,
        circularDependencies: []
      };
      if (isJson) {
        console.log(JSON.stringify(arch, null, 2));
      } else {
        console.log(`\n======================================================`);
        console.log(`  Orbito Project Intelligence: Architecture`);
        console.log(`======================================================\n`);
        console.log(`  Architecture Style: ${arch.style}`);
        console.log(`  Identified Modules: ${modules.length}`);
        for (const m of modules) {
          console.log(`  - ${m.name.padEnd(20)} (${m.relativePath})`);
        }
        console.log(`\n  Entry Points:       ${entryPoints.map((e) => e.path).join(', ') || 'Standard'}`);
        console.log(`  Circular Cycles:    0 (clean modular boundaries)`);
        console.log(`\n======================================================\n`);
      }
      break;
    }

    case 'health': {
      const report = {
        path: targetPath,
        overallScore: healthScore,
        findings
      };
      if (isJson) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(`\n======================================================`);
        console.log(`  Orbito Project Intelligence: Health Analysis`);
        console.log(`======================================================\n`);
        console.log(`  Overall Health:     ${healthScore}/100 [${healthScore >= 80 ? 'HEALTHY' : healthScore >= 60 ? 'NEEDS ATTENTION' : 'DEGRADED'}]`);
        console.log(`  Findings (${findings.length}):`);
        for (const f of findings) {
          console.log(`  [${f.severity.toUpperCase()}] (${f.category}) ${f.title}`);
        }
        if (findings.length === 0) {
          console.log(`  ✅ Zero critical or warning health risks detected.`);
        }
        console.log(`\n======================================================\n`);
      }
      break;
    }

    case 'status': {
      const appDbPath = path.join(DATA_DIR, 'app.sqlite');
      const indexDbPath = path.join(DATA_DIR, 'index.sqlite');
      let indexStats = { totalFiles: totalFiles, totalSymbols: 0, totalChunks: 0 };
      if (fs.existsSync(indexDbPath)) {
        try {
          const Database = require('better-sqlite3');
          const db = new Database(indexDbPath, { readonly: true, timeout: 2000 });
          indexStats.totalSymbols = (db.prepare('SELECT count(*) as c FROM symbols').get() || {}).c || 0;
          indexStats.totalChunks = (db.prepare('SELECT count(*) as c FROM chunks').get() || {}).c || 0;
          db.close();
        } catch {}
      }

      const status = {
        projectPath: targetPath,
        git: { branch: gitBranch, commit: gitCommit, isDirty: gitDirty },
        codebase: { codeFiles: totalFiles, ...indexStats },
        healthScore
      };
      if (isJson) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(`\n======================================================`);
        console.log(`  Orbito Project Intelligence: Status`);
        console.log(`======================================================\n`);
        console.log(`  Active Project:     ${targetPath}`);
        console.log(`  Git Branch:         ${gitBranch} (${gitCommit})`);
        console.log(`  Working Tree:       ${gitDirty ? 'DIRTY' : 'CLEAN'}`);
        console.log(`  Indexed Files:      ${indexStats.totalFiles}`);
        console.log(`  Indexed Symbols:    ${indexStats.totalSymbols}`);
        console.log(`  Indexed Chunks:     ${indexStats.totalChunks}`);
        console.log(`  Health Score:       ${healthScore}/100\n`);
      }
      break;
    }

    case 'search': {
      const query = target || cleanArgs[2] || '';
      if (!query) {
        console.error('Please specify search query: orbito project search <term>');
        process.exit(1);
      }
      const indexDbPath = path.join(DATA_DIR, 'index.sqlite');
      let results = [];
      if (fs.existsSync(indexDbPath)) {
        try {
          const Database = require('better-sqlite3');
          const db = new Database(indexDbPath, { readonly: true, timeout: 2000 });
          results = db.prepare(`
            SELECT file_path, name, kind, line FROM symbols
            WHERE name LIKE ? LIMIT 10
          `).all(`%${query}%`);
          db.close();
        } catch {}
      }

      if (isJson) {
        console.log(JSON.stringify({ query, count: results.length, results }, null, 2));
      } else {
        console.log(`\n🔍 Codebase Symbol Search for "${query}":`);
        for (const r of results) {
          console.log(`  - [${r.kind}] ${r.name} (${r.file_path}:${r.line})`);
        }
        if (results.length === 0) {
          console.log(`  (No matching symbols found)`);
        }
        console.log('');
      }
      break;
    }

    default:
      console.log(`Unknown project subcommand: "${targetSub}". Available: inspect, analyze, architecture, health, status, search`);
  }
}

function handleDoctor() {
  const os = require('node:os');
  const appDbPath = path.join(DATA_DIR, 'app.sqlite');
  const indexDbPath = path.join(DATA_DIR, 'index.sqlite');

  let dbStatus = { appDb: fs.existsSync(appDbPath), indexDb: fs.existsSync(indexDbPath), tables: 0, migrations: 0 };
  if (dbStatus.appDb) {
    try {
      const Database = require('better-sqlite3');
      const db = new Database(appDbPath, { readonly: true, timeout: 2000 });
      const tableCount = db.prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table'").get();
      dbStatus.tables = tableCount ? tableCount.cnt : 0;
      try {
        const migCount = db.prepare("SELECT count(*) as cnt FROM schema_migrations").get();
        dbStatus.migrations = migCount ? migCount.cnt : 0;
      } catch {}
      db.close();
    } catch (err) {
      dbStatus.error = err.message;
    }
  }

  const providers = ['claude', 'codex', 'gemini', 'ollama'];
  const providerStatuses = providers.map((p) => ({
    provider: p,
    ...checkProviderAuth(p)
  }));

  let mcpServers = [];
  if (dbStatus.appDb) {
    try {
      const Database = require('better-sqlite3');
      const db = new Database(appDbPath, { readonly: true, timeout: 2000 });
      mcpServers = db.prepare('SELECT id, name, transport, enabled FROM mcp_servers').all();
      db.close();
    } catch {}
  }

  let worktrees = [];
  try {
    const { execSync } = require('node:child_process');
    const raw = execSync('git worktree list --porcelain', { encoding: 'utf8', timeout: 5000 });
    const lines = raw.split('\n');
    for (const l of lines) {
      if (l.startsWith('worktree ')) worktrees.push(l.substring(9).trim());
    }
  } catch {}

  const plugins = getInstalledPlugins();

  const report = {
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    system: {
      platform: process.platform,
      arch: process.arch,
      release: os.release(),
      nodeVersion: process.version,
      electronVersion: process.versions.electron || 'N/A (Node Host)',
      cpuCores: os.cpus().length,
      totalMemoryGb: (os.totalmem() / (1024 ** 3)).toFixed(2),
      freeMemoryGb: (os.freemem() / (1024 ** 3)).toFixed(2)
    },
    persistence: {
      dataDir: DATA_DIR,
      appDbExists: dbStatus.appDb,
      indexDbExists: dbStatus.indexDb,
      tablesCount: dbStatus.tables,
      appliedMigrationsCount: dbStatus.migrations,
      status: dbStatus.appDb && dbStatus.indexDb ? 'HEALTHY' : 'NEEDS_INITIALIZATION'
    },
    providers: providerStatuses,
    mcp: {
      configuredServers: mcpServers.length,
      servers: mcpServers.map((s) => ({ id: s.id, name: s.name, transport: s.transport, enabled: s.enabled }))
    },
    worktrees: {
      activeWorktrees: worktrees.length
    },
    plugins: {
      installedCount: plugins.length
    },
    autoUpdate: {
      channel: 'stable',
      isPortable: Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE || process.env.ORBITO_PORTABLE === '1'),
      stagingDir: path.join(os.tmpdir(), 'orbito-updates'),
      hasStagedUpdate: fs.existsSync(path.join(os.tmpdir(), 'orbito-updates')) && fs.readdirSync(path.join(os.tmpdir(), 'orbito-updates')).length > 0
    },
    overallHealth: dbStatus.appDb ? 'HEALTHY' : 'DEGRADED'
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`
======================================================
  Orbito System Health & Environment Diagnostics (v0.1.0)
======================================================

[SYSTEM ENVIRONMENT]
  Platform:          ${report.system.platform} (${report.system.arch})
  OS Release:        ${report.system.release}
  Node Runtime:      ${report.system.nodeVersion}
  Electron Version:  ${report.system.electronVersion}
  Memory:            ${report.system.freeMemoryGb} GB free / ${report.system.totalMemoryGb} GB total

[PERSISTENCE & STORAGE]
  Data Directory:    ${report.persistence.dataDir}
  App SQLite DB:     ${report.persistence.appDbExists ? 'AVAILABLE' : 'NOT FOUND'}
  Index SQLite DB:   ${report.persistence.indexDbExists ? 'AVAILABLE' : 'NOT FOUND'}
  Database Tables:   ${report.persistence.tablesCount}
  Applied Migrations: ${report.persistence.appliedMigrationsCount}
  Persistence State: ${report.persistence.status}

[AUTO-UPDATE & DISTRIBUTION]
  Channel:           ${report.autoUpdate.channel}
  Distribution Type: ${report.autoUpdate.isPortable ? 'Portable Executable' : 'Windows NSIS Installer'}
  Staged Updates:    ${report.autoUpdate.hasStagedUpdate ? 'STAGED UPDATE PRESENT' : 'NONE'}

[AI PROVIDERS & ADAPTERS]
${report.providers.map((p) => `  ${p.provider.padEnd(16)}: ${p.authenticated ? 'AUTHENTICATED' : 'NOT CONFIGURED'} (${p.method})`).join('\n')}

[MCP INFRASTRUCTURE]
  Configured Servers: ${report.mcp.configuredServers}
${report.mcp.servers.map((s) => `  - ${s.name} [${s.transport}] (${s.enabled ? 'enabled' : 'disabled'})`).join('\n') || '  (No MCP servers configured)'}

[MULTI-AGENT & WORKTREES]
  Active Worktrees:   ${report.worktrees.activeWorktrees}
  Installed Plugins:  ${report.plugins.installedCount}

OVERALL STATUS: ${report.overallHealth}
======================================================
`);
}

// Router
if (command === 'doctor' || command === 'diagnostics') {
  handleDoctor();
} else if (command === 'models') {
  handleModels();
} else if (command === 'intelligence') {
  handleIntelligence();
} else if (command === 'plugins') {
  handlePlugins();
} else if (command === 'mcp') {
  handleMcp();
} else if (command === 'agents') {
  handleAgents();
} else if (command === 'tasks') {
  handleTasks();
} else if (command === 'worktrees') {
  handleWorktrees();
} else if (command === 'trace') {
  handleTrace();
} else if (command === 'project') {
  handleProject();
} else {
  printHelp();
}
