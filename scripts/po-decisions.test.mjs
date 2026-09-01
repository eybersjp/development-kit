import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PODecisionError,
  computePODecisionFingerprint,
  createPODecision,
  supersedePODecision,
  validatePODecision,
} from '../runtime/orchestration/po-decisions.mjs';

test('PODecision: Creates valid decision record with deterministic fingerprint', () => {
  const decision = createPODecision({
    id: 'POD-001',
    statement: 'Use PostgreSQL for persistent storage',
    affectedRequirements: ['REQ-001', 'REQ-002'],
    affectedArchitectureDecisions: ['ADR-001'],
  });

  assert.equal(decision.id, 'POD-001');
  assert.equal(decision.status, 'APPROVED');
  assert.ok(decision.fingerprint.startsWith('sha256:'));
  assert.equal(validatePODecision(decision), true);
});

test('PODecision: Rejects invalid ID or missing statement', () => {
  assert.throws(
    () => createPODecision({ id: 'INVALID-ID', statement: 'Statement' }),
    (err) => {
      assert.ok(err instanceof PODecisionError);
      assert.match(err.message, /Invalid decision ID/);
      return true;
    },
  );

  assert.throws(
    () => createPODecision({ id: 'POD-002', statement: '  ' }),
    (err) => {
      assert.ok(err instanceof PODecisionError);
      assert.match(err.message, /Decision statement is required/);
      return true;
    },
  );
});

test('PODecision: Superseding marks status and records new decision ID correctly', () => {
  const original = createPODecision({
    id: 'POD-001',
    statement: 'Original decision',
  });

  const superseded = supersedePODecision(original, 'POD-002');
  assert.equal(superseded.status, 'SUPERSEDED');
  assert.equal(superseded.supersededBy, 'POD-002');

  assert.throws(
    () => supersedePODecision(superseded, 'POD-003'),
    (err) => {
      assert.ok(err instanceof PODecisionError);
      assert.match(err.message, /already superseded/);
      return true;
    },
  );
});

test('PODecision: Persists and loads from disk with deterministic integrity', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { persistPODecision, loadPODecisions } = await import('../runtime/orchestration/po-decisions.mjs');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-pod-test-'));
  const decision = createPODecision({
    id: 'POD-100',
    statement: 'Require TypeScript strictly',
  });

  const filePath = persistPODecision(decision, tempDir);
  assert.ok(fs.existsSync(filePath));

  const loaded = loadPODecisions(tempDir);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'POD-100');
  assert.equal(loaded[0].statement, 'Require TypeScript strictly');
});

