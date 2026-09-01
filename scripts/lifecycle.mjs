#!/usr/bin/env node
/**
 * Development Kit Lifecycle Entry — Executable CLI Adapter
 *
 * Usage:
 *   node scripts/lifecycle.mjs --command=dk-idea [--phase=entry]
 */

import { executeLifecycleEntry } from '../runtime/lifecycle/lifecycle-gate.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const parts = arg.substring(2).split('=');
      const key = parts[0];
      const value = parts.length > 1 ? parts.slice(1).join('=') : true;
      options[key] = value;
    }
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const rootDir = process.cwd();
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
