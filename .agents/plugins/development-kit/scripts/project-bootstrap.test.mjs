import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  BootstrapError,
  assertProjectBootstrapped,
  bootstrapProject,
} from '../runtime/bootstrap/project-bootstrap.mjs';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dk-bootstrap-test-'));
}

test('assertProjectBootstrapped throws DK_BOOTSTRAP_MISSING when .development-kit does not exist', () => {
  const dir = createTempDir();
  assert.throws(
    () => assertProjectBootstrapped(dir),
    (err) => {
      assert.ok(err instanceof BootstrapError);
      assert.equal(err.code, 'DK_BOOTSTRAP_MISSING');
      return true;
    },
  );
});

test('assertProjectBootstrapped throws DK_BOOTSTRAP_CORRUPT when project.json is missing or invalid', () => {
  const dir = createTempDir();
  const dkDir = path.join(dir, '.development-kit');
  fs.mkdirSync(dkDir, { recursive: true });

  assert.throws(
    () => assertProjectBootstrapped(dir),
    (err) => {
      assert.ok(err instanceof BootstrapError);
      assert.equal(err.code, 'DK_BOOTSTRAP_CORRUPT');
      return true;
    },
  );

  fs.writeFileSync(path.join(dkDir, 'project.json'), '{ invalid json', 'utf8');
  fs.writeFileSync(path.join(dkDir, 'workspace-id'), 'ws-123', 'utf8');

  assert.throws(
    () => assertProjectBootstrapped(dir),
    (err) => {
      assert.ok(err instanceof BootstrapError);
      assert.equal(err.code, 'DK_BOOTSTRAP_CORRUPT');
      return true;
    },
  );
});

test('assertProjectBootstrapped succeeds when project is properly bootstrapped', async () => {
  const dir = createTempDir();
  const initResult = await bootstrapProject(dir);
  assert.equal(initResult.success, true);

  const status = assertProjectBootstrapped(dir);
  assert.equal(status.bootstrapped, true);
  assert.ok(status.projectId);
  assert.ok(status.frameworkVersion);
});
