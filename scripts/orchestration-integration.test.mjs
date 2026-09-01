import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  fingerprintCanonicalArtifact,
  reconcileCanonicalArtifact,
} from '../runtime/orchestration/reconciliation.mjs';
import { enforceAutopilotOrchestrationGate } from '../runtime/autopilot/orchestration-result-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

function tempProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-v09-integration-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function orchestration(overrides = {}) {
  return {
    activeContractId: 'INC-TASK-1',
    activeRunId: 'run-1',
    sourceFingerprint: `sha256:${'a'.repeat(64)}`,
    riskLevel: 2,
    correctionAttempt: 0,
    verificationVerdict: 'PASS',
    acceptanceState: 'ACCEPTED',
    requiredGates: ['specification'],
    completedGates: ['specification'],
    ...overrides,
  };
}

test('ORCH-005 canonical amendment applies exact delta and refuses stale replay', (t) => {
  const root = tempProject(t);
  const file = path.join(root, 'docs', 'plan.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'Task count: 20\nStatus: draft\n', 'utf8');
  const before = fingerprintCanonicalArtifact(root, 'docs/plan.md');

  const result = reconcileCanonicalArtifact({
    rootDir: root,
    path: 'docs/plan.md',
    expectedFingerprint: before,
    amendmentId: 'AMD-001',
    operations: [
      { type: 'replace', find: 'Task count: 20', replace: 'Task count: 22', expectedMatches: 1 },
      { type: 'replace', find: 'Status: draft', replace: 'Status: approved', expectedMatches: 1 },
    ],
  });
  assert.equal(result.changed, true);
  assert.match(fs.readFileSync(file, 'utf8'), /Task count: 22/);
  assert.notEqual(result.beforeFingerprint, result.afterFingerprint);

  assert.throws(() => reconcileCanonicalArtifact({
    rootDir: root,
    path: 'docs/plan.md',
    expectedFingerprint: before,
    amendmentId: 'AMD-REPLAY',
    operations: [{ type: 'replace', find: 'Task count: 22', replace: 'Task count: 23' }],
  }), /fingerprint changed/);

  const current = fingerprintCanonicalArtifact(root, 'docs/plan.md');
  assert.throws(() => reconcileCanonicalArtifact({
    rootDir: root,
    path: 'docs/plan.md',
    expectedFingerprint: current,
    amendmentId: 'AMD-BAD-ANCHOR',
    operations: [{ type: 'replace', find: 'text that does not exist', replace: 'x' }],
  }), /anchor match count/);
});

test('Autopilot contract-aware stage completion fails closed while legacy results remain compatible', () => {
  const verifyState = { currentStage: 'VERIFY', orchestration: null };
  assert.throws(() => enforceAutopilotOrchestrationGate(verifyState, {
    status: 'completed',
    orchestration: orchestration({ verificationVerdict: 'FAIL', acceptanceState: 'PENDING' }),
  }), /VERIFY stage cannot complete/);

  const goodVerify = { currentStage: 'VERIFY', orchestration: null };
  assert.equal(enforceAutopilotOrchestrationGate(goodVerify, {
    status: 'completed',
    orchestration: orchestration({ verificationVerdict: 'PASS', acceptanceState: 'PENDING' }),
  }).enforced, true);
  assert.equal(goodVerify.orchestration.verificationVerdict, 'PASS');

  const reviewState = { currentStage: 'REVIEW', orchestration: null };
  assert.throws(() => enforceAutopilotOrchestrationGate(reviewState, {
    status: 'completed',
    orchestration: orchestration({ acceptanceState: 'PENDING' }),
  }), /REVIEW stage cannot complete/);

  const switched = { currentStage: 'VERIFY', orchestration: orchestration() };
  assert.throws(() => enforceAutopilotOrchestrationGate(switched, {
    status: 'completed',
    orchestration: orchestration({ activeContractId: 'INC-OTHER' }),
  }), /changed without an explicit lifecycle transition/);

  assert.equal(enforceAutopilotOrchestrationGate({ currentStage: 'VERIFY' }, { status: 'completed' }).legacy, true);
});

test('orchestration CLI executes fail-closed safety operation', (t) => {
  const root = tempProject(t);
  const script = path.join(REPO_ROOT, 'scripts', 'orchestration.mjs');
  const payload = {
    command: 'docker rm -f $(docker ps -aq)',
    contract: {
      executionSafety: {
        resourceScope: 'project-only',
        destructiveOperations: 'explicit-approval',
        remoteMutation: 'explicit-contract',
      },
    },
    environment: { projectRoot: root },
  };
  const result = spawnSync(process.execPath, [script, '--operation=safety', `--input-json=${JSON.stringify(payload)}`], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.result.decision, 'BLOCK');
  assert.equal(parsed.result.blastRadius, 'host-wide');
});
