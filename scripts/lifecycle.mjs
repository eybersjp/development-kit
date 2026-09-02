#!/usr/bin/env node
/**
 * Development Kit Lifecycle Entry — Executable CLI Adapter
 *
 * Usage:
 *   node scripts/lifecycle.mjs --command=dk-idea [--phase=entry] [--root-dir=...]
 */

import { fileURLToPath } from 'node:url';
import { executeLifecycleEntry } from '../runtime/lifecycle/lifecycle-gate.mjs';
import { resolveProjectRoot } from '../runtime/bootstrap/project-root.mjs';

const __filename = fileURLToPath(import.meta.url);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const parts = arg.substring(2).split('=');
      const key = parts[0];
      const value = parts.length > 1 ? parts.slice(1).join('=') : (args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true);
      options[key] = value;
    }
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const explicitRoot = options['root-dir'] || options.rootDir;
  let rootDir;

  try {
    rootDir = resolveProjectRoot({
      cwd: process.cwd(),
      executablePath: __filename,
      explicitRoot,
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

  const command = options.command;

  if (!command) {
    console.error(JSON.stringify({ success: false, error: 'Missing --command flag' }));
    process.exit(1);
  }

  const result = await executeLifecycleEntry({
    rootDir,
    command,
    phase: options.phase || 'entry',
  });

  if (!result.success) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main();
