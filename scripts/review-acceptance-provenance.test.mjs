import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createPolicyBoundDevelopmentContract } from '../runtime/orchestration/contract-policy.mjs';
import { createVerificationRecord } from '../runtime/orchestration/evidence-store.mjs';
import { createReviewResult, validateReviewResult } from '../runtime/orchestration/review-result.mjs';
import { decideAcceptance } from '../runtime/orchestration/acceptance-engine.mjs';

function setup(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-review-provenance-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs', 'spec.md'), '# Spec\nREQ-1 works.\n', 'utf8');

  const contract = createPolicyBoundDevelopmentContract({
    rootDir,
    task: {
      id: 'TASK-REVIEW-001',
      projectId: 'proj-review-provenance',
      status: 'approved',
      objective: 'Validate review and approval provenance',
      scope: { in: ['src/'], out: [] },
      requirements: ['REQ-1'],
      acceptanceCriteria: [{
        id: 'AC-REVIEW-001',
        statement: 'Core behavior passes tests',
        verificationType: ['test'],
        requiredEvidence: true,
      }],
      architectureConstraints: [],
      designConstraints: [],
      securityConstraints: [],
      risk: { level: 0, reasons: [] },
      requiredVerification: ['tests'],
      requiredReviewers: ['code-reviewer'],
    },
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required' }],
    createdAt: '2026-08-24T06:30:00.000Z',
  });

  const verification = createVerificationRecord({
    contract,
    runId: 'run-review-001',
    role: 'spec-verifier',
    sourceFingerprint: contract.sourceFingerprint,
    createdAt: '2026-08-24T06:31:00.000Z',
    criteria: [{
      id: 'AC-REVIEW-001',
      status: 'PASS',
      evidence: [{ type: 'test', id: 'review-tests' }],
    }],
  });

  return { rootDir, contract, verification };
}

test('persisted review validation rechecks major finding evidence', (t) => {
  const { contract } = setup(t);
  const review = createReviewResult({
    contract,
    runId: 'run-review-001',
    role: 'code-reviewer',
    sourceFingerprint: contract.sourceFingerprint,
    createdAt: '2026-08-24T06:32:00.000Z',
    findings: [{
      id: 'F-001',
      title: 'Known residual risk',
      severity: 'MAJOR',
      disposition: 'ACCEPTED_RISK',
      approvalId: 'approval-risk-001',
      evidence: [{ type: 'diff', path: 'src/example.js' }],
    }],
  });

  const forged = structuredClone(review);
  forged.findings[0].evidence = [];
  assert.throws(() => validateReviewResult(forged), /MAJOR finding F-001 requires evidence/);
});

test('accepted-risk finding requires a real contract-bound approval before acceptance', (t) => {
  const { rootDir, contract, verification } = setup(t);
  const review = createReviewResult({
    contract,
    runId: verification.runId,
    role: 'code-reviewer',
    sourceFingerprint: contract.sourceFingerprint,
    createdAt: '2026-08-24T06:32:00.000Z',
    findings: [{
      id: 'F-RISK-001',
      title: 'Accepted residual risk',
      severity: 'MAJOR',
      disposition: 'ACCEPTED_RISK',
      approvalId: 'approval-risk-001',
      evidence: [{ type: 'diff', path: 'src/example.js' }],
    }],
  });

  const missing = decideAcceptance({ contract, verification, reviews: [review], rootDir });
  assert.equal(missing.state, 'PENDING');
  assert.ok(missing.pending.some((item) => item.code === 'MISSING_ACCEPTED_RISK_APPROVAL' && item.approvalId === 'approval-risk-001'));

  const approved = decideAcceptance({
    contract,
    verification,
    reviews: [review],
    approvals: [{
      id: 'approval-risk-001',
      status: 'approved',
      contractId: contract.contractId,
      sourceFingerprint: contract.sourceFingerprint,
    }],
    rootDir,
  });
  assert.equal(approved.state, 'ACCEPTED');
});

test('review evidence from another run cannot be mixed into active-run acceptance', (t) => {
  const { rootDir, contract, verification } = setup(t);
  const review = createReviewResult({
    contract,
    runId: 'run-review-OTHER',
    role: 'code-reviewer',
    sourceFingerprint: contract.sourceFingerprint,
    createdAt: '2026-08-24T06:32:00.000Z',
    findings: [],
  });

  const acceptance = decideAcceptance({ contract, verification, reviews: [review], rootDir });
  assert.equal(acceptance.state, 'BLOCKED');
  assert.ok(acceptance.blockers.some((item) => item.code === 'REVIEW_RUN_MISMATCH'));
});
