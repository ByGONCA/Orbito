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

COMMANDS:
  list                 List all installed plugins
  search <query>       Search the discovery marketplace
  info <plugin-id>     Inspect details of a plugin
  install <id | path>  Install a plugin by ID or from local directory
  uninstall <id>       Remove an installed plugin
  validate <dir>       Validate an extension manifest and entry point
  package <dir>        Package an extension into an installable archive

OPTIONS:
  --json               Output machine-readable JSON
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

// Router
if (command === 'plugins') {
  handlePlugins();
} else {
  printHelp();
}
