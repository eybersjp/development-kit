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

export function resolveScriptPath(scriptName, cwd = process.cwd()) {
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
    console.error(JSON.stringify({ success: false, error: 'Usage: node run.mjs <script-name> [args...]' }));
    process.exit(1);
  }

  const scriptPath = resolveScriptPath(scriptName);
  const child = spawnSync(process.execPath, [scriptPath, ...args.slice(1)], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });

  process.exit(child.status ?? 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
