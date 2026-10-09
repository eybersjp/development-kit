import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

import {
  appendEntityState,
  appendMetadataEvent,
  getStateEnginePaths,
  loadCanonicalEvents,
  loadStateSnapshot,
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



test('T04-H04 torn append with a valid pending journal deterministically repairs without losing committed history', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const before = fs.readFileSync(paths.events, 'utf8');
  appendMetadataEvent({ rootDir, eventType: 'FOLLOWUP_EVENT', payload: { value: 2 } });
  const expected = fs.readFileSync(paths.events, 'utf8');
  const suffix = expected.slice(before.length);
  fs.writeFileSync(paths.events, before + suffix.slice(0, 23), 'utf8');
  fs.writeFileSync(paths.pending, JSON.stringify({
    schemaVersion: '1.0.0',
    previousByteLength: Buffer.byteLength(before),
    previousHash: 'sha256:' + createHash('sha256').update(before).digest('hex'),
    suffix,
  }), 'utf8');

  const recovered = loadCanonicalEvents(rootDir);
  assert.equal(recovered.length, 2);
  assert.equal(fs.readFileSync(paths.events, 'utf8'), expected);
  assert.equal(fs.existsSync(paths.pending), false);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('T04-H07 conflicting pending suffix must fail closed, not truncate canonical evidence', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const before = fs.readFileSync(paths.events, 'utf8');
  fs.writeFileSync(paths.events, before + 'tampered', 'utf8');
  fs.writeFileSync(paths.pending, JSON.stringify({
    schemaVersion: '1.0.0',
    previousByteLength: Buffer.byteLength(before),
    previousHash: 'sha256:' + createHash('sha256').update(before).digest('hex'),
    suffix: '{"valid":true}\n',
  }), 'utf8');

  assert.throws(() => loadCanonicalEvents(rootDir), /suffix conflicts/i);
  assert.ok(fs.readFileSync(paths.events, 'utf8').endsWith('tampered'));
  assert.equal(fs.existsSync(paths.pending), true);
});

test('T04-H08 stale lock from a provably dead local process can be recovered', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  fs.writeFileSync(paths.lock, JSON.stringify({
    owner: 'dead-worker',
    pid: 2147483647,
    hostname: os.hostname(),
    acquiredAt: '2026-10-08T00:00:00.000Z',
  }), 'utf8');
  const old = new Date(Date.now() - 30_000);
  fs.utimesSync(paths.lock, old, old);
  appendMetadataEvent({ rootDir, eventType: 'RECOVERED_LOCK', payload: { value: 2 } });
  assert.equal(loadCanonicalEvents(rootDir).length, 2);
});


test('T04-H09 internal canonical events file may not be redirected through a symlink', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const outsideRoot = tempProject(t);
  const outsideFile = path.join(outsideRoot, 'outside-ledger.jsonl');
  const originalContent = fs.readFileSync(paths.events, 'utf8');
  fs.writeFileSync(outsideFile, originalContent, 'utf8');
  fs.rmSync(paths.events);
  try {
    fs.symlinkSync(outsideFile, paths.events, 'file');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip('Host does not permit file symlink creation');
      return;
    }
    throw error;
  }
  assert.throws(() => loadCanonicalEvents(rootDir), /not a regular file/i);
  assert.throws(() => appendMetadataEvent({ rootDir, eventType: 'DANGER', payload: {} }), /not a regular file/i);
  assert.equal(fs.readFileSync(outsideFile, 'utf8'), originalContent);
});


test('T04-H10 appending to a valid ledger without a terminal newline preserves record separation', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const original = fs.readFileSync(paths.events, 'utf8');
  assert.ok(original.endsWith('\n'));
  fs.writeFileSync(paths.events, original.slice(0, -1), 'utf8');
  appendMetadataEvent({ rootDir, eventType: 'FOLLOWUP_EVENT', payload: { value: 2 } });
  const history = loadCanonicalEvents(rootDir);
  assert.equal(history.length, 2);
  assert.equal(history[1].previousEventHash, history[0].eventHash);
  assert.ok(fs.readFileSync(paths.events, 'utf8').endsWith('\n'));
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('T04-H11 missing aged lock during stale-owner recheck retries acquisition safely', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  fs.writeFileSync(paths.lock, JSON.stringify({
    owner: 'provably-dead-owner',
    pid: 2147483647,
    hostname: os.hostname(),
    acquiredAt: '2026-10-08T00:00:00.000Z',
  }));
  const aged = new Date(Date.now() - 30_000);
  fs.utimesSync(paths.lock, aged, aged);
  const originalStat = fs.statSync;
  let lockStatCalls = 0;
  fs.statSync = function injectConcurrentLockRemoval(target, ...args) {
    if (target === paths.lock && ++lockStatCalls === 2) {
      const err = new Error('simulated competing stale-lock reclamation');
      err.code = 'ENOENT';
      throw err;
    }
    return originalStat.call(this, target, ...args);
  };
  try {
    appendMetadataEvent({ rootDir, eventType: 'AFTER_STALE_LOCK_RACE', payload: { ok: true } });
  } finally {
    fs.statSync = originalStat;
  }
  assert.ok(lockStatCalls >= 3);
  assert.equal(loadCanonicalEvents(rootDir).length, 2);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});


test('T04-H12 snapshot reader tolerates a legitimate writer committing between ledger and snapshot reads', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const originalRead = fs.readFileSync;
  let insertedWriter = false;
  fs.readFileSync = function simulateReadWriteInterleave(file, ...args) {
    if (!insertedWriter && file === paths.snapshot) {
      insertedWriter = true;
      appendMetadataEvent({ rootDir, eventType: 'SIMULTANEOUS_EVENT', payload: { value: 2 } });
    }
    return originalRead.call(this, file, ...args);
  };
  let snapshot;
  try {
    snapshot = loadStateSnapshot(rootDir);
  } finally {
    fs.readFileSync = originalRead;
  }
  assert.equal(insertedWriter, true);
  assert.equal(snapshot.lastEventSequence, 2);
  assert.equal(loadCanonicalEvents(rootDir).length, 2);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});
