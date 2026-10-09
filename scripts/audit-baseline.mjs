#!/usr/bin/env node
/**
 * Read-only local Git baseline for /dk-audit.
 * Never executes repository package scripts, reads secrets or writes files.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpathSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function git(root, ...args) {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    shell: false,
  });
  if (result.error || result.status !== 0) {
    return { ok: false, code: result.error?.code ?? result.status ?? 'UNKNOWN' };
  }
  return { ok: true, output: result.stdout.trim() };
}

export function inspectAuditBaseline(directory = process.cwd()) {
  const root = realpathSync(resolve(directory));
  if (!statSync(root).isDirectory()) throw new Error('Audit root must be a directory');

  let packageVersion = null;
  let packageName = null;
  try {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    packageVersion = typeof manifest.version === 'string' ? manifest.version : null;
    packageName = typeof manifest.name === 'string' ? manifest.name : null;
  } catch { /* package manifest is optional; do not execute it */ }

  const top = git(root, 'rev-parse', '--show-toplevel');
  const prefix = git(root, 'rev-parse', '--show-prefix');
  const inWorkTree = git(root, 'rev-parse', '--is-inside-work-tree');
  const head = git(root, 'rev-parse', '--verify', 'HEAD');
  const branch = git(root, 'symbolic-ref', '--quiet', '--short', 'HEAD');
  const changes = git(root, 'status', '--porcelain=v1', '--untracked-files=no');
  // Git may return differently cased or formatted absolute roots on Windows.
  // --show-prefix is empty only when -C points to the working-tree root.
  const atRoot = top.ok && prefix.ok && prefix.output === ''
    && inWorkTree.ok && inWorkTree.output === 'true';
  const hasHead = atRoot && head.ok && /^[a-f0-9]{40}$/.test(head.output);
  const repository = hasHead ? {
    root,
    head: head.output,
    branch: branch.ok ? branch.output : null,
    detached: !branch.ok,
    trackedWorkingTreeClean: changes.ok ? changes.output.length === 0 : null,
    ignoredAndUntrackedFilesNotInspected: true,
  } : null;

  const snapshot = {
    schemaVersion: 1,
    tool: 'dkf-audit-baseline',
    project: { name: packageName, version: packageVersion },
    repository,
    status: repository ? 'BASELINE_CAPTURED' : 'NOT_VERIFIED',
    limitations: repository
      ? ['Remote/CI/release facts not checked', 'Untracked and ignored files not checked', 'No tests or security checks executed']
      : ['A committed Git repository root could not be established', 'No tests or security checks executed'],
  };
  const fingerprint = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  return { ...snapshot, fingerprint };
}

function cli(args) {
  let root = process.cwd();
  let pretty = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--pretty') pretty = true;
    else if (args[i] === '--root' && i + 1 < args.length) root = args[++i];
    else throw new Error('Usage: node scripts/audit-baseline.mjs [--root DIRECTORY] [--pretty]');
  }
  return JSON.stringify(inspectAuditBaseline(root), null, pretty ? 2 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(cli(process.argv.slice(2)));
  } catch (error) {
    console.error('Audit baseline unavailable:', error.message);
    process.exitCode = 2;
  }
}
