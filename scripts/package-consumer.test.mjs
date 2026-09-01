import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dk-pkg-consumer-'));
}

test('Package Consumer: npm pack produces valid tarball with all runtime assets and schemas', () => {
  const tempDir = createTempDir();
  const packOutput = execSync('npm pack --dry-run --json', { encoding: 'utf8' });
  const [packInfo] = JSON.parse(packOutput);

  assert.equal(packInfo.name, 'development-kit');
  assert.equal(packInfo.version, '0.9.0');

  const filenames = packInfo.files.map((f) => f.path);
  assert.ok(filenames.some((f) => f.includes('runtime/orchestration/execution-broker.mjs')), 'Must include execution-broker.mjs');
  assert.ok(filenames.some((f) => f.includes('schemas/development-contract.schema.json')), 'Must include development-contract schema');
  assert.ok(filenames.some((f) => f.includes('scripts/install-antigravity.mjs')), 'Must include installer script');
});

test('Package Consumer: install-antigravity installs cleanly and idempotently', () => {
  const tempTarget = createTempDir();
  const installResult = spawnSync(process.execPath, [path.resolve('scripts/install-antigravity.mjs'), '--project'], {
    cwd: tempTarget,
    encoding: 'utf8',
  });

  assert.equal(installResult.status, 0, installResult.stderr || installResult.stdout);
  assert.ok(fs.existsSync(path.join(tempTarget, '.agents', 'plugins', 'development-kit', 'plugin.json')), 'Installs project plugin');
  assert.ok(fs.existsSync(path.join(tempTarget, '.agents', 'AGENTS.md')), 'Installs .agents/AGENTS.md');
});
