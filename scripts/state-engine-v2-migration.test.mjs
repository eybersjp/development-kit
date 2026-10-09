import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
  const restored = restoreLegacyBackup({
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
    () => restoreLegacyBackup({ backupPath: migrated.backupPath, targetRoot: restoreRoot }),
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
    () => restoreLegacyBackup({ backupPath: migrated.backupPath, targetRoot: restoreRoot, overwrite: true }),
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
    () => restoreLegacyBackup({ backupPath: migrated.backupPath, targetRoot: restoreRoot, overwrite: true }),
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
    const restored = restoreLegacyBackup({ backupPath:migrated.backupPath, targetRoot, overwrite:true });
    assert.ok(restored.restoredFiles.includes('.development-kit/autopilot/state/revision-000001.json'));
  } finally {
    fs.openSync = originalOpen;
  }
  assert.equal(fs.readFileSync(victim, 'utf8'), 'EXTERNAL-CONTENT');
  assert.equal(JSON.parse(fs.readFileSync(destination, 'utf8')).stateRevision, 1);
});
