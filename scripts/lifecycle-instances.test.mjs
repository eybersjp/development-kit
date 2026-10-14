import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  completeLifecycleInstance,
  createLifecycleInstance,
  ensureSingleLifecycleForWorkflow,
  lifecycleSummary,
  listChildLifecycleInstances,
  listLifecycleInstances,
  loadLifecycleInstance,
  loadProjectStateNamespace,
  recordLifecycleAcceptance,
  setProjectStateNamespace,
  transitionLifecycleStage,
  validateLifecycleInstance,
} from '../runtime/orchestration/lifecycle-instances.mjs';
import { queryStateIndex, verifyStateEngineIntegrity } from '../runtime/orchestration/state-engine-v2.mjs';

const FP = `sha256:${'a'.repeat(64)}`;

function tempProject(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-lifecycle-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  return rootDir;
}

function createRoot(rootDir, overrides = {}) {
  return createLifecycleInstance({
    rootDir,
    lifecycleId: 'lc-root',
    type: 'project',
    name: 'Root lifecycle',
    stage: 'UNDERSTAND',
    targets: ['dkf-framework'],
    sourceFingerprint: FP,
    createdAt: '2026-10-14T18:00:00.000Z',
    ...overrides,
  });
}

function advanceToComplete(lifecycleId, rootDir) {
  for (const stage of ['DEFINE','DESIGN','PLAN','IMPLEMENT','VERIFY','REVIEW','SIMPLIFY','COMPLETE']) {
    transitionLifecycleStage({
      lifecycleId,
      toStage: stage,
      rootDir,
      updatedAt: `2026-10-14T18:0${Math.min(stage.length,9)}:00.000Z`,
    });
  }
}

test('AC-016 lifecycle instances support optional parent/child relationships', (t) => {
  const rootDir = tempProject(t);
  createRoot(rootDir);
  const child = createLifecycleInstance({
    rootDir,
    lifecycleId: 'lc-child',
    parentLifecycleId: 'lc-root',
    type: 'feature',
    name: 'Child lifecycle',
    stage: 'UNDERSTAND',
    targets: ['dkf-framework'],
    sourceFingerprint: FP,
    createdAt: '2026-10-14T18:01:00.000Z',
  });

  assert.equal(child.parentLifecycleId, 'lc-root');
  assert.equal(listChildLifecycleInstances('lc-root', rootDir).length, 1);
  assert.equal(listChildLifecycleInstances('lc-root', rootDir)[0].lifecycleId, 'lc-child');
  assert.equal(listLifecycleInstances(rootDir).length, 2);
});

test('arbitrary lifecycle type labels remain descriptive rather than dispatch enums', (t) => {
  const rootDir = tempProject(t);
  const instance = createRoot(rootDir, { type: 'team-defined-delivery-loop' });
  assert.equal(instance.type, 'team-defined-delivery-loop');
  assert.equal(validateLifecycleInstance(instance), true);
});

test('unknown parent fails closed and self-parenting is rejected', (t) => {
  const rootDir = tempProject(t);
  assert.throws(() => createLifecycleInstance({
    rootDir,
    lifecycleId: 'lc-child',
    parentLifecycleId: 'lc-missing',
    name: 'Child',
    sourceFingerprint: FP,
  }), /not found/);

  assert.throws(() => createLifecycleInstance({
    rootDir,
    lifecycleId: 'lc-self',
    parentLifecycleId: 'lc-self',
    name: 'Self',
    sourceFingerprint: FP,
  }), /parent itself/);
});

test('canonical stages advance one step and backward movement is reserved for T06 re-entry', (t) => {
  const rootDir = tempProject(t);
  createRoot(rootDir);
  const defined = transitionLifecycleStage({
    lifecycleId: 'lc-root',
    toStage: 'DEFINE',
    rootDir,
    updatedAt: '2026-10-14T18:01:00.000Z',
  });
  assert.equal(defined.stage, 'DEFINE');

  assert.throws(() => transitionLifecycleStage({
    lifecycleId: 'lc-root',
    toStage: 'UNDERSTAND',
    rootDir,
  }), /controlled re-entry/);

  assert.throws(() => transitionLifecycleStage({
    lifecycleId: 'lc-root',
    toStage: 'IMPLEMENT',
    rootDir,
  }), /one canonical stage/);
});

test('AC-017 child COMPLETE leaves parent active and parent acceptance independent', (t) => {
  const rootDir = tempProject(t);
  createRoot(rootDir);
  createLifecycleInstance({
    rootDir,
    lifecycleId: 'lc-child',
    parentLifecycleId: 'lc-root',
    type: 'feature',
    name: 'Child',
    stage: 'UNDERSTAND',
    targets: ['dkf-framework'],
    sourceFingerprint: FP,
    createdAt: '2026-10-14T18:01:00.000Z',
  });

  advanceToComplete('lc-child', rootDir);
  recordLifecycleAcceptance({
    lifecycleId: 'lc-child',
    state: 'ACCEPTED',
    contractId: 'INC-CHILD',
    runId: 'run-child',
    acceptedAt: '2026-10-14T18:20:00.000Z',
    rootDir,
  });
  const completedChild = completeLifecycleInstance({
    lifecycleId: 'lc-child',
    completedAt: '2026-10-14T18:21:00.000Z',
    rootDir,
  });

  const parent = loadLifecycleInstance('lc-root', rootDir);
  assert.equal(completedChild.status, 'COMPLETE');
  assert.equal(parent.status, 'ACTIVE');
  assert.equal(parent.stage, 'UNDERSTAND');
  assert.equal(parent.acceptanceState, 'PENDING');
});

test('lifecycle completion fails closed without lifecycle-bound acceptance', (t) => {
  const rootDir = tempProject(t);
  createRoot(rootDir);
  advanceToComplete('lc-root', rootDir);

  assert.throws(
    () => completeLifecycleInstance({ lifecycleId: 'lc-root', rootDir }),
    /without ACCEPTED lifecycle acceptance/,
  );

  const accepted = recordLifecycleAcceptance({
    lifecycleId: 'lc-root',
    state: 'ACCEPTED',
    contractId: 'INC-ROOT',
    runId: 'run-root',
    rootDir,
  });
  assert.equal(accepted.acceptanceState, 'ACCEPTED');
  assert.equal(completeLifecycleInstance({ lifecycleId: 'lc-root', rootDir }).status, 'COMPLETE');
});

test('AC-018 arbitrary project state cannot implicitly complete or accept a lifecycle', (t) => {
  const rootDir = tempProject(t);
  createRoot(rootDir);
  const before = lifecycleSummary(loadLifecycleInstance('lc-root', rootDir));

  setProjectStateNamespace({
    namespace: 'domain',
    stateId: 'opportunity',
    value: { status: 'COMPLETE', accepted: true, stage: 'COMPLETE' },
    updatedAt: '2026-10-14T18:05:00.000Z',
    rootDir,
  });

  const after = lifecycleSummary(loadLifecycleInstance('lc-root', rootDir));
  assert.deepEqual(after, before);
  assert.equal(after.status, 'ACTIVE');
  assert.equal(after.acceptanceState, 'PENDING');
});

test('project-owned state namespaces are generic and revisioned independently', (t) => {
  const rootDir = tempProject(t);
  const first = setProjectStateNamespace({
    namespace: 'release',
    stateId: 'candidate',
    value: { status: 'ready' },
    updatedAt: '2026-10-14T18:01:00.000Z',
    rootDir,
  });
  const second = setProjectStateNamespace({
    namespace: 'release',
    stateId: 'candidate',
    value: { status: 'shipped' },
    updatedAt: '2026-10-14T18:02:00.000Z',
    rootDir,
  });

  assert.equal(first.stateRevision, 1);
  assert.equal(second.stateRevision, 2);
  assert.deepEqual(loadProjectStateNamespace('release', 'candidate', rootDir).value, { status: 'shipped' });
});

test('legacy/simple workflow adoption creates one root lifecycle without business inference', (t) => {
  const rootDir = tempProject(t);
  const workflowState = {
    workflowId: 'wf_simple',
    projectId: 'proj-simple',
    frameworkVersion: '0.11.2',
    currentStage: 'PLAN',
    workflowStatus: 'executing',
    createdAt: '2026-10-14T18:00:00.000Z',
  };

  const lifecycle = ensureSingleLifecycleForWorkflow({ workflowState, rootDir });
  assert.equal(lifecycle.lifecycleId, 'lc-wf_simple');
  assert.equal(lifecycle.parentLifecycleId, null);
  assert.equal(lifecycle.stage, 'PLAN');
  assert.equal(lifecycle.status, 'ACTIVE');
  assert.equal(lifecycle.acceptanceState, 'PENDING');
  assert.deepEqual(ensureSingleLifecycleForWorkflow({ workflowState, rootDir }), lifecycle);
});

test('completed legacy workflow is not treated as accepted unless orchestration acceptance is ACCEPTED', (t) => {
  const rootDir = tempProject(t);
  const workflowState = {
    workflowId: 'wf_completed_unaccepted',
    projectId: 'proj-simple',
    frameworkVersion: '0.11.2',
    currentStage: 'COMPLETE',
    workflowStatus: 'completed',
    createdAt: '2026-10-14T18:00:00.000Z',
  };

  const lifecycle = ensureSingleLifecycleForWorkflow({ workflowState, rootDir });
  assert.equal(lifecycle.stage, 'COMPLETE');
  assert.equal(lifecycle.status, 'ACTIVE');
  assert.equal(lifecycle.acceptanceState, 'PENDING');
});

test('accepted simple workflow can be adopted as one completed lifecycle', (t) => {
  const rootDir = tempProject(t);
  const workflowState = {
    workflowId: 'wf_completed_accepted',
    projectId: 'proj-simple',
    frameworkVersion: '0.11.2',
    currentStage: 'COMPLETE',
    workflowStatus: 'completed',
    createdAt: '2026-10-14T18:00:00.000Z',
    orchestration: {
      acceptanceState: 'ACCEPTED',
      sourceFingerprint: FP,
      activeContractId: 'INC-SIMPLE',
      activeRunId: 'run-simple',
    },
  };

  const lifecycle = ensureSingleLifecycleForWorkflow({ workflowState, rootDir });
  assert.equal(lifecycle.status, 'COMPLETE');
  assert.equal(lifecycle.acceptanceState, 'ACCEPTED');
  assert.equal(lifecycle.acceptanceContractId, 'INC-SIMPLE');
});

test('lifecycle entities are indexed by lifecycle ID and State Engine integrity remains valid', (t) => {
  const rootDir = tempProject(t);
  createRoot(rootDir);
  const records = queryStateIndex({ rootDir, lifecycleId: 'lc-root' });
  assert.ok(records.some((record) => record.entityType === 'lifecycle-instance' && record.entityId === 'lc-root'));
  assert.equal(verifyStateEngineIntegrity(rootDir).valid, true);
});

test('published lifecycle schemas remain aligned with runtime versions', () => {
  const lifecycleSchema = JSON.parse(fs.readFileSync(
    new URL('../schemas/lifecycle-instance.schema.json', import.meta.url),
    'utf8',
  ));
  const namespaceSchema = JSON.parse(fs.readFileSync(
    new URL('../schemas/project-state-namespace.schema.json', import.meta.url),
    'utf8',
  ));
  assert.equal(lifecycleSchema.properties.schemaVersion.const, '1.0.0');
  assert.equal(namespaceSchema.properties.schemaVersion.const, '1.0.0');
  assert.ok(lifecycleSchema.properties.stage.enum.includes('COMPLETE'));
});
