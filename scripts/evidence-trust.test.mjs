import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  TRUST_LEVELS,
  EvidenceValidationError,
  createVerificationRecord,
  inferTrustLevel,
} from '../runtime/orchestration/evidence-store.mjs';
import { createDevelopmentContract } from '../runtime/orchestration/development-contract.mjs';

function mockContract(overrides = {}) {
  const rootDir = path.resolve('.');
  const task = {
    id: 'TASK-EVID',
    projectId: 'test-project',
    status: 'approved',
    objective: 'Test evidence trust levels',
    scope: { in: ['runtime/'], out: [] },
    requirements: ['req-1'],
    acceptanceCriteria: [
      {
        id: 'AC-1',
        statement: 'Criteria requiring test verification',
        source: null,
        verificationType: ['test'],
        requiredEvidence: true,
      },
    ],
    architectureConstraints: [],
    designConstraints: [],
    securityConstraints: [],
    executionSafety: {
      resourceScope: 'project-only',
      destructiveOperations: 'explicit-approval',
      remoteMutation: 'explicit-contract',
    },
    risk: { level: 1, reasons: [] },
    requiredVerification: ['test'],
    requiredReviewers: ['code-reviewer'],
    correctionPolicy: { maxAttempts: 3 },
    ...overrides,
  };

  return createDevelopmentContract({
    rootDir,
    projectId: 'test-project',
    task,
    authoritativeSources: [
      {
        path: 'package.json',
        kind: 'project-source',
        authority: 'required',
        sections: [],
      },
    ],
  });
}

test('TRUST_LEVELS: inferTrustLevel correctly classifies E0 through E4', () => {
  assert.equal(inferTrustLevel({ type: 'assertion', statement: 'I ran the tests' }), TRUST_LEVELS.E0);
  assert.equal(inferTrustLevel({ type: 'source', path: 'src/index.js' }), TRUST_LEVELS.E1);
  assert.equal(inferTrustLevel({ type: 'diff', path: 'src/index.js' }), TRUST_LEVELS.E1);
  assert.equal(inferTrustLevel({ type: 'test', exitCode: 0, commandFingerprint: 'sha256:123' }), TRUST_LEVELS.E2);
  assert.equal(inferTrustLevel({ type: 'test', exitCode: 0, deterministicVerification: true }), TRUST_LEVELS.E3);
  assert.equal(inferTrustLevel({ type: 'external', authoritativeExternalState: true }), TRUST_LEVELS.E4);
});

test('TRUST_LEVELS: Rejects manual upgrade of unverified evidence to higher trust level', () => {
  const contract = mockContract();

  assert.throws(
    () => {
      createVerificationRecord({
        contract,
        runId: 'RUN-001',
        role: 'spec-verifier',
        sourceFingerprint: contract.sourceFingerprint,
        criteria: [
          {
            id: 'AC-1',
            status: 'PASS',
            evidence: [
              {
                type: 'assertion',
                trustLevel: 'E3', // Fraudulent upgrade
                statement: 'I promise tests passed',
              },
            ],
          },
        ],
      });
    },
    (err) => {
      assert.ok(err instanceof EvidenceValidationError);
      assert.match(err.message, /Declared evidence trust level E3 exceeds proven level E0/);
      return true;
    },
  );
});

test('TRUST_LEVELS: PASS criterion cannot be satisfied solely by E0 assertions', () => {
  const contract = mockContract();

  assert.throws(
    () => {
      createVerificationRecord({
        contract,
        runId: 'RUN-001',
        role: 'spec-verifier',
        sourceFingerprint: contract.sourceFingerprint,
        criteria: [
          {
            id: 'AC-1',
            status: 'PASS',
            evidence: [
              {
                type: 'assertion',
                statement: 'I ran tests and they passed',
              },
            ],
          },
        ],
      });
    },
    (err) => {
      assert.ok(err instanceof EvidenceValidationError);
      assert.match(err.message, /cannot be satisfied by E0 agent assertions alone/);
      return true;
    },
  );
});

test('TRUST_LEVELS: Valid E2/E3 test execution evidence produces valid PASS verification record', () => {
  const contract = mockContract();

  const record = createVerificationRecord({
    contract,
    runId: 'RUN-001',
    role: 'spec-verifier',
    sourceFingerprint: contract.sourceFingerprint,
    criteria: [
      {
        id: 'AC-1',
        status: 'PASS',
        evidence: [
          {
            type: 'test',
            command: 'npm test',
            exitCode: 0,
            commandFingerprint: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            deterministicVerification: true,
          },
        ],
      },
    ],
  });

  assert.equal(record.verdict, 'PASS');
  assert.equal(record.criteria[0].evidence[0].trustLevel, 'E3');
});
