import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createVerificationRecord } from '../runtime/orchestration/evidence-store.mjs';
import { createPolicyBoundDevelopmentContract } from '../runtime/orchestration/contract-policy.mjs';
import { decideAcceptance } from '../runtime/orchestration/acceptance-engine.mjs';

function fingerprint(char = 'a') {
  return `sha256:${char.repeat(64)}`;
}

test('PASS criterion must prove its declared verification type', () => {
  const contract = {
    contractId: 'INC-EVIDENCE-KIND',
    sourceFingerprint: fingerprint(),
    acceptanceCriteria: [{
      id: 'AC-BROWSER-001',
      statement: 'Interactive flow works in a browser',
      verificationType: ['browser'],
      requiredEvidence: true,
    }],
  };

  assert.throws(() => createVerificationRecord({
    contract,
    runId: 'run-evidence-kind-1',
    role: 'spec-verifier',
    sourceFingerprint: contract.sourceFingerprint,
    criteria: [{
      id: 'AC-BROWSER-001',
      status: 'PASS',
      evidence: [{ type: 'test', id: 'unit-only' }],
    }],
  }), /requires browser verification evidence/);

  const record = createVerificationRecord({
    contract,
    runId: 'run-evidence-kind-2',
    role: 'spec-verifier',
    sourceFingerprint: contract.sourceFingerprint,
    criteria: [{
      id: 'AC-BROWSER-001',
      status: 'PASS',
      evidence: [{ type: 'browser', id: 'browser-flow' }],
    }],
  });

  assert.equal(record.verdict, 'PASS');
  assert.deepEqual(record.criteria[0].verificationType, ['browser']);
});

test('acceptance stays pending when a contract-level required verification class is not covered', (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-required-verification-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs', 'spec.md'), '# Spec\nBrowser proof is required.\n', 'utf8');

  const contract = createPolicyBoundDevelopmentContract({
    rootDir,
    task: {
      id: 'TASK-VERIFICATION-GAP',
      projectId: 'proj-verification-gap',
      status: 'approved',
      objective: 'Prove required verification coverage',
      scope: { in: ['src/'], out: [] },
      requirements: ['REQ-1'],
      acceptanceCriteria: [{
        id: 'AC-VERIFICATION-001',
        statement: 'Core logic passes tests',
        verificationType: ['test'],
        requiredEvidence: true,
      }],
      architectureConstraints: [],
      designConstraints: [],
      securityConstraints: [],
      risk: { level: 0, reasons: [] },
      requiredVerification: ['browser'],
      requiredReviewers: [],
    },
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required' }],
  });

  const verification = createVerificationRecord({
    contract,
    runId: 'run-verification-gap',
    role: 'spec-verifier',
    sourceFingerprint: contract.sourceFingerprint,
    criteria: [{
      id: 'AC-VERIFICATION-001',
      status: 'PASS',
      evidence: [{ type: 'test', id: 'core-tests' }],
    }],
  });

  const acceptance = decideAcceptance({ contract, verification, rootDir });
  assert.equal(acceptance.state, 'PENDING');
  assert.ok(acceptance.pending.some((item) => item.code === 'MISSING_REQUIRED_VERIFICATION' && item.verification === 'browser'));
});
