import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createPolicyBoundDevelopmentContract } from '../runtime/orchestration/contract-policy.mjs';
import { createVerificationRecord, evaluateControlCoverage } from '../runtime/orchestration/evidence-store.mjs';
import { createReviewResult } from '../runtime/orchestration/review-result.mjs';
import { detectArchitectureDrift } from '../runtime/orchestration/architecture-drift.mjs';
import { decideAcceptance } from '../runtime/orchestration/acceptance-engine.mjs';
import { reconcileCanonicalArtifact } from '../runtime/orchestration/reconciliation.mjs';

function project(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-failclosed-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs', 'spec.md'), '# Spec\nREQ-1 secure behavior\n', 'utf8');
  return rootDir;
}

function highRiskContract(rootDir) {
  return createPolicyBoundDevelopmentContract({
    rootDir,
    task: {
      id: 'TASK-HIGH-RISK',
      projectId: 'proj-failclosed',
      status: 'approved',
      objective: 'Implement security-sensitive behavior',
      scope: { in: ['src/'], out: ['No architecture redesign'] },
      requirements: ['REQ-1'],
      acceptanceCriteria: [{ id: 'AC-HIGH-001', statement: 'Secure behavior is implemented', verificationType: ['test'], requiredEvidence: true }],
      architectureConstraints: ['Preserve architecture'],
      designConstraints: [],
      securityConstraints: ['Least privilege'],
      risk: { level: 3, reasons: ['Authorization-sensitive'] },
      requiredVerification: ['tests', 'security'],
      requiredReviewers: [],
    },
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required', sections: ['REQ-1'] }],
  });
}

function review(contract, role) {
  return createReviewResult({
    contract,
    runId: 'run-high-risk',
    role,
    sourceFingerprint: contract.sourceFingerprint,
    findings: [],
  });
}

test('acceptance derives risk-based reviewer and control gates instead of trusting sparse contract arrays', (t) => {
  const rootDir = project(t);
  const contract = highRiskContract(rootDir);
  const verification = createVerificationRecord({
    contract,
    runId: 'run-high-risk',
    role: 'spec-verifier',
    contextIsolation: 'rehydrated',
    sourceFingerprint: contract.sourceFingerprint,
    criteria: [{ id: 'AC-HIGH-001', status: 'PASS', evidence: [{ type: 'test', id: 'secure.behavior' }] }],
  });

  const incomplete = decideAcceptance({ contract, verification, rootDir });
  assert.equal(incomplete.state, 'PENDING');
  assert.deepEqual(incomplete.requiredGates.reviewers, ['architecture-reviewer', 'code-reviewer', 'security-reviewer']);
  assert.deepEqual(incomplete.requiredGates.controlDomains, ['security']);
  const pendingCodes = incomplete.pending.map((item) => `${item.code}:${item.role ?? item.domain ?? ''}`);
  assert.ok(pendingCodes.includes('MISSING_REQUIRED_REVIEW:code-reviewer'));
  assert.ok(pendingCodes.includes('MISSING_REQUIRED_REVIEW:security-reviewer'));
  assert.ok(pendingCodes.includes('MISSING_REQUIRED_REVIEW:architecture-reviewer'));
  assert.ok(pendingCodes.includes('MISSING_CONTROL_DOMAIN:security'));
  assert.ok(pendingCodes.includes('MISSING_ARCHITECTURE_DRIFT_REVIEW:'));

  const securityManifest = evaluateControlCoverage({
    contractId: contract.contractId,
    runId: 'run-high-risk',
    domain: 'security',
    expectedControls: [{ id: 'SEC-001', statement: 'Least privilege verified', required: true, requiredEvidence: true }],
    results: [{ id: 'SEC-001', status: 'PASS', evidence: [{ type: 'test', id: 'least-privilege' }] }],
  });
  const drift = detectArchitectureDrift({ baseline: { dependencies: [] }, current: { dependencies: [] } });
  const accepted = decideAcceptance({
    contract,
    verification,
    reviews: [review(contract, 'code-reviewer'), review(contract, 'security-reviewer'), review(contract, 'architecture-reviewer')],
    controlManifests: [securityManifest],
    architectureDrift: drift,
    rootDir,
  });
  assert.equal(accepted.state, 'ACCEPTED');
});

test('canonical reconciliation refuses amendments that omit the expected source fingerprint', (t) => {
  const rootDir = project(t);
  fs.writeFileSync(path.join(rootDir, 'docs', 'plan.md'), 'Task count: 20\n', 'utf8');
  assert.throws(() => reconcileCanonicalArtifact({
    rootDir,
    path: 'docs/plan.md',
    amendmentId: 'AMD-NO-FINGERPRINT',
    operations: [{ type: 'replace', find: '20', replace: '22' }],
  }), /expectedFingerprint is required/);
});
