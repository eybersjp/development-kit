import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectAuditBaseline } from './audit-baseline.mjs';

const SCRIPT = fileURLToPath(new URL('./audit-baseline.mjs', import.meta.url));
const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'dkf-audit-baseline-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('reports NOT_VERIFIED for directory without committed Git repository', (t) => {
  const root = fixture(t);
  const baseline = inspectAuditBaseline(root);
  assert.equal(baseline.status, 'NOT_VERIFIED');
  assert.equal(baseline.repository, null);
  assert.ok(baseline.limitations.some((value) => value.includes('Git repository')));
});

test('captures only a committed Git repository root without modifying it', { skip: !hasGit }, (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'audit-fixture', version: '1.2.3' }));
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'add', 'package.json']);
  execFileSync('git', ['-C', root, '-c', 'user.name=Audit Test', '-c', 'user.email=audit@example.invalid', 'commit', '-qm', 'init']);
  const first = inspectAuditBaseline(root);
  const second = inspectAuditBaseline(root);
  assert.equal(first.status, 'BASELINE_CAPTURED');
  assert.match(first.repository.head, /^[a-f0-9]{40}$/);
  assert.equal(first.project.version, '1.2.3');
  assert.equal(first.repository.trackedWorkingTreeClean, true);
  assert.equal(first.fingerprint, second.fingerprint);
  writeFileSync(join(root, 'package.json'), '{"name":"audit-fixture","version":"1.2.4"}');
  assert.equal(inspectAuditBaseline(root).repository.trackedWorkingTreeClean, false);
});

test('never executes package scripts and rejects unknown command arguments', (t) => {
  const root = fixture(t);
  const sentinel = join(root, 'SENTINEL');
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    scripts: { postinstall: 'node -e "require(\\\'fs\\\').writeFileSync(\\\'SENTINEL\\\', \\\'unsafe\\\')"'},
  }));
  const run = spawnSync(process.execPath, [SCRIPT, '--root', root, '--pretty'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).status, 'NOT_VERIFIED');
  const invalid = spawnSync(process.execPath, [SCRIPT, '--execute-tests'], { encoding: 'utf8' });
  assert.equal(invalid.status, 2);
});

test('cannot treat a nested directory as a repository root', { skip: !hasGit }, (t) => {
  const root = fixture(t);
  execFileSync('git', ['init', '-q', root]);
  mkdirSync(join(root, 'nested'));
  assert.equal(inspectAuditBaseline(join(root, 'nested')).status, 'NOT_VERIFIED');
});
