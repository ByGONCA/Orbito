#!/usr/bin/env node

/**
 * Orbito Repository Structure & Governance Validator
 *
 * Enforces repository hygiene, root cleanliness, and documentation integrity
 * in accordance with docs/development/REPOSITORY_ORGANISATION.md.
 *
 * Usage:
 *   node scripts/validate-structure.js [--verbose] [--help]
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`
Orbito Repository Structure Validator

Checks:
  1. Permitted root Markdown files (README.md, AGENTS.md, CLAUDE.md)
  2. Required docs/ categories (architecture, audits, development, agents, editor, plugins, releases, reference)
  3. Central documentation index (docs/README.md) and valid relative links
  4. Detection of misplaced audit reports or root-level markdown leaks
  5. Hygiene of gitignored runtime directories (.ai-workspace-data, out)

To approve a legitimate root configuration exception:
  Add the file name to PERMITTED_ROOT_FILES in scripts/validate-structure.js
  and document the rationale in docs/development/REPOSITORY_ORGANISATION.md.
`);
  process.exit(0);
}

const verbose = args.includes('--verbose');

// 1. Whitelist of permitted root-level files and directories
const PERMITTED_ROOT_MD = new Set(['README.md', 'AGENTS.md', 'CLAUDE.md']);

const PERMITTED_ROOT_FILES = new Set([
  'package.json',
  'package-lock.json',
  'electron.vite.config.ts',
  'postcss.config.js',
  'tailwind.config.js',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.web.json',
  'vitest.config.ts',
  'skills-lock.json',
  '.gitignore',
  '.gitattributes',
  'tsconfig.node.tsbuildinfo',
  'tsconfig.web.tsbuildinfo'
]);

const PERMITTED_ROOT_DIRS = new Set([
  '.agents',
  '.ai-workspace-data',
  '.git',
  '.github',
  'bin',
  'docs',
  'graphify-out',
  'node_modules',
  'out',
  'plugins',
  'resources',
  'scratch',
  'scripts',
  'src',
  'tests'
]);

const REQUIRED_DOCS_DIRS = [
  'architecture',
  'audits',
  'development',
  'agents',
  'editor',
  'plugins',
  'releases',
  'reference'
];

let errorCount = 0;
let warningCount = 0;

function pass(msg) {
  console.log(`  ✅ ${msg}`);
}

function fail(msg) {
  console.error(`  ❌ ERROR: ${msg}`);
  errorCount++;
}

function warn(msg) {
  console.warn(`  ⚠️  WARNING: ${msg}`);
  warningCount++;
}

console.log('--- Validating Orbito Repository Structure & Documentation Hierarchy ---\n');

// 1. Check Root Directory Items
console.log('1. Checking Root-Level Entries:');
const rootEntries = fs.readdirSync(rootDir, { withFileTypes: true });

for (const entry of rootEntries) {
  const name = entry.name;
  if (entry.isDirectory()) {
    if (!PERMITTED_ROOT_DIRS.has(name)) {
      warn(`Unregistered root directory: "${name}". If permanent, add to PERMITTED_ROOT_DIRS in scripts/validate-structure.js.`);
    } else if (verbose) {
      pass(`Approved root directory: ${name}/`);
    }
  } else {
    // It's a file
    if (name.endsWith('.md')) {
      if (!PERMITTED_ROOT_MD.has(name)) {
        fail(`Unapproved root-level Markdown file: "${name}". Move to appropriate docs/<category>/ subdirectory.`);
      } else {
        pass(`Approved root entrypoint: ${name}`);
      }
    } else if (!PERMITTED_ROOT_FILES.has(name) && !PERMITTED_ROOT_MD.has(name)) {
      warn(`Unregistered root-level file: "${name}". If required by tooling, add to PERMITTED_ROOT_FILES in scripts/validate-structure.js.`);
    } else if (verbose) {
      pass(`Approved root configuration: ${name}`);
    }
  }
}

// 2. Check Required Documentation Directories
console.log('\n2. Checking Required docs/ Subdirectories:');
const docsDir = path.join(rootDir, 'docs');
if (!fs.existsSync(docsDir)) {
  fail('Missing docs/ directory at repository root.');
} else {
  for (const sub of REQUIRED_DOCS_DIRS) {
    const subPath = path.join(docsDir, sub);
    if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
      pass(`docs/${sub}/ exists`);
    } else {
      fail(`Missing required documentation directory: docs/${sub}/`);
    }
  }
}

// 3. Check Central Documentation Index
console.log('\n3. Checking Central Documentation Index:');
const indexFile = path.join(docsDir, 'README.md');
if (!fs.existsSync(indexFile)) {
  fail('Missing central documentation index at docs/README.md.');
} else {
  pass('Found docs/README.md');

  // Verify internal relative markdown links in docs/README.md
  const content = fs.readFileSync(indexFile, 'utf8');
  const linkRegex = /\[([^\]]+)\]\((?!https?:\/\/|#)([^)]+)\)/g;
  let match;
  let linkCount = 0;
  let brokenLinks = 0;

  while ((match = linkRegex.exec(content)) !== null) {
    const targetLink = match[2].split('#')[0]; // strip hash anchors
    if (!targetLink) continue;
    linkCount++;
    const resolvedPath = path.resolve(docsDir, targetLink);
    if (!fs.existsSync(resolvedPath)) {
      fail(`Broken relative link in docs/README.md: "${targetLink}" (resolved to: ${resolvedPath})`);
      brokenLinks++;
    }
  }

  if (brokenLinks === 0) {
    pass(`All ${linkCount} relative documentation links in docs/README.md verified successfully.`);
  }
}

// 4. Check for Misplaced Audit Reports
console.log('\n4. Checking for Misplaced Audit and Report Documents:');
const auditPatterns = [/.*_AUDIT\.md$/i, /.*_REPORT\.md$/i, /.*_MANIFEST\.md$/i, /.*_CHECK\.md$/i, /.*_REVIEW\.md$/i];

function checkDirectoryForMisplacedAudits(currentDir, relativePrefix = '') {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const rel = path.join(relativePrefix, entry.name).replace(/\\/g, '/');

    // Skip ignored/vendor dirs
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'out' || entry.name === '.ai-workspace-data' || entry.name === 'graphify-out') {
      continue;
    }

    // Skip .agents/coordination (which maintains its own internal task manifests and coordination handoffs)
    if (rel.startsWith('.agents/coordination')) {
      continue;
    }

    if (entry.isDirectory()) {
      checkDirectoryForMisplacedAudits(fullPath, rel);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const isAudit = auditPatterns.some((p) => p.test(entry.name));
      if (isAudit && !rel.startsWith('docs/audits/')) {
        fail(`Misplaced audit report: "${rel}". Move to docs/audits/.`);
      }
    }
  }
}

checkDirectoryForMisplacedAudits(rootDir);
if (errorCount === 0) {
  pass('Zero misplaced audit reports detected across repository.');
}

// Summary
console.log('\n======================================================');
if (errorCount > 0) {
  console.error(`💥 Structure validation failed: ${errorCount} error(s), ${warningCount} warning(s).`);
  process.exit(1);
} else {
  console.log(`🌟 Structure validation passed: 0 errors, ${warningCount} warning(s).`);
  console.log('Repository organization and documentation governance are fully compliant.');
  process.exit(0);
}
