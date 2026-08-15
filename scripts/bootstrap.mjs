#!/usr/bin/env node
/**
 * Development Kit Project Bootstrap — Executable CLI Adapter
 *
 * Ensures project-local runtime state (.development-kit/) is properly initialized
 * before lifecycle operations proceed.
 *
 * Usage:
 *   node scripts/bootstrap.mjs [--status | --init | --check]
 */

import { bootstrapProject, getProjectBootstrapStatus } from '../runtime/bootstrap/project-bootstrap.mjs';

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

function respond(success, data, exitCode = 0) {
  console.log(JSON.stringify({ success, ...data }, null, 2));
  process.exit(exitCode);
}

async function main() {
  const options = parseArgs();
  const rootDir = process.cwd();

  if (options.status || options.check) {
    const status = getProjectBootstrapStatus(rootDir);
    return respond(status.initialized, { status });
  }

  // Default operation is bootstrap
  const result = await bootstrapProject(rootDir, options);
  if (!result.success) {
    return respond(false, { error: result.error, code: result.code }, 1);
  }

  return respond(true, { message: 'Project bootstrapped successfully', ...result });
}

main();
