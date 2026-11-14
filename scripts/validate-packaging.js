#!/usr/bin/env node

/**
 * Orbito Electron Packaging & Distribution Validator
 *
 * Validates electron-builder configuration, ASAR boundary rules,
 * native module unpack rules, version consistency, and distribution hygiene.
 *
 * Usage:
 *   node scripts/validate-packaging.js [--require-build]
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const requireBuild = args.includes('--require-build');

let failed = false;
function logPass(msg) { console.log(`  [PASS] ${msg}`); }
function logFail(msg) { console.error(`  [FAIL] ${msg}`); failed = true; }
function logWarn(msg) { console.warn(`  [WARN] ${msg}`); }

console.log('\n=== Orbito Electron Packaging Validator ===\n');

// 1. Check electron-builder.json presence and structure
const builderConfigPath = path.join(rootDir, 'electron-builder.json');
if (!fs.existsSync(builderConfigPath)) {
  logFail('electron-builder.json configuration file is missing from root.');
  process.exit(1);
}

let builderConfig;
try {
  builderConfig = JSON.parse(fs.readFileSync(builderConfigPath, 'utf8'));
  logPass('electron-builder.json parsed successfully.');
} catch (e) {
  logFail(`Failed to parse electron-builder.json: ${e.message}`);
  process.exit(1);
}

// 2. Validate essential desktop distribution properties
if (builderConfig.appId === 'com.orbito.workspace') {
  logPass('Application ID verified: com.orbito.workspace');
} else {
  logFail(`Unexpected appId: ${builderConfig.appId} (expected com.orbito.workspace)`);
}

if (builderConfig.productName === 'Orbito') {
  logPass('Product name verified: Orbito');
} else {
  logFail(`Unexpected productName: ${builderConfig.productName} (expected Orbito)`);
}

// 3. Validate Windows packaging targets (NSIS + Portable)
const winTargets = builderConfig.win?.target;
const targetNames = Array.isArray(winTargets) ? winTargets.map((t) => typeof t === 'string' ? t : t.target) : [];

if (targetNames.includes('nsis')) {
  logPass('Windows target contains NSIS installer.');
} else {
  logFail('Windows target missing NSIS installer definition.');
}

if (targetNames.includes('portable')) {
  logPass('Windows target contains Portable executable.');
} else {
  logFail('Windows target missing Portable executable definition.');
}

// 4. Validate ASAR and native module unpacking rules
if (builderConfig.asar === true || builderConfig.asar === undefined) {
  logPass('ASAR packaging archive is enabled.');
} else {
  logFail('ASAR packaging is disabled (insecure and inefficient for distribution).');
}

const unpackList = builderConfig.asarUnpack || [];
const hasSqliteUnpack = unpackList.some((p) => p.includes('better-sqlite3'));
const hasPtyUnpack = unpackList.some((p) => p.includes('node-pty'));

if (hasSqliteUnpack && hasPtyUnpack) {
  logPass('Native modules (better-sqlite3, node-pty) properly registered in asarUnpack.');
} else {
  logFail('Missing required native modules in asarUnpack (better-sqlite3, node-pty required on Windows).');
}

// 5. Validate file inclusion/exclusion hygiene
const filesList = builderConfig.files || [];
const requiredExclusions = ['!src/**/*', '!tests/**/*', '!docs/**/*', '!.ai-workspace-data/**/*'];
for (const excl of requiredExclusions) {
  if (filesList.includes(excl)) {
    logPass(`ASAR packaging excludes development artifact: ${excl}`);
  } else {
    logFail(`ASAR packaging must exclude ${excl} to prevent distribution leakage.`);
  }
}

// 6. Validate version consistency
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const cliScript = fs.readFileSync(path.join(rootDir, 'bin', 'orbito.js'), 'utf8');

if (packageJson.version) {
  logPass(`package.json version: ${packageJson.version}`);
}

if (cliScript.includes(`v${packageJson.version}`)) {
  logPass(`bin/orbito.js CLI banner version matches package.json (${packageJson.version}).`);
} else {
  logWarn(`bin/orbito.js CLI banner does not match package.json version ${packageJson.version}.`);
}

// 7. Check build outputs (optional or required based on flag)
const outDir = path.join(rootDir, 'out');
const mainOut = path.join(outDir, 'main', 'index.js');
const preloadOut = path.join(outDir, 'preload', 'index.js');
const rendererOut = path.join(outDir, 'renderer', 'index.html');

if (fs.existsSync(mainOut) && fs.existsSync(preloadOut) && fs.existsSync(rendererOut)) {
  logPass('Production build outputs exist (out/main, out/preload, out/renderer).');

  // Check that no .ts or .test.js files exist in out/
  let leakedFiles = [];
  function scanOut(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        scanOut(full);
      } else if (ent.name.endsWith('.ts') && !ent.name.endsWith('.d.ts')) {
        leakedFiles.push(path.relative(rootDir, full));
      } else if (ent.name.includes('.test.') || ent.name.includes('.spec.')) {
        leakedFiles.push(path.relative(rootDir, full));
      }
    }
  }
  scanOut(outDir);

  if (leakedFiles.length === 0) {
    logPass('No TypeScript source or test files detected in compiled out/ directory.');
  } else {
    logFail(`Detected unwanted source or test files in out/: ${leakedFiles.join(', ')}`);
  }
} else if (requireBuild) {
  logFail('Production build outputs missing. Run "npm run build" before validation.');
} else {
  logWarn('Production build outputs not yet generated (run "npm run build").');
}

console.log('\n==========================================');
if (failed) {
  console.error('Packaging validation FAILED.\n');
  process.exit(1);
} else {
  console.log('Packaging validation PASSED.\n');
  process.exit(0);
}
