import test from 'node:test';
import assert from 'node:assert/strict';

import { enforceAutopilotOrchestrationGate } from '../runtime/autopilot/orchestration-result-gate.mjs';

test('legacy result remains compatible before any Development Contract is bound', () => {
  const state = { currentStage: 'VERIFY' };
  const result = { status: 'completed' };
  assert.deepEqual(enforceAutopilotOrchestrationGate(state, result), { legacy: true, enforced: false });
});

test('contract-aware state cannot omit orchestration evidence and downgrade to legacy mode', () => {
  const state = {
    currentStage: 'VERIFY',
    orchestration: {
      activeContractId: 'INC-TASK-001',
      activeRunId: 'run-001',
      sourceFingerprint: `sha256:${'a'.repeat(64)}`,
      verificationVerdict: 'PASS',
      acceptanceState: 'PENDING',
      requiredGates: [],
      completedGates: [],
    },
  };

  assert.throws(
    () => enforceAutopilotOrchestrationGate(state, { status: 'completed' }),
    /cannot omit orchestration evidence or downgrade to legacy mode/,
  );
});
