import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  ISOLATION_LEVELS,
  ContextPackageError,
  assertIndependentVerificationContext,
  buildContextPackage,
} from '../runtime/orchestration/context-package.mjs';
import { createDevelopmentContract } from '../runtime/orchestration/development-contract.mjs';
import { verifyFromContext } from '../runtime/orchestration/verification-engine.mjs';

function mockContract(overrides = {}) {
  const rootDir = path.resolve('.');
  const task = {
    id: 'TASK-ISO',
    projectId: 'test-project',
    status: 'approved',
    objective: 'Test verification isolation',
    scope: { in: ['runtime/'], out: [] },
    requirements: ['req-1'],
    acceptanceCriteria: [
      {
        id: 'AC-1',
        statement: 'Criteria 1',
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

test('ISOLATION_LEVELS: Rejects self-certification by implementation role', () => {
  const contract = mockContract();
  const implContext = buildContextPackage({
    contract,
    role: 'implementation-agent',
  });

  assert.throws(
    () => assertIndependentVerificationContext(implContext),
    (err) => {
      assert.ok(err instanceof ContextPackageError);
      assert.match(err.message, /Verification requires a verification context package/);
      return true;
    },
  );
});

test('ISOLATION_LEVELS: Computes and records L1 through L4 metadata truthfully', () => {
  const contract = mockContract();

  const l2Context = buildContextPackage({
    contract,
    role: 'spec-verifier',
  });
  assert.equal(l2Context.isolationLevel, ISOLATION_LEVELS.L2);
  assert.equal(l2Context.isolationMetadata.separateAgentRole, true);
  assert.equal(l2Context.isolationMetadata.sourceRehydrated, true);

  const l3Context = buildContextPackage({
    contract,
    role: 'spec-verifier',
    separateProcess: true,
  });
  assert.equal(l3Context.isolationLevel, ISOLATION_LEVELS.L3);
  assert.equal(l3Context.isolationMetadata.separateProcess, true);

  const l4Context = buildContextPackage({
    contract,
    role: 'spec-verifier',
    externalVerifier: true,
  });
  assert.equal(l4Context.isolationLevel, ISOLATION_LEVELS.L4);
  assert.equal(l4Context.isolationMetadata.externalVerifier, true);
});

test('ISOLATION_LEVELS: verifyFromContext succeeds only with independent verification context', () => {
  const contract = mockContract();
  const verifierContext = buildContextPackage({
    contract,
    role: 'spec-verifier',
  });

  const record = verifyFromContext({
    contextPackage: verifierContext,
    runId: 'RUN-ISO-01',
    criteria: [
      {
        id: 'AC-1',
        status: 'PASS',
        evidence: [
          {
            type: 'test',
            command: 'npm test',
            exitCode: 0,
            deterministicVerification: true,
          },
        ],
      },
    ],
  });

  assert.equal(record.verdict, 'PASS');
  assert.equal(record.role, 'spec-verifier');
});
