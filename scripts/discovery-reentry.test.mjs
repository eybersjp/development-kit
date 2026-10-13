import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  createDiscoveryEvent,
  resolveReentryStage,
  computeSelectiveInvalidation,
  validateDiscoveryEvent,
  persistDiscoveryEvent,
  loadDiscoveryEvents,
  DiscoveryError,
  DISCOVERY_EVENT_SCHEMA_VERSION,
} from '../runtime/orchestration/discovery-reentry.mjs';

test('AC-019: Discovery events persist evidence, classification, and affected authority references', () => {
  const event = createDiscoveryEvent({
    lifecycleId: 'lc-1234567890ab',
    taskId: 'DKF120-T06',
    classification: 'implementation-defect',
    description: 'Off-by-one index error in re-entry traversal',
    evidence: {
      type: 'test-failure',
      reference: 'test/discovery.test.mjs:42',
      details: { exitCode: 1 },
    },
    affectedAuthority: [
      {
        path: 'runtime/orchestration/discovery-reentry.mjs',
        kind: 'implementation',
        sections: ['computeSelectiveInvalidation'],
      },
    ],
    affectedTasks: ['DKF120-T06'],
  });

  assert.equal(event.schemaVersion, DISCOVERY_EVENT_SCHEMA_VERSION);
  assert.equal(event.classification, 'implementation-defect');
  assert.equal(event.minimumReentryStage, 'IMPLEMENT');
  assert.equal(event.requiresHumanApproval, false);
  assert.equal(event.evidence.type, 'test-failure');
  assert.equal(event.affectedAuthority.length, 1);
});

test('AC-020: Minimum safe re-entry stage resolved according to authority classification hierarchy', () => {
  // 1. Implementation-only defect -> IMPLEMENT (no human gate)
  const impl = resolveReentryStage({ classification: 'implementation-defect' });
  assert.equal(impl.stage, 'IMPLEMENT');
  assert.equal(impl.requiresHumanApproval, false);

  // 2. Plan invalidation -> PLAN (no human gate)
  const plan = resolveReentryStage({ classification: 'plan-invalidation' });
  assert.equal(plan.stage, 'PLAN');
  assert.equal(plan.requiresHumanApproval, false);

  // 3. Architecture invalidation -> DESIGN (requires human approval)
  const arch = resolveReentryStage({ classification: 'architecture-invalidation' });
  assert.equal(arch.stage, 'DESIGN');
  assert.equal(arch.requiresHumanApproval, true);

  // 4. Specification invalidation -> DEFINE (requires human approval)
  const spec = resolveReentryStage({ classification: 'specification-invalidation' });
  assert.equal(spec.stage, 'DEFINE');
  assert.equal(spec.requiresHumanApproval, true);
});

test('AC-021: Selective invalidation preserves unrelated accepted work across dependency graph', () => {
  const allTasks = [
    { id: 'T01', dependsOn: [] },
    { id: 'T02', dependsOn: ['T01'] },
    { id: 'T03', dependsOn: ['T02'] },
    { id: 'T04', dependsOn: ['T03'] },
    { id: 'T05', dependsOn: ['T04'] },
    { id: 'T06', dependsOn: ['T05'] },
  ];

  // Invalidation affecting only T05:
  // T01, T02, T03, T04 MUST be preserved.
  // T05, T06 MUST be invalidated.
  const result = computeSelectiveInvalidation({
    allTasks,
    affectedTaskIds: ['T05'],
  });

  assert.deepEqual(result.preservedTasks, ['T01', 'T02', 'T03', 'T04']);
  assert.deepEqual(result.invalidatedTasks, ['T05', 'T06']);
  assert.equal(result.preservedCount, 4);
  assert.equal(result.invalidatedCount, 2);
});

test('AC-020: externally supplied discovery events cannot downgrade upstream approval gates', () => {
  for (const classification of ['architecture-invalidation', 'specification-invalidation']) {
    const event = createDiscoveryEvent({
      lifecycleId: 'lc-1234567890ab', classification,
      description: 'New evidence invalidates an upstream authority',
      evidence: { type: 'review', reference: 'record-123' },
    });
    assert.equal(event.requiresHumanApproval, true);
    assert.throws(() => validateDiscoveryEvent({ ...event, requiresHumanApproval: false }),
      /Human approval requirement conflicts/);
  }
  const implementation = createDiscoveryEvent({
    lifecycleId: 'lc-1234567890ab', classification: 'implementation-defect',
    description: 'Implementation correction only',
    evidence: { type: 'test-failure', reference: 'test-456' },
  });
  assert.throws(() => validateDiscoveryEvent({ ...implementation, requiresHumanApproval: true }),
    /Human approval requirement conflicts/);
});

test('AC-020: upstream affected authority cannot be masked by implementation classification', () => {
  for (const [kind, stage, approval] of [
    ['specification', 'DEFINE', true],
    ['architecture', 'DESIGN', true],
    ['plan', 'PLAN', false],
    ['implementation', 'IMPLEMENT', false],
  ]) {
    const authority = [{ path: 'docs/authority.md', kind }];
    const event = createDiscoveryEvent({
      lifecycleId: 'lc-1234567890ab', classification: 'implementation-defect',
      description: 'Source invalidated', evidence: { type: 'review', reference: 'finding' },
      affectedAuthority: authority,
    });
    assert.equal(event.minimumReentryStage, stage);
    assert.equal(event.requiresHumanApproval, approval);
    if (stage !== 'IMPLEMENT') {
      assert.throws(() => validateDiscoveryEvent({ ...event, minimumReentryStage: 'IMPLEMENT' }),
        /minimumReentryStage mismatch/);
    }
    if (approval) assert.throws(() => validateDiscoveryEvent({ ...event, requiresHumanApproval: false }),
      /Human approval requirement conflicts/);
  }
  const mixed = resolveReentryStage({
    classification: 'plan-invalidation',
    affectedAuthority: [{ path: 'a', kind: 'architecture' }, { path: 'b', kind: 'specification' }],
  });
  assert.equal(mixed.stage, 'DEFINE');
  assert.equal(mixed.requiresHumanApproval, true);
  for (const affectedAuthority of [null, [{ path: 'x', kind: 'unknown' }], [{ kind: 'specification' }]]) {
    assert.throws(() => resolveReentryStage({
      classification: 'implementation-defect', affectedAuthority,
    }), DiscoveryError);
  }
});

test('AC-019: project-bound discovery events survive reload, reject edits and invalid persisted content', (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dkf-discovery-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const event = createDiscoveryEvent({
    rootDir, lifecycleId: 'lc-1234567890ab', classification: 'architecture-invalidation',
    description: 'Architecture re-entry required',
    evidence: { type: 'review', reference: 'finding-F1' },
    affectedAuthority: [{ kind: 'architecture', path: 'docs/arch.md' }],
  });
  assert.deepEqual(loadDiscoveryEvents(rootDir), [event]);
  assert.equal(persistDiscoveryEvent(event, rootDir).created, false);
  assert.throws(() => persistDiscoveryEvent({ ...event, description: 'forged revision' }, rootDir),
    /Refusing to overwrite/);
  const pathToEvent = path.join(rootDir, '.development-kit', 'discovery', 'events', event.discoveryId + '.json');
  fs.writeFileSync(pathToEvent, '{malformed:', 'utf8');
  assert.throws(() => loadDiscoveryEvents(rootDir), SyntaxError);
});
