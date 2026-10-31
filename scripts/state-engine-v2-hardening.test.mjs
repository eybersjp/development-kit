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
  rebuildStateSnapshot,
  verifyStateEngineIntegrity,
  recoverAbandonedStateLock,
  ensureStateEngineLayout,
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
    const isTargetLedger = file === paths.events ||
      (typeof file === 'string' && file.includes('/proc/self/fd/') && file.endsWith('/events.jsonl'));
    if (!injected && isTargetLedger && isAppend) {
      const displaced = path.join(paths.stateRoot, 'original-ledger-for-test.jsonl');
      fs.renameSync(paths.events, displaced);
      try {
        fs.symlinkSync(victim, paths.events, 'file');
      } catch (err) {
        fs.renameSync(displaced, paths.events);
        if (['EPERM','EACCES','ENOTSUP'].includes(err.code)) {
          t.skip('Host denies file symlink fixture');
          skipped = true;
          return originalOpen.call(this, file, flags, ...args);
        }
        throw err;
      }
      injected = true;
    }
    return originalOpen.call(this, file, flags, ...args);
  };
  let skipped = false;
  try {
    try {
      appendMetadataEvent({ rootDir, eventType: 'MUST_NOT_ESCAPE', payload: {} });
      if (!skipped) {
        assert.fail('Missing expected exception');
      }
    } catch (err) {
      if (skipped) return;
      assert.match(String(err), /symlink|symbolic|inode|link|ELOOP|outside|State Engine/i);
    }
  } finally {
    fs.openSync = originalOpen;
  }
  if (!injected || skipped) return;
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
  if (process.platform === 'win32') {
    t.skip('Pinned Windows directory handles prevent this POSIX directory-swap fixture');
    return;
  }
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
      try {
        fs.renameSync(paths.stateRoot, moved);
      } catch (err) {
        if (process.platform === 'win32' && err.code === 'EPERM') {
          t.skip('Windows locks directory handles against renaming while pinned open');
          return originalOpen.call(this, target, flags, ...rest);
        }
        throw err;
      }
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

test('T04-H37 pending journal unlink fails closed when state directory is replaced during commit', (t) => {
  if (process.platform === 'win32') {
    t.skip('Pinned Windows directory handles prevent this POSIX directory-swap fixture');
    return;
  }
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'FIRST', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const outside = tempProject(t);
  const protectedFile = path.join(outside, 'pending-commit.json');
  fs.writeFileSync(protectedFile, 'EXTERNAL-SENTINEL-DO-NOT-DELETE', 'utf8');
  const moved = paths.stateRoot + '-held-for-unlink-test';
  const originalOpen = fs.openSync;
  let swapped = false;

  // Intercept before unlink or atomic write
  let journalCreated = false;
  fs.openSync = function swapRootAtJournalUnlinkOpen(target, flags, ...rest) {
    if (typeof target === 'string' && target.includes('pending-commit.json.tmp-')) {
      journalCreated = true;
    }
    if (journalCreated && !swapped && typeof target === 'string' && (target.includes('snapshot.json') || target === paths.snapshot) && typeof flags === 'string' && flags.includes('w')) {
      try {
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
      } catch (err) {
        if (process.platform === 'win32' && err.code === 'EPERM') {
          // Open directory descriptors prevent renaming the directory on Windows
          t.skip('Windows locks directory handles against renaming while pinned open');
          return originalOpen.call(this, target, flags, ...rest);
        }
        throw err;
      }
    }
    return originalOpen.call(this, target, flags, ...rest);
  };

  try {
    assert.throws(
      () => appendMetadataEvent({ rootDir, eventType: 'SECOND_MUST_FAIL_CLEANUP', payload: {} }),
      /directory|symbolic|changed|replaced|journal cleanup|mismatch/i,
    );
  } finally {
    fs.openSync = originalOpen;
    if (swapped) {
      fs.unlinkSync(paths.stateRoot);
      fs.renameSync(moved, paths.stateRoot);
    }
  }

  assert.equal(fs.readFileSync(protectedFile, 'utf8'), 'EXTERNAL-SENTINEL-DO-NOT-DELETE',
    'External victim pending-commit.json must not be unlinked');
});

test('T04-H38 pending journal unlink fails closed when state directory is swapped with an ordinary directory across transaction', (t) => {
  if (process.platform === 'win32') {
    t.skip('Pinned Windows directory handles prevent this POSIX directory-swap fixture');
    return;
  }
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'FIRST', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const moved = paths.stateRoot + '-held-for-ordinary-dir-swap';
  const originalOpen = fs.openSync;
  let swapped = false;
  let journalCreated = false;

  fs.openSync = function swapRootWithOrdinaryDirectory(target, flags, ...rest) {
    if (typeof target === 'string' && target.includes('pending-commit.json.tmp-')) {
      journalCreated = true;
    }
    // Trigger swap after journal file is opened/written but before unlink
    const isTargetLedger = target === paths.events ||
      (typeof target === 'string' && target.includes('/proc/self/fd/') && target.endsWith('/events.jsonl'));
    if (journalCreated && !swapped && isTargetLedger && typeof flags === 'number') {
      try {
        fs.renameSync(paths.stateRoot, moved);
        // Create a brand new ordinary directory at paths.stateRoot with a decoy pending-commit.json
        fs.mkdirSync(paths.stateRoot, { recursive: true });
        fs.writeFileSync(paths.pending, 'DECOY-JOURNAL', 'utf8');
        swapped = true;
      } catch (err) {
        if (process.platform === 'win32' && err.code === 'EPERM') {
          t.skip('Windows locks directory handles against renaming while pinned open');
          return originalOpen.call(this, target, flags, ...rest);
        }
        throw err;
      }
    }
    return originalOpen.call(this, target, flags, ...rest);
  };

  try {
    assert.throws(
      () => appendMetadataEvent({ rootDir, eventType: 'SECOND_MUST_FAIL_CLEANUP', payload: {} }),
      /directory|changed|replaced/i,
    );
  } finally {
    fs.openSync = originalOpen;
    if (swapped) {
      fs.rmSync(paths.stateRoot, { recursive: true, force: true });
      fs.renameSync(moved, paths.stateRoot);
    }
  }
});

test('T04-H40 durable transaction writes fail closed when state directory is replaced before append or derived writes', (t) => {
  if (process.platform === 'win32') {
    t.skip('Pinned Windows directory handles prevent this POSIX directory-swap fixture');
    return;
  }
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'FIRST', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const moved = paths.stateRoot + '-held-for-swap';
  const originalOpen = fs.openSync;
  let swapped = false;
  let journalCreated = false;

  fs.openSync = function swapRootBeforeAppend(target, flags, ...rest) {
    if (typeof target === 'string' && target.includes('pending-commit.json.tmp-')) {
      journalCreated = true;
    }
    // Swap state directory right before appendDurably opens paths.events
    if (journalCreated && !swapped && (target === paths.events || (typeof target === 'string' && target.endsWith('/events.jsonl')))) {
      try {
        fs.renameSync(paths.stateRoot, moved);
        fs.mkdirSync(paths.stateRoot, { recursive: true });
        fs.writeFileSync(paths.events, fs.readFileSync(path.join(moved, 'events.jsonl')));
        swapped = true;
      } catch (err) {
        if (process.platform === 'win32' && err.code === 'EPERM') {
          t.skip('Windows locks directory handles against renaming while pinned open');
          return originalOpen.call(this, target, flags, ...rest);
        }
        throw err;
      }
    }
    return originalOpen.call(this, target, flags, ...rest);
  };

  try {
    assert.throws(
      () => appendMetadataEvent({ rootDir, eventType: 'SECOND_MUST_FAIL_APPEND', payload: {} }),
      /directory|changed|replaced/i,
    );
  } finally {
    fs.openSync = originalOpen;
    if (swapped) {
      fs.rmSync(paths.stateRoot, { recursive: true, force: true });
      fs.renameSync(moved, paths.stateRoot);
    }
  }
});

test('T04-H41 recovery resolves pending journal, events, and snapshot relative to pinned directory descriptor', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const before = fs.readFileSync(paths.events, 'utf8');
  appendMetadataEvent({ rootDir, eventType: 'FOLLOWUP_EVENT', payload: { value: 2 } });
  const expected = fs.readFileSync(paths.events, 'utf8');
  const suffix = expected.slice(before.length);
  // Simulate torn append with pending journal
  fs.writeFileSync(paths.events, before + suffix.slice(0, 10), 'utf8');
  fs.writeFileSync(paths.pending, JSON.stringify({
    schemaVersion: '1.0.0',
    previousByteLength: Buffer.byteLength(before),
    previousHash: 'sha256:' + createHash('sha256').update(before).digest('hex'),
    suffix,
  }), 'utf8');

  const openedTargets = [];
  const originalOpen = fs.openSync;
  fs.openSync = function trackOpen(target, flags, ...rest) {
    if (typeof target === 'string') {
      openedTargets.push(target);
    }
    return originalOpen.call(this, target, flags, ...rest);
  };

  try {
    const recovered = loadStateSnapshot(rootDir, { rebuildIfNeeded: true });
    assert.ok(recovered);
    assert.equal(recovered.lastEventSequence, 2);
    if (process.platform === 'linux') {
      const procFdEvents = openedTargets.find(p => p.includes('/proc/self/fd/') && p.endsWith('events.jsonl'));
      assert.ok(procFdEvents, 'Linux recovery must open events ledger through /proc/self/fd/ descriptor path');
    }
  } finally {
    fs.openSync = originalOpen;
  }
});

test('T04-H42 appendDurably fails closed if canonical ledger entry is displaced during write', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'INITIAL_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const displaced = path.join(paths.stateRoot, 'displaced-events.jsonl');

  const originalWriteSync = fs.writeSync;
  let swapped = false;
  fs.writeSync = function hookedWrite(fd, buffer, offset, length, position) {
    if (!swapped) {
      try {
        fs.renameSync(paths.events, displaced);
        fs.writeFileSync(paths.events, 'MUTATED_NEW_FILE\n', 'utf8');
        swapped = true;
      } catch (err) {
        if (process.platform === 'win32' && err.code === 'EPERM') {
          t.skip('Windows locks open files against renaming');
          return originalWriteSync.call(this, fd, buffer, offset, length, position);
        }
        throw err;
      }
    }
    return originalWriteSync.call(this, fd, buffer, offset, length, position);
  };

  try {
    assert.throws(
      () => appendMetadataEvent({ rootDir, eventType: 'MUST_FAIL_EVENT', payload: { value: 2 } }),
      /displaced|changed|mismatch/i,
    );
  } finally {
    fs.writeSync = originalWriteSync;
    if (swapped) {
      fs.rmSync(paths.events, { force: true });
      fs.renameSync(displaced, paths.events);
    }
  }
});




function swapLedgerBeforeJournalUnlink(t, paths, replacementContent) {
  const originalUnlink = fs.unlinkSync;
  const displaced = path.join(paths.stateRoot, 'displaced-events.jsonl');
  const state = { swapped: false, skipped: false, displaced, restore() {
    fs.unlinkSync = originalUnlink;
  } };
  fs.unlinkSync = function swapBetweenFinalLstatAndUnlink(target, ...rest) {
    if (!state.swapped && typeof target === 'string' && target.endsWith('pending-commit.json')) {
      try {
        fs.renameSync(paths.events, displaced);
        fs.writeFileSync(paths.events, replacementContent, 'utf8');
        state.swapped = true;
      } catch (err) {
        if (process.platform === 'win32' && ['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) {
          state.skipped = true;
          t.skip('Windows denies renaming the open ledger; Ubuntu CI provides the inode-swap evidence');
        } else {
          throw err;
        }
      }
    }
    return originalUnlink.call(this, target, ...rest);
  };
  return state;
}

test('T04-H43 ledger swap between final lstat and journal unlink is detected fail-closed on next load (append)', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const preLedger = fs.readFileSync(paths.events, 'utf8');
  const state = swapLedgerBeforeJournalUnlink(t, paths, preLedger);
  try {
    appendMetadataEvent({ rootDir, eventType: 'AMBIGUOUS_EVENT', payload: { value: 2 } });
  } finally {
    state.restore();
  }
  if (state.skipped) return;
  assert.equal(state.swapped, true);
  // Post-condition witnesses: canonical authority is the replaced ledger left directly in place by the hook,
  // the pending journal was removed, and derived state is ahead of the replaced ledger.
  assert.equal(fs.existsSync(paths.pending), false);
  assert.equal(fs.existsSync(state.displaced), true);
  assert.equal(fs.readFileSync(state.displaced, 'utf8').split('\n').filter(Boolean).length, 2,
    'displaced ledger holds both committed events');
  assert.equal(fs.readFileSync(paths.events, 'utf8'), preLedger,
    'events.jsonl contains the authentic swapped preLedger without synthetic post-operation rewrite');
  assert.equal(loadCanonicalEvents(rootDir).length, 1);
  assert.throws(() => loadStateSnapshot(rootDir, { rebuildIfNeeded: false }), /truncated|differs|materialized/i);
  assert.throws(() => verifyStateEngineIntegrity(rootDir), /truncated|differs|materialized|equivalent/i);
});

test('T04-H44 ledger swap between final lstat and journal unlink is detected fail-closed on next load (recovery)', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const before = fs.readFileSync(paths.events, 'utf8');
  appendMetadataEvent({ rootDir, eventType: 'FOLLOWUP_EVENT', payload: { value: 2 } });
  const suffix = fs.readFileSync(paths.events, 'utf8').slice(before.length);
  fs.writeFileSync(paths.events, before + suffix.slice(0, 10), 'utf8');
  fs.writeFileSync(paths.pending, JSON.stringify({
    schemaVersion: '1.0.0',
    previousByteLength: Buffer.byteLength(before),
    previousHash: 'sha256:' + createHash('sha256').update(before).digest('hex'),
    suffix,
  }), 'utf8');
  const state = swapLedgerBeforeJournalUnlink(t, paths, before);
  try {
    assert.throws(() => loadStateSnapshot(rootDir, { rebuildIfNeeded: true }), /truncated|differs|materialized/i);
  } finally {
    state.restore();
  }
  if (state.skipped) return;
  assert.equal(state.swapped, true);
  assert.equal(fs.existsSync(paths.pending), false);
  assert.equal(fs.existsSync(state.displaced), true);
  assert.equal(fs.readFileSync(paths.events, 'utf8'), before,
    'events.jsonl contains the authentic swapped before ledger without synthetic rewrite');
  assert.throws(() => loadStateSnapshot(rootDir, { rebuildIfNeeded: false }), /truncated|differs|materialized/i);
  assert.throws(() => verifyStateEngineIntegrity(rootDir), /truncated|differs|materialized|equivalent/i);
});

test('T04-H45 missing events.jsonl with pending journal present fails closed across all accessors', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);

  // Setup pending commit marker
  fs.writeFileSync(paths.pending, JSON.stringify({
    schemaVersion: '1.0.0',
    previousByteLength: 0,
    previousHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    suffix: '{"schemaVersion":"1.0.0"}\n',
  }), 'utf8');

  // Remove the canonical events ledger
  fs.unlinkSync(paths.events);

  // Verify loadCanonicalEvents fails closed
  assert.throws(
    () => loadCanonicalEvents(rootDir),
    /events\.jsonl is missing while pending-commit\.json is present/i,
  );

  // Verify loadStateSnapshot fails closed
  assert.throws(
    () => loadStateSnapshot(rootDir, { rebuildIfNeeded: false }),
    /events\.jsonl is missing while pending-commit\.json is present/i,
  );

  // Verify ensureStateEngineLayout fails closed rather than wiping/creating an empty ledger
  assert.throws(
    () => ensureStateEngineLayout(rootDir),
    /events\.jsonl is missing while pending-commit\.json is present/i,
  );

  // Verify verifyStateEngineIntegrity fails closed
  assert.throws(
    () => verifyStateEngineIntegrity(rootDir),
    /events\.jsonl is missing while pending-commit\.json is present/i,
  );
});

test('T04-H46 recovery fsyncs a fully present but unflushed suffix before acknowledging journal', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'H46_INITIAL', payload: { seq: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const before = fs.readFileSync(paths.events, 'utf8');
  appendMetadataEvent({ rootDir, eventType: 'H46_FOLLOWUP', payload: { seq: 2 } });
  const full = fs.readFileSync(paths.events, 'utf8');
  const suffix = full.slice(before.length);
  // Writer died after writing the complete suffix, before fsync and journal removal.
  fs.writeFileSync(paths.pending, JSON.stringify({
    schemaVersion: '1.0.0',
    previousByteLength: Buffer.byteLength(before),
    previousHash: 'sha256:' + createHash('sha256').update(before).digest('hex'),
    suffix,
  }), 'utf8');
  const ledger = fs.statSync(paths.events);
  const originalFsync = fs.fsyncSync;
  const originalUnlink = fs.unlinkSync;
  let ledgerFlushed = false;
  let observedJournalRemoval = false;
  fs.fsyncSync = function trackLedgerFsync(fd) {
    const stat = fs.fstatSync(fd);
    if (stat.isFile() && stat.dev === ledger.dev && stat.ino === ledger.ino) ledgerFlushed = true;
    return originalFsync.call(this, fd);
  };
  fs.unlinkSync = function guardJournalUnlink(target, ...args) {
    if (typeof target === 'string' && target.endsWith('pending-commit.json')) {
      observedJournalRemoval = true;
      assert.ok(ledgerFlushed,
        'Recovery must fsync fully present canonical suffix before removing pending journal');
    }
    return originalUnlink.call(this, target, ...args);
  };
  try {
    assert.equal(loadStateSnapshot(rootDir, { rebuildIfNeeded: true }).lastEventSequence, 2);
    assert.ok(observedJournalRemoval);
    assert.equal(fs.existsSync(paths.pending), false);
    assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
  } finally {
    fs.fsyncSync = originalFsync;
    fs.unlinkSync = originalUnlink;
  }
});


test('T04-H49 Windows refuses canonical ledger mutation when pending-journal directory flush fails', (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows write-capable directory flush barrier');
    return;
  }
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'H49_BASELINE', payload: { step: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const before = fs.readFileSync(paths.events);
  const dir = fs.statSync(paths.stateRoot);
  const originalFsync = fs.fsyncSync;
  let injected = false;
  fs.fsyncSync = function failStateDirectory(fd) {
    const witness = fs.fstatSync(fd);
    if (witness.isDirectory() && witness.dev === dir.dev && witness.ino === dir.ino) {
      injected = true;
      const error = new Error('injected Windows namespace durability failure');
      error.code = 'EIO';
      throw error;
    }
    return originalFsync.call(this, fd);
  };
  try {
    assert.throws(
      () => appendMetadataEvent({ rootDir, eventType: 'H49_FOLLOWUP', payload: { step: 2 } }),
      /directory durability barrier failed/i,
    );
  } finally {
    fs.fsyncSync = originalFsync;
  }
  assert.equal(injected, true);
  assert.deepEqual(fs.readFileSync(paths.events), before,
    'The ledger must not be changed if publishing the pending journal is not durable');
  assert.equal(fs.existsSync(paths.pending), true,
    'Keep recovery evidence when pending journal namespace cannot be flushed');
});

test('T04-H50 Windows flushes pending-journal directory before any physical canonical append', (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows pending-journal namespace ordering');
    return;
  }
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'H50_BASELINE', payload: { step: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const dir = fs.statSync(paths.stateRoot);
  const ledger = fs.statSync(paths.events);
  const originalFsync = fs.fsyncSync;
  const originalWrite = fs.writeSync;
  let namespaceFlushed = false;
  let sawLedgerAppend = false;
  fs.fsyncSync = function watchStateDirectoryFlush(fd) {
    const stat = fs.fstatSync(fd);
    const returned = originalFsync.call(this, fd);
    if (stat.isDirectory() && stat.dev === dir.dev && stat.ino === dir.ino) {
      namespaceFlushed = true;
    }
    return returned;
  };
  fs.writeSync = function guardLedgerAppend(fd, ...args) {
    const stat = fs.fstatSync(fd);
    if (stat.isFile() && stat.dev === ledger.dev && stat.ino === ledger.ino) {
      sawLedgerAppend = true;
      assert.equal(namespaceFlushed, true,
        'The pending journal must be flushed in its parent before appending ledger bytes');
    }
    return originalWrite.call(this, fd, ...args);
  };
  try {
    appendMetadataEvent({ rootDir, eventType: 'H50_FOLLOWUP', payload: { step: 2 } });
  } finally {
    fs.fsyncSync = originalFsync;
    fs.writeSync = originalWrite;
  }
  assert.equal(sawLedgerAppend, true);
  assert.equal(fs.existsSync(paths.pending), false);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('T04-P1 initial layout cannot overwrite an acknowledged concurrent first event', (t) => {
  const rootDir = tempProject(t);
  const paths = getStateEnginePaths(rootDir);
  const originalRename = fs.renameSync;
  const originalOpen = fs.openSync;
  let injected = false;
  const injectWriter = () => {
    injected = true;
    appendMetadataEvent({
      rootDir, eventType: 'RACE_COMMIT', actorClass: 'concurrency-regression',
      payload: { witness: 'acknowledged-before-initial-layout' },
    });
  };
  fs.renameSync = function raceOnFirstLedgerPublication(from, to, ...rest) {
    if (!injected && path.basename(String(to)) === 'events.jsonl' && String(from).includes('events.jsonl.tmp-')) {
      injectWriter();
    }
    return originalRename.call(this, from, to, ...rest);
  };
  fs.openSync = function raceOnExclusiveLedgerCreation(file, flags, ...rest) {
    if (!injected && path.basename(String(file)) === 'events.jsonl' && flags === 'wx') injectWriter();
    return originalOpen.call(this, file, flags, ...rest);
  };
  try {
    ensureStateEngineLayout(rootDir);
  } finally {
    fs.renameSync = originalRename;
    fs.openSync = originalOpen;
  }
  assert.equal(injected, true, 'fixture must interleave first layout with a successful writer');
  const ledger = fs.readFileSync(paths.events, 'utf8');
  assert.match(ledger, /RACE_COMMIT/, 'initialization must not replace an acknowledged canonical event');
  assert.equal(loadCanonicalEvents(rootDir).length, 1);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('T04-H52 corrupted pending suffix is rejected before mutating canonical bytes or journal', (t) => {
  for (const partialLength of [0, 20]) {
    const rootDir = tempProject(t);
    appendMetadataEvent({ rootDir, eventType: 'H52_BASELINE', payload: { value: 1 } });
    const paths = getStateEnginePaths(rootDir);
    const baseline = fs.readFileSync(paths.events, 'utf8');
    appendMetadataEvent({ rootDir, eventType: 'H52_FOLLOWUP', payload: { value: 2 } });
    const validSuffix = fs.readFileSync(paths.events, 'utf8').slice(baseline.length);
    const invalidEvent = JSON.parse(validSuffix.trim());
    invalidEvent.eventHash = 'sha256:' + '0'.repeat(64);
    const invalidSuffix = JSON.stringify(invalidEvent) + '\n';
    const originalLedger = baseline + invalidSuffix.slice(0, partialLength);
    const journal = JSON.stringify({
      schemaVersion: '1.0.0',
      previousByteLength: Buffer.byteLength(baseline),
      previousHash: 'sha256:' + createHash('sha256').update(baseline).digest('hex'),
      suffix: invalidSuffix,
    }) + '\n';
    fs.writeFileSync(paths.events, originalLedger, 'utf8');
    fs.writeFileSync(paths.pending, journal, 'utf8');
    assert.throws(() => loadCanonicalEvents(rootDir), /event hash mismatch|invalid|integrity/i);
    assert.equal(fs.readFileSync(paths.events, 'utf8'), originalLedger,
      'Invalid pending event must not overwrite original crash evidence (partialLength=' + partialLength + ')');
    assert.equal(fs.readFileSync(paths.pending, 'utf8'), journal,
      'Rejected pending journal must remain available for operator diagnosis');
  }
});


test('T04-H56 pending recovery preserves canonical evidence when snapshot witness read is denied', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const baseline = fs.readFileSync(paths.events, 'utf8');
  appendMetadataEvent({ rootDir, eventType: 'FOLLOWUP_EVENT', payload: { value: 2 } });
  const suffix = fs.readFileSync(paths.events, 'utf8').slice(baseline.length);
  const torn = baseline + suffix.slice(0, Math.max(1, Math.floor(suffix.length / 3)));
  fs.writeFileSync(paths.events, torn, 'utf8');
  fs.writeFileSync(paths.pending, JSON.stringify({
    schemaVersion: '1.0.0',
    previousByteLength: Buffer.byteLength(baseline),
    previousHash: 'sha256:' + createHash('sha256').update(baseline).digest('hex'),
    suffix,
  }), 'utf8');

  const originalRead = fs.readFileSync;
  let denied = 0;
  fs.readFileSync = function denySnapshotWitnessRead(target, ...args) {
    if (path.basename(String(target)) === path.basename(paths.snapshot)) {
      denied += 1;
      const error = new Error('Synthetic snapshot witness permission denial');
      error.code = 'EACCES';
      throw error;
    }
    return originalRead.call(this, target, ...args);
  };
  try {
    assert.throws(
      () => loadStateSnapshot(rootDir, { rebuildIfNeeded: true }),
      /snapshot witness|EACCES|permission denial/i,
      'A denied snapshot witness read must fail closed before canonical repair',
    );
  } finally {
    fs.readFileSync = originalRead;
  }
  assert.ok(denied > 0, 'Fault injection must intercept the witness read');
  assert.equal(fs.readFileSync(paths.events, 'utf8'), torn,
    'Failed witness read must not truncate or append canonical event bytes');
  assert.equal(fs.existsSync(paths.pending), true,
    'Failed witness read must retain the pending journal for operator recovery');
});

/**
 * T04-H57: a canonical ledger may be swapped for an external hard link
 * after the recovery preflight but before the repair opens it for mutation.
 * Both newline completion and torn-tail truncation must fail closed.
 */
for (const repairMode of ['missing-terminal-newline', 'torn-trailing-json']) {
  test('T04-H57 ledger tail repair rejects a swapped hard link (' + repairMode + ')', (t) => {
    const rootDir = tempProject(t);
    const outsideRoot = tempProject(t);
    appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
    const paths = getStateEnginePaths(rootDir);
    const baseline = fs.readFileSync(paths.events, 'utf8');
    const damaged = repairMode === 'missing-terminal-newline'
      ? baseline.slice(0, -1)
      : baseline + '{"incomplete":';
    fs.writeFileSync(paths.events, damaged, 'utf8');
    const outsideFile = path.join(outsideRoot, 'unrelated-evidence.jsonl');
    fs.writeFileSync(outsideFile, damaged, 'utf8');

    const originalOpen = fs.openSync;
    let swaps = 0;
    fs.openSync = function injectHardLinkAtRepairOpen(target, flags, ...args) {
      const writeRepair = flags === 'r+' ||
        (typeof flags === 'number' &&
          (flags & fs.constants.O_RDWR) === fs.constants.O_RDWR);
      if (target === paths.events && writeRepair) {
        swaps += 1;
        fs.unlinkSync(paths.events);
        fs.linkSync(outsideFile, paths.events);
      }
      return originalOpen.call(this, target, flags, ...args);
    };
    try {
      assert.throws(
        () => loadCanonicalEvents(rootDir),
        /canonical ledger|hard.?link|integrity|identity|unsafe/i,
        'A post-preflight hard-link substitution must be rejected before repair writes',
      );
    } finally {
      fs.openSync = originalOpen;
    }
    assert.equal(swaps, 1, 'Fault injection must intercept the repair descriptor open');
    assert.equal(fs.readFileSync(outsideFile, 'utf8'), damaged,
      'Recovery must never append to or truncate unrelated external evidence');
    assert.equal(fs.readFileSync(paths.events, 'utf8'), damaged,
      'Rejected repair must not alter the substituted canonical path');
  });
}

test('T04-H58 unreadable snapshot witness cannot authorize no-journal torn-tail truncation', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  appendMetadataEvent({ rootDir, eventType: 'ACKNOWLEDGED_EVENT', payload: { value: 2 } });
  const paths = getStateEnginePaths(rootDir);
  const ledger = fs.readFileSync(paths.events);
  const finalLineStart = ledger.lastIndexOf(0x0a, ledger.length - 2) + 1;
  const torn = Buffer.concat([ledger.subarray(0, finalLineStart),
    ledger.subarray(finalLineStart, finalLineStart + 21)]);
  fs.writeFileSync(paths.events, torn);
  assert.equal(fs.existsSync(paths.pending), false);
  const originalRead = fs.readFileSync;
  let denied = 0;
  fs.readFileSync = function denyTailSnapshotWitness(target, ...args) {
    if (String(target) === paths.snapshot) {
      denied += 1;
      const error = new Error('Synthetic snapshot witness access denied');
      error.code = 'EACCES';
      throw error;
    }
    return originalRead.call(this, target, ...args);
  };
  try {
    assert.throws(() => loadCanonicalEvents(rootDir),
      /snapshot witness|EACCES|access denied/i,
      'An unreadable acknowledged witness must block destructive tail repair');
  } finally {
    fs.readFileSync = originalRead;
  }
  assert.ok(denied > 0, 'Fault injection must intercept the snapshot witness');
  assert.deepEqual(fs.readFileSync(paths.events), torn,
    'Rejected tail repair must retain all original torn canonical bytes');
});

test('T04-H59 incomplete multibyte UTF-8 tail is truncated using raw canonical bytes', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const baseline = fs.readFileSync(paths.events);
  const torn = Buffer.concat([baseline, Buffer.from('{"payload":"'),
    Buffer.from([0xe2, 0x82])]);
  fs.writeFileSync(paths.events, torn);
  assert.equal(fs.existsSync(paths.pending), false);
  const recovered = loadCanonicalEvents(rootDir);
  assert.equal(recovered.length, 1);
  assert.deepEqual(fs.readFileSync(paths.events), baseline,
    'A torn UTF-8 suffix must be removed without rewriting valid history');
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('T04-H60 valid unterminated ledger event survives ENOSPC during newline repair', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'H60_VALID_EVENT', payload: { value: 60 } });
  const paths = getStateEnginePaths(rootDir);
  const validWithoutNewline = fs.readFileSync(paths.events).subarray(0, -1);
  fs.writeFileSync(paths.events, validWithoutNewline);
  // No acknowledged derived witness: a failed newline write must not be
  // misclassified as malformed JSON and authorize destructive truncation.
  fs.unlinkSync(paths.snapshot);
  const canonical = fs.statSync(paths.events);
  const originalWrite = fs.writeSync;
  let injected = 0;
  fs.writeSync = function denyLedgerNewline(fd, buffer, ...args) {
    const stat = fs.fstatSync(fd);
    if (stat.isFile() && stat.dev === canonical.dev && stat.ino === canonical.ino &&
        Buffer.isBuffer(buffer) && buffer.length === 1 && buffer[0] === 10) {
      injected += 1;
      const error = new Error('Synthetic ENOSPC during valid event newline completion');
      error.code = 'ENOSPC';
      throw error;
    }
    return originalWrite.call(this, fd, buffer, ...args);
  };
  try {
    assert.throws(() => loadCanonicalEvents(rootDir), /ENOSPC|newline completion/i,
      'A failed valid-event repair write must fail closed, never truncate history');
  } finally {
    fs.writeSync = originalWrite;
  }
  assert.equal(injected, 1, 'Fault injection must reach the actual canonical repair write');
  assert.deepEqual(fs.readFileSync(paths.events), validWithoutNewline,
    'A failed newline repair must preserve the complete valid event bytes');
});


test('T04-H61 failed lock metadata fsync must not strand an orphaned lock', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'H61_BASELINE', payload: { step: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const before = fs.readFileSync(paths.events);
  const originalFsync = fs.fsyncSync;
  let injected = false;
  fs.fsyncSync = function denyNewLockDurability(fd, ...args) {
    const opened = fs.fstatSync(fd, { bigint: true });
    let entry = null;
    try {
      entry = fs.lstatSync(paths.lock, { bigint: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (!injected && entry && opened.isFile() &&
        opened.dev === entry.dev && opened.ino === entry.ino) {
      injected = true;
      const error = new Error('injected lock-file fsync failure');
      error.code = 'EIO';
      throw error;
    }
    return originalFsync.call(this, fd, ...args);
  };
  try {
    assert.throws(
      () => appendMetadataEvent({ rootDir, eventType: 'H61_REJECTED', payload: { step: 2 } }),
      /lock|EIO|durability/i,
    );
  } finally {
    fs.fsyncSync = originalFsync;
  }
  assert.equal(injected, true, 'Must exercise failure after exclusive lock-file creation');
  assert.equal(fs.existsSync(paths.lock), false,
    'A failed lock initialization must not strand an unowned lock file');
  assert.deepEqual(fs.readFileSync(paths.events), before,
    'Lock initialization failure must not mutate canonical history');
  appendMetadataEvent({ rootDir, eventType: 'H61_RETRY', payload: { step: 3 } });
  assert.equal(loadCanonicalEvents(rootDir).length, 2);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});


test('T04-H61 lock metadata write failure must not leave an unowned lock', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'H61_WRITE_BASELINE', payload: { step: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const before = fs.readFileSync(paths.events);
  const originalWriteFile = fs.writeFileSync;
  let injected = false;
  fs.writeFileSync = function denyLockMetadataWrite(target, ...args) {
    if (!injected && typeof target === 'number') {
      const opened = fs.fstatSync(target, { bigint: true });
      let lockEntry = null;
      try {
        lockEntry = fs.lstatSync(paths.lock, { bigint: true });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (lockEntry && opened.isFile() &&
          opened.dev === lockEntry.dev && opened.ino === lockEntry.ino) {
        injected = true;
        const error = new Error('injected lock-file write failure');
        error.code = 'EIO';
        throw error;
      }
    }
    return originalWriteFile.call(this, target, ...args);
  };
  try {
    assert.throws(
      () => appendMetadataEvent({ rootDir, eventType: 'H61_WRITE_REJECTED', payload: { step: 2 } }),
      /lock|EIO|write/i,
    );
  } finally {
    fs.writeFileSync = originalWriteFile;
  }
  assert.equal(injected, true, 'Must inject after exclusive lock-file creation');
  assert.equal(fs.existsSync(paths.lock), false,
    'Failed lock metadata write must not strand an unowned lock');
  assert.deepEqual(fs.readFileSync(paths.events), before);
  appendMetadataEvent({ rootDir, eventType: 'H61_WRITE_RETRY', payload: { step: 3 } });
  assert.equal(loadCanonicalEvents(rootDir).length, 2);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});


test('T04-H62 failed state-lock release must not silently acknowledge a durable append', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'H62_BASELINE', payload: { step: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const originalUnlink = fs.unlinkSync;
  let injected = false;
  fs.unlinkSync = function failLockRelease(target, ...args) {
    if (!injected && path.resolve(String(target)) === path.resolve(paths.lock)) {
      injected = true;
      const error = new Error('injected state-lock release unlink EIO');
      error.code = 'EIO';
      throw error;
    }
    return originalUnlink.call(this, target, ...args);
  };
  try {
    assert.throws(
      () => appendMetadataEvent({ rootDir, eventType: 'H62_COMMITTED', payload: { step: 2 } }),
      /lock release|offline recovery|EIO/i,
      'A failed release of the owned lock must never return an unqualified success',
    );
  } finally {
    fs.unlinkSync = originalUnlink;
  }
  assert.equal(injected, true, 'Fault must hit the actual state-lock release');
  assert.equal(fs.existsSync(paths.lock), true, 'Failed lock release must preserve its owner witness');
  assert.equal(loadCanonicalEvents(rootDir).length, 2,
    'A durable canonical append must not be rolled back or duplicated after release failure');
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});


for (const deniedCode of ['EACCES', 'EIO']) {
  test(`T04-H63 unreadable acknowledged snapshot blocks derived repair (${deniedCode})`, (t) => {
    const rootDir = tempProject(t);
    appendMetadataEvent({ rootDir, eventType: 'H63_BASELINE', payload: { step: 1 } });
    appendMetadataEvent({ rootDir, eventType: 'H63_ACKNOWLEDGED', payload: { step: 2 } });
    const paths = getStateEnginePaths(rootDir);
    const snapshotWitness = fs.readFileSync(paths.snapshot);
    const indexWitness = fs.readFileSync(paths.index);
    const canonical = fs.readFileSync(paths.events, 'utf8');
    const firstLine = canonical.slice(0, canonical.indexOf('\n') + 1);
    fs.writeFileSync(paths.events, firstLine);
    const truncatedCanonical = fs.readFileSync(paths.events);
    assert.equal(fs.existsSync(paths.pending), false);

    const originalRead = fs.readFileSync;
    let injected = 0;
    fs.readFileSync = function denyDerivedSnapshotWitness(target, ...args) {
      if (String(target) === paths.snapshot) {
        injected += 1;
        const error = new Error(`Synthetic ${deniedCode} reading acknowledged snapshot`);
        error.code = deniedCode;
        throw error;
      }
      return originalRead.call(this, target, ...args);
    };
    try {
      assert.throws(() => rebuildStateSnapshot(rootDir),
        /snapshot witness|EACCES|EIO|cannot inspect/i,
        'A failed witness read must not authorize replacement by an older ledger prefix');
    } finally {
      fs.readFileSync = originalRead;
    }
    assert.ok(injected > 0, 'Fault injection must reach the actual snapshot witness read');
    assert.deepEqual(fs.readFileSync(paths.snapshot), snapshotWitness,
      'The acknowledged snapshot witness must survive failed inspection byte-for-byte');
    assert.deepEqual(fs.readFileSync(paths.index), indexWitness,
      'The derived index must not be rewritten after witness inspection fails');
    assert.deepEqual(fs.readFileSync(paths.events), truncatedCanonical,
      'The canonical ledger must not be modified by rejected derived repair');
    assert.equal(fs.existsSync(paths.pending), false);
  });
}


test('T04-H64 a missing canonical ledger cannot be silently recreated over acknowledged snapshot history', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'H64_ACKNOWLEDGED', payload: { critical: true } });
  const paths = getStateEnginePaths(rootDir);
  const canonicalWitness = fs.readFileSync(paths.events);
  const snapshotWitness = fs.readFileSync(paths.snapshot);
  const indexWitness = fs.readFileSync(paths.index);
  assert.ok(canonicalWitness.length > 0);
  assert.ok(JSON.parse(snapshotWitness.toString('utf8')).lastEventSequence > 0);

  // Model loss of the directory entry after a completed, acknowledged commit.
  // No pending journal is required to prove this is not a fresh project:
  // the durable snapshot/index are existing witnesses of committed history.
  fs.unlinkSync(paths.events);
  assert.equal(fs.existsSync(paths.pending), false);

  for (const [label, action] of [
    ['canonical reader', () => loadCanonicalEvents(rootDir)],
    ['snapshot reader', () => loadStateSnapshot(rootDir)],
    ['layout initializer', () => ensureStateEngineLayout(rootDir)],
    ['new writer', () => appendMetadataEvent({
      rootDir, eventType: 'H64_MUST_NOT_REPLACE_HISTORY', payload: { critical: false },
    })],
  ]) {
    assert.throws(action, /missing|absent|incomplete|integrity|canonical|ledger/i,
      label + ' must fail closed instead of accepting an empty canonical history');
    assert.equal(fs.existsSync(paths.events), false,
      label + ' must not manufacture a replacement canonical ledger');
    assert.deepEqual(fs.readFileSync(paths.snapshot), snapshotWitness);
    assert.deepEqual(fs.readFileSync(paths.index), indexWitness);
  }

  // The original canonical bytes remain sufficient to restore the authority
  // through a separate, evidence-preserving operator recovery operation.
  fs.writeFileSync(paths.events, canonicalWitness);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('T04-H65 valid canonical prefix truncation cannot overwrite acknowledged snapshot history', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'H65_FIRST', payload: { order: 1 } });
  appendMetadataEvent({ rootDir, eventType: 'H65_ACKNOWLEDGED', payload: { order: 2 } });
  const paths = getStateEnginePaths(rootDir);
  const fullLedger = fs.readFileSync(paths.events, 'utf8');
  const snapshotWitness = fs.readFileSync(paths.snapshot);
  const indexWitness = fs.readFileSync(paths.index);
  const prefix = fullLedger.slice(0, fullLedger.indexOf('\n') + 1);
  fs.writeFileSync(paths.events, prefix, 'utf8');
  assert.equal(fs.existsSync(paths.pending), false);
  assert.throws(
    () => appendMetadataEvent({ rootDir, eventType: 'H65_MUST_NOT_REPLACE', payload: { order: 999 } }),
    /canonical|witness|history|truncat|integrity/i,
    'A new valid event must not replace an already acknowledged event with the same sequence',
  );
  assert.equal(fs.readFileSync(paths.events, 'utf8'), prefix);
  assert.deepEqual(fs.readFileSync(paths.snapshot), snapshotWitness);
  assert.deepEqual(fs.readFileSync(paths.index), indexWitness);
  assert.equal(fs.existsSync(paths.pending), false);
});

test('T04-H65 an index-only witness blocks derived repair and a new entity write over truncated history', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'H65_FIRST', payload: { order: 1 } });
  appendMetadataEvent({ rootDir, eventType: 'H65_ACKNOWLEDGED', payload: { order: 2 } });
  const paths = getStateEnginePaths(rootDir);
  const fullLedger = fs.readFileSync(paths.events, 'utf8');
  const indexWitness = fs.readFileSync(paths.index);
  const prefix = fullLedger.slice(0, fullLedger.indexOf('\n') + 1);
  fs.writeFileSync(paths.events, prefix, 'utf8');
  fs.unlinkSync(paths.snapshot);
  assert.throws(
    () => appendEntityState({
      rootDir, entityType: 'h65-state', entityId: 'test', state: { stateRevision: 1, value: 'must-not-write' },
    }),
    /canonical|witness|history|truncat|integrity/i,
    'A retained index is an acknowledged history witness even when the snapshot is missing',
  );
  assert.equal(fs.readFileSync(paths.events, 'utf8'), prefix);
  assert.deepEqual(fs.readFileSync(paths.index), indexWitness);
  // Layout bootstrap may recreate a disposable empty snapshot before it
  // inspects the retained index; it must not publish the truncated history.
  if (fs.existsSync(paths.snapshot)) {
    assert.equal(JSON.parse(fs.readFileSync(paths.snapshot, 'utf8')).lastEventSequence, 0);
  }
  assert.equal(fs.existsSync(paths.pending), false);
});

test('T04-H65 older but consistent derived witnesses may be refreshed by a later valid append', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'H65_FIRST', payload: { order: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const oldSnapshot = fs.readFileSync(paths.snapshot);
  const oldIndex = fs.readFileSync(paths.index);
  appendMetadataEvent({ rootDir, eventType: 'H65_SECOND', payload: { order: 2 } });
  fs.writeFileSync(paths.snapshot, oldSnapshot);
  fs.writeFileSync(paths.index, oldIndex);
  appendMetadataEvent({ rootDir, eventType: 'H65_THIRD', payload: { order: 3 } });
  assert.equal(loadCanonicalEvents(rootDir).length, 3);
  assert.equal(JSON.parse(fs.readFileSync(paths.snapshot, 'utf8')).lastEventSequence, 3);
  assert.equal(JSON.parse(fs.readFileSync(paths.index, 'utf8')).sourceSequence, 3);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('T04-H65 a failed snapshot witness read cannot authorize a metadata append', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'H65_FIRST', payload: { order: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const originalLedger = fs.readFileSync(paths.events);
  const originalIndex = fs.readFileSync(paths.index);
  const originalRead = fs.readFileSync;
  let denied = false;
  fs.readFileSync = function rejectSnapshotWitnessRead(target, ...args) {
    if (String(target) === paths.snapshot) {
      denied = true;
      const error = new Error('Injected snapshot witness EIO');
      error.code = 'EIO';
      throw error;
    }
    return originalRead.call(this, target, ...args);
  };
  try {
    assert.throws(
      () => appendMetadataEvent({ rootDir, eventType: 'H65_MUST_NOT_COMMIT', payload: { order: 2 } }),
      /snapshot|witness|EIO|inspect/i,
    );
  } finally {
    fs.readFileSync = originalRead;
  }
  assert.equal(denied, true, 'Writer must actually inspect the acknowledged snapshot witness');
  assert.deepEqual(fs.readFileSync(paths.events), originalLedger);
  assert.deepEqual(fs.readFileSync(paths.index), originalIndex);
  assert.equal(fs.existsSync(paths.pending), false);
});

test('T04-H65 index-only acknowledged history prevents destructive torn-tail recovery', (t) => {
  const rootDir = tempProject(t);
  appendMetadataEvent({ rootDir, eventType: 'H65_FIRST', payload: { order: 1 } });
  appendMetadataEvent({ rootDir, eventType: 'H65_ACKNOWLEDGED', payload: { order: 2 } });
  const paths = getStateEnginePaths(rootDir);
  const ledger = fs.readFileSync(paths.events, 'utf8');
  const indexWitness = fs.readFileSync(paths.index);
  const first = ledger.slice(0, ledger.indexOf('\n') + 1);
  const torn = first + '{"schemaVersion":"1.0.0","sequence":2,';
  fs.writeFileSync(paths.events, torn, 'utf8');
  fs.unlinkSync(paths.snapshot);
  assert.throws(
    () => loadCanonicalEvents(rootDir),
    /index|witness|canonical|truncat|history/i,
    'The surviving index must prevent discarding bytes potentially belonging to an acknowledged event',
  );
  assert.equal(fs.readFileSync(paths.events, 'utf8'), torn);
  assert.deepEqual(fs.readFileSync(paths.index), indexWitness);
  assert.equal(fs.existsSync(paths.pending), false);
});
