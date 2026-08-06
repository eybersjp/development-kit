/**
 * Development Kit Autopilot — Unit Test Suite
 *
 * Runs via `node --test scripts/autopilot.test.mjs`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { validateWorkflowState, validateAction, validateActionResult } from '../runtime/autopilot/validators.mjs';
import { getProjectIdentity } from '../runtime/autopilot/project-identity.mjs';
import { getCurrentState, saveStateRevision, recoverLatestValidState } from '../runtime/autopilot/state-store.mjs';
import { createInitialState, calculateNextAction, beginActionState, recordResultState } from '../runtime/autopilot/transition-model.mjs';
import { acquireTransactionLock, releaseTransactionLock } from '../runtime/autopilot/lock-manager.mjs';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dk-autopilot-test-'));
}

test('1. Project & Workspace Identity Resolution', () => {
  const tmpDir = createTempDir();
  const identity1 = getProjectIdentity(tmpDir);
  assert.ok(identity1.projectId.startsWith('proj_'));
  assert.ok(identity1.workspaceId.startsWith('ws_'));

  // Stable resolution
  const identity2 = getProjectIdentity(tmpDir);
  assert.equal(identity1.projectId, identity2.projectId);
  assert.equal(identity1.workspaceId, identity2.workspaceId);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('2. State Validation', () => {
  const state = {
    schemaVersion: '1.0.0',
    workflowId: 'wf_123',
    projectId: 'proj_456',
    workflowMode: 'autopilot',
    autonomyLevel: 'guided-autopilot',
    workflowStatus: 'executing',
    currentStage: 'UNDERSTAND',
    completedStages: [],
    skippedStages: [],
    blockedStages: [],
    stateRevision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    frameworkVersion: '0.4.0'
  };
  assert.equal(validateWorkflowState(state), true);
});

test('3. Immutable Revision Persistence & Reading', () => {
  const tmpDir = createTempDir();
  const state1 = createInitialState({ autonomy: 'guided-autopilot' }, tmpDir);
  saveStateRevision(state1, tmpDir);

  const loadedState = getCurrentState(tmpDir);
  assert.equal(loadedState.workflowId, state1.workflowId);
  assert.equal(loadedState.stateRevision, 1);

  // Revision 2
  loadedState.stateRevision = 2;
  loadedState.currentStage = 'DEFINE';
  saveStateRevision(loadedState, tmpDir);

  const loadedState2 = getCurrentState(tmpDir);
  assert.equal(loadedState2.stateRevision, 2);
  assert.equal(loadedState2.currentStage, 'DEFINE');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('4. Corrupt Pointer Recovery', () => {
  const tmpDir = createTempDir();
  const state1 = createInitialState({ autonomy: 'guided-autopilot' }, tmpDir);
  saveStateRevision(state1, tmpDir);

  // Corrupt current.json
  const currentFile = path.join(tmpDir, '.development-kit', 'autopilot', 'state', 'current.json');
  fs.writeFileSync(currentFile, '{ "corrupt": true }', 'utf8');

  const recovered = getCurrentState(tmpDir);
  assert.ok(recovered);
  assert.equal(recovered.workflowId, state1.workflowId);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('5. Short Transaction Locking', () => {
  const tmpDir = createTempDir();
  const lock1 = acquireTransactionLock(tmpDir);
  assert.ok(lock1.ownerToken);

  // Acquiring lock again without release should fail/timeout
  assert.throws(() => {
    acquireTransactionLock(tmpDir, 200);
  });

  releaseTransactionLock(lock1);
  const lock2 = acquireTransactionLock(tmpDir);
  assert.ok(lock2.ownerToken);
  releaseTransactionLock(lock2);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('6. Next Action Calculation & Transition', () => {
  const tmpDir = createTempDir();
  const state = createInitialState({ autonomy: 'guided-autopilot' }, tmpDir);
  saveStateRevision(state, tmpDir);

  const action = calculateNextAction(state);
  assert.equal(action.actionType, 'invoke_command');
  assert.equal(action.stage, 'UNDERSTAND');
  assert.equal(action.command, '/dk-idea');

  state.activeAction = action;
  beginActionState(state, action.actionId);
  assert.equal(state.activeAction.status, 'in_progress');

  const resultPayload = {
    workflowId: state.workflowId,
    stateRevision: state.stateRevision,
    actionId: action.actionId,
    status: 'completed'
  };

  const updatedState = recordResultState(state, resultPayload);
  assert.equal(updatedState.currentStage, 'DEFINE');
  assert.equal(updatedState.stateRevision, 2);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
