import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const scope = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/04-architecture/dkf-v0.12-release-scope.json'), 'utf8'));
const EXPECTED_TASKS = [1, 2, 3, 5, 6, 7, 8, 9, 10].map(n => 'DKF120-T' + String(n).padStart(2, '0'));
const EXCLUDED = [12, 13, 14, 15, 34].map(n => 'DKF-120-AC-' + String(n).padStart(3, '0'));
const EXPECTED_CRITERIA = Array.from({ length: 40 }, (_, n) =>
  'DKF-120-AC-' + String(n + 1).padStart(3, '0')).filter(id => !EXCLUDED.includes(id));

test('v0.12 release scope is explicitly authorized and excludes unfinished T04', () => {
  assert.equal(scope.releaseVersion, '0.12.0');
  assert.equal(scope.authority, 'https://github.com/eybersjp/development-kit/issues/82');
  assert.deepEqual(scope.includedTasks, EXPECTED_TASKS);
  assert.deepEqual(scope.deferredTasks, ['DKF120-T04']);
  assert.deepEqual(scope.requiredCriteria, EXPECTED_CRITERIA);
  assert.deepEqual(scope.deferredCriteria, EXCLUDED);
  assert.equal(scope.publishAuthorizedOnVerifiedAcceptance, true);
  assert.equal(scope.releasePublished, false);
  assert.equal(scope.canonicalStateEngine, 'autopilot-versioned-snapshots');
  assert.deepEqual(scope.priorityNextRelease, {
    version: '0.13.0', task: 'DKF120-T04', issue: 73, fullWindowsRestoreRequired: true,
  });
});

test('v0.12 retains actual dependency-ordered acceptance without T04', () => {
  assert.deepEqual(scope.acceptanceEdges,
    EXPECTED_TASKS.slice(1).map((next, i) => EXPECTED_TASKS[i] + '->' + next));
});

test('v0.12 ships no T04 ledger/migration code or public State Engine V2 import', () => {
  for (const filename of ['state-engine-v2.mjs', 'state-engine-migration.mjs']) {
    assert.equal(fs.existsSync(path.join(ROOT, 'runtime/orchestration', filename)), false, filename);
  }
  for (const pathname of [
    'runtime/api/runtime-api-service.mjs',
    'runtime/orchestration/lifecycle-instance.mjs',
    'runtime/orchestration/index.mjs',
  ]) {
    const content = fs.readFileSync(path.join(ROOT, pathname), 'utf8');
    assert.doesNotMatch(content, /from ['"][^'"]*state-engine-v2(?:\.mjs)?['"]/);
  }
});

test('v0.12 includes all nine scoped feature implementation components', () => {
  const modules = [
    'cost-observatory', 'workspace-targets', 'execution-capsule',
    'lifecycle-instance', 'discovery-reentry', 'gate-profiles',
    'verification-extension-sdk', 'complexity-delta',
  ];
  for (const name of modules) {
    assert.equal(fs.existsSync(path.join(ROOT, 'runtime/orchestration', name + '.mjs')), true, name);
  }
  assert.equal(fs.existsSync(path.join(ROOT, 'runtime/api/runtime-api-service.mjs')), true);
});

test('T04 remains explicitly deferred in the user-facing release documentation', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs/04-architecture/dkf-v0.12-release-scope-amendment.md'), 'utf8');
  assert.match(doc, /priority #1/i);
  assert.match(doc, /full Windows/i);
  assert.match(doc, /AC-034/);
});
