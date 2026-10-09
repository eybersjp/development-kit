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
  recoverAbandonedStateLock,
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


test('T04-H14 transient Windows EPERM on lock creation retries without bypassing ownership', (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows-specific filesystem contention semantics');
    return;
  }
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const originalOpen = fs.openSync;
  let attempts = 0;
  fs.openSync = function injectTemporaryWindowsLockContention(file, flags, ...args) {
    if (file === paths.lock && flags === 'wx') {
      attempts += 1;
      if (attempts === 1) {
        const err = new Error('simulated Windows transient lock-file sharing violation');
        err.code = 'EPERM';
        throw err;
      }
    }
    return originalOpen.call(this, file, flags, ...args);
  };
  try {
    appendMetadataEvent({ rootDir, eventType: 'LOCK_RETRY_SUCCEEDED', payload: { value: 2 } });
  } finally {
    fs.openSync = originalOpen;
  }
  assert.ok(attempts >= 2);
  assert.equal(loadCanonicalEvents(rootDir).length, 2);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});


test('T04-H15 simultaneous stale-lock reclaimers cannot delete a new owner', async (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  fs.writeFileSync(paths.lock, JSON.stringify({
    owner: 'dead-before-contention', pid: 2147483647, hostname: os.hostname(),
    acquiredAt: '2026-10-08T00:00:00.000Z',
  }));
  const aged = new Date(Date.now() - 30_000);
  fs.utimesSync(paths.lock, aged, aged);
  await Promise.all(Array.from({ length: 4 }, (_, i) => runWorker(rootDir, 'stale-worker-' + i)));
  const records = loadCanonicalEvents(rootDir);
  assert.equal(records.length, 49);
  assert.equal(records.at(-1).sequence, 49);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('T04-H16 canonical ledger hardlink cannot append to an external file', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const outsideRoot = tempProject(t);
  const victim = path.join(outsideRoot, 'external-history.jsonl');
  const originalContent = fs.readFileSync(paths.events);
  fs.writeFileSync(victim, originalContent);
  fs.rmSync(paths.events);
  try {
    fs.linkSync(victim, paths.events);
  } catch (e) {
    if (['EPERM','EACCES','ENOTSUP','EXDEV'].includes(e.code)) {
      t.skip('File hardlinks unavailable'); return;
    }
    throw e;
  }
  assert.throws(() => appendMetadataEvent({ rootDir, eventType: 'SHOULD_FAIL', payload: {} }), /hard.?link|multiple links/i);
  assert.deepEqual(fs.readFileSync(victim), originalContent);
});

test('T04-H17 interrupted commit refreshes derived snapshot and index before clearing journal', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const before = fs.readFileSync(paths.events);
  const oldSnapshot = fs.readFileSync(paths.snapshot);
  const oldIndex = fs.readFileSync(paths.index);
  appendMetadataEvent({ rootDir, eventType: 'FOLLOWUP_EVENT', payload: { value: 2 } });
  const after = fs.readFileSync(paths.events);
  fs.writeFileSync(paths.snapshot, oldSnapshot);
  fs.writeFileSync(paths.index, oldIndex);
  fs.writeFileSync(paths.pending, JSON.stringify({
    schemaVersion: '1.0.0',
    previousByteLength: before.length,
    previousHash: 'sha256:' + createHash('sha256').update(before).digest('hex'),
    suffix: after.subarray(before.length).toString('utf8'),
  }));
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
  assert.equal(JSON.parse(fs.readFileSync(paths.snapshot, 'utf8')).lastEventSequence, 2);
  assert.equal(JSON.parse(fs.readFileSync(paths.index, 'utf8')).sourceSequence, 2);
  assert.equal(fs.existsSync(paths.pending), false);
});

test('T04-H18 stale reader cannot overwrite a later writer snapshot with old derived state', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const oldSnapshot = fs.readFileSync(paths.snapshot);
  appendMetadataEvent({ rootDir, eventType: 'SECOND_EVENT', payload: { value: 2 } });
  fs.writeFileSync(paths.snapshot, oldSnapshot);
  const originalRead = fs.readFileSync;
  let insertedWriter = false;
  fs.readFileSync = function staleReaderInterleave(file, ...args) {
    if (!insertedWriter && file === paths.snapshot) {
      insertedWriter = true;
      const staleContent = originalRead.call(this, file, ...args);
      appendMetadataEvent({ rootDir, eventType: 'THIRD_EVENT', payload: { value: 3 } });
      return staleContent;
    }
    return originalRead.call(this, file, ...args);
  };
  try {
    loadStateSnapshot(rootDir);
  } finally {
    fs.readFileSync = originalRead;
  }
  assert.equal(insertedWriter, true);
  assert.equal(JSON.parse(fs.readFileSync(paths.snapshot, 'utf8')).lastEventSequence, 3);
  assert.equal(JSON.parse(fs.readFileSync(paths.index, 'utf8')).sourceSequence, 3);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});


test('T04-H22 event append refuses a symlink swapped into place immediately before open', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const outside = tempProject(t);
  const victim = path.join(outside, 'must-not-change.txt');
  fs.writeFileSync(victim, 'EXTERNAL-SENTINEL', 'utf8');
  const originalOpen = fs.openSync;
  let injected = false;
  fs.openSync = function swapCanonicalPathAtAppendOpen(file, flags, ...args) {
    const isAppend = flags === 'a' ||
      (typeof flags === 'number' && (flags & fs.constants.O_APPEND) !== 0);
    if (!injected && file === paths.events && isAppend) {
      const displaced = path.join(paths.stateRoot, 'original-ledger-for-test.jsonl');
      fs.renameSync(paths.events, displaced);
      try {
        fs.symlinkSync(victim, paths.events, 'file');
      } catch (err) {
        fs.renameSync(displaced, paths.events);
        if (['EPERM','EACCES','ENOTSUP'].includes(err.code)) {
          t.skip('Host denies file symlink fixture');
          return originalOpen.call(this, file, flags, ...args);
        }
        throw err;
      }
      injected = true;
    }
    return originalOpen.call(this, file, flags, ...args);
  };
  try {
    assert.throws(
      () => appendMetadataEvent({ rootDir, eventType: 'MUST_NOT_ESCAPE', payload: {} }),
      /symlink|symbolic|inode|link|ELOOP|outside|State Engine/i,
    );
  } finally {
    fs.openSync = originalOpen;
  }
  if (!injected) return;
  assert.equal(fs.readFileSync(victim, 'utf8'), 'EXTERNAL-SENTINEL');
});


test('T04-H26 abandoned recovery guard is recovered only by explicit offline confirmation', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const guard = paths.lock + '.reclaim';
  fs.mkdirSync(guard, { mode: 0o700 });
  fs.writeFileSync(paths.lock, JSON.stringify({
    owner: 'dead-lock-owner', pid: 2147483647,
    hostname: os.hostname(), acquiredAt: '2026-10-08T00:00:00.000Z',
  }));
  const ago = new Date(Date.now() - 120_000);
  fs.utimesSync(paths.lock, ago, ago);
  fs.utimesSync(guard, ago, ago);
  assert.throws(() => recoverAbandonedStateLock({ rootDir }), /offline confirmation/i);
  assert.equal(fs.existsSync(guard), true);
  const recovered = recoverAbandonedStateLock({ rootDir, confirmOffline: true });
  assert.equal(recovered.recovered, true);
  assert.equal(fs.existsSync(guard), false);
  appendMetadataEvent({ rootDir, eventType: 'AFTER_ORPHAN_RECOVERY', payload: { value: 2 } });
  assert.equal(loadCanonicalEvents(rootDir).length, 2);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('T04-H27 offline orphan guard recovery refuses a live owner', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const guard = paths.lock + '.reclaim';
  fs.mkdirSync(guard, { mode: 0o700 });
  fs.writeFileSync(path.join(guard, 'owner.json'), JSON.stringify({
    owner: 'still-running', pid: process.pid, hostname: os.hostname(),
  }));
  const ago = new Date(Date.now() - 120_000);
  fs.utimesSync(guard, ago, ago);
  assert.throws(() => recoverAbandonedStateLock({ rootDir, confirmOffline: true }), /live State Engine recovery guard/i);
  assert.equal(fs.existsSync(guard), true);
});


test('T04-H29 interrupted ledger recovery must never truncate an external hardlink swapped during read', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const prefix = fs.readFileSync(paths.events);
  appendMetadataEvent({ rootDir, eventType: 'FOLLOWUP_EVENT', payload: { value: 2 } });
  const complete = fs.readFileSync(paths.events);
  const suffix = complete.subarray(prefix.length);
  fs.writeFileSync(paths.events, Buffer.concat([prefix, suffix.subarray(0, 40)]));
  fs.writeFileSync(paths.pending, JSON.stringify({
    schemaVersion: '1.0.0',
    previousByteLength: prefix.length,
    previousHash: 'sha256:' + createHash('sha256').update(prefix).digest('hex'),
    suffix: suffix.toString('utf8'),
  }));
  const outside = tempProject(t);
  const victim = path.join(outside, 'external-ledger.jsonl');
  fs.writeFileSync(victim, Buffer.concat([prefix, Buffer.alloc(500, 0x58)]));
  const expectedExternal = fs.readFileSync(victim);
  const originalRead = fs.readFileSync;
  let swapped = false;
  fs.readFileSync = function swapAfterLedgerRead(file, ...args) {
    const bytes = originalRead.call(this, file, ...args);
    if (!swapped && file === paths.events) {
      swapped = true;
      fs.renameSync(paths.events, path.join(paths.stateRoot, 'displaced-ledger'));
      fs.linkSync(victim, paths.events);
    }
    return bytes;
  };
  try {
    // The corrected implementation may reject any inode substitution or
    // complete on its original descriptor. Neither may corrupt the victim.
    try { loadCanonicalEvents(rootDir); } catch (error) {
      assert.match(String(error), /canonical|inode|link|history|State Engine/i);
    }
  } finally {
    fs.readFileSync = originalRead;
  }
  assert.deepEqual(fs.readFileSync(victim), expectedExternal);
});


test('T04-H36 pending journal cannot overwrite external file after state-directory swap', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'FIRST', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const outside = tempProject(t);
  const protectedFile = path.join(outside, 'pending-commit.json');
  fs.writeFileSync(protectedFile, 'EXTERNAL-DATA-MUST-STAY', 'utf8');
  const moved = paths.stateRoot + '-held-for-test';
  const originalOpen = fs.openSync;
  let swapped = false;
  fs.openSync = function swapRootAtJournalTempOpen(target, flags, ...rest) {
    if (!swapped && typeof target === 'string' &&
      target.includes('pending-commit.json.tmp-') && flags === 'wx') {
      fs.renameSync(paths.stateRoot, moved);
      try {
        fs.symlinkSync(outside, paths.stateRoot, process.platform === 'win32' ? 'junction' : 'dir');
      } catch (error) {
        fs.renameSync(moved, paths.stateRoot);
        if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
          t.skip('Host does not permit test directory symlinks/junctions');
          return originalOpen.call(this, target, flags, ...rest);
        }
        throw error;
      }
      swapped = true;
    }
    return originalOpen.call(this, target, flags, ...rest);
  };
  try {
    assert.throws(
      () => appendMetadataEvent({ rootDir, eventType: 'SECOND_MUST_NOT_PUBLISH', payload: {} }),
      /directory|symbolic|changed|outside|project root|symlink|mismatch/i,
    );
  } finally {
    fs.openSync = originalOpen;
    if (swapped) {
      fs.unlinkSync(paths.stateRoot);
      fs.renameSync(moved, paths.stateRoot);
    }
  }
  assert.equal(fs.readFileSync(protectedFile, 'utf8'), 'EXTERNAL-DATA-MUST-STAY');
  assert.equal(loadCanonicalEvents(rootDir).length, 1);
});
