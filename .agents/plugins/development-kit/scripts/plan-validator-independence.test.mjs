import test from 'node:test';
import assert from 'node:assert/strict';

import { validatePlanModel } from '../runtime/orchestration/plan-validator.mjs';

test('independent parallel tasks are valid when deterministic plan invariants are satisfied', () => {
  const report = validatePlanModel({
    declaredTaskCount: 2,
    declaredDependencyEdges: [],
    requiredResources: ['resource-a', 'resource-b'],
    requiredAcceptanceCriteria: ['AC-001', 'AC-002'],
    tasks: [
      { id: 'TASK-01', dependsOn: [], owns: ['resource-a'], acceptanceCriteria: ['AC-001'] },
      { id: 'TASK-02', dependsOn: [], owns: ['resource-b'], acceptanceCriteria: ['AC-002'] },
    ],
  });

  assert.equal(report.valid, true);
  assert.deepEqual(report.issues, []);
  assert.equal(report.computed.taskCount, 2);
  assert.deepEqual(report.computed.dependencyEdges, []);
});
