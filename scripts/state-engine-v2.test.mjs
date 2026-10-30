import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  appendEntityState,
  canonicalStateJson,
  cleanupOrphanedStateTemps,
  countStateEngineFiles,
  getStateEnginePaths,
  ensureStateEngineLayout,
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

test('T04-P1 patch replay preserves own __proto__ data without prototype pollution', (t) => {
  const rootDir = tempProject(t, 'dk-t04-patch-proto-');
  const key = '__t04PatchPollutionProbe';
  assert.equal(Object.hasOwn(Object.prototype, key), false, 'probe must start clean');
  try {
    appendEntityState({
      rootDir, entityType: 'generic-state', entityId: 'prototype-safety',
      state: { stateRevision: 1, metadata: {} }, actorClass: 'security-regression',
    });
    const changed = JSON.parse('{"stateRevision":2,"metadata":{"__proto__":{"__t04PatchPollutionProbe":true},"safe":42}}');
    appendEntityState({
      rootDir, entityType: 'generic-state', entityId: 'prototype-safety',
      state: changed, actorClass: 'security-regression',
    });
    assert.equal(Object.hasOwn(Object.prototype, key), false,
      'patch traversal must never mutate Object.prototype');
    const snapshot = loadStateSnapshot(rootDir, { rebuildIfNeeded: true });
    const actual = snapshot.entities['generic-state']['prototype-safety'].state;
    assert.equal(Object.hasOwn(actual.metadata, '__proto__'), true,
      'literal JSON __proto__ must be retained as an own data property');
    assert.deepEqual(actual.metadata, changed.metadata);
    const replay = rebuildSnapshotFromEvents(loadCanonicalEvents(rootDir));
    assert.deepEqual(replay.entities['generic-state']['prototype-safety'].state, changed);
    assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
  } finally {
    delete Object.prototype[key];
  }
});


test('V13-SEC-ENTITY-01 prototype-sensitive entity identities and index references are literal own keys', (t) => {
  const rootDir = tempProject(t, 'dk-v13-identity-');
  const moduleUrl = new URL('../runtime/orchestration/state-engine-v2.mjs', import.meta.url).href;
  const childCode = [
    'import assert from "node:assert/strict";',
    'import { appendEntityState, loadStateSnapshot, loadEntityState, queryStateIndex, verifyStateEngineIntegrity } from ' + JSON.stringify(moduleUrl) + ';',
    'const rootDir = process.argv[1];',
    'for (const [type,id] of [["generic-state","__proto__"],["constructor","entity"],["generic-state","constructor"]]) {',
    '  appendEntityState({ rootDir, entityType:type, entityId:id, state:{stateRevision:1,value:type+"/"+id}, refs:{contractId:"__proto__",taskId:"constructor"}, actorClass:"identity-security-test" });',
    '  const state = loadEntityState(type,id,rootDir);',
    '  assert.equal(state?.value, type+"/"+id);',
    '}',
    'const snapshot = loadStateSnapshot(rootDir);',
    'assert.ok(Object.hasOwn(snapshot.entities, "constructor"));',
    'assert.ok(Object.hasOwn(snapshot.entities["generic-state"], "__proto__"));',
    'assert.ok(Object.hasOwn(snapshot.entities["generic-state"], "constructor"));',
    'assert.equal(queryStateIndex({rootDir,contractId:"__proto__"}).length, 3);',
    'assert.equal(queryStateIndex({rootDir,taskId:"constructor"}).length, 3);',
    'assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);',
    'assert.equal(Object.hasOwn(Object.prototype, "state"), false);',
    'assert.equal(Object.hasOwn(Object.prototype, "stateRevision"), false);',
   ].join("\n");
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', childCode, rootDir],
    { encoding: 'utf8', timeout: 20000 });
  assert.equal(child.status, 0, 'Identity replay must not pollute inherited objects or lose records: ' + child.stderr);
});

test('V13-CONC-SCHEMA-01 another initializer never observes an incomplete published schema', (t) => {
  const rootDir = tempProject(t, 'dk-v13-schema-');
  const moduleUrl = new URL('../runtime/orchestration/state-engine-v2.mjs', import.meta.url).href;
  const originalWrite = fs.writeFileSync;
  let interleaved = false;
  fs.writeFileSync = function interleaveSchemaWrite(fd, content, ...args) {
    if (!interleaved && typeof fd === 'number' && typeof content === 'string'
        && content.includes('canonicalHistory') && content.includes('materializedSnapshot')) {
      interleaved = true;
      const code = 'import {ensureStateEngineLayout} from ' + JSON.stringify(moduleUrl) +
        '; ensureStateEngineLayout(process.argv[1]);';
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', code, rootDir],
        { encoding: 'utf8', timeout: 20000 });
      assert.equal(child.status, 0, 'Concurrent initializer must never read an empty schema: ' + child.stderr);
    }
    return originalWrite.call(this, fd, content, ...args);
  };
  try {
    ensureStateEngineLayout(rootDir);
  } finally {
    fs.writeFileSync = originalWrite;
  }
  assert.equal(interleaved, true, 'Fixture must interleave at schema publication');
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('V13-INDEX-IDENTITY-01 composite entity keys cannot collide across colon-bearing identities', (t) => {
  const rootDir = tempProject(t, 'dk-v13-index-identity-');
  const cases = [
    { entityType: 'a::b', entityId: 'c', contractId: 'contract-first',
      taskId: 'task-first', runId: 'run-first', lifecycleId: 'lifecycle-first' },
    { entityType: 'a', entityId: 'b::c', contractId: 'contract-second',
      taskId: 'task-second', runId: 'run-second', lifecycleId: 'lifecycle-second' },
  ];
  for (const entry of cases) {
    appendEntityState({
      rootDir,
      entityType: entry.entityType,
      entityId: entry.entityId,
      state: { stateRevision: 1, marker: entry.contractId },
      refs: { contractId: entry.contractId, taskId: entry.taskId,
        runId: entry.runId, lifecycleId: entry.lifecycleId },
      actorClass: 'index-identity-regression',
    });
  }
  const index = loadStateIndex(rootDir);
  assert.equal(index.records.length, 2);
  assert.equal(new Set(index.records.map((record) => record.key)).size, 2,
    'Distinct valid entity tuples must never share the same index key');
  for (const entry of cases) {
    for (const [filter, value] of [
      ['contractId', entry.contractId], ['taskId', entry.taskId],
      ['runId', entry.runId], ['lifecycleId', entry.lifecycleId],
    ]) {
      const found = queryStateIndex({ rootDir, [filter]: value });
      assert.equal(found.length, 1, filter + ' must not return another entity with a colliding key');
      assert.equal(found[0].entityType, entry.entityType);
      assert.equal(found[0].entityId, entry.entityId);
    }
  }
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});


test('V13-INDEX-IDENTITY-02 stale delimiter-based index is rebuilt before serving filtered queries', (t) => {
  const rootDir = tempProject(t, 'dk-v13-index-upgrade-');
  for (const entry of [
    { entityType: 'a::b', entityId: 'c', contractId: 'first' },
    { entityType: 'a', entityId: 'b::c', contractId: 'second' },
  ]) {
    appendEntityState({
      rootDir, entityType: entry.entityType, entityId: entry.entityId,
      state: { stateRevision: 1, marker: entry.contractId },
      refs: { contractId: entry.contractId },
      actorClass: 'index-upgrade-regression',
    });
  }
  const paths = getStateEnginePaths(rootDir);
  const oldIndex = structuredClone(loadStateIndex(rootDir));
  oldIndex.records = oldIndex.records.map((record) => ({
    ...record, key: record.entityType + '::' + record.entityId,
  }));
  for (const map of [oldIndex.byContract, oldIndex.byTask, oldIndex.byRun, oldIndex.byLifecycle]) {
    for (const [ref, keys] of Object.entries(map)) {
      map[ref] = keys.map((key) => {
        const record = loadStateIndex(rootDir).records.find((entry) => entry.key === key);
        return record.entityType + '::' + record.entityId;
      });
    }
  }
  fs.writeFileSync(paths.index, JSON.stringify(oldIndex) + '\n');
  const first = queryStateIndex({ rootDir, contractId: 'first' });
  assert.equal(first.length, 1, 'An old derived index must not leak another contract');
  assert.equal(first[0].entityType, 'a::b');
  assert.equal(first[0].entityId, 'c');
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('V13-CONC-BOOTSTRAP-02 interrupted initial hard-link publication is safely recoverable', (t) => {
  const rootDir = tempProject(t, 'dk-v13-bootstrap-link-');
  const moduleUrl = new URL('../runtime/orchestration/state-engine-v2.mjs', import.meta.url).href;
  const childCode = [
    'import fs from "node:fs";',
    'import { ensureStateEngineLayout } from ' + JSON.stringify(moduleUrl) + ';',
    'const link = fs.linkSync;',
    'fs.linkSync = (...args) => { link(...args); process.exit(77); };',
    'ensureStateEngineLayout(process.argv[1]);',
    'process.exit(99);',
  ].join('\n');
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', childCode, rootDir],
    { encoding: 'utf8', timeout: 20000 });
  assert.equal(child.status, 77, 'Fixture must terminate after publication but before staging unlink: ' + child.stderr);
  const stateRoot = path.join(rootDir, '.development-kit', 'state');
  const tempNames = fs.readdirSync(stateRoot).filter((name) => name.startsWith('schema.json.tmp-'));
  assert.equal(tempNames.length, 1, 'Interrupted bootstrap staging link must remain');
  assert.equal(fs.statSync(path.join(stateRoot, 'schema.json')).nlink, 2);
  ensureStateEngineLayout(rootDir);
  assert.equal(fs.statSync(path.join(stateRoot, 'schema.json')).nlink, 1);
  assert.equal(fs.existsSync(path.join(stateRoot, tempNames[0])), false);
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('V13-CONC-BOOTSTRAP-03 unrelated hard links remain fail-closed and preserved', (t) => {
  const rootDir = tempProject(t, 'dk-v13-bootstrap-untrusted-');
  const paths = ensureStateEngineLayout(rootDir);
  const external = path.join(rootDir, 'unrelated-schema-link');
  fs.linkSync(paths.schema, external);
  assert.throws(() => ensureStateEngineLayout(rootDir), /hard links|multiple hard links/i);
  assert.equal(fs.existsSync(external), true, 'Unrelated hard link must never be deleted');
  assert.equal(fs.statSync(paths.schema).nlink, 2);
});


test('V13-CONC-BOOTSTRAP-04 live initializer staging links are not reclaimed', (t) => {
  const rootDir = tempProject(t, 'dk-v13-bootstrap-live-');
  const paths = ensureStateEngineLayout(rootDir);
  const temporary = path.join(paths.stateRoot,
    'schema.json.tmp-' + process.pid + '-00000000-0000-4000-8000-000000000001');
  fs.linkSync(paths.schema, temporary);
  try {
    assert.throws(() => ensureStateEngineLayout(rootDir), /live process/i,
      'A live initializer retains ownership of its temporary publication link');
    assert.equal(fs.existsSync(temporary), true);
    assert.equal(fs.statSync(paths.schema).nlink, 2);
  } finally {
    fs.unlinkSync(temporary);
  }
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('T04-P2 JSON object keys including empty, control and Unicode strings survive patch update and deletion', (t) => {
  for (const [index, key] of ['', '\n', '\r', '\u0000', 'x\ny', 'é', '__proto__'].entries()) {
    const rootDir = tempProject(t, 'dk-v13-patch-key-');
    const entityId = 'literal-key-' + index;
    const first = { stateRevision: 1, metadata: { [key]: { count: 1 } } };
    const second = { stateRevision: 2, metadata: { [key]: { count: 2 } } };
    const third = { stateRevision: 3, metadata: {} };
    appendEntityState({ rootDir, entityType: 'generic-state', entityId,
      state: first, actorClass: 'regression' });
    appendEntityState({ rootDir, entityType: 'generic-state', entityId,
      state: second, actorClass: 'regression' });
    assert.deepEqual(loadStateSnapshot(rootDir, { rebuildIfNeeded: true })
      .entities['generic-state'][entityId].state, second, 'update key ' + JSON.stringify(key));
    appendEntityState({ rootDir, entityType: 'generic-state', entityId,
      state: third, actorClass: 'regression' });
    assert.deepEqual(rebuildSnapshotFromEvents(loadCanonicalEvents(rootDir))
      .entities['generic-state'][entityId].state, third, 'delete key ' + JSON.stringify(key));
    assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
  }
});
