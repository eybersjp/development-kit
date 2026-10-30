import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync as requireSpawnSync } from 'node:child_process';

import {
  appendEntityState,
  canonicalStateJson,
  countStateEngineFiles,
  getStateEnginePaths,
  loadCanonicalEvents,
  loadEntityState,
  verifyStateEngineIntegrity,
} from '../runtime/orchestration/state-engine-v2.mjs';
import {
  getLegacyBackupPath,
  inspectLegacyState,
  migrateLegacyStateToV2,
  restoreLegacyBackup,
  recoverLegacyRestore,
} from '../runtime/orchestration/state-engine-migration.mjs';
import {
  getCurrentState,
  saveStateRevision,
} from '../runtime/autopilot/state-store.mjs';
import {
  loadCurrentRunState,
} from '../runtime/orchestration/orchestration-run.mjs';

function tempProject(t, prefix = 'dk-state-migration-') {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  return rootDir;
}

function workflowState(revision, workflowId = 'wf-legacy-001') {
  return {
    schemaVersion: '1.0.0',
    workflowId,
    projectId: 'proj-legacy',
    workspaceId: 'ws-legacy',
    workflowMode: 'autopilot',
    autonomyLevel: 'guided-autopilot',
    workflowStatus: revision === 26 ? 'paused' : 'executing',
    currentStage: revision >= 20 ? 'IMPLEMENT' : revision >= 10 ? 'DESIGN' : 'UNDERSTAND',
    completedStages: revision >= 10 ? ['UNDERSTAND', 'DEFINE'] : [],
    skippedStages: [],
    blockedStages: [],
    activeAction: null,
    pendingApproval: null,
    pendingConfirmation: null,
    activeDecisionMenu: null,
    stateRevision: revision,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: new Date(Date.parse('2026-09-01T00:00:00.000Z') + revision * 1000).toISOString(),
    frameworkVersion: '0.11.2',
  };
}

function writeLegacyAutopilot(rootDir, count = 26) {
  const stateDir = path.join(rootDir, '.development-kit', 'autopilot', 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  const workflowId = 'wf-legacy-001';
  for (let revision = 1; revision <= count; revision += 1) {
    const name = 'revision-' + String(revision).padStart(6, '0') + '.json';
    fs.writeFileSync(
      path.join(stateDir, name),
      JSON.stringify(workflowState(revision, workflowId), null, 2) + '\n',
      'utf8',
    );
  }
  fs.writeFileSync(
    path.join(stateDir, 'current.json'),
    JSON.stringify({
      currentRevision: count,
      currentRevisionFile: 'revision-' + String(count).padStart(6, '0') + '.json',
      workflowId,
      updatedAt: '2026-09-01T01:00:00.000Z',
    }, null, 2) + '\n',
    'utf8',
  );
  return { stateDir, workflowId, current: workflowState(count, workflowId) };
}

function runState(revision, state = 'READY', acceptanceState = 'PENDING') {
  return {
    schemaVersion: '1.0.0',
    contractId: 'INC-LEGACY-RUN',
    taskId: 'TASK-LEGACY-RUN',
    runId: 'run-legacy-001',
    sourceFingerprint: 'sha256:' + 'b'.repeat(64),
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: new Date(Date.parse('2026-09-02T00:00:00.000Z') + revision * 1000).toISOString(),
    stateRevision: revision,
    state,
    executionStrategy: 'sequential-fresh-context',
    hostCapabilities: {
      fileRead: true,
      fileWrite: true,
      shell: true,
      git: true,
      freshContext: true,
      subagents: false,
      parallelAgents: false,
      browser: false,
      visualInspection: false,
      externalModelRouting: false,
    },
    manualEvidenceRequired: false,
    requiredGates: {
      verification: ['specification', 'tests'],
      reviewers: ['code-reviewer'],
      controlDomains: [],
      humanApprovals: [],
      configurationReadiness: { required: false },
    },
    completedGates: state === 'ACCEPTED' ? ['specification', 'tests', 'code-reviewer'] : [],
    correctionAttempt: 0,
    failureSignatures: [],
    verificationVerdict: state === 'ACCEPTED' ? 'PASS' : null,
    acceptanceState,
  };
}

function writeLegacyRun(rootDir) {
  const run1 = runState(1, 'READY', 'PENDING');
  const run2 = runState(2, 'VERIFYING', 'PENDING');
  const run3 = runState(3, 'ACCEPTED', 'ACCEPTED');
  const runDir = path.join(
    rootDir,
    '.development-kit',
    'runs',
    run1.contractId,
    run1.runId,
  );
  const revisions = path.join(runDir, 'state-revisions');
  fs.mkdirSync(revisions, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(run1, null, 2) + '\n', 'utf8');
  for (const run of [run1, run2, run3]) {
    const name = String(run.stateRevision).padStart(8, '0') + '.json';
    fs.writeFileSync(path.join(revisions, name), JSON.stringify(run, null, 2) + '\n', 'utf8');
  }
  fs.writeFileSync(
    path.join(runDir, 'current-state.json'),
    JSON.stringify({
      schemaVersion: '1.0.0',
      contractId: run3.contractId,
      runId: run3.runId,
      stateRevision: run3.stateRevision,
      revisionPath: 'state-revisions/00000003.json',
    }, null, 2) + '\n',
    'utf8',
  );
  fs.writeFileSync(path.join(runDir, 'final-state.json'), JSON.stringify(run3, null, 2) + '\n', 'utf8');
  return { runDir, current: run3 };
}

test('AC-015 unmigrated legacy Autopilot projects remain on legacy state until migration', (t) => {
  const rootDir = tempProject(t);
  const legacy = writeLegacyAutopilot(rootDir, 2);
  assert.deepEqual(getCurrentState(rootDir), legacy.current);

  const third = workflowState(3, legacy.workflowId);
  saveStateRevision(third, rootDir);
  assert.equal(
    fs.existsSync(path.join(legacy.stateDir, 'revision-000003.json')),
    true,
  );
  assert.deepEqual(getCurrentState(rootDir), third);
  assert.equal(fs.existsSync(path.join(rootDir, '.development-kit', 'state')), false);
});

test('AC-015 partial V2 import cannot cut over an existing legacy project before MIGRATION_COMPLETED', (t) => {
  const rootDir = tempProject(t);
  const legacy = writeLegacyAutopilot(rootDir, 2);

  const partial = workflowState(2, legacy.workflowId);
  partial.currentStage = 'REVIEW';
  appendEntityState({
    rootDir,
    entityType: 'autopilot-workflow',
    entityId: legacy.workflowId,
    state: partial,
    actorClass: 'legacy-migration',
    timestamp: partial.updatedAt,
  });

  // A partially imported V2 entity exists, but there is no verified
  // MIGRATION_COMPLETED event. The legacy store must therefore remain canonical.
  const beforeCompletion = getCurrentState(rootDir);
  assert.equal(beforeCompletion.currentStage, legacy.current.currentStage);
  assert.notEqual(beforeCompletion.currentStage, partial.currentStage);

  const nextLegacy = workflowState(3, legacy.workflowId);
  saveStateRevision(nextLegacy, rootDir);
  assert.equal(
    fs.existsSync(path.join(legacy.stateDir, 'revision-000003.json')),
    true,
  );
  assert.equal(getCurrentState(rootDir).stateRevision, 3);
});

test('AC-015 legacy migration is idempotent, semantically equivalent, and retains recoverable legacy state', (t) => {
  const rootDir = tempProject(t);
  const legacy = writeLegacyAutopilot(rootDir, 26);
  const inspection = inspectLegacyState(rootDir);
  assert.equal(inspection.legacyFileCount, 27);
  assert.equal(inspection.entityCount, 1);

  const first = migrateLegacyStateToV2({
    rootDir,
    completedAt: '2026-10-07T18:30:00.000Z',
  });
  assert.equal(first.migrated, true);
  assert.equal(first.idempotent, false);
  assert.equal(first.semanticEquivalence, true);
  assert.equal(first.legacyRetained, true);
  assert.equal(canonicalStateJson(getCurrentState(rootDir)), canonicalStateJson(legacy.current));
  assert.equal(canonicalStateJson(
    loadEntityState('autopilot-workflow', legacy.workflowId, rootDir),
  ), canonicalStateJson(legacy.current));
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);

  for (let revision = 1; revision <= 26; revision += 1) {
    assert.equal(
      fs.existsSync(path.join(
        legacy.stateDir,
        'revision-' + String(revision).padStart(6, '0') + '.json',
      )),
      true,
    );
  }
  assert.equal(fs.existsSync(path.join(legacy.stateDir, 'current.json')), true);
  assert.equal(fs.existsSync(getLegacyBackupPath(rootDir)), true);

  const eventsBefore = loadCanonicalEvents(rootDir).length;
  const second = migrateLegacyStateToV2({
    rootDir,
    completedAt: '2026-10-07T18:31:00.000Z',
  });
  assert.equal(second.migrated, false);
  assert.equal(second.idempotent, true);
  assert.equal(loadCanonicalEvents(rootDir).length, eventsBefore);
});

test('AC-015 completed migration remains idempotent after legitimate V2 progress', (t) => {
  const rootDir = tempProject(t);
  const legacy = writeLegacyAutopilot(rootDir, 3);
  const first = migrateLegacyStateToV2({
    rootDir,
    completedAt: '2026-10-07T18:31:30.000Z',
  });
  assert.equal(first.migrated, true);

  const progressed = workflowState(4, legacy.workflowId);
  progressed.currentStage = 'VERIFY';
  appendEntityState({
    rootDir,
    entityType: 'autopilot-workflow',
    entityId: legacy.workflowId,
    state: progressed,
    actorClass: 'autopilot',
    timestamp: progressed.updatedAt,
  });

  const eventCountBefore = loadCanonicalEvents(rootDir).length;
  const rerun = migrateLegacyStateToV2({
    rootDir,
    completedAt: '2026-10-07T18:31:40.000Z',
  });

  assert.equal(rerun.migrated, false);
  assert.equal(rerun.idempotent, true);
  assert.equal(loadCanonicalEvents(rootDir).length, eventCountBefore);
  assert.equal(getCurrentState(rootDir).stateRevision, 4);
  assert.equal(getCurrentState(rootDir).currentStage, 'VERIFY');
});

test('AC-015 bundled legacy backup can restore the complete legacy state chain', (t) => {
  const rootDir = tempProject(t);
  writeLegacyAutopilot(rootDir, 5);
  migrateLegacyStateToV2({
    rootDir,
    completedAt: '2026-10-07T18:32:00.000Z',
  });

  const restoreRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-state-restore-'));
  t.after(() => fs.rmSync(restoreRoot, { recursive: true, force: true }));
  const restored = restoreLegacyBackup({ confirmOffline: true,
    backupPath: getLegacyBackupPath(rootDir),
    targetRoot: restoreRoot,
  });
  assert.equal(restored.restoredFiles.length, 6);

  for (let revision = 1; revision <= 5; revision += 1) {
    assert.equal(fs.existsSync(path.join(
      restoreRoot,
      '.development-kit',
      'autopilot',
      'state',
      'revision-' + String(revision).padStart(6, '0') + '.json',
    )), true);
  }
  assert.equal(fs.existsSync(path.join(
    restoreRoot,
    '.development-kit',
    'autopilot',
    'state',
    'current.json',
  )), true);
});

test('AC-015 missing Autopilot revision fails closed before migration cutover', (t) => {
  const rootDir = tempProject(t);
  const legacy = writeLegacyAutopilot(rootDir, 4);
  fs.rmSync(path.join(legacy.stateDir, 'revision-000002.json'));

  assert.throws(
    () => migrateLegacyStateToV2({ rootDir }),
    /revision chain is missing revision-000002\.json/,
  );
  assert.equal(fs.existsSync(path.join(rootDir, '.development-kit', 'state')), false);
});

test('AC-015 missing orchestration revision and manifest mismatch fail closed', (t) => {
  const rootDir = tempProject(t);
  const legacy = writeLegacyRun(rootDir);
  fs.rmSync(path.join(legacy.runDir, 'state-revisions', '00000002.json'));

  assert.throws(
    () => migrateLegacyStateToV2({ rootDir }),
    /revision chain is missing 00000002\.json/,
  );
  assert.equal(fs.existsSync(path.join(rootDir, '.development-kit', 'state')), false);

  // Restore revision 2 and then corrupt revision 1 relative to manifest.
  const run2 = runState(2, 'VERIFYING', 'PENDING');
  fs.writeFileSync(
    path.join(legacy.runDir, 'state-revisions', '00000002.json'),
    JSON.stringify(run2, null, 2) + '\n',
    'utf8',
  );
  const run1 = runState(1, 'IMPLEMENTING', 'PENDING');
  fs.writeFileSync(
    path.join(legacy.runDir, 'state-revisions', '00000001.json'),
    JSON.stringify(run1, null, 2) + '\n',
    'utf8',
  );

  assert.throws(
    () => migrateLegacyStateToV2({ rootDir }),
    /revision 1 differs from immutable manifest/,
  );
  assert.equal(fs.existsSync(path.join(rootDir, '.development-kit', 'state')), false);
});

test('AC-015 corrupted legacy input fails closed before State Engine cutover', (t) => {
  const rootDir = tempProject(t);
  const legacy = writeLegacyAutopilot(rootDir, 3);
  fs.writeFileSync(path.join(legacy.stateDir, 'revision-000002.json'), '{"broken":', 'utf8');

  assert.throws(
    () => migrateLegacyStateToV2({ rootDir }),
    /invalid JSON/,
  );
  assert.equal(fs.existsSync(path.join(rootDir, '.development-kit', 'state')), false);
  assert.equal(fs.existsSync(path.join(legacy.stateDir, 'current.json')), true);
});

test('AC-015 partial orchestration import cannot override legacy current state before verified migration completion', (t) => {
  const rootDir = tempProject(t);
  const legacy = writeLegacyRun(rootDir);

  const partial = structuredClone(legacy.current);
  partial.state = 'BLOCKED';
  partial.acceptanceState = 'BLOCKED';
  appendEntityState({
    rootDir,
    entityType: 'orchestration-run',
    entityId: partial.contractId + '/' + partial.runId,
    state: partial,
    refs: {
      contractId: partial.contractId,
      taskId: partial.taskId,
      runId: partial.runId,
    },
    actorClass: 'legacy-migration',
    timestamp: partial.updatedAt,
  });

  const current = loadCurrentRunState(
    legacy.current.contractId,
    legacy.current.runId,
    rootDir,
  );
  assert.equal(current.state, 'ACCEPTED');
  assert.equal(current.acceptanceState, 'ACCEPTED');
});

test('AC-015 orchestration migration preserves ACCEPTED meaning and switches current-state reads to V2', (t) => {
  const rootDir = tempProject(t);
  const legacy = writeLegacyRun(rootDir);
  const before = loadCurrentRunState(
    legacy.current.contractId,
    legacy.current.runId,
    rootDir,
  );
  assert.equal(before.state, 'ACCEPTED');
  assert.equal(before.acceptanceState, 'ACCEPTED');

  const migrated = migrateLegacyStateToV2({
    rootDir,
    completedAt: '2026-10-07T18:33:00.000Z',
  });
  assert.equal(migrated.semanticEquivalence, true);

  const v2 = loadEntityState(
    'orchestration-run',
    legacy.current.contractId + '/' + legacy.current.runId,
    rootDir,
  );
  assert.equal(canonicalStateJson(v2), canonicalStateJson(legacy.current));

  const after = loadCurrentRunState(
    legacy.current.contractId,
    legacy.current.runId,
    rootDir,
  );
  assert.equal(after.state, 'ACCEPTED');
  assert.equal(after.acceptanceState, 'ACCEPTED');
  assert.equal(after.verificationVerdict, 'PASS');

  assert.equal(fs.existsSync(path.join(legacy.runDir, 'state-revisions', '00000003.json')), true);
  assert.equal(fs.existsSync(path.join(legacy.runDir, 'current-state.json')), true);
  assert.equal(fs.existsSync(path.join(legacy.runDir, 'final-state.json')), true);
});

test('AC-034 representative 26-revision migration exceeds the >=80% active canonical micro-file reduction objective', (t) => {
  const rootDir = tempProject(t);
  writeLegacyAutopilot(rootDir, 26);
  const legacyCount = inspectLegacyState(rootDir).legacyFileCount;
  assert.equal(legacyCount, 27);

  migrateLegacyStateToV2({
    rootDir,
    completedAt: '2026-10-07T18:34:00.000Z',
  });

  const canonicalFiles = countStateEngineFiles(rootDir);
  const reductionPercent = Number((((legacyCount - canonicalFiles) / legacyCount) * 100).toFixed(2));
  process.stdout.write('T04_STATE_FILE_EVIDENCE ' + JSON.stringify({
    legacyTransitionStateFiles: legacyCount,
    stateEngineCanonicalFilesIncludingRecoveryBundle: canonicalFiles,
    reductionPercent,
    legacyFilesRetainedForRecovery: true,
  }) + '\n');

  assert.equal(canonicalFiles, 5);
  assert.equal(reductionPercent, 81.48);
  assert.ok(reductionPercent >= 80);

  const paths = getStateEnginePaths(rootDir);
  for (const required of ['events', 'snapshot', 'index', 'schema']) {
    assert.equal(fs.existsSync(paths[required]), true);
  }
  assert.equal(fs.existsSync(getLegacyBackupPath(rootDir)), true);
});


test('T04-H05 restore refuses a preexisting symlink/junction parent and leaves outside directory untouched', (t) => {
  const rootDir = tempProject(t, 'dk-restore-source-');
  writeLegacyAutopilot(rootDir, 2);
  const migrated = migrateLegacyStateToV2({ rootDir });
  const restoreRoot = tempProject(t, 'dk-restore-target-');
  const outside = tempProject(t, 'dk-restore-outside-');
  const dkRoot = path.join(restoreRoot, '.development-kit');
  fs.mkdirSync(dkRoot, { recursive: true });
  try {
    fs.symlinkSync(outside, path.join(dkRoot, 'autopilot'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip('Host does not permit directory symlink/junction creation');
      return;
    }
    throw error;
  }
  assert.throws(
    () => restoreLegacyBackup({ confirmOffline: true, backupPath: migrated.backupPath, targetRoot: restoreRoot }),
    /symbolic link|junction|escapes/i,
  );
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('T04-H06 restore refuses a final-file symlink even when overwrite is explicitly enabled', (t) => {
  const rootDir = tempProject(t, 'dk-restore-source-');
  writeLegacyAutopilot(rootDir, 2);
  const migrated = migrateLegacyStateToV2({ rootDir });
  const restoreRoot = tempProject(t, 'dk-restore-target-');
  const outside = tempProject(t, 'dk-restore-outside-');
  const filename = path.join(outside, 'should-not-change.json');
  fs.writeFileSync(filename, 'SAFE', 'utf8');
  const parent = path.join(restoreRoot, '.development-kit', 'autopilot', 'state');
  fs.mkdirSync(parent, { recursive: true });
  try {
    fs.symlinkSync(filename, path.join(parent, 'revision-000001.json'), 'file');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip('Host does not permit file symlink creation');
      return;
    }
    throw error;
  }
  assert.throws(
    () => restoreLegacyBackup({ confirmOffline: true, backupPath: migrated.backupPath, targetRoot: restoreRoot, overwrite: true }),
    /regular file|symbolic link|junction/i,
  );
  assert.equal(fs.readFileSync(filename, 'utf8'), 'SAFE');
});


test('T04-H13 backup restore rejects a hard-linked overwrite destination', (t) => {
  const rootDir = tempProject(t, 'dk-hardlink-source-');
  writeLegacyAutopilot(rootDir, 2);
  const migrated = migrateLegacyStateToV2({ rootDir });
  const restoreRoot = tempProject(t, 'dk-hardlink-target-');
  const outside = tempProject(t, 'dk-hardlink-outside-');
  const external = path.join(outside, 'protected.json');
  fs.writeFileSync(external, 'PROTECTED', 'utf8');
  const destinationDir = path.join(restoreRoot, '.development-kit', 'autopilot', 'state');
  fs.mkdirSync(destinationDir, { recursive: true });
  const destination = path.join(destinationDir, 'revision-000001.json');
  try {
    fs.linkSync(external, destination);
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP', 'EXDEV'].includes(error.code)) {
      t.skip('Filesystem disallows hard-link fixture');
      return;
    }
    throw error;
  }
  assert.throws(
    () => restoreLegacyBackup({ confirmOffline: true, backupPath: migrated.backupPath, targetRoot: restoreRoot, overwrite: true }),
    /hard.?link|multiple links/i,
  );
  assert.equal(fs.readFileSync(external, 'utf8'), 'PROTECTED');
});


test('T04-H19 restoring a backup cannot write through a destination hardlink swapped at open time', (t) => {
  const source = tempProject(t, 'dk-restore-race-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const targetRoot = tempProject(t, 'dk-restore-race-target-');
  const protectedRoot = tempProject(t, 'dk-restore-race-outside-');
  const victim = path.join(protectedRoot, 'external.json');
  fs.writeFileSync(victim, 'EXTERNAL-CONTENT', 'utf8');
  const parent = path.join(targetRoot, '.development-kit', 'autopilot', 'state');
  fs.mkdirSync(parent, {recursive:true});
  const destination = path.join(parent, 'revision-000001.json');
  fs.writeFileSync(destination, 'stale value', 'utf8');
  const originalOpen = fs.openSync;
  let swapped = false;
  fs.openSync = function swappedAtDestinationOpen(file, flags, ...rest) {
    if (!swapped && file === destination) {
      swapped = true;
      fs.rmSync(destination);
      fs.linkSync(victim, destination);
    }
    return originalOpen.call(this, file, flags, ...rest);
  };
  try {
    const restored = restoreLegacyBackup({ confirmOffline: true, backupPath:migrated.backupPath, targetRoot, overwrite:true });
    assert.ok(restored.restoredFiles.includes('.development-kit/autopilot/state/revision-000001.json'));
  } finally {
    fs.openSync = originalOpen;
  }
  assert.equal(fs.readFileSync(victim, 'utf8'), 'EXTERNAL-CONTENT');
  assert.equal(JSON.parse(fs.readFileSync(destination, 'utf8')).stateRevision, 1);
});


test('T04-H20 restore never creates target-tree directories before atomic staged promotion', (t) => {
  const source = tempProject(t, 'dk-restore-stage-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const targetRoot = tempProject(t, 'dk-restore-stage-target-');
  const originalMkdir = fs.mkdirSync;
  let attemptedUnsafeWrite = false;
  fs.mkdirSync = function blockPrepromotionTargetWrites(directory, ...args) {
    const relative = path.relative(targetRoot, path.resolve(directory));
    if (relative && relative !== '..' && !relative.startsWith('..' + path.sep)
      && !path.isAbsolute(relative)) {
      attemptedUnsafeWrite = true;
      throw new Error('restore preflight attempted a direct target-directory mutation');
    }
    return originalMkdir.call(this, directory, ...args);
  };
  try {
    const restored = restoreLegacyBackup({ confirmOffline: true, backupPath: migrated.backupPath, targetRoot });
    assert.equal(restored.restoredFiles.length, 3);
  } finally {
    fs.mkdirSync = originalMkdir;
  }
  assert.equal(attemptedUnsafeWrite, false);
  const pathToRestored = path.join(targetRoot, '.development-kit', 'autopilot', 'state', 'revision-000001.json');
  assert.equal(JSON.parse(fs.readFileSync(pathToRestored, 'utf8')).stateRevision, 1);
});


test('T04-H21 stage-promoted restore supports an absent root within an existing parent directory', (t) => {
  const source = tempProject(t, 'dk-restore-newroot-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const parent = tempProject(t, 'dk-restore-newroot-parent-');
  const root = path.join(parent, 'new-restore-root');
  assert.equal(fs.existsSync(root), false);
  const restored = restoreLegacyBackup({ confirmOffline: true, backupPath: migrated.backupPath, targetRoot: root });
  assert.equal(restored.restoredFiles.length, 3);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(root, '.development-kit','autopilot','state','revision-000001.json'), 'utf8')).stateRevision,
    1,
  );
});


test('T04-H23 staged restore preserves the existing destination root mode and ownership', (t) => {
  if (process.platform === 'win32') {
    t.skip('POSIX mode/uid semantics are not portable to Windows'); return;
  }
  const source = tempProject(t, 'dk-mode-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const targetRoot = tempProject(t, 'dk-mode-target-');
  fs.chmodSync(targetRoot, 0o755);
  const before = fs.statSync(targetRoot);
  restoreLegacyBackup({ confirmOffline: true, backupPath: migrated.backupPath, targetRoot });
  const after = fs.statSync(targetRoot);
  assert.equal(after.mode & 0o7777, before.mode & 0o7777);
  assert.equal(after.uid, before.uid);
  assert.equal(after.gid, before.gid);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(targetRoot,'.development-kit','autopilot','state','revision-000001.json'),'utf8')).stateRevision,
    1,
  );
});


test('T04-H24 legacy restore requires explicit offline capability', (t) => {
  const source = tempProject(t, 'dk-offline-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const root = tempProject(t, 'dk-offline-target-');
  assert.throws(() => restoreLegacyBackup({ backupPath: migrated.backupPath, targetRoot: root }),
    /offline confirmation/i);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('T04-H25 interrupted two-step root promotion can restore original using journal', (t) => {
  const source = tempProject(t, 'dk-crash-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const root = tempProject(t, 'dk-crash-target-');
  const sentinel = path.join(root, 'persist-original.txt');
  fs.writeFileSync(sentinel, 'ORIGINAL');
  const originalRename = fs.renameSync;
  const originalWrite = fs.writeFileSync;
  let movedRoot = false;
  let failureInjected = false;
  if (process.platform === 'win32') {
    // Windows uses the native helper for renames. Inject immediately after
    // the durable ORIGINAL_DISPLACED log write, before stage promotion.
    fs.writeFileSync = function injectWindowsRestoreFailure(fd, content, ...args) {
      const result = originalWrite.call(this, fd, content, ...args);
      if (!failureInjected && typeof fd === 'number' &&
          String(content).includes('"phase":"ORIGINAL_DISPLACED"')) {
        failureInjected = true;
        throw new Error('simulated crash between displacement and promotion');
      }
      return result;
    };
  } else {
    fs.renameSync = function injectPowerFailure(oldPath, nextPath, ...args) {
      if (movedRoot && !failureInjected && typeof oldPath === 'string' &&
        oldPath.includes('.dk-legacy-restore-stage-') && nextPath === root) {
        failureInjected = true;
        throw new Error('simulated crash between displacement and promotion');
      }
      if (oldPath === root && String(nextPath).endsWith('-original')) movedRoot = true;
      return originalRename.call(this, oldPath, nextPath, ...args);
    };
  }
  try {
    assert.throws(() => restoreLegacyBackup({
      confirmOffline: true, backupPath: migrated.backupPath, targetRoot: root,
    }), /simulated crash/);
    assert.equal(failureInjected, true, 'The intended crash boundary must actually be reached');
  } finally {
    fs.renameSync = originalRename;
    fs.writeFileSync = originalWrite;
  }
  // If the in-process finally managed the rollback, the leftover journal is
  // still authoritative. Recovery must be idempotent and must never erase it.
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'ORIGINAL');
  assert.throws(() => restoreLegacyBackup({
    confirmOffline:true, backupPath:migrated.backupPath, targetRoot:root,
  }), /Incomplete legacy restore/i);
  assert.throws(() => recoverLegacyRestore({ targetRoot: root }), /offline confirmation/i);
  const recovered = recoverLegacyRestore({ targetRoot: root, confirmOffline: true });
  assert.equal(recovered.recovered, true);
  assert.equal(fs.readFileSync(sentinel,'utf8'), 'ORIGINAL');
  assert.equal(recoverLegacyRestore({ targetRoot: root, confirmOffline: true }).recovered, false);
  const restored = restoreLegacyBackup({
    confirmOffline:true, backupPath:migrated.backupPath, targetRoot:root,
  });
  assert.equal(restored.restoredFiles.length, 3);
  assert.equal(fs.readFileSync(path.join(root,'persist-original.txt'),'utf8'),'ORIGINAL');
});


test('T04-H28 restore journals preserve original after a simulated process death between root renames', (t) => {
  const source = tempProject(t, 'dk-crash-worker-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const root = tempProject(t, 'dk-crash-worker-target-');
  const sentinel = path.join(root, 'original.txt');
  fs.writeFileSync(sentinel, 'KEEP-ME', 'utf8');

  const script = [
    'import fs from "node:fs";',
    'import {restoreLegacyBackup} from '+JSON.stringify(new URL('../runtime/orchestration/state-engine-migration.mjs', import.meta.url).href)+';',
    'const backup=process.argv[1],root=process.argv[2],rename=fs.renameSync,write=fs.writeFileSync;',
    'if(process.platform==="win32") {',
    ' fs.writeFileSync=function(fd,content,...rest){',
    '  const out=write.call(this,fd,content,...rest);',
    '  if(typeof fd==="number" && String(content).includes(\'"phase":"ORIGINAL_DISPLACED"\')) process.exit(91);',
    '  return out;',
    ' };',
    '} else {',
    ' fs.renameSync=function(a,b,...rest){',
    '  if(a===root && String(b).endsWith("-original")) {const out=rename.call(this,a,b,...rest);process.exit(91);}',
    '  return rename.call(this,a,b,...rest);',
    ' };',
    '}',
    'restoreLegacyBackup({backupPath:backup,targetRoot:root,confirmOffline:true});',
  ].join('\n');
  // spawnSync is intentionally used for a true process exit instead of a
  // caught synchronous exception that runs finally/rollback.
  const result = requireSpawnSync(process.execPath, ['--input-type=module','-e',script,migrated.backupPath,root]);
  assert.equal(result.status, 91, result.stderr);
  assert.equal(fs.existsSync(root), false);
  assert.throws(() => restoreLegacyBackup({
    backupPath:migrated.backupPath,targetRoot:root,confirmOffline:true,
  }), /Incomplete legacy restore/i);
  const recovered = recoverLegacyRestore({ targetRoot: root, confirmOffline: true });
  assert.equal(recovered.outcome, 'rolled-back-original');
  assert.equal(fs.readFileSync(sentinel,'utf8'),'KEEP-ME');
  assert.equal(fs.existsSync(root),true);
});


test('T04-H47 POSIX rollback parent flush precedes append-only terminal acknowledgement', (t) => {
  if (process.platform === 'win32') {
    t.skip('Native Windows rename/flush is exercised by H48'); return;
  }
  const source = tempProject(t, 'dk-rollback-fsync-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const root = tempProject(t, 'dk-rollback-fsync-target-');
  const sentinel = path.join(root, 'original.txt');
  fs.writeFileSync(sentinel, 'ROLLBACK-ORIGINAL', 'utf8');

  const script = [
    'import fs from "node:fs";',
    'import {restoreLegacyBackup} from ' +
      JSON.stringify(new URL('../runtime/orchestration/state-engine-migration.mjs', import.meta.url).href) + ';',
    'const backup=process.argv[1],root=process.argv[2],rename=fs.renameSync;',
    'fs.renameSync=function(a,b,...rest){',
    ' if(a===root && String(b).endsWith("-original")) {rename.call(this,a,b,...rest);process.exit(91);}',
    ' return rename.call(this,a,b,...rest);',
    '};',
    'restoreLegacyBackup({backupPath:backup,targetRoot:root,confirmOffline:true});',
  ].join('\n');
  const result = requireSpawnSync(process.execPath,
    ['--input-type=module', '-e', script, migrated.backupPath, root]);
  assert.equal(result.status, 91, result.stderr);
  assert.equal(fs.existsSync(root), false);

  const parent = path.dirname(root);
  const parentStat = fs.statSync(parent);
  const originalRename = fs.renameSync;
  const originalFsync = fs.fsyncSync;
  const originalWrite = fs.writeFileSync;
  let rollbackRenamed = false;
  let parentSyncedAfterRollback = false;
  let terminalRecorded = false;
  fs.renameSync = function watchRollback(from, to, ...args) {
    const returned = originalRename.call(this, from, to, ...args);
    if (typeof from === 'string' && from.endsWith('-original') && to === root) rollbackRenamed = true;
    return returned;
  };
  fs.fsyncSync = function watchParentDurability(fd) {
    const stat = fs.fstatSync(fd);
    const returned = originalFsync.call(this, fd);
    if (rollbackRenamed && stat.isDirectory() &&
        stat.dev === parentStat.dev && stat.ino === parentStat.ino) parentSyncedAfterRollback = true;
    return returned;
  };
  fs.writeFileSync = function guardTerminalRecord(fd, content, ...args) {
    if (typeof fd === 'number' && String(content).includes('"phase":"CLEANUP_SAFE"')) {
      terminalRecorded = true;
      assert.equal(rollbackRenamed, true, 'Recovery must restore the displaced root');
      assert.equal(parentSyncedAfterRollback, true,
        'Rollback directory rename must be fsynced before durable terminal log append');
    }
    return originalWrite.call(this, fd, content, ...args);
  };
  try {
    const recovery = recoverLegacyRestore({ targetRoot: root, confirmOffline: true });
    assert.equal(recovery.outcome, 'rolled-back-original');
    assert.ok(terminalRecorded, 'Append-only terminal log must acknowledge rollback');
    assert.equal(fs.existsSync(recovery.transactionLog), true, 'Retain the hash-chained recovery log');
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'ROLLBACK-ORIGINAL');
  } finally {
    fs.renameSync = originalRename;
    fs.fsyncSync = originalFsync;
    fs.writeFileSync = originalWrite;
  }
});

test('T04-H48 Windows native rollback completes directory flush before retained terminal log', (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows native durability helper requires Windows NTFS'); return;
  }
  const source = tempProject(t, 'dk-win-rollback-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const root = tempProject(t, 'dk-win-rollback-target-');
  const sentinel = path.join(root, 'original.txt');
  fs.writeFileSync(sentinel, 'WINDOWS-ORIGINAL', 'utf8');

  // The v0.13 Windows path uses an isolated native helper, not fs.renameSync.
  // Kill the child only after the ORIGINAL_DISPLACED record has been written.
  const script = [
    'import fs from "node:fs";',
    'import {restoreLegacyBackup} from ' +
      JSON.stringify(new URL('../runtime/orchestration/state-engine-migration.mjs', import.meta.url).href) + ';',
    'const backup=process.argv[1],root=process.argv[2],write=fs.writeFileSync;',
    'fs.writeFileSync=function(fd,content,...rest){',
    ' const out=write.call(this,fd,content,...rest);',
    ' if(typeof fd==="number" && String(content).includes(\'"phase":"ORIGINAL_DISPLACED"\')) process.exit(91);',
    ' return out;',
    '};',
    'restoreLegacyBackup({backupPath:backup,targetRoot:root,confirmOffline:true});',
  ].join('\n');
  const result = requireSpawnSync(process.execPath,
    ['--input-type=module', '-e', script, migrated.backupPath, root]);
  assert.equal(result.status, 91, result.stderr);
  assert.equal(fs.existsSync(root), false);

  const recovery = recoverLegacyRestore({ targetRoot: root, confirmOffline: true });
  assert.equal(recovery.outcome, 'rolled-back-original');
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'WINDOWS-ORIGINAL');
  assert.equal(fs.existsSync(recovery.transactionLog), true, 'Native recovery retains journal');
  const records = fs.readFileSync(recovery.transactionLog, 'utf8').trimEnd().split('\n').map(JSON.parse);
  assert.equal(records.at(-1).phase, 'CLEANUP_SAFE');
  assert.equal(records.at(-1).outcome, 'rolled-back-original');
});

test('T04-H30 offline staged restore preserves descendant file identity and POSIX permission metadata', (t) => {
  if (process.platform === 'win32') {
    t.skip('POSIX ownership and mode semantics require a POSIX host'); return;
  }
  const source = tempProject(t, 'dk-descendant-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const root = tempProject(t, 'dk-descendant-target-');
  const nested = path.join(root, 'unrelated', 'private.txt');
  fs.mkdirSync(path.dirname(nested), { recursive: true });
  fs.writeFileSync(nested, 'PROTECTED-CONTENT');
  fs.chmodSync(nested, 0o600);
  if (process.getuid?.() === 0) {
    fs.chownSync(nested, 65534, 65534);
  }
  const before = fs.statSync(nested);
  restoreLegacyBackup({ backupPath:migrated.backupPath, targetRoot:root, confirmOffline:true });
  const after = fs.statSync(nested);
  assert.equal(after.uid, before.uid);
  assert.equal(after.gid, before.gid);
  assert.equal(after.mode & 0o7777, before.mode & 0o7777);
  assert.equal(fs.readFileSync(nested, 'utf8'), 'PROTECTED-CONTENT');
});

test('T04-H31 staged restore does not advance historical root access and modification timestamps', (t) => {
  if (process.platform === 'win32') {
    t.skip('POSIX access-time semantics require a POSIX host'); return;
  }
  const source = tempProject(t, 'dk-atime-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const root = tempProject(t, 'dk-atime-target-');
  const old = new Date('2001-01-01T00:00:00.000Z');
  fs.utimesSync(root, old, old);
  const before = fs.statSync(root);
  restoreLegacyBackup({ backupPath:migrated.backupPath, targetRoot:root, confirmOffline:true });
  const after = fs.statSync(root);
  assert.ok(Math.abs(after.atimeMs - before.atimeMs) < 1000, 'root access time must be preserved');
  assert.ok(Math.abs(after.mtimeMs - before.mtimeMs) < 1000, 'root modification time must be preserved');
});


test('T04-H32 offline staged restore preserves the text of unrelated relative symlinks', (t) => {
  const source = tempProject(t, 'dk-link-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const targetRoot = tempProject(t, 'dk-link-target-');
  fs.writeFileSync(path.join(targetRoot, 'target.txt'), 'ORIGINAL', 'utf8');
  const link = path.join(targetRoot, 'relative-link.txt');
  try {
    fs.symlinkSync('target.txt', link, 'file');
  } catch (error) {
    if (['EPERM','EACCES','ENOTSUP'].includes(error.code)) { t.skip('Relative symlink unavailable'); return; }
    throw error;
  }
  const priorLink = fs.readlinkSync(link);
  restoreLegacyBackup({ backupPath: migrated.backupPath, targetRoot, confirmOffline: true });
  assert.equal(fs.readlinkSync(link), priorLink);
  assert.equal(fs.readFileSync(link, 'utf8'), 'ORIGINAL');
});

test('T04-H33 backup with duplicate normalized destinations is refused before staging', async (t) => {
  const source = tempProject(t, 'dk-dup-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const targetRoot = tempProject(t, 'dk-dup-target-');
  const pathA = path.join(targetRoot, '.development-kit', 'autopilot', 'state', 'revision-000001.json');
  const backup = JSON.parse(fs.readFileSync(migrated.backupPath, 'utf8'));
  const first = backup.files[0];
  const duplicate = { ...first, path: './' + first.path };
  backup.files.push(duplicate);
  backup.fileCount = backup.files.length;
  const manifest = backup.files.map(e => ({ path: e.path, fingerprint: e.fingerprint, bytes: e.bytes }));
  const crypto = await import('node:crypto');
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(
      Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,val]) => [key, canonical(val)])
    );
    return value;
  }
  backup.sourceFingerprint = 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(canonical(manifest))).digest('hex');
  const hostileBackup = path.join(source, 'alias-backup.json');
  fs.writeFileSync(hostileBackup, JSON.stringify(backup));
  assert.throws(
    () => restoreLegacyBackup({ backupPath: hostileBackup, targetRoot, confirmOffline: true }),
    /duplicate normalized/i,
  );
  assert.equal(fs.existsSync(pathA), false);
});


test('T04-H34 backup case aliases fail closed even on a case-sensitive test filesystem', async (t) => {
  const source = tempProject(t, 'dk-restore-case-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const targetRoot = tempProject(t, 'dk-restore-case-target-');
  const backup = JSON.parse(fs.readFileSync(migrated.backupPath, 'utf8'));
  const first = backup.files[0];
  const alias = { ...first, path: first.path.toUpperCase() };
  assert.notEqual(alias.path, first.path);
  backup.files.push(alias);
  backup.fileCount = backup.files.length;
  const manifest = backup.files.map(e => ({ path: e.path, fingerprint: e.fingerprint, bytes: e.bytes }));
  const { createHash } = await import('node:crypto');
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, stable(value[key])]));
    return value;
  }
  backup.sourceFingerprint = 'sha256:' + createHash('sha256').update(JSON.stringify(stable(manifest))).digest('hex');
  const aliasBackup = path.join(source, 'case-alias-backup.json');
  fs.writeFileSync(aliasBackup, JSON.stringify(backup));
  assert.throws(
    () => restoreLegacyBackup({backupPath:aliasBackup,targetRoot,confirmOffline:true}),
    /duplicate normalized/i,
  );
  assert.deepEqual(fs.readdirSync(targetRoot), []);
});


test('T04-H35 backup with distinct unpaired surrogates cannot overwrite one filesystem name', async (t) => {
  const source = tempProject(t, 'dk-unicode-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const targetRoot = tempProject(t, 'dk-unicode-target-');
  const backup = JSON.parse(fs.readFileSync(migrated.backupPath, 'utf8'));
  const sourceEntry = backup.files[0];
  backup.files.push({ ...sourceEntry, path: 'suspicious-\uD800.json' });
  backup.files.push({ ...sourceEntry, path: 'suspicious-\uD801.json' });
  backup.fileCount = backup.files.length;
  const entries = backup.files.map(e => ({path:e.path, fingerprint:e.fingerprint, bytes:e.bytes}));
  const { createHash } = await import('node:crypto');
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
    }
    return value;
  }
  backup.sourceFingerprint = 'sha256:' + createHash('sha256').update(JSON.stringify(stable(entries))).digest('hex');
  const hostileBackup = path.join(source, 'ill-formed-unicode.json');
  fs.writeFileSync(hostileBackup, JSON.stringify(backup));
  assert.throws(
    () => restoreLegacyBackup({ backupPath: hostileBackup, targetRoot, confirmOffline: true }),
    /ill-formed Unicode/i,
  );
  assert.deepEqual(fs.readdirSync(targetRoot), []);
});

test('T04-H39 backup with trailing dot or space path alias is refused before restore', async (t) => {
  const source = tempProject(t, 'dk-trailing-dot-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const targetRoot = tempProject(t, 'dk-trailing-dot-target-');
  const backup = JSON.parse(fs.readFileSync(migrated.backupPath, 'utf8'));
  const sourceEntry = backup.files[0];
  // Attempt to add a trailing-dot alias path that would map to the same file on Windows
  backup.files.push({ ...sourceEntry, path: sourceEntry.path + '.' });
  backup.fileCount = backup.files.length;
  const entries = backup.files.map(e => ({ path: e.path, fingerprint: e.fingerprint, bytes: e.bytes }));
  const { createHash } = await import('node:crypto');
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
    }
    return value;
  }
  backup.sourceFingerprint = 'sha256:' + createHash('sha256').update(JSON.stringify(stable(entries))).digest('hex');
  const hostileBackup = path.join(source, 'trailing-dot-backup.json');
  fs.writeFileSync(hostileBackup, JSON.stringify(backup));
  assert.throws(
    () => restoreLegacyBackup({ backupPath: hostileBackup, targetRoot, confirmOffline: true }),
    /trailing dot|duplicate normalized/i,
  );
  assert.deepEqual(fs.readdirSync(targetRoot), []);
});


test('W73-26 Windows helper launch ignores a forged powershell.exe in the working directory', (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows executable-search hijack regression requires Windows'); return;
  }
  const source = tempProject(t, 'dk-win-helper-launch-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const hostileWorkingDir = tempProject(t, 'dk-win-helper-launch-cwd-');
  // A copy of Node named powershell.exe is an executable canary: invoking it
  // with PowerShell flags fails. The restore must instead use the trusted
  // system interpreter by absolute path, never libuv's cwd-first lookup.
  fs.copyFileSync(process.execPath, path.join(hostileWorkingDir, 'powershell.exe'));
  const targetRoot = path.join(hostileWorkingDir, 'restored-project');
  const script = [
    'import { restoreLegacyBackup } from ' +
      JSON.stringify(new URL('../runtime/orchestration/state-engine-migration.mjs', import.meta.url).href) + ';',
    'restoreLegacyBackup({ backupPath: process.argv[1], targetRoot: process.argv[2], confirmOffline: true });',
  ].join('\n');
  const child = requireSpawnSync(process.execPath,
    ['--input-type=module', '-e', script, migrated.backupPath, targetRoot], {
      cwd: hostileWorkingDir, encoding: 'utf8', timeout: 120_000, windowsHide: true,
    });
  assert.equal(child.status, 0,
    'Windows restore must not execute cwd/powershell.exe: ' + (child.stderr || child.stdout));
  assert.equal(fs.existsSync(path.join(targetRoot, '.development-kit', 'autopilot', 'state', 'current.json')), true,
    'A trusted helper launch must complete the original legacy backup restoration');
});

test('W73-27 Windows 8.3 ancestor alias cannot bypass an interrupted restore journal', (t) => {
  if (process.platform !== 'win32') {
    t.skip('NTFS short-name aliases require Windows'); return;
  }
  const source = tempProject(t, 'dk-short-alias-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const parent = tempProject(t, 'dk-short-alias-parent-');
  const targetRoot = path.join(parent, 'target');
  fs.mkdirSync(targetRoot);
  fs.writeFileSync(path.join(targetRoot, 'original.txt'), 'KEEP-ORIGINAL');
  const command = 'for %I in ("' + parent + '") do @echo %~sI';
  const shortResult = requireSpawnSync(process.env.ComSpec || 'cmd.exe',
    ['/d', '/c', command], { encoding: 'utf8', windowsHide: true });
  assert.equal(shortResult.status, 0, shortResult.stderr);
  const shortParent = shortResult.stdout.trim().split(/\r?\n/).at(-1);
  let aliasParent = shortParent;
  if (!fs.existsSync(shortParent) ||
      path.win32.normalize(shortParent).toLowerCase() === path.win32.normalize(parent).toLowerCase()) {
    // The extended-length namespace is a second real spelling of the same
    // Windows directory even when NTFS 8.3 name generation is disabled.
    const extendedParent = '\\\\?\\' + parent;
    if (!fs.existsSync(extendedParent)) {
      t.skip('Neither an 8.3 nor an extended-length ancestor alias is available'); return;
    }
    aliasParent = extendedParent;
  }
  assert.equal(fs.realpathSync.native(aliasParent).toLowerCase(),
    fs.realpathSync.native(parent).toLowerCase(), 'Alias must identify the same physical parent');
  const crashScript = [
    'import fs from "node:fs";',
    'import {restoreLegacyBackup} from ' +
      JSON.stringify(new URL('../runtime/orchestration/state-engine-migration.mjs', import.meta.url).href) + ';',
    'const write=fs.writeFileSync;',
    'fs.writeFileSync=function(fd, content, ...rest) {',
    ' const result=write.call(this, fd, content, ...rest);',
    ' if(typeof fd==="number" && String(content).includes(\'"phase":"PREPARED"\')) process.exit(91);',
    ' return result;',
    '};',
    'restoreLegacyBackup({backupPath:process.argv[1],targetRoot:process.argv[2],confirmOffline:true});',
  ].join('\n');
  const crashed = requireSpawnSync(process.execPath,
    ['--input-type=module', '-e', crashScript, migrated.backupPath, targetRoot],
    { encoding: 'utf8', windowsHide: true, timeout: 120_000 });
  assert.equal(crashed.status, 91, crashed.stderr || crashed.stdout);
  const journals = fs.readdirSync(parent).filter(name =>
    /^\.dk-restore-transaction-[a-f0-9]{24}\.jsonl$/i.test(name));
  assert.equal(journals.length, 1, 'Interrupted transaction must retain its journal');
  const journalBytes = fs.readFileSync(path.join(parent, journals[0]));
  const shortRoot = path.join(aliasParent, 'target');
  assert.throws(
    () => restoreLegacyBackup({
      backupPath: migrated.backupPath, targetRoot: shortRoot,
      overwrite: true, confirmOffline: true,
    }),
    /alias|journal|incomplete|witness/i,
    'Same physical target through 8.3 ancestor must not start a second transaction',
  );
  assert.deepEqual(fs.readFileSync(path.join(targetRoot, 'original.txt'), 'utf8'), 'KEEP-ORIGINAL');
  assert.deepEqual(fs.readFileSync(path.join(parent, journals[0])), journalBytes);
});


test('W73-28 Unicode uppercase-folded restore aliases fail closed before publication on every OS', async (t) => {
  // NTFS case-insensitive name comparison uses an uppercase mapping. A
  // conservative preflight must also reject these aliases on POSIX so the
  // signed backup cannot behave differently on a Windows restore target.
  const longS = '\u017f'; // LATIN SMALL LETTER LONG S; uppercase maps to S.
  assert.equal(longS.toUpperCase(), 'S');
  assert.notEqual(longS.toLowerCase(), 's');

  const source = tempProject(t, 'dk-ntfs-unicode-alias-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const backup = JSON.parse(fs.readFileSync(migrated.backupPath, 'utf8'));
  const first = backup.files[0];
  const firstBytes = Buffer.from('FIRST-RESTORED-ENTRY');
  const secondBytes = Buffer.from('SECOND-RESTORED-ENTRY');
  const { createHash } = await import('node:crypto');
  const digest = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
  const relativeDir = '.development-kit/autopilot/state/';
  backup.files.push({
    ...first, path: relativeDir + 's.json',
    bytes: firstBytes.length, fingerprint: digest(firstBytes),
    contentBase64: firstBytes.toString('base64'),
  });
  backup.files.push({
    ...first, path: relativeDir + longS + '.json',
    bytes: secondBytes.length, fingerprint: digest(secondBytes),
    contentBase64: secondBytes.toString('base64'),
  });
  backup.fileCount = backup.files.length;
  const stable = value => Array.isArray(value) ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
      : value;
  const manifest = backup.files.map(e => ({ path: e.path, fingerprint: e.fingerprint, bytes: e.bytes }));
  backup.sourceFingerprint = digest(JSON.stringify(stable(manifest)));
  const hostileBackup = path.join(source, 'ntfs-alias-backup.json');
  fs.writeFileSync(hostileBackup, JSON.stringify(backup));
  const targetRoot = tempProject(t, 'dk-ntfs-unicode-alias-target-');
  const original = path.join(targetRoot, 'original.txt');
  fs.writeFileSync(original, 'KEEP-ORIGINAL');
  assert.throws(
    () => restoreLegacyBackup({ backupPath: hostileBackup, targetRoot, confirmOffline: true }),
    /duplicate|alias|collision|physical identity/i,
    'Two different backup paths naming one physical NTFS file must fail closed before publication',
  );
  assert.equal(fs.readFileSync(original, 'utf8'), 'KEEP-ORIGINAL');
  assert.equal(fs.existsSync(path.join(targetRoot, relativeDir, 's.json')), false,
    'Rejected backup must not publish the staged candidate');
});


test('W73-29 staged restore refuses a second path resolving to an already written physical file', async (t) => {
  const source = tempProject(t, 'dk-restore-physical-alias-source-');
  writeLegacyAutopilot(source, 2);
  const migrated = migrateLegacyStateToV2({ rootDir: source });
  const backup = JSON.parse(fs.readFileSync(migrated.backupPath, 'utf8'));
  const { createHash } = await import('node:crypto');
  const digest = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
  const relativeDir = '.development-kit/autopilot/state/';
  for (const [name, text] of [['a.json', 'FIRST'], ['b.json', 'SECOND']]) {
    const bytes = Buffer.from(text);
    backup.files.push({
      path: relativeDir + name, bytes: bytes.length,
      fingerprint: digest(bytes), contentBase64: bytes.toString('base64'),
    });
  }
  backup.fileCount = backup.files.length;
  const stable = value => Array.isArray(value) ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
      : value;
  const manifest = backup.files.map(e => ({ path: e.path, fingerprint: e.fingerprint, bytes: e.bytes }));
  backup.sourceFingerprint = digest(JSON.stringify(stable(manifest)));
  const hostileBackup = path.join(source, 'physical-alias-backup.json');
  fs.writeFileSync(hostileBackup, JSON.stringify(backup));

  const targetRoot = tempProject(t, 'dk-restore-physical-alias-target-');
  fs.writeFileSync(path.join(targetRoot, 'original.txt'), 'KEEP-ORIGINAL');
  const realRename = fs.renameSync;
  let aliasInjected = false;
  fs.renameSync = function (from, to) {
    const result = realRename.call(this, from, to);
    if (!aliasInjected && typeof to === 'string' && to.endsWith(path.sep + 'a.json')
      && to.includes('.dk-legacy-restore-stage-') && String(from).includes('.tmp-')) {
      fs.linkSync(to, path.join(path.dirname(to), 'b.json'));
      aliasInjected = true;
    }
    return result;
  };
  try {
    assert.throws(
      () => restoreLegacyBackup({ backupPath: hostileBackup, targetRoot, confirmOffline: true }),
      /duplicate|alias|collision|physical identity/i,
      'An existing staged hard-link alias must not be silently overwritten by the next backup entry',
    );
  } finally {
    fs.renameSync = realRename;
  }
  assert.equal(aliasInjected, true, 'Fixture must create the second physical name after the first write');
  assert.equal(fs.readFileSync(path.join(targetRoot, 'original.txt'), 'utf8'), 'KEEP-ORIGINAL');
  assert.equal(fs.existsSync(path.join(targetRoot, relativeDir, 'a.json')), false);
});
