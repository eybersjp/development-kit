#!/usr/bin/env node
/**
 * Development Kit Control Center — Executable CLI Adapter
 *
 * Launches the project-scoped Control Center service via the canonical Runtime API.
 * Binds loopback only, prevents duplicate launches, and opens the browser interface.
 *
 * Usage:
 *   node scripts/control-center.mjs [--port=<port>] [--no-browser] [--status] [--root-dir=...]
 */

import { fileURLToPath } from 'node:url';
import { ControlCenterService, maybeAutoOpenControlCenter } from '../runtime/control-center/control-center-service.mjs';
import { bootstrapProject } from '../runtime/bootstrap/project-bootstrap.mjs';
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

function respond(success, data, exitCode = 0) {
  console.log(JSON.stringify({ success, ...data }, null, 2));
  process.exit(exitCode);
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
    console.error(`Failed to start Control Center: ${err.message}`);
    process.exit(1);
  }

  // Ensure project is bootstrapped
  await bootstrapProject(rootDir);

  const port = options.port ? parseInt(options.port, 10) : 0;
  const service = new ControlCenterService({ rootDir, port });

  try {
    const started = await service.start();

    // In interactive mode or when requested, open browser
    const shouldOpenBrowser = options['no-browser'] !== true;
    let browserResult = { opened: false };
    if (shouldOpenBrowser) {
      browserResult = await maybeAutoOpenControlCenter(started, {
        rootDir,
        forceInteractive: true
      });
    }

    // Output formatted status
    console.log(`Development Kit Control Center is running at: ${started.uiUrl}`);
    console.log(`Runtime API: ${started.url}`);
    console.log(`Host: ${started.host}:${started.port}`);
    console.log(`Session capability token generated`);

    // If spawned as one-shot or daemon
    if (options.daemon === false) {
      // Keep alive if run directly in foreground
      process.on('SIGINT', async () => {
        await service.stop();
        process.exit(0);
      });
    }
  } catch (err) {
    console.error(`Failed to start Control Center: ${err.message}`);
    process.exit(1);
  }
}

const isMain = process.argv[1] && (process.argv[1].endsWith('control-center.mjs') || process.argv[1].includes('control-center'));
if (isMain) {
  main();
}
