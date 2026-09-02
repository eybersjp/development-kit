#!/usr/bin/env node
/**
 * Development Kit — Universal Command Dispatcher
 *
 * Resolves and dispatches DK scripts across all Antigravity execution modes:
 * 1. project-local (.agents/plugins/development-kit/scripts/)
 * 2. repository-local (scripts/)
 * 3. global Antigravity configuration
 *
 * Canonical Project Root Invariant:
 * Resolves canonical project root before spawning child scripts, ensuring child
 * executes with cwd = canonical project root and receives --root-dir argument.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveProjectRoot, ProjectRootError } from '../runtime/bootstrap/project-root.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export function resolveScriptPath(scriptName) {
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

  // Strictly bind to the sibling script belonging to this same DKF installation
  const siblingPath = path.join(__dirname, scriptName);
  if (fs.existsSync(siblingPath) && fs.statSync(siblingPath).isFile()) {
    return siblingPath;
  }

  throw new Error(`Unable to resolve script: ${scriptName} (sibling not found at ${siblingPath})`);
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

  let canonicalRoot;
  try {
    canonicalRoot = resolveProjectRoot({
      cwd: process.cwd(),
      executablePath: __filename,
    });
  } catch (err) {
    console.error(JSON.stringify({
      success: false,
      code: err.code || 'DK_PROJECT_ROOT_ERROR',
      error: err.message,
      details: err.details || null,
    }));
    process.exit(1);
  }

  // Check if args already provide --root-dir or --rootDir
  const passArgs = [...args.slice(1)];
  const hasExplicitRoot = passArgs.some((a) => a.startsWith('--root-dir=') || a.startsWith('--rootDir=') || a === '--root-dir' || a === '--rootDir');
  if (!hasExplicitRoot && ['lifecycle.mjs', 'orchestration.mjs', 'autopilot.mjs', 'bootstrap.mjs', 'control-center.mjs', 'next-step.mjs'].includes(scriptName)) {
    passArgs.push(`--root-dir=${canonicalRoot}`);
  }

  const child = spawnSync(process.execPath, [scriptPath, ...passArgs], {
    stdio: 'inherit',
    cwd: canonicalRoot,
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
