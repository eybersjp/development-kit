#!/usr/bin/env node
/**
 * DKF project bootstrap and Development Modes selection.
 * Methodology selection is separate from package installation and Autopilot autonomy.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { bootstrapProject, getProjectBootstrapStatus } from '../runtime/bootstrap/project-bootstrap.mjs';
import {
  DEVELOPMENT_MODES, getDefaultModeConfiguration, resolveDevelopmentModeConfiguration,
} from '../runtime/development-modes/policy-contract.mjs';
import {
  changeDevelopmentMode, inspectDevelopmentMode,
} from '../runtime/development-modes/config-store.mjs';
import { recommendDevelopmentMode } from '../runtime/development-modes/recommendation.mjs';

function parseArgs(args = process.argv.slice(2)) {
  const options = {};
  for (const arg of args) {
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const [key, ...value] = arg.slice(2).split('=');
    if (!key || Object.hasOwn(options, key)) throw new Error(`Invalid or duplicate option: ${key}`);
    options[key] = value.length ? value.join('=') : true;
  }
  return options;
}

function respond(success, data, exitCode = 0) {
  console.log(JSON.stringify({ success, ...data }, null, 2));
  process.exitCode = exitCode;
}

function readConfigFile(rootDir, name) {
  if (typeof name !== 'string' || !name) throw new Error('--config-file requires a path');
  const root = fs.realpathSync(rootDir);
  const filePath = fs.realpathSync(path.resolve(root, name));
  const relative = path.relative(root, filePath);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Configuration file must be inside the project directory');
  }
  if (!fs.statSync(filePath).isFile()) throw new Error('Configuration must be a regular JSON file');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function requestedConfig(rootDir, opts) {
  if (opts['config-file'] && (opts.mode || opts['base-methodology'])) {
    throw new Error('Use --config-file or --mode, not both');
  }
  if (opts['config-file']) return readConfigFile(rootDir, opts['config-file']);
  if (!opts.mode && opts['base-methodology']) throw new Error('--base-methodology requires --mode');
  if (!opts.mode) return null;
  if (typeof opts.mode !== 'string') throw new Error('--mode requires a mode ID');
  return {
    schemaVersion: 1, mode: opts.mode,
    ...(opts['base-methodology'] ? { baseMethodology: opts['base-methodology'] } : {}),
  };
}

async function interactiveSelection() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Interactive mode requires a terminal; use --mode or --config-file in automation');
  }
  const ids = Object.keys(DEVELOPMENT_MODES);
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  try {
    process.stderr.write('\nDKF Project Initialization — Select development methodology\n');
    ids.forEach((id, i) => process.stderr.write(`  ${i + 1}) ${DEVELOPMENT_MODES[id]}${id === 'balanced' ? ' (default)' : ''}\n`));
    const selected = (await rl.question('Select 1–5 [2]: ')).trim() || '2';
    if (!/^[1-5]$/.test(selected)) throw new Error('Invalid development mode selection');
    const mode = ids[Number(selected) - 1];
    if (mode !== 'maintenance-evolution') return { schemaVersion: 1, mode };
    process.stderr.write('\nChoose the underlying methodology for this existing project:\n');
    ids.slice(0, 4).forEach((id, i) => process.stderr.write(`  ${i + 1}) ${DEVELOPMENT_MODES[id]}\n`));
    const base = (await rl.question('Select 1–4 [2]: ')).trim() || '2';
    if (!/^[1-4]$/.test(base)) throw new Error('Invalid underlying methodology selection');
    return { schemaVersion: 1, mode, baseMethodology: ids[Number(base) - 1] };
  } finally {
    rl.close();
  }
}

async function main() {
  const options = parseArgs();
  const rootDir = process.cwd();
  const mainOperations = ['status', 'check', 'mode-status', 'history', 'recommend', 'set-mode', 'init'];
  if (mainOperations.filter((key) => options[key]).length > 1) {
    throw new Error('Specify only one primary operation');
  }

  if (options.recommend) {
    const answers = {};
    for (const [option, key] of [
      ['project-type', 'projectType'], ['delivery', 'delivery'],
      ['requirements', 'requirements'], ['documentation', 'documentation'], ['governance', 'governance'],
    ]) {
      if (options[option] !== undefined) answers[key] = options[option];
    }
    return respond(true, { recommendation: recommendDevelopmentMode(answers) });
  }

  if (options.status || options.check) {
    const status = getProjectBootstrapStatus(rootDir);
    return respond(status.initialized && status.modeConfigurationStatus !== 'invalid', { status },
      status.initialized && status.modeConfigurationStatus !== 'invalid' ? 0 : 1);
  }
  if (options['mode-status'] || options.history) {
    const state = inspectDevelopmentMode(rootDir);
    return respond(state.status === 'configured',
      options.history ? { status: state.status, history: state.history ?? [] } : { developmentMode: state },
      state.status === 'configured' ? 0 : 1);
  }
  if (options['set-mode']) {
    const selection = requestedConfig(rootDir, options);
    if (!selection) throw new Error('--set-mode requires --mode or --config-file');
    const revision = Number(options['expected-revision']);
    const result = changeDevelopmentMode(rootDir, selection, {
      expectedRevision: revision,
      reason: options.reason,
      actor: typeof options.actor === 'string' ? options.actor : 'developer-cli',
    });
    return respond(true, { message: result.changed ? 'Development methodology revised' : 'Selection unchanged', developmentMode: result });
  }

  if (options.interactive && options['no-interactive']) throw new Error('--interactive and --no-interactive conflict');
  const explicit = requestedConfig(rootDir, options);
  const status = getProjectBootstrapStatus(rootDir);
  if (status.modeConfigurationStatus === 'invalid') throw new Error(`Invalid existing mode state: ${status.modeError}`);

  let selection = explicit;
  if (!selection && status.modeConfigurationStatus === 'absent'
    && (!status.initialized || options.interactive)
    && !options['no-interactive'] && (options.interactive || (process.stdin.isTTY && process.stdout.isTTY))) {
    selection = await interactiveSelection();
  }
  if (selection) resolveDevelopmentModeConfiguration(selection);
  const result = await bootstrapProject(rootDir, selection ? { modeConfig: selection } : {});
  return respond(result.success, {
    ...(result.success ? { message: 'Project bootstrapped successfully', ...result }
      : { error: result.error, code: result.code }),
  }, result.success ? 0 : 1);
}

main().catch((error) => respond(false, { error: error.message, code: error.code ?? 'ERROR_INVALID_MODE_OPERATION' }, 1));
