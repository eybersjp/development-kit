import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

import {
  ExecutionBroker,
  ExecutionBrokerError,
  OPERATION_CLASSES,
} from '../runtime/orchestration/execution-broker.mjs';
import {
  BLAST_RADIUS,
  DECISIONS,
  fingerprintCommand,
} from '../runtime/orchestration/execution-safety.mjs';

import { createDevelopmentContract } from '../runtime/orchestration/development-contract.mjs';

function mockContract(overrides = {}) {
  const rootDir = path.resolve('.');
  const task = {
    id: 'TASK-01',
    projectId: 'test-project',
    status: 'approved',
    objective: 'Test execution broker',
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
      ...overrides.executionSafety,
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

test('ExecutionBroker evaluates non-destructive commands cleanly and permits execution', () => {
  const broker = new ExecutionBroker({
    contract: mockContract(),
    runId: 'RUN-001',
  });

  const evaluation = broker.evaluate({ command: 'node -v' });
  assert.equal(evaluation.decision, DECISIONS.ALLOW);
  assert.equal(evaluation.destructive, false);
  assert.equal(evaluation.remoteMutation, false);
  assert.equal(evaluation.mediationSupported, true);

  const execResult = broker.execute({ command: 'node -v' });
  assert.equal(execResult.success, true);
  assert.equal(execResult.exitCode, 0);
  assert.match(execResult.stdout, /^v\d+\./);
  assert.equal(broker.getExecutionLog().length, 1);
});

test('ExecutionBroker blocks host-wide destructive commands like docker rm -f $(docker ps -aq)', () => {
  const broker = new ExecutionBroker({
    contract: mockContract(),
    runId: 'RUN-001',
  });

  const command = 'docker rm -f $(docker ps -aq)';
  const evaluation = broker.evaluate({ command });
  assert.equal(evaluation.decision, DECISIONS.BLOCK);
  assert.equal(evaluation.blastRadius, BLAST_RADIUS.HOST_WIDE);

  assert.throws(
    () => broker.execute({ command }),
    (err) => {
      assert.ok(err instanceof ExecutionBrokerError);
      assert.match(err.message, /Command execution blocked by safety policy/);
      return true;
    },
  );
});

test('ExecutionBroker requires approval for project-scoped destructive operations and allows once approved', () => {
  const broker = new ExecutionBroker({
    contract: mockContract(),
    runId: 'RUN-001',
  });

  const command = 'rm -rf .next';
  const pendingEval = broker.evaluate({ command });
  assert.equal(pendingEval.decision, DECISIONS.REQUIRE_APPROVAL);

  assert.throws(
    () => broker.execute({ command }),
    (err) => {
      assert.ok(err instanceof ExecutionBrokerError);
      assert.match(err.message, /Command requires explicit approval/);
      return true;
    },
  );

  // Register approval matching fingerprint
  broker.registerApproval({
    commandFingerprint: fingerprintCommand(command),
    destructiveOperations: true,
  });

  const approvedEval = broker.evaluate({ command });
  assert.equal(approvedEval.decision, DECISIONS.ALLOW);
});

test('ExecutionBroker fails closed when host capability guaranteedMediation is false and mediation is required', () => {
  const broker = new ExecutionBroker({
    contract: mockContract(),
    runId: 'RUN-001',
    capabilities: { guaranteedMediation: false },
  });

  const evaluation = broker.evaluate({ command: 'node -v' });
  assert.equal(evaluation.mediationSupported, false);
  assert.match(evaluation.mediationLimitation, /Host environment does not support guaranteed execution interception/);

  assert.throws(
    () => broker.execute({ command: 'node -v', requireGuaranteedMediation: true }),
    (err) => {
      assert.ok(err instanceof ExecutionBrokerError);
      assert.match(err.message, /Execution blocked: Host environment does not support guaranteed execution interception/);
      return true;
    },
  );
});

test('ExecutionBroker honors contract forbidden destructive operations even with registered approval', () => {
  const broker = new ExecutionBroker({
    contract: mockContract({
      executionSafety: {
        resourceScope: 'project-only',
        destructiveOperations: 'forbidden',
        remoteMutation: 'forbidden',
      },
    }),
    runId: 'RUN-001',
  });

  const command = 'git reset --hard HEAD';
  broker.registerApproval({
    commandFingerprint: fingerprintCommand(command),
    destructiveOperations: true,
  });

  const evaluation = broker.evaluate({ command });
  assert.equal(evaluation.decision, DECISIONS.BLOCK);
  assert.match(evaluation.blockers.join('; '), /Development Contract forbids destructive operations/);

  assert.throws(
    () => broker.execute({ command }),
    (err) => {
      assert.ok(err instanceof ExecutionBrokerError);
      return true;
    },
  );
});
