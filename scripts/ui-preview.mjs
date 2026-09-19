#!/usr/bin/env node
import path from 'node:path';
import { classifyUiContext } from '../runtime/ui-preview/ui-context-classifier.mjs';
import { ensurePreview, openPreview, stopPreview } from '../runtime/ui-preview/preview-manager.mjs';
import { readPreviewState } from '../runtime/ui-preview/state-store.mjs';

function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...rest] = arg.slice(2).split('=');
    options[key] = rest.length ? rest.join('=') : true;
  }
  return options;
}

function respond(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = exitCode;
}

const options = parseArgs(process.argv.slice(2));
const rootDir = path.resolve(typeof options.root === 'string' ? options.root : process.cwd());
const context = typeof options.context === 'string' ? options.context : '';
const route = typeof options.route === 'string' ? options.route : '/';
const providerId = typeof options.provider === 'string' ? options.provider : 'host-browser';

try {
  if (options.classify) {
    respond({ success: true, ...classifyUiContext(context) });
  } else if (options.status) {
    respond({ success: true, state: readPreviewState(rootDir) ?? { status: 'INACTIVE' } });
  } else if (options.ensure) {
    const result = await ensurePreview({ rootDir, context, route, providerId, existingUrl: typeof options.url === 'string' ? options.url : null });
    respond(result, result.success ? 0 : 1);
  } else if (options.open) {
    const result = await openPreview({ rootDir, route, providerId });
    respond(result, result.success ? 0 : 1);
  } else if (options.stop) {
    const result = stopPreview({ rootDir });
    respond(result, result.success ? 0 : 1);
  } else {
    respond({ success: false, error: 'Supported operations: --classify, --ensure, --status, --open, --stop' }, 2);
  }
} catch (error) {
  respond({ success: false, error: error.message }, 1);
}
