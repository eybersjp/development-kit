import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeComplexityDelta,
  COMPLEXITY_DELTA_SCHEMA_VERSION,
} from '../runtime/orchestration/complexity-delta.mjs';

test('AC-028: Identical diff inputs produce strictly identical deterministic complexity deltas', () => {
  const input1 = {
    filesAdded: 2,
    filesRemoved: 1,
    filesModified: 3,
    linesAdded: 150,
    linesDeleted: 20,
    dependenciesAdded: ['dep-a', 'dep-b'],
    abstractionsExported: ['funcX', 'classY'],
  };

  const input2 = {
    filesAdded: 2,
    filesRemoved: 1,
    filesModified: 3,
    linesAdded: 150,
    linesDeleted: 20,
    dependenciesAdded: ['dep-b', 'dep-a'], // Differently ordered
    abstractionsExported: ['classY', 'funcX'],
  };

  const delta1 = computeComplexityDelta(input1);
  const delta2 = computeComplexityDelta(input2);

  assert.equal(delta1.schemaVersion, COMPLEXITY_DELTA_SCHEMA_VERSION);
  assert.equal(delta1.deltaId, delta2.deltaId);
  assert.deepEqual(delta1.dependenciesAdded, ['dep-a', 'dep-b']);
  assert.deepEqual(delta1.abstractionsExported, ['classY', 'funcX']);
  assert.equal(delta1.requiresSimplicityReview, delta2.requiresSimplicityReview);
});

test('AC-029: Low-complexity diff avoids optional heavy simplicity review invocation', () => {
  const lowComplexity = computeComplexityDelta({
    filesAdded: 1,
    filesRemoved: 0,
    filesModified: 1,
    linesAdded: 20,
    linesDeleted: 5,
    dependenciesAdded: [],
    abstractionsExported: ['smallHelper'],
    riskLevel: 1,
  });

  assert.equal(lowComplexity.requiresSimplicityReview, false);
  assert.equal(lowComplexity.triggerReasons.length, 0);
});

test('AC-029: Policy or risk case still invokes mandatory simplicity review', () => {
  // Case A: High risk (level 3) MUST invoke simplicity review even on small diff
  const highRisk = computeComplexityDelta({
    filesAdded: 0,
    filesRemoved: 0,
    filesModified: 1,
    linesAdded: 5,
    linesDeleted: 2,
    riskLevel: 3,
  });
  assert.equal(highRisk.requiresSimplicityReview, true);
  assert.ok(highRisk.triggerReasons.some((r) => r.includes('risk level 3')));

  // Case B: Dependency added MUST invoke simplicity review
  const depAdded = computeComplexityDelta({
    filesAdded: 0,
    dependenciesAdded: ['new-package'],
    riskLevel: 1,
  });
  assert.equal(depAdded.requiresSimplicityReview, true);
  assert.ok(depAdded.triggerReasons.some((r) => r.includes('dependencies')));
});
