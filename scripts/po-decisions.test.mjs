import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PODecisionError,
  computePODecisionFingerprint,
  createPODecision,
  createSupersedingPODecision,
  validatePODecision,
  persistPODecision,
  loadPODecisions,
  loadPODecisionById,
} from '../runtime/orchestration/po-decisions.mjs';

test('PODecision: Creates valid decision record with deterministic fingerprint', () => {
  const decision = createPODecision({
    id: 'POD-001',
    statement: 'Use PostgreSQL for persistent storage',
    status: 'APPROVED',
    provenance: 'product-owner',
    affectedRequirements: ['REQ-001', 'REQ-002'],
    affectedArchitectureDecisions: ['ADR-001'],
  });

  assert.equal(decision.id, 'POD-001');
  assert.equal(decision.status, 'APPROVED');
  assert.equal(decision.provenance, 'product-owner');
  assert.ok(decision.fingerprint.startsWith('sha256:'));
  assert.equal(validatePODecision(decision), true);
});

test('PODecision: Rejects invalid ID, missing statement, missing status, or missing provenance', () => {
  assert.throws(
    () => createPODecision({ id: 'INVALID-ID', statement: 'Statement', status: 'APPROVED', provenance: 'product-owner' }),
    (err) => {
      assert.ok(err instanceof PODecisionError);
      assert.match(err.message, /Invalid decision ID/);
      return true;
    },
  );

  assert.throws(
    () => createPODecision({ id: 'POD-002', statement: '  ', status: 'APPROVED', provenance: 'product-owner' }),
    (err) => {
      assert.ok(err instanceof PODecisionError);
      assert.match(err.message, /Decision statement is required/);
      return true;
    },
  );

  assert.throws(
    () => createPODecision({ id: 'POD-003', statement: 'Valid statement', provenance: 'product-owner' }),
    (err) => {
      assert.ok(err instanceof PODecisionError);
      assert.match(err.message, /Decision status is required/);
      return true;
    },
  );

  assert.throws(
    () => createPODecision({ id: 'POD-004', statement: 'Valid statement', status: 'APPROVED' }),
    (err) => {
      assert.ok(err instanceof PODecisionError);
      assert.match(err.message, /Decision provenance is required/);
      return true;
    },
  );
});

test('PODecision: Append-only superseding creates new immutable decision referencing original', () => {
  const original = createPODecision({
    id: 'POD-001',
    statement: 'Original decision',
    status: 'APPROVED',
    provenance: 'product-owner',
  });

  const superseding = createSupersedingPODecision({
    originalDecisionId: 'POD-001',
    id: 'POD-002',
    statement: 'Superseding decision',
    status: 'APPROVED',
    provenance: 'product-owner',
  });

  assert.equal(superseding.id, 'POD-002');
  assert.equal(superseding.supersedes, 'POD-001');
  assert.equal(superseding.status, 'APPROVED');
  assert.equal(validatePODecision(superseding), true);
});

test('PODecision: Persists and loads from disk with deterministic integrity and immutability', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-pod-test-'));
  try {
    const decision = createPODecision({
      id: 'POD-100',
      statement: 'Require TypeScript strictly',
      status: 'APPROVED',
      provenance: 'product-owner',
    });

    const filePath = persistPODecision(decision, tempDir);
    assert.ok(fs.existsSync(filePath));

    const loaded = loadPODecisions(tempDir);
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].id, 'POD-100');
    assert.equal(loaded[0].statement, 'Require TypeScript strictly');

    const byId = loadPODecisionById(tempDir, 'POD-100');
    assert.equal(byId.id, 'POD-100');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
