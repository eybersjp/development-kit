import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createPolicyBoundDevelopmentContract } from '../runtime/orchestration/contract-policy.mjs';
import { createVerificationRecord } from '../runtime/orchestration/evidence-store.mjs';
import {
  createOrchestrationRun,
  loadCurrentRunState,
  loadRunManifest,
  persistRunManifest,
  persistRunStateRevision,
} from '../runtime/orchestration/orchestration-run.mjs';
import { evaluateRun, planCorrection } from '../runtime/orchestration/index.mjs';

function capabilities() {
  return {
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
  };
}

test('orchestration run persists append-only current state and resumes latest revision', (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-run-resume-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs', 'spec.md'), '# Spec\nREQ-1 works.\n', 'utf8');

  const contract = createPolicyBoundDevelopmentContract({
    rootDir,
    task: {
      id: 'TASK-RESUME-001',
      projectId: 'proj-resume',
      status: 'approved',
      objective: 'Persist governed orchestration state',
      scope: { in: ['src/'], out: [] },
      requirements: ['REQ-1'],
      acceptanceCriteria: [{
        id: 'AC-RESUME-001',
        statement: 'Required behavior passes tests',
        verificationType: ['test'],
        requiredEvidence: true,
      }],
      architectureConstraints: [],
      designConstraints: [],
      securityConstraints: [],
      risk: { level: 0, reasons: [] },
      requiredVerification: ['tests'],
      requiredReviewers: [],
    },
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required' }],
    createdAt: '2026-08-24T06:00:00.000Z',
  });

  const run = createOrchestrationRun({
    contract,
    runId: 'run-resume-001',
    capabilities: capabilities(),
    createdAt: '2026-08-24T06:01:00.000Z',
  });
  persistRunManifest(run, rootDir);
  persistRunStateRevision(run, rootDir);

  const verification = createVerificationRecord({
    contract,
    runId: run.runId,
    role: 'spec-verifier',
    sourceFingerprint: contract.sourceFingerprint,
    createdAt: '2026-08-24T06:02:00.000Z',
    criteria: [{
      id: 'AC-RESUME-001',
      status: 'PASS',
      evidence: [{ type: 'test', id: 'resume-tests' }],
    }],
  });

  const evaluated = evaluateRun({ run, contract, verification, rootDir });
  assert.equal(evaluated.acceptance.state, 'ACCEPTED');
  assert.equal(evaluated.run.state, 'ACCEPTED');
  assert.equal(evaluated.run.stateRevision, 2);

  const initial = loadRunManifest(contract.contractId, run.runId, rootDir);
  assert.equal(initial.state, 'READY');
  assert.equal(initial.stateRevision, 1);

  const resumed = loadCurrentRunState(contract.contractId, run.runId, rootDir);
  assert.equal(resumed.state, 'ACCEPTED');
  assert.equal(resumed.stateRevision, 2);
  assert.equal(resumed.acceptanceState, 'ACCEPTED');

  const none = planCorrection({ run: resumed, contract, verification, rootDir });
  assert.equal(none.decision.action, 'NONE');
  assert.equal(none.run.state, 'ACCEPTED');
  assert.equal(none.run.stateRevision, 2);
  assert.equal(loadCurrentRunState(contract.contractId, run.runId, rootDir).stateRevision, 2);

  const forged = structuredClone(resumed);
  forged.state = 'CORRECTING';
  assert.throws(() => persistRunStateRevision(forged, rootDir), /Refusing to overwrite orchestration run state revision/);
});
