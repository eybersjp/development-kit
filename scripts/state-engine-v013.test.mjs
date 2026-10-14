import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  appendMetadataEvent,
  getStateEnginePaths,
  loadCanonicalEvents,
  loadStateSnapshot,
  rebuildStateIndex,
  verifyStateEngineIntegrity,
} from '../runtime/orchestration/state-engine-v2.mjs';
import {
  getLegacyBackupPath,
  migrateLegacyStateToV2,
  recoverLegacyRestore,
  restoreLegacyBackup,
} from '../runtime/orchestration/state-engine-migration.mjs';
import { createInitialState } from '../runtime/autopilot/transition-model.mjs';
import { saveStateRevision } from '../runtime/autopilot/state-store.mjs';

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
