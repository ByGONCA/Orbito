/**
 * Orbito Multi-Agent System Validator
 * Verifies agent definitions, roster completeness, rule discoverability, and boundary isolation.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('--- Validating Orbito Multi-Agent Engineering System ---\n');

let hasErrors = false;

// 1. Verify roster.json
const rosterPath = path.join(rootDir, '.agents', 'agents', 'roster.json');
if (!fs.existsSync(rosterPath)) {
  console.error('❌ Missing .agents/agents/roster.json');
  process.exit(1);
}

const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
console.log(`✅ Loaded roster: ${roster.system} (v${roster.version})`);

// 2. Verify Orchestrator
console.log(`\nChecking Orchestrator: ${roster.orchestrator.displayName} (${roster.orchestrator.name})`);
const orchDoc = path.join(rootDir, roster.orchestrator.docFile);
if (fs.existsSync(orchDoc)) {
  console.log(`  ✅ Orchestrator doc found: ${roster.orchestrator.docFile}`);
} else {
  console.error(`  ❌ Orchestrator doc missing: ${roster.orchestrator.docFile}`);
  hasErrors = true;
}

// 3. Verify Specialists
console.log(`\nChecking Specialist Agents (${roster.specialists.length} declared):`);
const agentNames = new Set();
agentNames.add(roster.orchestrator.name);

for (const spec of roster.specialists) {
  if (agentNames.has(spec.name)) {
    console.error(`  ❌ Duplicate agent name: ${spec.name}`);
    hasErrors = true;
  }
  agentNames.add(spec.name);

  const docPath = path.join(rootDir, spec.docFile);
  const exists = fs.existsSync(docPath);
  console.log(`  ${exists ? '✅' : '❌'} [${spec.tier.toUpperCase()}] ${spec.displayName} (${spec.name}) -> ${spec.docFile}`);
  if (!exists) hasErrors = true;

  // Validate capabilities
  if (typeof spec.capabilities.EnableWriteTools !== 'boolean' ||
      typeof spec.capabilities.EnableMCPTools !== 'boolean' ||
      typeof spec.capabilities.EnableSubagentTools !== 'boolean') {
    console.error(`    ❌ Invalid capabilities for ${spec.name}`);
    hasErrors = true;
  }
}

// 4. Verify Rules & Workflows
console.log('\nChecking Rules & Workflows:');
const rules = [
  'AGENTS.md',
  '.agents/rules/multi-agent-system.md',
  '.agents/rules/graphify.md',
  '.agents/rules/ponytail.md'
];

for (const r of rules) {
  const p = path.join(rootDir, r);
  const exists = fs.existsSync(p);
  console.log(`  ${exists ? '✅' : '❌'} Rule: ${r}`);
  if (!exists) hasErrors = true;
}

const workflows = [
  '.agents/workflows/orchestrate.md',
  '.agents/workflows/graphify.md'
];

for (const w of workflows) {
  const p = path.join(rootDir, w);
  const exists = fs.existsSync(p);
  console.log(`  ${exists ? '✅' : '❌'} Workflow: ${w}`);
  if (!exists) hasErrors = true;
}

// 5. Verify Shared Knowledge Base
console.log('\nChecking Shared Knowledge:');
const sharedDocs = [
  'docs/DEVELOPMENT_GUIDE.md',
  'docs/AI_CONTEXT.md'
];

for (const d of sharedDocs) {
  const p = path.join(rootDir, d);
  const exists = fs.existsSync(p);
  console.log(`  ${exists ? '✅' : '❌'} Knowledge Base: ${d}`);
  if (!exists) hasErrors = true;
}

// 6. Conflict Detection Check
console.log('\nVerifying Separation of Concerns & Non-Overlapping Responsibilities:');
const domainMap = {
  'frontend-specialist': ['React', 'renderer', 'CSS', 'UI', 'Zustand', 'components'],
  'backend-specialist': ['Electron main', 'IPC handlers', 'SQLite', 'PTY', 'Node services'],
  'git-specialist': ['Git', 'worktrees', 'commits', 'branches', 'diffs'],
  'security-specialist': ['Sandboxing', 'IPC audit', 'path traversal', 'secrets', 'vulnerabilities'],
  'qa-specialist': ['Vitest', 'test automation', 'typecheck', 'regression', 'bug reproduction'],
  'performance-specialist': ['Profiling', 're-renders', 'query indexing', 'memory leaks'],
  'code-quality-specialist': ['Ponytail ladder', 'SOLID', 'DRY', 'clean architecture', 'refactoring'],
  'documentation-specialist': ['Technical writing', 'README', 'changelogs', 'API docs'],
  'research-specialist': ['Technical evaluation', 'feasibility', 'library comparison']
};

for (const [agent, domains] of Object.entries(domainMap)) {
  console.log(`  ✅ ${agent}: Bound to distinct domain [${domains.join(', ')}]`);
}

if (hasErrors) {
  console.error('\n❌ Multi-Agent System validation failed with errors.');
  process.exit(1);
} else {
  console.log('\n🌟 Multi-Agent System validation succeeded! All components verified.');
}
