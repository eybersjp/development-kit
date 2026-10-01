import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { bootstrapProject } from '../runtime/bootstrap/project-bootstrap.mjs';
import { changeDevelopmentMode } from '../runtime/development-modes/config-store.mjs';
import {
  captureDevelopmentModeSnapshot,
  createDevelopmentModeSnapshot,
  getDevelopmentModeGuidance,
  resolveModeAwareArtifactLevel,
  validateDevelopmentModeSnapshot,
} from '../runtime/development-modes/integration.mjs';
import { createDevelopmentContract } from '../runtime/orchestration/development-contract.mjs';

function tempProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-mode-integration-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'spec.md'), '# Spec\nREQ-1: preserve reliability.\n');
  return root;
}

function task(id = 'TASK-MODE-001') {
  return {
    id,
    projectId: 'proj-mode-test',
    status: 'approved',
    objective: 'Exercise Development Mode integration',
    scope: { in: ['mode integration'], out: [] },
    requirements: ['REQ-1'],
    acceptanceCriteria: [{ id: 'AC-MODE-001', statement: 'Mode is contract-bound', verificationType: ['test'] }],
    requiredVerification: ['tests'],
    requiredReviewers: ['spec-reviewer'],
  };
}

test('MODE-INT-001 captures persisted mode with deterministic immutable fingerprint', async (t) => {
  const root = tempProject(t);
  assert.equal((await bootstrapProject(root, { modeConfig: { schemaVersion: 1, mode: 'spec-driven' } })).success, true);
  const one = captureDevelopmentModeSnapshot(root);
  const two = captureDevelopmentModeSnapshot(root);
  assert.deepEqual(one, two);
  assert.equal(one.revision, 1);
  assert.equal(one.resolved.mode, 'spec-driven');
  assert.equal(validateDevelopmentModeSnapshot(one), true);
  assert.match(one.fingerprint, /^sha256:[a-f0-9]{64}$/);
});

test('MODE-INT-002 absent legacy mode can be represented only as explicit backward-compatible Balanced snapshot', (t) => {
  const root = tempProject(t);
  const snapshot = captureDevelopmentModeSnapshot(root);
  assert.equal(snapshot.source, 'backward-compatible-default');
  assert.equal(snapshot.revision, 0);
  assert.equal(snapshot.resolved.mode, 'balanced');
  assert.throws(
    () => captureDevelopmentModeSnapshot(root, { allowBackwardCompatibleDefault: false }),
    /bootstrap or migrate/,
  );
});

test('MODE-INT-003 mode guidance cannot remove mandatory controls', () => {
  for (const mode of ['rapid', 'balanced', 'spec-driven', 'doc-driven']) {
    const snapshot = createDevelopmentModeSnapshot({ revision: 1, source: 'persisted', selection: { schemaVersion: 1, mode } });
    const guidance = getDevelopmentModeGuidance(snapshot);
    assert.ok(guidance.mandatoryControls.includes('independent-evidence-backed-verification'));
    assert.ok(guidance.mandatoryControls.includes('execution-safety-and-required-human-approvals'));
    assert.ok(guidance.mandatoryControls.includes('release-validation'));
  }
});

test('MODE-INT-004 artifact depth responds deterministically to methodology without weakening risk-derived base', () => {
  const rapid = createDevelopmentModeSnapshot({ revision: 1, selection: { schemaVersion: 1, mode: 'rapid' } });
  const spec = createDevelopmentModeSnapshot({ revision: 1, selection: { schemaVersion: 1, mode: 'spec-driven' } });
  const docs = createDevelopmentModeSnapshot({ revision: 1, selection: { schemaVersion: 1, mode: 'doc-driven' } });

  assert.equal(resolveModeAwareArtifactLevel({ baseLevel: 'standard', behaviorChange: true, snapshot: rapid }), 'standard');
  assert.equal(resolveModeAwareArtifactLevel({ baseLevel: 'small', behaviorChange: true, snapshot: spec }), 'standard');
  assert.equal(resolveModeAwareArtifactLevel({ baseLevel: 'standard', behaviorChange: true, snapshot: docs }), 'comprehensive');
  assert.equal(resolveModeAwareArtifactLevel({ baseLevel: 'comprehensive', behaviorChange: false, snapshot: rapid }), 'comprehensive');
});

test('MODE-INT-005 Maintenance & Evolution requires repository audit and inherits selected methodology', () => {
  const snapshot = createDevelopmentModeSnapshot({
    revision: 2,
    selection: { schemaVersion: 1, mode: 'maintenance-evolution', baseMethodology: 'spec-driven' },
  });
  const guidance = getDevelopmentModeGuidance(snapshot);
  assert.equal(guidance.requireRepositoryAudit, true);
  assert.equal(guidance.baseMethodology, 'spec-driven');
  assert.equal(guidance.requireFeatureSpecification, true);
});

test('MODE-INT-006 Development Contract binds current mode snapshot and later mode change does not rewrite it', async (t) => {
  const root = tempProject(t);
  assert.equal((await bootstrapProject(root, { modeConfig: { schemaVersion: 1, mode: 'spec-driven' } })).success, true);

  const contract = createDevelopmentContract({
    rootDir: root,
    task: task(),
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required' }],
    createdAt: '2026-10-01T06:30:00.000Z',
  });
  assert.equal(contract.developmentMode.resolved.mode, 'spec-driven');
  assert.equal(contract.developmentMode.revision, 1);
  const originalFingerprint = contract.developmentMode.fingerprint;

  changeDevelopmentMode(root, { schemaVersion: 1, mode: 'rapid' }, {
    expectedRevision: 1,
    reason: 'Approved methodology change for future work',
    actor: 'product-owner',
  });

  assert.equal(contract.developmentMode.resolved.mode, 'spec-driven');
  assert.equal(contract.developmentMode.fingerprint, originalFingerprint);

  const later = createDevelopmentContract({
    rootDir: root,
    task: task('TASK-MODE-002'),
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required' }],
    createdAt: '2026-10-01T06:31:00.000Z',
  });
  assert.equal(later.developmentMode.resolved.mode, 'rapid');
  assert.equal(later.developmentMode.revision, 2);
  assert.notEqual(later.developmentMode.fingerprint, originalFingerprint);
});

test('MODE-INT-007 tampered snapshot fails closed', () => {
  const snapshot = structuredClone(createDevelopmentModeSnapshot({
    revision: 1,
    selection: { schemaVersion: 1, mode: 'balanced' },
  }));
  snapshot.resolved.effectivePolicies.testingDepth = 'essential';
  assert.throws(() => validateDevelopmentModeSnapshot(snapshot), /does not match/);
});
