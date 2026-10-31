import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  createLifecycleInstance,
  advanceLifecycleStage,
  evaluateLifecycleCompletion,
  ensureProjectLifecycle,
  validateLifecycleInstance,
  LifecycleError,
  DEFAULT_ROOT_LIFECYCLE_ID,
  LIFECYCLE_INSTANCE_SCHEMA_VERSION,
} from '../runtime/orchestration/lifecycle-instance.mjs';
import { CANONICAL_STAGES, createInitialState } from '../runtime/autopilot/transition-model.mjs';
import { saveStateRevision } from '../runtime/autopilot/state-store.mjs';

test('AC-016: Lifecycle Instances support parent/child relationships with independent state isolation', () => {
  const parent = createLifecycleInstance({
    name: 'Parent Lifecycle',
    type: 'feature',
    targets: ['dkf-core'],
    stage: 'PLAN',
  });

  assert.equal(parent.schemaVersion, LIFECYCLE_INSTANCE_SCHEMA_VERSION);
  assert.equal(parent.parentLifecycleId, null);
  assert.equal(parent.stage, 'PLAN');
  assert.equal(parent.status, 'active');

  const child = createLifecycleInstance({
    name: 'Child Subtask Lifecycle',
    parentLifecycleId: parent.lifecycleId,
    type: 'subtask',
    targets: ['dkf-core'],
    stage: 'UNDERSTAND',
  });

  assert.equal(child.parentLifecycleId, parent.lifecycleId);
  assert.notEqual(child.lifecycleId, parent.lifecycleId);
  assert.equal(child.stage, 'UNDERSTAND');
  assert.equal(child.status, 'active');

  // Verify full 9 stages supported on both independently
  assert.deepEqual(CANONICAL_STAGES, [
    'UNDERSTAND',
    'DEFINE',
    'DESIGN',
    'PLAN',
    'IMPLEMENT',
    'VERIFY',
    'REVIEW',
    'SIMPLIFY',
    'COMPLETE',
  ]);

  // Advance child independently
  const childAdv1 = advanceLifecycleStage(child, 'DEFINE');
  assert.equal(childAdv1.stage, 'DEFINE');
  assert.equal(parent.stage, 'PLAN'); // Parent unchanged
});

test('AC-016: Lifecycle instance validation rejects invalid IDs and circular parent references', () => {
  assert.throws(
    () => createLifecycleInstance({ lifecycleId: 'bad_id' }),
    /pattern/
  );

  assert.throws(
    () => createLifecycleInstance({ lifecycleId: 'lc-12345678', parentLifecycleId: 'lc-12345678' }),
    /parentLifecycleId cannot equal lifecycleId/
  );

  assert.throws(
    () => createLifecycleInstance({ stage: 'NON_EXISTENT_STAGE' }),
    /Invalid canonical stage/
  );
});

test('AC-017: COMPLETE applies only to the active Lifecycle Instance', () => {
  const parent = createLifecycleInstance({
    name: 'Parent Lifecycle',
    stage: 'IMPLEMENT',
    status: 'active',
  });

  let child = createLifecycleInstance({
    parentLifecycleId: parent.lifecycleId,
    name: 'Child Slice',
    stage: 'SIMPLIFY',
    status: 'active',
  });

  // Advance child to COMPLETE
  child = advanceLifecycleStage(child, 'COMPLETE');
  assert.equal(child.stage, 'COMPLETE');
  assert.equal(child.status, 'active', 'Stage COMPLETE must not persist premature accepted status');

  const pendingChild = evaluateLifecycleCompletion({ instance: child, acceptanceState: 'PENDING' });
  assert.equal(pendingChild.completed, false);
  assert.equal(pendingChild.status, 'active');

  // Evaluate child completion
  const childEval = evaluateLifecycleCompletion({
    instance: child,
    acceptanceState: 'ACCEPTED',
  });
  assert.equal(childEval.completed, true);
  assert.equal(childEval.status, 'completed');

  // Parent lifecycle MUST remain in its active stage (IMPLEMENT) and status (active)
  assert.equal(parent.stage, 'IMPLEMENT');
  assert.equal(parent.status, 'active');

  // Evaluate parent completion: must NOT be complete because parent is not at COMPLETE stage
  const parentEval = evaluateLifecycleCompletion({
    instance: parent,
    acceptanceState: 'ACCEPTED', // Even if some criterion accepted, parent is not COMPLETE
  });
  assert.equal(parentEval.completed, false);
  assert.equal(parentEval.status, 'active');
});

test('AC-018: Domain/application state cannot implicitly change DKF lifecycle acceptance/completion state', () => {
  const instance = createLifecycleInstance({
    name: 'Work Item',
    stage: 'VERIFY',
    status: 'active',
  });

  // Hostile / external business status indicating complete
  const hostileDomainState = {
    isComplete: true,
    completed: true,
    released: true,
    shipped: true,
    status: 'production-shipped',
    businessValueDelivered: 100,
  };

  // Evaluation without formal DKF acceptance
  const result = evaluateLifecycleCompletion({
    instance,
    acceptanceState: 'PENDING',
    domainState: hostileDomainState,
  });

  assert.equal(result.completed, false);
  assert.equal(result.status, 'active');
  assert.equal(result.acceptanceState, 'PENDING');
});

test('AC-018: Legacy single-lifecycle projects behave identically as a single default lifecycle', () => {
  // Fresh project without legacy state
  const defaultInstance = ensureProjectLifecycle();
  assert.equal(defaultInstance.lifecycleId, DEFAULT_ROOT_LIFECYCLE_ID);
  assert.equal(defaultInstance.parentLifecycleId, null);
  assert.equal(defaultInstance.stage, 'UNDERSTAND');
  assert.equal(defaultInstance.status, 'active');

  // Project with existing legacy autopilot state
  const legacyAutopilotState = {
    currentStage: 'PLAN',
    workflowStatus: 'executing',
    stateRevision: 4,
  };

  const adapted = ensureProjectLifecycle({ legacyAutopilotState });
  assert.equal(adapted.lifecycleId, DEFAULT_ROOT_LIFECYCLE_ID);
  assert.equal(adapted.parentLifecycleId, null);
  assert.equal(adapted.stage, 'PLAN');
  assert.equal(adapted.status, 'active');
  assert.equal(adapted.sourceRevision, 4);
});


test('AC-017: stage advancement cannot skip, regress, or self-complete without acceptance', () => {
  const initial = createLifecycleInstance({ name: 'Acceptance guarded lifecycle', stage: 'UNDERSTAND' });
  assert.throws(() => advanceLifecycleStage(initial, 'COMPLETE'), /exactly one canonical stage/);
  assert.throws(() => advanceLifecycleStage(initial, 'PLAN'), /exactly one canonical stage/);
  const defining = advanceLifecycleStage(initial, 'DEFINE');
  assert.throws(() => advanceLifecycleStage(defining, 'UNDERSTAND'), /exactly one canonical stage/);
  assert.throws(() => advanceLifecycleStage(defining, 'DEFINE'), /exactly one canonical stage/);

  const preComplete = createLifecycleInstance({ name: 'Pre-complete instance', stage: 'SIMPLIFY' });
  const completeStage = advanceLifecycleStage(preComplete, 'COMPLETE');
  assert.equal(completeStage.status, 'active');
  for (const verdict of [undefined, 'PENDING', 'FAIL', 'REJECTED']) {
    const decision = evaluateLifecycleCompletion({ instance: completeStage, acceptanceState: verdict });
    assert.equal(decision.completed, false);
    assert.equal(decision.status, 'active');
  }
  assert.equal(evaluateLifecycleCompletion({
    instance: completeStage, acceptanceState: 'ACCEPTED',
  }).completed, true);

  for (const status of ['paused', 'blocked', 'cancelled', 'completed']) {
    const notActive = createLifecycleInstance({ name: 'Non-active lifecycle', status });
    assert.throws(() => advanceLifecycleStage(notActive, 'DEFINE'), /non-active lifecycle/);
  }
});

test('AC-017: lifecycle COMPLETE is not inherited by a parent, nor dictated by external domain flags', () => {
  const parent = createLifecycleInstance({ name: 'Parent', stage: 'SIMPLIFY' });
  const child = advanceLifecycleStage(createLifecycleInstance({
    name: 'Child', parentLifecycleId: parent.lifecycleId, stage: 'SIMPLIFY',
  }), 'COMPLETE');
  const domainState = { status: 'shipped', completed: true, approved: true };
  const childUnaccepted = evaluateLifecycleCompletion({ instance: child, acceptanceState: 'PENDING', domainState });
  assert.equal(childUnaccepted.completed, false);
  assert.equal(parent.status, 'active');
  assert.equal(parent.stage, 'SIMPLIFY');
  assert.equal(evaluateLifecycleCompletion({
    instance: parent, acceptanceState: 'ACCEPTED', domainState,
  }).completed, false);
});

test('AC-017: externally supplied completed status cannot survive unaccepted lifecycle evaluation', () => {
  const userSupplied = createLifecycleInstance({ name: 'Forged completed status', stage: 'COMPLETE', status: 'completed' });
  const pending = evaluateLifecycleCompletion({ instance: userSupplied, acceptanceState: 'PENDING' });
  assert.equal(pending.completed, false);
  assert.notEqual(pending.status, 'completed');
  const rejected = evaluateLifecycleCompletion({ instance: userSupplied, acceptanceState: 'REJECTED' });
  assert.equal(rejected.status, 'active');
});

test('AC-016: implicit legacy lifecycle rehydrates stable persisted snapshot without writes', (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dkf-life-legacy-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const state = createInitialState({}, rootDir);
  state.currentStage = 'REVIEW';
  state.completedStages = ['UNDERSTAND', 'DEFINE', 'DESIGN', 'PLAN', 'IMPLEMENT', 'VERIFY'];
  state.stateRevision = 3;
  // This fixture specifically exercises an existing, unmigrated legacy state
  // authority. Fresh v0.13 projects intentionally use the canonical ledger;
  // seed an actual legacy revision before invoking the compatibility adapter.
  const legacyStateDir = path.join(rootDir, '.development-kit', 'autopilot', 'state');
  fs.mkdirSync(legacyStateDir, { recursive: true });
  fs.writeFileSync(path.join(legacyStateDir, 'revision-000003.json'), JSON.stringify(state, null, 2));
  saveStateRevision(state, rootDir);
  const pointer = path.join(rootDir, '.development-kit', 'autopilot', 'state', 'current.json');
  const previous = fs.readFileSync(pointer);
  const hydrated = ensureProjectLifecycle({ rootDir });
  assert.equal(hydrated.stage, 'REVIEW');
  assert.equal(hydrated.sourceRevision, 3);
  assert.deepEqual(hydrated.completedStages, state.completedStages);
  assert.deepEqual(fs.readFileSync(pointer), previous);
  const explicit = ensureProjectLifecycle({ rootDir, legacyAutopilotState: { currentStage: 'PLAN', stateRevision: 5 } });
  assert.equal(explicit.stage, 'PLAN');
  assert.equal(explicit.sourceRevision, 5);
});
