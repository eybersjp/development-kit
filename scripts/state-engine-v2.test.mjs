import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  appendEntityState,
  canonicalStateJson,
  cleanupOrphanedStateTemps,
  countStateEngineFiles,
  getStateEnginePaths,
  loadCanonicalEvents,
  loadStateIndex,
  loadStateSnapshot,
  queryStateIndex,
  rebuildSnapshotFromEvents,
  rebuildStateIndex,
  rebuildStateSnapshot,
  verifyStateEngineIntegrity,
} from '../runtime/orchestration/state-engine-v2.mjs';
import {
  getCurrentState,
  saveStateRevision,
} from '../runtime/autopilot/state-store.mjs';
import {
  loadCurrentRunState,
  persistRunManifest,
  persistRunStateRevision,
} from '../runtime/orchestration/orchestration-run.mjs';

function tempProject(t, prefix = 'dk-state-v2-') {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  return rootDir;
}

function workflowState(revision = 1, overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    workflowId: 'wf-state-v2',
    projectId: 'proj-state-v2',
    workspaceId: 'ws-state-v2',
    workflowMode: 'autopilot',
    autonomyLevel: 'guided-autopilot',
    workflowStatus: 'executing',
    currentStage: revision > 1 ? 'DEFINE' : 'UNDERSTAND',
    completedStages: revision > 1 ? ['UNDERSTAND'] : [],
    skippedStages: [],
    blockedStages: [],
    activeAction: null,
    pendingApproval: null,
    pendingConfirmation: null,
    activeDecisionMenu: null,
    stateRevision: revision,
    createdAt: '2026-10-07T18:00:00.000Z',
    updatedAt: new Date(Date.parse('2026-10-07T18:00:00.000Z') + revision * 1000).toISOString(),
    frameworkVersion: '0.11.2',
    ...overrides,
  };
}

function runState(revision = 1, overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    contractId: 'INC-STATE-V2',
    taskId: 'TASK-STATE-V2',
    runId: 'run-state-v2',
    sourceFingerprint: 'sha256:' + 'a'.repeat(64),
    createdAt: '2026-10-07T18:10:00.000Z',
    updatedAt: new Date(Date.parse('2026-10-07T18:10:00.000Z') + revision * 1000).toISOString(),
    stateRevision: revision,
    state: revision === 1 ? 'READY' : 'IMPLEMENTING',
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
    completedGates: [],
    correctionAttempt: 0,
    failureSignatures: [],
    verificationVerdict: null,
    acceptanceState: 'PENDING',
    ...overrides,
  };
}

test('AC-012 canonical event history is monotonic, hash-chained, and reconstructable', (t) => {
  const rootDir = tempProject(t);
  const first = workflowState(1);
  const second = workflowState(2);

  appendEntityState({
    rootDir,
    entityType: 'autopilot-workflow',
    entityId: first.workflowId,
    state: first,
    actorClass: 'test',
    timestamp: first.updatedAt,
  });
  appendEntityState({
    rootDir,
    entityType: 'autopilot-workflow',
    entityId: second.workflowId,
    state: second,
    actorClass: 'test',
    timestamp: second.updatedAt,
  });

  const events = loadCanonicalEvents(rootDir);
  assert.equal(events.length, 2);
  assert.equal(events[0].sequence, 1);
  assert.equal(events[1].sequence, 2);
  assert.equal(events[0].previousEventHash, null);
  assert.equal(events[1].previousEventHash, events[0].eventHash);

  const rebuilt = rebuildSnapshotFromEvents(events);
  assert.deepEqual(
    rebuilt.entities['autopilot-workflow'][first.workflowId].state,
    second,
  );
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('AC-012 canonical history detects mutation and reordering', (t) => {
  const rootDir = tempProject(t);
  appendEntityState({
    rootDir,
    entityType: 'generic-state',
    entityId: 'one',
    state: { stateRevision: 1, value: 1 },
    actorClass: 'test',
    timestamp: '2026-10-07T18:20:00.000Z',
  });
  appendEntityState({
    rootDir,
    entityType: 'generic-state',
    entityId: 'one',
    state: { stateRevision: 2, value: 2 },
    actorClass: 'test',
    timestamp: '2026-10-07T18:20:01.000Z',
  });

  const paths = getStateEnginePaths(rootDir);
  const lines = fs.readFileSync(paths.events, 'utf8').trim().split(/\r?\n/);
  const mutated = JSON.parse(lines[0]);
  mutated.payload.state.value = 99;
  fs.writeFileSync(paths.events, JSON.stringify(mutated) + '\n' + lines[1] + '\n', 'utf8');
  assert.throws(() => loadCanonicalEvents(rootDir), /hash mismatch/i);

  fs.writeFileSync(paths.events, lines[1] + '\n' + lines[0] + '\n', 'utf8');
  assert.throws(() => loadCanonicalEvents(rootDir), /First state event sequence|sequence/i);
});

test('AC-012 canonical tail truncation fails closed when the materialized snapshot witnesses later history', (t) => {
  const rootDir = tempProject(t);
  appendEntityState({
    rootDir,
    entityType: 'generic-state',
    entityId: 'tail-witness',
    state: { stateRevision: 1, value: 1 },
    actorClass: 'test',
    timestamp: '2026-10-07T18:21:00.000Z',
  });
  appendEntityState({
    rootDir,
    entityType: 'generic-state',
    entityId: 'tail-witness',
    state: { stateRevision: 2, value: 2 },
    actorClass: 'test',
    timestamp: '2026-10-07T18:21:01.000Z',
  });

  const paths = getStateEnginePaths(rootDir);
  const lines = fs.readFileSync(paths.events, 'utf8').trim().split(/\r?\n/);
  assert.equal(lines.length, 2);

  // Simulate loss/removal of the canonical tail while retaining the previously
  // materialized snapshot as an integrity witness.
  fs.writeFileSync(paths.events, lines[0] + '\n', 'utf8');

  assert.throws(
    () => loadStateSnapshot(rootDir, { rebuildIfNeeded: true }),
    /history appears truncated/i,
  );
});

test('State Engine rejects a state-root symlink or junction that resolves outside the project', (t) => {
  const rootDir = tempProject(t, 'dk-state-realpath-');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-state-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));

  const dkDir = path.join(rootDir, '.development-kit');
  fs.mkdirSync(dkDir, { recursive: true });
  const statePath = path.join(dkDir, 'state');

  try {
    fs.symlinkSync(outside, statePath, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip('Host does not permit directory symlink/junction creation');
      return;
    }
    throw error;
  }

  assert.throws(
    () => appendEntityState({
      rootDir,
      entityType: 'generic-state',
      entityId: 'escape-attempt',
      state: { stateRevision: 1, value: true },
      actorClass: 'test',
      timestamp: '2026-10-07T18:22:00.000Z',
    }),
    /resolves outside project root/,
  );

  assert.equal(fs.readdirSync(outside).length, 0);
});

test('tampered State Engine schema contract fails closed on read', (t) => {
  const rootDir = tempProject(t);
  const state = workflowState(1);
  saveStateRevision(state, rootDir);
  const paths = getStateEnginePaths(rootDir);

  const schema = JSON.parse(fs.readFileSync(paths.schema, 'utf8'));
  schema.authority.canonicalHistory = 'something-else.jsonl';
  fs.writeFileSync(paths.schema, JSON.stringify(schema, null, 2) + '\n', 'utf8');

  assert.throws(
    () => getCurrentState(rootDir),
    /schema\.json does not match the runtime schema contract/,
  );
});

test('AC-013 materialized snapshot deletion/corruption rebuilds from canonical history', (t) => {
  const rootDir = tempProject(t);
  const state = workflowState(1);
  appendEntityState({
    rootDir,
    entityType: 'autopilot-workflow',
    entityId: state.workflowId,
    state,
    actorClass: 'test',
    timestamp: state.updatedAt,
  });

  const paths = getStateEnginePaths(rootDir);
  const expected = loadStateSnapshot(rootDir);
  fs.rmSync(paths.snapshot);
  const rebuiltAfterDelete = loadStateSnapshot(rootDir, { rebuildIfNeeded: true });
  assert.equal(canonicalStateJson(rebuiltAfterDelete), canonicalStateJson(expected));

  fs.writeFileSync(paths.snapshot, '{"corrupt":true}\n', 'utf8');
  const rebuiltAfterCorruption = rebuildStateSnapshot(rootDir);
  assert.equal(canonicalStateJson(rebuiltAfterCorruption), canonicalStateJson(expected));
});

test('AC-014 disposable index deletion/rebuild preserves semantically equivalent query state', (t) => {
  const rootDir = tempProject(t);
  const run = runState(1);
  appendEntityState({
    rootDir,
    entityType: 'orchestration-run',
    entityId: run.contractId + '/' + run.runId,
    state: run,
    refs: { contractId: run.contractId, taskId: run.taskId, runId: run.runId },
    actorClass: 'test',
    timestamp: run.updatedAt,
  });

  const before = loadStateIndex(rootDir);
  const queryBefore = queryStateIndex({ rootDir, contractId: run.contractId });
  const paths = getStateEnginePaths(rootDir);
  fs.rmSync(paths.index);
  const rebuilt = rebuildStateIndex(rootDir);
  const queryAfter = queryStateIndex({ rootDir, contractId: run.contractId });

  assert.equal(canonicalStateJson(rebuilt), canonicalStateJson(before));
  assert.deepEqual(queryAfter, queryBefore);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('interrupted temporary state files cannot advance canonical history', (t) => {
  const rootDir = tempProject(t);
  const state = workflowState(1);
  appendEntityState({
    rootDir,
    entityType: 'autopilot-workflow',
    entityId: state.workflowId,
    state,
    actorClass: 'test',
    timestamp: state.updatedAt,
  });
  const paths = getStateEnginePaths(rootDir);
  const before = fs.readFileSync(paths.events, 'utf8');

  fs.writeFileSync(
    path.join(paths.stateRoot, 'events.jsonl.tmp-interrupted'),
    before + '{"partial":',
    'utf8',
  );

  assert.equal(loadCanonicalEvents(rootDir).length, 1);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
  const removed = cleanupOrphanedStateTemps(rootDir);
  assert.equal(removed.length, 1);
  assert.equal(fs.readFileSync(paths.events, 'utf8'), before);
});

test('fresh Autopilot projects use State Engine V2 without legacy revision micro-files', (t) => {
  const rootDir = tempProject(t);
  const first = workflowState(1);
  saveStateRevision(first, rootDir);
  const second = workflowState(2);
  saveStateRevision(second, rootDir);

  assert.deepEqual(getCurrentState(rootDir), second);
  assert.equal(fs.existsSync(path.join(rootDir, '.development-kit', 'autopilot', 'state')), false);
  assert.equal(loadCanonicalEvents(rootDir).length, 2);
  assert.equal(countStateEngineFiles(rootDir), 4);
});

test('fresh orchestration transition state uses V2 while manifest remains an immutable artifact', (t) => {
  const rootDir = tempProject(t);
  const run = runState(1);
  persistRunManifest(run, rootDir);
  const first = persistRunStateRevision(run, rootDir);
  assert.equal(first.stateEngine, 'v2');

  const second = runState(2);
  const next = persistRunStateRevision(second, rootDir);
  assert.equal(next.stateEngine, 'v2');
  assert.deepEqual(loadCurrentRunState(run.contractId, run.runId, rootDir), second);

  const runDir = path.join(rootDir, '.development-kit', 'runs', run.contractId, run.runId);
  assert.equal(fs.existsSync(path.join(runDir, 'state-revisions')), false);
  assert.equal(fs.existsSync(path.join(runDir, 'current-state.json')), false);
  assert.equal(fs.existsSync(path.join(runDir, 'manifest.json')), true);
});

test('orchestration V2 refuses same-revision semantic overwrite', (t) => {
  const rootDir = tempProject(t);
  const run = runState(1);
  persistRunManifest(run, rootDir);
  persistRunStateRevision(run, rootDir);

  const forged = structuredClone(run);
  forged.state = 'CORRECTING';
  assert.throws(
    () => persistRunStateRevision(forged, rootDir),
    /Refusing to overwrite orchestration run state revision/,
  );
});
