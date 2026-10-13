import assert from 'node:assert/strict';
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
import { CANONICAL_STAGES } from '../runtime/autopilot/transition-model.mjs';

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
  assert.equal(child.status, 'completed');

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
