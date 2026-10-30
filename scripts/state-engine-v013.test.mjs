import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  appendMetadataEvent,
  getStateEnginePaths,
  loadCanonicalEvents,
  loadEntityState,
  loadStateSnapshot,
  rebuildStateIndex,
  verifyStateEngineIntegrity,
} from '../runtime/orchestration/state-engine-v2.mjs';
import {
  getLegacyBackupPath,
  migrateLegacyStateToV2,
  recoverLegacyRestore,
  restoreLegacyBackup,
  validateWindowsDurabilityHelperResult,
} from '../runtime/orchestration/state-engine-migration.mjs';
import { createInitialState } from '../runtime/autopilot/transition-model.mjs';
import { saveStateRevision } from '../runtime/autopilot/state-store.mjs';
import { persistRunManifest, persistRunStateRevision, updateRun } from '../runtime/orchestration/orchestration-run.mjs';

function tempDir(t, prefix = 'dk-v013-state-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function captureMaterialized(paths) {
  return {
    events: fs.readFileSync(paths.events, 'utf8'),
    snapshot: fs.readFileSync(paths.snapshot, 'utf8'),
    index: fs.readFileSync(paths.index, 'utf8'),
  };
}

function restoreMaterialized(paths, captured) {
  fs.writeFileSync(paths.events, captured.events, 'utf8');
  fs.writeFileSync(paths.snapshot, captured.snapshot, 'utf8');
  fs.writeFileSync(paths.index, captured.index, 'utf8');
  if (fs.existsSync(paths.pending)) fs.rmSync(paths.pending, { force: true });
}

function createLegacyBackupFixture(t) {
  const sourceRoot = tempDir(t, 'dk-v013-legacy-source-');
  const state = createInitialState({ autonomy: 'guided-autopilot' }, sourceRoot);
  saveStateRevision(state, sourceRoot);
  const migration = migrateLegacyStateToV2({
    rootDir: sourceRoot,
    completedAt: '2026-10-14T20:00:00.000Z',
  });
  assert.equal(migration.semanticEquivalence, true);
  const backupPath = getLegacyBackupPath(sourceRoot);
  assert.equal(fs.existsSync(backupPath), true);
  return { sourceRoot, backupPath };
}

test('V13-LEDGER-01 pending journal loss cannot strand an unambiguous torn trailing append', (t) => {
  const rootDir = tempDir(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const baseline = captureMaterialized(paths);

  appendMetadataEvent({ rootDir, eventType: 'UNACKNOWLEDGED_EVENT', payload: { value: 2 } });
  const full = fs.readFileSync(paths.events, 'utf8');
  const suffix = full.slice(baseline.events.length);

  restoreMaterialized(paths, baseline);
  const torn = baseline.events + suffix.slice(0, Math.max(1, Math.floor(suffix.length / 3)));
  fs.writeFileSync(paths.events, torn, 'utf8');

  const recovered = loadCanonicalEvents(rootDir);
  assert.equal(recovered.length, 1);
  assert.equal(fs.readFileSync(paths.events, 'utf8'), baseline.events);
  assert.equal(fs.existsSync(paths.pending), false);
});

test('V13-LEDGER-02 complete valid final event missing only newline is preserved, not truncated', (t) => {
  const rootDir = tempDir(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const baseline = captureMaterialized(paths);

  appendMetadataEvent({ rootDir, eventType: 'SECOND_EVENT', payload: { value: 2 } });
  const full = fs.readFileSync(paths.events, 'utf8');
  const suffix = full.slice(baseline.events.length);
  assert.ok(suffix.endsWith('\n'));

  restoreMaterialized(paths, baseline);
  fs.writeFileSync(paths.events, baseline.events + suffix.slice(0, -1), 'utf8');

  const recovered = loadCanonicalEvents(rootDir);
  assert.equal(recovered.length, 2);
  assert.ok(fs.readFileSync(paths.events, 'utf8').endsWith('\n'));

  loadStateSnapshot(rootDir, { rebuildIfNeeded: true });
  rebuildStateIndex(rootDir);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('V13-LEDGER-03 acknowledged snapshot prevents truncating a torn tail that may contain accepted history', (t) => {
  const rootDir = tempDir(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const baselineEvents = fs.readFileSync(paths.events, 'utf8');

  appendMetadataEvent({ rootDir, eventType: 'ACKNOWLEDGED_EVENT', payload: { value: 2 } });
  const full = fs.readFileSync(paths.events, 'utf8');
  const suffix = full.slice(baselineEvents.length);
  const torn = baselineEvents + suffix.slice(0, Math.max(1, Math.floor(suffix.length / 3)));
  fs.writeFileSync(paths.events, torn, 'utf8');
  if (fs.existsSync(paths.pending)) fs.rmSync(paths.pending, { force: true });

  assert.throws(
    () => loadCanonicalEvents(rootDir),
    /Refusing to truncate trailing canonical bytes witnessed by the materialized snapshot/,
  );
  assert.equal(fs.readFileSync(paths.events, 'utf8'), torn);
});

test('V13-LEDGER-04 parseable hash-invalid final event fails closed even without pending journal', (t) => {
  const rootDir = tempDir(t);
  appendMetadataEvent({ rootDir, eventType: 'BASELINE_EVENT', payload: { value: 1 } });
  const paths = getStateEnginePaths(rootDir);
  const baseline = captureMaterialized(paths);

  appendMetadataEvent({ rootDir, eventType: 'SECOND_EVENT', payload: { value: 2 } });
  const full = fs.readFileSync(paths.events, 'utf8');
  const line = full.slice(baseline.events.length).trim();
  const tampered = JSON.parse(line);
  tampered.payload = { value: 999 };

  restoreMaterialized(paths, baseline);
  const bytes = baseline.events + JSON.stringify(tampered);
  fs.writeFileSync(paths.events, bytes, 'utf8');

  assert.throws(() => loadCanonicalEvents(rootDir), /hash mismatch/i);
  assert.equal(fs.readFileSync(paths.events, 'utf8'), bytes);
});

test('V13-LEDGER-05 mid-ledger corruption remains fail-closed', (t) => {
  const rootDir = tempDir(t);
  appendMetadataEvent({ rootDir, eventType: 'ONE', payload: { value: 1 } });
  appendMetadataEvent({ rootDir, eventType: 'TWO', payload: { value: 2 } });
  appendMetadataEvent({ rootDir, eventType: 'THREE', payload: { value: 3 } });
  const paths = getStateEnginePaths(rootDir);
  const lines = fs.readFileSync(paths.events, 'utf8').trimEnd().split('\n');
  lines[1] = '{corrupt-middle';
  const corrupted = lines.join('\n') + '\n';
  fs.writeFileSync(paths.events, corrupted, 'utf8');

  assert.throws(() => loadCanonicalEvents(rootDir), /JSON is invalid at line 2/i);
  assert.equal(fs.readFileSync(paths.events, 'utf8'), corrupted);
});

test('W73-01/W73-04 normal restore retains hash-chained terminal transaction evidence', (t) => {
  const { backupPath } = createLegacyBackupFixture(t);
  const parent = tempDir(t, 'dk-v013-restore-parent-');
  const targetRoot = path.join(parent, 'restored-project');

  const result = restoreLegacyBackup({
    backupPath,
    targetRoot,
    overwrite: true,
    confirmOffline: true,
  });

  assert.equal(fs.existsSync(result.transactionLog), true);
  assert.equal(fs.existsSync(targetRoot), true);
  const lines = fs.readFileSync(result.transactionLog, 'utf8').trimEnd().split('\n').map(JSON.parse);
  assert.deepEqual(
    lines.map((record) => record.phase),
    ['PREPARED', 'CANDIDATE_PUBLISHED', 'PROMOTION_ACKNOWLEDGED', 'CLEANUP_SAFE'],
  );
  assert.ok(lines.every((record) => /^sha256:[a-f0-9]{64}$/.test(record.recordHash)));
  assert.equal(lines.at(-1).outcome, 'promoted-new-root');

  const recovery = recoverLegacyRestore({ targetRoot, confirmOffline: true });
  assert.equal(recovery.alreadyComplete, true);
  assert.equal(recovery.transactionId, result.transactionId);
});

test('W73-09 a second restore appends a new transaction without deleting prior recovery history', (t) => {
  const { backupPath } = createLegacyBackupFixture(t);
  const parent = tempDir(t, 'dk-v013-restore-repeat-');
  const targetRoot = path.join(parent, 'restored-project');

  const first = restoreLegacyBackup({ backupPath, targetRoot, overwrite: true, confirmOffline: true });
  const firstLog = fs.readFileSync(first.transactionLog, 'utf8');

  const second = restoreLegacyBackup({ backupPath, targetRoot, overwrite: true, confirmOffline: true });
  assert.equal(second.transactionLog, first.transactionLog);
  const secondLog = fs.readFileSync(second.transactionLog, 'utf8');
  assert.ok(secondLog.startsWith(firstLog));

  const records = secondLog.trimEnd().split('\n').map(JSON.parse);
  const transactions = [...new Set(records.map((record) => record.transactionId))];
  assert.equal(transactions.length, 2);
  assert.equal(records.at(-1).phase, 'CLEANUP_SAFE');
});

test('W73-07 missing journal with a surviving staging witness fails closed instead of guessing', (t) => {
  const parent = tempDir(t, 'dk-v013-orphan-');
  const targetRoot = path.join(parent, 'project');
  const orphan = path.join(parent, '.dk-legacy-restore-stage-' + 'a'.repeat(32));
  fs.mkdirSync(orphan);

  assert.throws(
    () => recoverLegacyRestore({ targetRoot, confirmOffline: true }),
    /witnesses exist without a recovery journal/i,
  );
  assert.equal(fs.existsSync(orphan), true);
});

test('W73-10 no transaction and no witness reports no recovery work', (t) => {
  const parent = tempDir(t, 'dk-v013-empty-recovery-');
  const targetRoot = path.join(parent, 'project');
  assert.deepEqual(
    recoverLegacyRestore({ targetRoot, confirmOffline: true }),
    { recovered: false },
  );
});


test('W73-11 terminal restore log cannot certify a missing promoted root', (t) => {
  const { backupPath } = createLegacyBackupFixture(t);
  const parent = tempDir(t, 'dk-v013-terminal-witness-');
  const targetRoot = path.join(parent, 'restored-project');
  const result = restoreLegacyBackup({ backupPath, targetRoot, overwrite: true, confirmOffline: true });
  assert.equal(fs.existsSync(result.transactionLog), true);
  assert.equal(fs.existsSync(targetRoot), true);

  // Model a persisted terminal record whose corresponding directory rename
  // was not durable across a power interruption. No attacker is assumed.
  // A terminal record must never be sufficient to declare recovery complete.
  const moved = path.join(parent, 'simulated-unpersisted-promotion');
  fs.renameSync(targetRoot, moved);
  assert.throws(
    () => recoverLegacyRestore({ targetRoot, confirmOffline: true }),
    /terminal.*(root|witness)|terminal.*identity/i,
    'Missing promoted root must fail closed despite a valid terminal journal',
  );
  assert.equal(fs.existsSync(moved), true, 'Do not destroy recovery evidence');
  assert.equal(fs.existsSync(result.transactionLog), true, 'Retain authenticated journal');
});


test('W73-12 completed Windows-compatible restore retains exact original inode after terminal acknowledgement', (t) => {
  const { backupPath } = createLegacyBackupFixture(t);
  const parent = tempDir(t, 'dk-v013-retained-original-');
  const targetRoot = path.join(parent, 'project');
  fs.mkdirSync(targetRoot);
  const originalSentinel = path.join(targetRoot, 'original-witness.txt');
  fs.writeFileSync(originalSentinel, 'ORIGINAL-MUST-SURVIVE');
  const before = fs.lstatSync(targetRoot, { bigint: true });

  const restored = restoreLegacyBackup({
    backupPath, targetRoot, overwrite: true, confirmOffline: true,
  });
  assert.ok(restored.displacedOriginal,
    'The original directory must remain an independently verifiable rollback witness');
  const retained = fs.lstatSync(restored.displacedOriginal, { bigint: true });
  assert.equal(retained.dev, before.dev);
  assert.equal(retained.ino, before.ino, 'Original directory inode must be retained');
  assert.equal(fs.readFileSync(path.join(restored.displacedOriginal, 'original-witness.txt'), 'utf8'),
    'ORIGINAL-MUST-SURVIVE');
  assert.equal(fs.existsSync(restored.transactionLog), true, 'Retain terminal transaction log');
  const recovered = recoverLegacyRestore({ targetRoot, confirmOffline: true });
  assert.equal(recovered.alreadyComplete, true);
  assert.equal(fs.existsSync(restored.displacedOriginal), true,
    'Read-only completed recovery must not delete the original witness');
});


for (const linkKind of ['symbolic', 'hard']) {
  test(`W73-13/${linkKind} pre-existing linked restore journal cannot redirect transaction writes`, (t) => {
    const { backupPath } = createLegacyBackupFixture(t);
    const parent = tempDir(t, 'dk-v013-journal-link-');
    const targetRoot = path.join(parent, 'project');
    const outside = path.join(parent, 'unrelated-confidential-log.jsonl');
    fs.writeFileSync(outside, '');
    const digest = crypto.createHash('sha256').update(path.resolve(targetRoot)).digest('hex').slice(0, 24);
    const journal = path.join(parent, '.dk-restore-transaction-' + digest + '.jsonl');
    try {
      if (linkKind === 'symbolic') fs.symlinkSync(outside, journal, 'file');
      else fs.linkSync(outside, journal);
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP', 'EOPNOTSUPP'].includes(error.code)) {
        t.skip('Host does not permit this linked-file fixture'); return;
      }
      throw error;
    }
    assert.throws(
      () => restoreLegacyBackup({ backupPath, targetRoot, confirmOffline: true }),
      /restore.*(journal|transaction|link)|unsafe.*(link|journal)/i,
      'Existing linked journal must fail closed before writing external bytes',
    );
    assert.equal(fs.readFileSync(outside, 'utf8'), '', 'Unrelated target must remain untouched');
    assert.equal(fs.existsSync(targetRoot), false);
  });
}


test('W73-14 retained original from one project must not block unrelated target in same parent', (t) => {
  const { backupPath } = createLegacyBackupFixture(t);
  const parent = tempDir(t, 'dk-v013-independent-targets-');
  const firstRoot = path.join(parent, 'first');
  const secondRoot = path.join(parent, 'second');
  fs.mkdirSync(firstRoot);
  fs.writeFileSync(path.join(firstRoot, 'first-original.txt'), 'FIRST-ORIGINAL');
  const first = restoreLegacyBackup({ backupPath, targetRoot: firstRoot, overwrite: true, confirmOffline: true });
  assert.ok(first.displacedOriginal);
  assert.equal(fs.existsSync(first.displacedOriginal), true);

  const second = restoreLegacyBackup({ backupPath, targetRoot: secondRoot, confirmOffline: true });
  assert.equal(fs.existsSync(secondRoot), true,
    'Unrelated target must remain independently restorable');
  assert.equal(fs.existsSync(second.transactionLog), true);
  assert.equal(fs.readFileSync(path.join(first.displacedOriginal, 'first-original.txt'), 'utf8'),
    'FIRST-ORIGINAL', 'Original rollback witness must survive the other restore');
});


test('W73-15 a terminal journal with a missing root blocks the next restore without superseding evidence', (t) => {
  const { backupPath } = createLegacyBackupFixture(t);
  const parent = tempDir(t, 'dk-v013-terminal-preflight-');
  const targetRoot = path.join(parent, 'project');
  fs.mkdirSync(targetRoot);
  fs.writeFileSync(path.join(targetRoot, 'original.txt'), 'KEEP-ORIGINAL');
  const first = restoreLegacyBackup({ backupPath, targetRoot, overwrite: true, confirmOffline: true });
  assert.ok(first.displacedOriginal);
  const before = fs.readFileSync(first.transactionLog, 'utf8');

  // Model terminal journal persistence without the preceding root publication.
  const unpersisted = path.join(parent, 'unpersisted-published-root');
  fs.renameSync(targetRoot, unpersisted);
  assert.throws(
    () => restoreLegacyBackup({ backupPath, targetRoot, confirmOffline: true }),
    /terminal.*(root|witness)|terminal.*identity/i,
    'A newer restore must not supersede an unresolved terminal root witness',
  );
  assert.equal(fs.existsSync(targetRoot), false);
  assert.equal(fs.readFileSync(first.transactionLog, 'utf8'), before);
  assert.equal(fs.readFileSync(path.join(first.displacedOriginal, 'original.txt'), 'utf8'), 'KEEP-ORIGINAL');
});

test('W73-16 imported V1 terminal outcomes remain idempotently recoverable', (t) => {
  const parent = tempDir(t, 'dk-v013-imported-v1-');
  const targetRoot = path.join(parent, 'project');
  fs.mkdirSync(targetRoot);
  fs.writeFileSync(path.join(targetRoot, 'original.txt'), 'V1-ORIGINAL');
  const original = fs.lstatSync(targetRoot, { bigint: true });
  const transactionId = 'a'.repeat(32);
  const stageName = '.dk-legacy-restore-stage-' + transactionId;
  const digest = crypto.createHash('sha256').update(path.resolve(targetRoot)).digest('hex').slice(0, 24);
  const journal = path.join(parent, '.dk-restore-journal-' + digest + '.json');
  fs.writeFileSync(journal, JSON.stringify({
    schemaVersion: '1.0.0', transactionId, targetRoot, stageName,
    existed: true, originalDev: original.dev.toString(), originalIno: original.ino.toString(),
    stageDev: '1', stageIno: '1',
  }));
  const first = recoverLegacyRestore({ targetRoot, confirmOffline: true });
  assert.equal(first.legacyJournal, true);
  assert.equal(first.outcome, 'uncommitted-original-unchanged');
  assert.equal(fs.existsSync(first.retainedJournal), true);
  const second = recoverLegacyRestore({ targetRoot, confirmOffline: true });
  assert.equal(second.alreadyComplete, true);
  assert.equal(fs.readFileSync(path.join(targetRoot, 'original.txt'), 'utf8'), 'V1-ORIGINAL');
});

test('W73-17 mixed legacy Autopilot and canonical V2 orchestration runs migrate without revision regression', (t) => {
  const rootDir = tempDir(t, 'dk-v013-mixed-state-');
  const legacy = createInitialState({ autonomy: 'guided-autopilot' }, rootDir);
  const legacyDir = path.join(rootDir, '.development-kit', 'autopilot', 'state');
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(path.join(legacyDir, 'revision-000001.json'), JSON.stringify(legacy, null, 2));
  saveStateRevision(legacy, rootDir);

  const run = {
    schemaVersion: '1.0.0', contractId: 'contract-mixed', taskId: 'task-mixed',
    runId: 'run-mixed', sourceFingerprint: 'sha256:' + 'a'.repeat(64),
    createdAt: '2026-10-30T00:00:00.000Z', updatedAt: '2026-10-30T00:00:00.000Z',
    stateRevision: 1, state: 'READY', executionStrategy: 'direct',
    hostCapabilities: {}, manualEvidenceRequired: false, requiredGates: {},
    completedGates: [], correctionAttempt: 0, failureSignatures: [],
    verificationVerdict: null, acceptanceState: 'PENDING',
  };
  persistRunManifest(run, rootDir);
  assert.equal(persistRunStateRevision(run, rootDir).stateEngine, 'v2');
  const revised = updateRun(run, { state: 'IMPLEMENTING' }, '2026-10-30T00:01:00.000Z');
  assert.equal(persistRunStateRevision(revised, rootDir).stateEngine, 'v2');
  const migration = migrateLegacyStateToV2({ rootDir, completedAt: '2026-10-30T00:02:00.000Z' });
  assert.equal(migration.semanticEquivalence, true);
  assert.equal(loadEntityState('orchestration-run', 'contract-mixed/run-mixed', rootDir).stateRevision, 2);
});


test('W73-18 recovery cannot acknowledge candidate promotion without retrying parent flush', (t) => {
  if (process.platform === 'win32') {
    t.skip('POSIX fsync injection; Windows native-helper barrier requires its own fault hook'); return;
  }
  const { backupPath } = createLegacyBackupFixture(t);
  const parent = tempDir(t, 'dk-v013-publication-barrier-');
  const targetRoot = path.join(parent, 'project');
  fs.mkdirSync(targetRoot);
  fs.writeFileSync(path.join(targetRoot, 'original.txt'), 'RETAIN-ORIGINAL');
  const originalRename = fs.renameSync;
  const originalFsync = fs.fsyncSync;
  const parentStat = fs.statSync(parent);
  let promoted = false;
  let injected = false;
  fs.renameSync = function watchPromotion(from, to, ...args) {
    const result = originalRename.call(this, from, to, ...args);
    if (typeof from === 'string' && from.includes('.dk-legacy-restore-stage-') &&
        !from.endsWith('-original') && to === targetRoot) promoted = true;
    return result;
  };
  fs.fsyncSync = function failPublicationBarrier(fd) {
    const stat = fs.fstatSync(fd);
    if (promoted && !injected && stat.isDirectory() &&
        stat.dev === parentStat.dev && stat.ino === parentStat.ino) {
      injected = true;
      throw new Error('simulated publication parent flush failure');
    }
    return originalFsync.call(this, fd);
  };
  try {
    assert.throws(
      () => restoreLegacyBackup({ backupPath, targetRoot, overwrite: true, confirmOffline: true }),
      /simulated publication parent flush failure|flush barrier failed/i,
    );
    assert.equal(injected, true);
  } finally {
    fs.renameSync = originalRename;
    fs.fsyncSync = originalFsync;
  }
  const journal = fs.readdirSync(parent).find((name) => name.startsWith('.dk-restore-transaction-'));
  assert.ok(journal);
  const journalPath = path.join(parent, journal);
  assert.equal(fs.readFileSync(journalPath, 'utf8').includes('"phase":"CLEANUP_SAFE"'), false);

  let recoveryBarrierAttempted = false;
  fs.fsyncSync = function failRecoveryBarrier(fd) {
    const stat = fs.fstatSync(fd);
    if (!recoveryBarrierAttempted && stat.isDirectory() &&
        stat.dev === parentStat.dev && stat.ino === parentStat.ino) {
      recoveryBarrierAttempted = true;
      throw new Error('simulated recovery publication flush failure');
    }
    return originalFsync.call(this, fd);
  };
  try {
    assert.throws(
      () => recoverLegacyRestore({ targetRoot, confirmOffline: true }),
      /simulated recovery publication flush failure|flush barrier failed/i,
    );
    assert.equal(recoveryBarrierAttempted, true, 'Recovery must retry the publication flush');
    assert.equal(fs.readFileSync(journalPath, 'utf8').includes('"phase":"CLEANUP_SAFE"'), false,
      'No terminal acknowledgement after a failed recovery barrier');
  } finally {
    fs.fsyncSync = originalFsync;
  }
  const recovered = recoverLegacyRestore({ targetRoot, confirmOffline: true });
  assert.equal(recovered.outcome, 'promoted-original-retained');
  assert.equal(fs.existsSync(recovered.displacedOriginal), true);
});


test('W73-19 Windows case alias cannot bypass the existing restore transaction witness', (t) => {
  if (process.platform !== 'win32') {
    t.skip('NTFS case-insensitive alias behavior requires Windows'); return;
  }
  const { backupPath } = createLegacyBackupFixture(t);
  const parent = tempDir(t, 'dk-v013-ntfs-case-alias-');
  const targetRoot = path.join(parent, 'MixedCaseProject');
  const aliasRoot = path.join(parent, 'mixedcaseproject');
  fs.mkdirSync(targetRoot);
  fs.writeFileSync(path.join(targetRoot, 'original.txt'), 'ORIGINAL-CASE-ALIAS');
  const first = restoreLegacyBackup({ backupPath, targetRoot, overwrite: true, confirmOffline: true });
  assert.ok(first.displacedOriginal);
  const journalBefore = fs.readFileSync(first.transactionLog, 'utf8');
  const moved = path.join(parent, 'unpersisted-published-root');
  fs.renameSync(targetRoot, moved);
  assert.throws(
    () => restoreLegacyBackup({ backupPath, targetRoot: aliasRoot, confirmOffline: true }),
    /terminal.*(root|witness)|incomplete restore|restore witnesses/i,
    'Case alias must not start a new transaction over an unresolved original',
  );
  assert.equal(fs.readFileSync(first.transactionLog, 'utf8'), journalBefore);
  assert.equal(fs.existsSync(aliasRoot), false);
  assert.equal(fs.readFileSync(path.join(first.displacedOriginal, 'original.txt'), 'utf8'),
    'ORIGINAL-CASE-ALIAS');
});


test('W73-20 Windows case alias cannot bypass an orphan displaced original after journal loss', (t) => {
  if (process.platform !== 'win32') {
    t.skip('NTFS case-insensitive alias behavior requires Windows'); return;
  }
  const { backupPath } = createLegacyBackupFixture(t);
  const parent = tempDir(t, 'dk-v013-orphan-case-alias-');
  const targetRoot = path.join(parent, 'OriginalCaseProject');
  const aliasRoot = path.join(parent, 'originalcaseproject');
  fs.mkdirSync(targetRoot);
  fs.writeFileSync(path.join(targetRoot, 'original.txt'), 'ORIGINAL-ORPHAN');
  const first = restoreLegacyBackup({ backupPath, targetRoot, overwrite: true, confirmOffline: true });
  const moved = path.join(parent, 'unpersisted-published-root');
  fs.renameSync(targetRoot, moved);
  fs.unlinkSync(first.transactionLog); // Simulate journal namespace loss after an interrupted publication.
  assert.throws(
    () => restoreLegacyBackup({ backupPath, targetRoot: aliasRoot, confirmOffline: true }),
    /restore witnesses|restore.*journal|orphan.*restore|recovery journal/i,
    'An orphan retained original must not be silently superseded via case alias',
  );
  assert.equal(fs.existsSync(aliasRoot), false);
  assert.equal(fs.readFileSync(path.join(first.displacedOriginal, 'original.txt'), 'utf8'), 'ORIGINAL-ORPHAN');
});


test('W73-22 Windows native helper must prove operation-specific success before advancing recovery', () => {
  const probe = {
    path: 'C:\\dk\\parent', volumeRoot: 'C:\\', fileSystem: 'NTFS',
    driveType: 3, localFixed: true, supportedAutomaticRestore: true,
  };
  assert.deepEqual(validateWindowsDurabilityHelperResult('Probe', probe), probe);
  assert.throws(() => validateWindowsDurabilityHelperResult('Probe', {
    ...probe, supportedAutomaticRestore: false,
  }), /unsupported|profile|probe/i);

  const flush = { operation: 'FlushDirectory', profile: probe, flushed: true };
  assert.deepEqual(validateWindowsDurabilityHelperResult('FlushDirectory', flush), flush);
  for (const bad of [
    { ...flush, flushed: false },
    { ...flush, flushed: undefined },
    { ...flush, operation: 'Rename' },
    { ...flush, profile: { ...probe, supportedAutomaticRestore: false } },
  ]) assert.throws(() => validateWindowsDurabilityHelperResult('FlushDirectory', bad),
    /helper|flush|profile|operation/i);

  const rename = {
    operation: 'Rename', source: 'C:\\dk\\from', destination: 'C:\\dk\\to',
    profile: probe, renamed: true, parentFlushCompleted: true,
  };
  assert.deepEqual(validateWindowsDurabilityHelperResult('Rename', rename), rename);
  for (const bad of [
    { ...rename, renamed: false },
    { ...rename, renamed: undefined },
    { ...rename, parentFlushCompleted: false },
    { ...rename, parentFlushCompleted: undefined },
    { ...rename, operation: 'Probe' },
    { ...rename, profile: { ...probe, fileSystem: 'ReFS' } },
  ]) assert.throws(() => validateWindowsDurabilityHelperResult('Rename', bad),
    /helper|rename|profile|operation|flush/i);
});

test('W73-25 native Windows helper cannot acknowledge an unrelated filesystem path', () => {
  const profile = {
    path: 'C:\\dk\\parent', volumeRoot: 'C:\\', fileSystem: 'NTFS',
    driveType: 3, localFixed: true, supportedAutomaticRestore: true,
  };
  assert.deepEqual(
    validateWindowsDurabilityHelperResult('Probe', profile, { Path: profile.path }),
    profile,
  );
  assert.throws(
    () => validateWindowsDurabilityHelperResult('Probe', {
      ...profile, path: 'C:\\dk\\unrelated',
    }, { Path: profile.path }),
    /helper|path|profile|mismatch/i,
    'A supported NTFS profile for a different path is not evidence for the requested root',
  );

  const flush = { operation: 'FlushDirectory', profile, flushed: true };
  assert.deepEqual(
    validateWindowsDurabilityHelperResult('FlushDirectory', flush, { Path: profile.path }),
    flush,
  );
  assert.throws(
    () => validateWindowsDurabilityHelperResult('FlushDirectory', {
      ...flush, profile: { ...profile, path: 'C:\\dk\\unrelated' },
    }, { Path: profile.path }),
    /helper|path|profile|mismatch/i,
    'A flush of a different parent cannot acknowledge the requested namespace barrier',
  );

  const rename = {
    operation: 'Rename', source: 'C:\\dk\\stage', destination: 'C:\\dk\\project',
    profile: { ...profile, path: 'C:\\dk' }, renamed: true, parentFlushCompleted: true,
  };
  assert.deepEqual(
    validateWindowsDurabilityHelperResult('Rename', rename, {
      From: rename.source, To: rename.destination,
    }),
    rename,
  );
  for (const wrong of [
    { ...rename, source: 'C:\\dk\\unrelated' },
    { ...rename, destination: 'C:\\dk\\unrelated' },
    { ...rename, profile: { ...profile, path: 'C:\\dk\\unrelated' } },
  ]) {
    assert.throws(
      () => validateWindowsDurabilityHelperResult('Rename', wrong, {
        From: rename.source, To: rename.destination,
      }),
      /helper|path|profile|mismatch/i,
      'An unrelated rename or parent flush cannot acknowledge the requested transaction',
    );
  }
});

test('W73-21 Windows restore stage and promoted root preserve the original restrictive NTFS DACL', (t) => {
  if (process.platform !== 'win32') {
    t.skip('NTFS ACL fixture requires Windows'); return;
  }
  const { backupPath } = createLegacyBackupFixture(t);
  const parent = tempDir(t, 'dk-v013-ntfs-acl-');
  const targetRoot = path.join(parent, 'restricted-project');
  fs.mkdirSync(targetRoot);
  fs.writeFileSync(path.join(targetRoot, 'confidential.txt'), 'CONFIDENTIAL-ORIGINAL');

  function aclScript(script, location) {
    return spawnSync('powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', windowsHide: true, shell: false, timeout: 30000,
        env: { ...process.env, DKF_TEST_ACL_PATH: location } });
  }
  const restrict = aclScript([
    "$ErrorActionPreference='Stop'",
    '$acl=[System.IO.Directory]::GetAccessControl($env:DKF_TEST_ACL_PATH)',
    '$acl.SetAccessRuleProtection($true,$false)',
    '$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User',
    '$rights=[System.Security.AccessControl.FileSystemRights]::FullControl',
    '$flags=[System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit',
    '$rule=[System.Security.AccessControl.FileSystemAccessRule]::new($sid,$rights,$flags,[System.Security.AccessControl.PropagationFlags]::None,[System.Security.AccessControl.AccessControlType]::Allow)',
    '$acl.SetAccessRule($rule)',
    '[System.IO.Directory]::SetAccessControl($env:DKF_TEST_ACL_PATH,$acl)',
  ].join(';'), targetRoot);
  if (restrict.status !== 0) {
    t.skip('Host cannot create restrictive NTFS DACL fixture: ' + String(restrict.stderr).slice(0, 200));
    return;
  }
  function dacl(location) {
    const result = aclScript(
      "$ErrorActionPreference='Stop'; ([System.IO.Directory]::GetAccessControl($env:DKF_TEST_ACL_PATH)).GetSecurityDescriptorSddlForm([System.Security.AccessControl.AccessControlSections]::Access)",
      location,
    );
    assert.equal(result.status, 0, String(result.stderr));
    return result.stdout.trim();
  }
  const comparableDacl = (value) => value;
  const originalDacl = dacl(targetRoot);
  const fileDacl = (location) => {
    const result = aclScript(
      "$ErrorActionPreference='Stop'; ([System.IO.File]::GetAccessControl($env:DKF_TEST_ACL_PATH)).GetSecurityDescriptorSddlForm([System.Security.AccessControl.AccessControlSections]::Access)",
      location,
    );
    assert.equal(result.status, 0, String(result.stderr));
    return result.stdout.trim();
  };
  const originalFileDacl = fileDacl(path.join(targetRoot, 'confidential.txt'));
  assert.notEqual(originalDacl, dacl(parent), 'Fixture must differ from inherited parent DACL');

  const originalCp = fs.cpSync;
  let stageInspected = false;
  fs.cpSync = function verifyPrivateStageBeforeCopy(source, destination, ...options) {
    if (path.resolve(source) === path.resolve(targetRoot)) {
      stageInspected = true;
      assert.match(dacl(destination), /^D:P/,
        'Restore stage must be private and protected before sensitive data copy');
    }
    return originalCp.call(this, source, destination, ...options);
  };
  try {
    try {
      restoreLegacyBackup({ backupPath, targetRoot, overwrite: true, confirmOffline: true });
    } catch (error) {
      assert.fail('W73-21 restore error: ' + error.message + ' details=' + JSON.stringify(error.details));
    }
  } finally {
    fs.cpSync = originalCp;
  }
  assert.equal(stageInspected, true);
  assert.equal(comparableDacl(dacl(targetRoot)), comparableDacl(originalDacl),
    'Promoted root must preserve source DACL protection and ACEs');
  assert.equal(comparableDacl(fileDacl(path.join(targetRoot, 'confidential.txt'))),
    comparableDacl(originalFileDacl),
    'Original file DACL must survive staged copy and promotion');
  assert.equal(fs.readFileSync(path.join(targetRoot, 'confidential.txt'), 'utf8'), 'CONFIDENTIAL-ORIGINAL');
});

test('W73-23 native ACL helper responses must be explicit and path-bound', () => {
  const stage = { operation: 'CreateSecureStage', path: 'C:\\dk\\stage', protected: true };
  assert.deepEqual(validateWindowsDurabilityHelperResult('CreateSecureStage', stage,
    { Path: 'C:\\dk\\stage' }), stage);
  for (const invalid of [
    { ...stage, protected: false },
    { ...stage, path: 'C:\\dk\\other' },
    { ...stage, operation: 'Rename' },
  ]) {
    assert.throws(() => validateWindowsDurabilityHelperResult('CreateSecureStage', invalid,
      { Path: 'C:\\dk\\stage' }), /helper|stage|path|operation|protect/i);
  }

  const tree = { operation: 'CopyAclTree', source: 'C:\\dk\\source',
    destination: 'C:\\dk\\stage', verified: true };
  assert.deepEqual(validateWindowsDurabilityHelperResult('CopyAclTree', tree,
    { From: 'C:\\dk\\source', To: 'C:\\dk\\stage' }), tree);
  for (const invalid of [
    { ...tree, verified: false },
    { ...tree, source: 'C:\\dk\\wrong' },
    { ...tree, destination: 'C:\\dk\\wrong' },
    { ...tree, operation: 'Rename' },
  ]) {
    assert.throws(() => validateWindowsDurabilityHelperResult('CopyAclTree', invalid,
      { From: 'C:\\dk\\source', To: 'C:\\dk\\stage' }),
      /helper|acl|path|operation|source|destination/i);
  }
});


test('W73-24 staged confidential child is never copied under a broader root DACL', (t) => {
  if (process.platform !== 'win32') {
    t.skip('NTFS DACL isolation requires Windows'); return;
  }
  const { backupPath } = createLegacyBackupFixture(t);
  const parent = tempDir(t, 'dk-v013-ntfs-private-stage-');
  const targetRoot = path.join(parent, 'mixed-access-project');
  const child = path.join(targetRoot, 'confidential.txt');
  fs.mkdirSync(targetRoot);
  fs.writeFileSync(child, 'CONFIDENTIAL-ORIGINAL');

  function ps(script, location) {
    return spawnSync('powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', windowsHide: true, shell: false, timeout: 30000,
        env: { ...process.env, DKF_TEST_ACL_PATH: location } });
  }
  const aclSetup = ps([
    "$ErrorActionPreference='Stop'",
    '$root=$env:DKF_TEST_ACL_PATH',
    '$user=[System.Security.Principal.WindowsIdentity]::GetCurrent().User',
    '$everyone=[System.Security.Principal.SecurityIdentifier]::new("S-1-1-0")',
    '$full=[System.Security.AccessControl.FileSystemRights]::FullControl',
    '$read=[System.Security.AccessControl.FileSystemRights]::ReadAndExecute',
    '$inherit=[System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit',
    '$allow=[System.Security.AccessControl.AccessControlType]::Allow',
    '$none=[System.Security.AccessControl.PropagationFlags]::None',
    '$acl=[System.IO.Directory]::GetAccessControl($root)',
    '$acl.SetAccessRuleProtection($true,$false)',
    '$acl.SetAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($user,$full,$inherit,$none,$allow))',
    '$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($everyone,$read,$inherit,$none,$allow))',
    '[System.IO.Directory]::SetAccessControl($root,$acl)',
    '$file=[System.IO.File]::GetAccessControl([System.IO.Path]::Combine($root,"confidential.txt"))',
    '$file.SetAccessRuleProtection($true,$false)',
    '$file.SetAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($user,$full,$allow))',
    '[System.IO.File]::SetAccessControl([System.IO.Path]::Combine($root,"confidential.txt"),$file)',
  ].join(';'), targetRoot);
  assert.equal(aclSetup.status, 0, 'Windows DACL fixture must execute: ' + String(aclSetup.stderr));
  function dacl(location, kind = 'Directory') {
    const z = ps("$ErrorActionPreference='Stop'; ([System.IO." + kind +
      "]::GetAccessControl($env:DKF_TEST_ACL_PATH)).GetSecurityDescriptorSddlForm([System.Security.AccessControl.AccessControlSections]::Access)",
      location);
    assert.equal(z.status, 0, String(z.stderr));
    return z.stdout.trim();
  }
  const rootAcl = dacl(targetRoot);
  const childAcl = dacl(child, 'File');
  assert.match(rootAcl, /;;;WD\)/, 'Fixture root must grant Everyone read access');
  assert.doesNotMatch(childAcl, /;;;WD\)/, 'Fixture confidential child must deny Everyone access');

  const originalCp = fs.cpSync;
  let inspected = false;
  fs.cpSync = function assertPrivateStageDuringCopy(source, destination, ...args) {
    if (path.resolve(source) === path.resolve(targetRoot)) {
      inspected = true;
      const before = dacl(destination);
      assert.match(before, /^D:P/, 'Stage root must have protected private DACL before copy');
      assert.doesNotMatch(before, /;;;WD\)/, 'Stage root must not expose confidential children');
      const result = originalCp.call(this, source, destination, ...args);
      const during = dacl(destination);
      assert.match(during, /^D:P/, 'Stage must remain private until child ACLs are restored');
      assert.doesNotMatch(during, /;;;WD\)/, 'Copied confidential bytes must remain private');
      return result;
    }
    return originalCp.call(this, source, destination, ...args);
  };
  try {
    restoreLegacyBackup({ backupPath, targetRoot, overwrite: true, confirmOffline: true });
  } finally {
    fs.cpSync = originalCp;
  }
  assert.equal(inspected, true, 'Test must observe the real copy boundary');
  assert.equal(dacl(targetRoot), rootAcl, 'Published root must preserve the original DACL');
  assert.equal(dacl(path.join(targetRoot, 'confidential.txt'), 'File'), childAcl,
    'Published confidential child must preserve its more restrictive DACL');
});
