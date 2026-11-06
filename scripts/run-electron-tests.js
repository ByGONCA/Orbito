#!/usr/bin/env node
/**
 * Cross-platform Electron test runner for Vitest.
 * Executes Vitest inside Electron's Node runtime (NODE_MODULE_VERSION 132),
 * ensuring full binary ABI compatibility for native modules like better-sqlite3.
 */
process.env.ELECTRON_RUN_AS_NODE = '1';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const electronExecutable = require('electron');
const vitestEntry = require.resolve('vitest/vitest.mjs');

// Forward all command line arguments to Vitest
const vitestArgs = [vitestEntry, ...process.argv.slice(2)];

const result = spawnSync(electronExecutable, vitestArgs, {
  stdio: 'inherit',
  env: process.env
});

if (result.error) {
  console.error('[run-electron-tests] Failed to launch electron test runner:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
