#!/usr/bin/env node
/**
 * Development Kit — Universal Command Dispatcher
 *
 * Resolves and dispatches DK scripts across all Antigravity execution modes:
 * 1. project-local (.agents/plugins/development-kit/scripts/)
 * 2. repository-local (scripts/)
 * 3. global Antigravity configuration
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ALLOWED_SCRIPTS = Object.freeze([
  'lifecycle.mjs',
  'orchestration.mjs',
  'autopilot.mjs',
  'next-step.mjs',
  'bootstrap.mjs',
  'control-center.mjs',
  'sync-plugin.mjs',
  'validate-docs.mjs',
  'validate-skills.mjs',
  'validate-evals.mjs',
]);

export function resolveScriptPath(scriptName, cwd = process.cwd()) {
  if (!scriptName || typeof scriptName !== 'string') {
    throw new Error('Script name must be a non-empty string');
  }

  // Reject directory traversal or path separators
  if (scriptName.includes('/') || scriptName.includes('\\') || scriptName.includes('..')) {
    throw new Error(`Invalid script name (traversal/separators forbidden): ${scriptName}`);
  }

  if (!ALLOWED_SCRIPTS.includes(scriptName)) {
    throw new Error(`Script is not in allowlist: ${scriptName}`);
  }

  const candidates = [
    // 1. Project local plugin directory relative to CWD
    path.join(cwd, '.agents', 'plugins', 'development-kit', 'scripts', scriptName),
    // 2. Project root relative to CWD
    path.join(cwd, 'scripts', scriptName),
    // 3. Same directory as run.mjs
    path.join(__dirname, scriptName),
    // 4. Global home directory
    path.join(process.env.HOME || process.env.USERPROFILE || '', '.gemini', 'config', 'plugins', 'development-kit', 'scripts', scriptName),
  ];

  for (const p of candidates) {
    if (p && fs.existsSync(p) && fs.statSync(p).isFile()) {
      return p;
    }
  }

  throw new Error(`Unable to resolve script: ${scriptName}`);
}

function main() {
  const args = process.argv.slice(2);
  const scriptName = args[0];
  if (!scriptName) {
    console.error(JSON.stringify({ success: false, code: 'DK_USAGE_ERROR', error: 'Usage: node run.mjs <script-name> [args...]' }));
    process.exit(1);
  }

  let scriptPath;
  try {
    scriptPath = resolveScriptPath(scriptName);
  } catch (err) {
    console.error(JSON.stringify({ success: false, code: 'DK_SCRIPT_RESOLUTION_ERROR', error: err.message }));
    process.exit(1);
  }

  const child = spawnSync(process.execPath, [scriptPath, ...args.slice(1)], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });

  if (child.error) {
    console.error(JSON.stringify({ success: false, code: 'DK_SPAWN_ERROR', error: child.error.message }));
    process.exit(1);
  }

  if (child.status === null || child.status === undefined) {
    console.error(JSON.stringify({ success: false, code: 'DK_PROCESS_TERMINATED', error: 'Process terminated abnormally or via signal', signal: child.signal }));
    process.exit(1);
  }

  process.exit(child.status);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
