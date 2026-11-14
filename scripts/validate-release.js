#!/usr/bin/env node

/**
 * Orbito Automated Release Validation Suite
 *
 * Comprehensive end-to-end release readiness orchestrator:
 * 1. Semantic version validation
 * 2. Repository structure and documentation governance
 * 3. Agent and coordination validation
 * 4. Security, dependency and license validation
 * 5. Production build and packaging validation
 * 6. CLI diagnostics and database verification
 *
 * Usage:
 *   node scripts/validate-release.js [--tag v0.1.0]
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const tagIndex = args.indexOf('--tag');
const targetTag = tagIndex !== -1 ? args[tagIndex + 1] : null;

console.log('======================================================');
console.log('   ORBITO PRE-RELEASE VALIDATION ORCHESTRATOR         ');
console.log('======================================================\n');

let failedStages = [];

function runStage(name, command) {
  process.stdout.write(`[STAGE] ${name}... `);
  try {
    const output = execSync(command, { cwd: rootDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log('PASSED');
    return { success: true, output };
  } catch (err) {
    console.log('FAILED');
    console.error(`\n--- Error Output for ${name} ---`);
    console.error(err.stdout || '');
    console.error(err.stderr || err.message);
    console.error('--------------------------------\n');
    failedStages.push(name);
    return { success: false, error: err };
  }
}

// 1. Version and Tag Validation
process.stdout.write('[STAGE] Version & Tag Alignment... ');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const semverRegex = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?$/;

if (!semverRegex.test(packageJson.version)) {
  console.log('FAILED');
  console.error(`Version "${packageJson.version}" does not adhere to Semantic Versioning.`);
  failedStages.push('Semantic Versioning');
} else if (targetTag && targetTag !== `v${packageJson.version}`) {
  console.log('FAILED');
  console.error(`Release tag "${targetTag}" does not match package.json version "v${packageJson.version}".`);
  failedStages.push('Release Tag Matching');
} else {
  console.log(`PASSED (v${packageJson.version})`);
}

// 2. Repository Structure Validation
runStage('Repository Structure Governance', 'node scripts/validate-structure.js');

// 3. Multi-Agent Roster & System Validation
runStage('Agent System Validation', 'node scripts/validate-agents.js');
runStage('Agent Coordination Rules', 'node scripts/validate-coordination.js');

// 4. Security & License Compliance
runStage('Security & License Compliance', 'node scripts/validate-security-and-licenses.js');

// 5. TypeScript Compilation Check
runStage('TypeScript Typecheck', 'npm run typecheck');

// 6. Production Build Check
runStage('Production Bundle Build', 'npm run build');

// 7. Packaging Validation
runStage('Electron Packaging & ASAR Rules', 'node scripts/validate-packaging.js --require-build');

// 8. Runtime Diagnostics Validation
process.stdout.write('[STAGE] Runtime Diagnostics Dry-Run... ');
try {
  const doctorOutput = execSync('node bin/orbito.js doctor --json', { cwd: rootDir, encoding: 'utf8' });
  const report = JSON.parse(doctorOutput);
  if (report.overallHealth === 'HEALTHY') {
    console.log('PASSED (Persistence & Engine Healthy)');
  } else {
    console.log(`WARNING (Status: ${report.overallHealth})`);
  }
} catch (err) {
  console.log('FAILED');
  console.error(err.message);
  failedStages.push('Runtime Diagnostics');
}

console.log('\n======================================================');
if (failedStages.length > 0) {
  console.error(`RELEASE VERDICT: REJECTED (${failedStages.length} stage(s) failed)`);
  console.error(`Failed stages: ${failedStages.join(', ')}`);
  process.exit(1);
} else {
  console.log(`RELEASE VERDICT: APPROVED (All quality gates passed for v${packageJson.version})`);
  console.log('======================================================\n');
  process.exit(0);
}
