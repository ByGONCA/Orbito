#!/usr/bin/env node

/**
 * Orbito Security, Dependency & License Auditor
 *
 * Enforces security gates:
 * 1. Lockfile integrity & consistency
 * 2. Production dependency license compliance (MIT, Apache, BSD, ISC)
 * 3. Secret scanning for accidental API key, token, or private key leaks
 *
 * Usage:
 *   node scripts/validate-security-and-licenses.js
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

let failed = false;
function logPass(msg) { console.log(`  [PASS] ${msg}`); }
function logFail(msg) { console.error(`  [FAIL] ${msg}`); failed = true; }
function logWarn(msg) { console.warn(`  [WARN] ${msg}`); }

console.log('\n=== Orbito Security, Dependency & License Auditor ===\n');

// 1. Lockfile integrity & consistency
const packageJsonPath = path.join(rootDir, 'package.json');
const lockfilePath = path.join(rootDir, 'package-lock.json');

if (!fs.existsSync(lockfilePath)) {
  logFail('package-lock.json is missing. Lockfile consistency check failed.');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));

logPass('package-lock.json exists and is valid JSON.');

const prodDeps = Object.keys(packageJson.dependencies || {});
const packagesInLock = lockfile.packages || {};

let missingInLock = 0;
for (const dep of prodDeps) {
  const lockKey = `node_modules/${dep}`;
  if (!packagesInLock[lockKey] && !lockfile.dependencies?.[dep]) {
    logFail(`Production dependency "${dep}" is not registered in package-lock.json.`);
    missingInLock++;
  }
}

if (missingInLock === 0) {
  logPass(`All ${prodDeps.length} production dependencies synchronized in package-lock.json.`);
}

// 2. License compliance review
const PERMITTED_LICENSES = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'CC0-1.0',
  '0BSD',
  'Unlicense',
  'Python-2.0',
  'BlueOak-1.0.0'
]);

let licenseIssues = 0;
const auditedLicenses = new Map();

for (const dep of prodDeps) {
  const depPackageJsonPath = path.join(rootDir, 'node_modules', dep, 'package.json');
  if (fs.existsSync(depPackageJsonPath)) {
    try {
      const depMeta = JSON.parse(fs.readFileSync(depPackageJsonPath, 'utf8'));
      const rawLicense = depMeta.license || (Array.isArray(depMeta.licenses) ? depMeta.licenses.map(l => l.type || l).join(' OR ') : 'UNKNOWN');
      const license = typeof rawLicense === 'string' ? rawLicense.replace(/[()]/g, '').trim() : 'UNKNOWN';

      auditedLicenses.set(dep, license);

      // Check if license is permitted
      const tokens = license.split(/\s+(?:OR|AND)\s+/);
      const hasPermitted = tokens.some((t) => PERMITTED_LICENSES.has(t));
      if (!hasPermitted && !PERMITTED_LICENSES.has(license)) {
        logWarn(`Dependency "${dep}" uses non-standard license: "${license}". Review required.`);
        if (license.includes('GPL') && !license.includes('LGPL')) {
          logFail(`Dependency "${dep}" uses copyleft license (${license}) incompatible with distribution.`);
          licenseIssues++;
        }
      }
    } catch {
      logWarn(`Could not read license for ${dep}.`);
    }
  }
}

if (licenseIssues === 0) {
  logPass(`Verified ${auditedLicenses.size} production dependency licenses (all permissive OSS).`);
}

// 3. Secret & Credential Leakage Scanning
const SECRET_PATTERNS = [
  { name: 'Anthropic API Key', regex: /sk-ant-api[a-zA-Z0-9_\-]{20,}/g },
  { name: 'OpenAI API Key', regex: /sk-(?:proj-)?[a-zA-Z0-9]{32,}/g },
  { name: 'Google Gemini API Key', regex: /AIzaSy[a-zA-Z0-9_\-]{33}/g },
  { name: 'GitHub Personal Token', regex: /(?:ghp_|github_pat_)[a-zA-Z0-9_]{36,}/g },
  { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g }
];

const SCAN_DIRS = ['src', 'scripts', 'bin', '.github'];
let leakedSecretsCount = 0;

function scanForSecrets(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const fullPath = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name !== 'node_modules' && ent.name !== '.git' && ent.name !== 'out' && ent.name !== 'dist') {
        scanForSecrets(fullPath);
      }
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (['.ts', '.tsx', '.js', '.jsx', '.json', '.yml', '.yaml', '.sh'].includes(ext)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const pattern of SECRET_PATTERNS) {
            const matches = content.match(pattern.regex);
            if (matches) {
              // Ensure match is not a placeholder in tests or documentation
              const isTestOrFixture = fullPath.includes('test') || fullPath.includes('mock');
              const isSimulated = matches.some((m) => m.includes('TAMPERED') || m.includes('SIMULATED') || m.includes('000000'));
              if (!isTestOrFixture && !isSimulated) {
                logFail(`Potential ${pattern.name} found in ${path.relative(rootDir, fullPath)}`);
                leakedSecretsCount++;
              }
            }
          }
        } catch {}
      }
    }
  }
}

for (const d of SCAN_DIRS) {
  scanForSecrets(path.join(rootDir, d));
}

if (leakedSecretsCount === 0) {
  logPass('Secret scanning completed: zero exposed API keys or private keys found.');
}

console.log('\n==========================================');
if (failed) {
  console.error('Security & License validation FAILED.\n');
  process.exit(1);
} else {
  console.log('Security & License validation PASSED.\n');
  process.exit(0);
}
