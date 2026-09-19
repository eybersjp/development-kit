#!/usr/bin/env node
import { spawn } from 'node:child_process';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) out[argv[i]?.replace(/^--/, '')] = argv[i + 1];
  return out;
}

const options = parseArgs(process.argv.slice(2));
if (!options.token || !options.root || !options.command || !options['args-json']) process.exit(64);

const args = JSON.parse(options['args-json']);
process.title = `dkf-ui-preview:${options.token}`;

const child = spawn(options.command, args, {
  cwd: options.root,
  env: { ...process.env, BROWSER: 'none' },
  stdio: 'inherit',
  windowsHide: true,
  detached: process.platform !== 'win32',
});

let terminating = false;
function terminate(signal = 'SIGTERM') {
  if (terminating) return;
  terminating = true;
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch {}
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGTERM', () => terminate('SIGTERM'));
process.on('SIGINT', () => terminate('SIGINT'));
child.on('exit', (code, signal) => {
  if (signal) process.exit(0);
  process.exit(Number.isInteger(code) ? code : 1);
});
child.on('error', () => process.exit(1));
