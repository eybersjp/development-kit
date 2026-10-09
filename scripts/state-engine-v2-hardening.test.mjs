import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  appendEntityState,
  appendMetadataEvent,
  getStateEnginePaths,
  loadCanonicalEvents,
  verifyStateEngineIntegrity,
} from '../runtime/orchestration/state-engine-v2.mjs';

function tempProject(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-t04-hardening-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('T04-H01 physical event ledger retains its open file identity across commits', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const ledger = getStateEnginePaths(rootDir).events;
  const descriptor = fs.openSync(ledger, 'r');
  try {
    const before = fs.fstatSync(descriptor).size;
    appendMetadataEvent({ rootDir, eventType: 'FOLLOWUP_EVENT', payload: { value: 2 } });
    assert.ok(fs.fstatSync(descriptor).size > before, 'append must grow the same canonical file, not rewrite its inode');
    assert.equal(loadCanonicalEvents(rootDir).length, 2);
  } finally {
    fs.closeSync(descriptor);
  }
});

test('T04-H02 a live owner cannot lose an aged lock', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const lockFile = getStateEnginePaths(rootDir).lock;
  fs.writeFileSync(lockFile, JSON.stringify({
    owner: 'live-long-running-worker',
    pid: process.pid,
    hostname: os.hostname(),
    acquiredAt: '2026-10-08T00:00:00.000Z',
  }), 'utf8');
  const old = new Date(Date.now() - 30_000);
  fs.utimesSync(lockFile, old, old);
  assert.throws(
    () => appendMetadataEvent({ rootDir, eventType: 'MUST_NOT_COMMIT', payload: { value: 2 } }),
    /lock acquisition timed out/i,
  );
  assert.equal(loadCanonicalEvents(rootDir).length, 1);
  assert.equal(fs.existsSync(lockFile), true);
});

function runWorker(rootDir, workerId) {
  return new Promise((resolve, reject) => {
    const moduleUrl = new URL('../runtime/orchestration/state-engine-v2.mjs', import.meta.url).href;
    const worker = [
      'import { appendEntityState } from ' + JSON.stringify(moduleUrl) + ';',
      'const dir = process.argv[1], id = process.argv[2];',
      'for (let n = 1; n <= 12; n++) appendEntityState({ rootDir: dir, entityType: "worker-state", entityId: id, state: { stateRevision: n, value: n }, actorClass: "concurrency-test" });',
    ].join('\n');
    const child = spawn(process.execPath, ['--input-type=module', '-e', worker, rootDir, workerId], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error('Worker ' + workerId + ' exited ' + code + ': ' + stderr.slice(-1600))));
  });
}

test('T04-H03 four processes append without losing events or corrupting sequence', async (t) => {
  const rootDir = tempProject(t);
  await Promise.all(Array.from({ length: 4 }, (_, i) => runWorker(rootDir, 'worker-' + i)));
  const events = loadCanonicalEvents(rootDir);
  assert.equal(events.length, 48);
  assert.equal(events[0].sequence, 1);
  assert.equal(events.at(-1).sequence, 48);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

