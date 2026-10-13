import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { test } from 'node:test';
import {
  checkNumericTolerance,
  evaluateInvariant,
  checkDatasetFreshness,
  VerificationExtensionRegistry,
  executeVerificationExtensions,
  VerificationExtensionError,
} from '../runtime/orchestration/verification-extension-sdk.mjs';
import { createDevelopmentContract } from '../runtime/orchestration/development-contract.mjs';
import { decideAcceptance } from '../runtime/orchestration/acceptance-engine.mjs';
import { createVerificationRecord } from '../runtime/orchestration/evidence-store.mjs';

test('AC-025: Generic numeric tolerance primitives support absolute and relative bounds', () => {
  // Absolute tolerance test
  const absPass = checkNumericTolerance({
    actual: 10.05,
    expected: 10.00,
    absoluteTolerance: 0.1,
  });
  assert.equal(absPass.pass, true);

  const absFail = checkNumericTolerance({
    actual: 10.15,
    expected: 10.00,
    absoluteTolerance: 0.1,
  });
  assert.equal(absFail.pass, false);
  assert.ok(absFail.reason.includes('Exceeded absolute tolerance'));

  // Relative tolerance test (e.g. 5%)
  const relPass = checkNumericTolerance({
    actual: 104,
    expected: 100,
    relativeTolerance: 0.05,
  });
  assert.equal(relPass.pass, true);

  const relFail = checkNumericTolerance({
    actual: 106,
    expected: 100,
    relativeTolerance: 0.05,
  });
  assert.equal(relFail.pass, false);
  assert.ok(relFail.reason.includes('Exceeded relative tolerance'));
});

test('AC-026: Custom invariants evaluate correctly and can fail closed', () => {
  const passingInvariant = evaluateInvariant({
    name: 'positive-balance',
    condition: (val) => val.balance >= 0,
    value: { balance: 50 },
  });
  assert.equal(passingInvariant.pass, true);

  const failingInvariant = evaluateInvariant({
    name: 'positive-balance',
    condition: (val) => val.balance >= 0,
    value: { balance: -10 },
  });
  assert.equal(failingInvariant.pass, false);
  assert.ok(failingInvariant.reason.includes('violated'));
});

test('AC-027: Reference dataset fingerprinting detects freshness and stale data', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-ext-test-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const dataFile = path.join(tempDir, 'golden.json');
  fs.writeFileSync(dataFile, JSON.stringify({ a: 1 }), 'utf8');

  const content = fs.readFileSync(dataFile);
  const validHash = `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;

  const fresh = checkDatasetFreshness({
    datasetPath: dataFile,
    expectedFingerprint: validHash,
  });
  assert.equal(fresh.fresh, true);

  const stale = checkDatasetFreshness({
    datasetPath: dataFile,
    expectedFingerprint: 'sha256:' + 'f'.repeat(64),
  });
  assert.equal(stale.fresh, false);
  assert.ok(stale.reason.includes('Fingerprint mismatch'));
});

test('AC-038 & AC-037: Two materially different example extensions run without core changes', () => {
  const registry = new VerificationExtensionRegistry();

  // Extension 1: Financial ledger tolerance extension
  const financialExtension = {
    extensionId: 've-financial-tolerance',
    name: 'Financial Ledger Tolerance Extension',
    version: '1.0.0',
    checkTypes: ['numeric-tolerance', 'reconciliation-invariant'],
    referenceDatasets: [],
  };

  // Extension 2: Geometry CAD boundary extension
  const cadExtension = {
    extensionId: 've-cad-geometry',
    name: 'CAD Geometry Invariant Extension',
    version: '1.0.0',
    checkTypes: ['bounding-box-check', 'normal-vector-invariant'],
    referenceDatasets: [],
  };

  registry.register(financialExtension);
  registry.register(cadExtension);

  assert.equal(registry.list().length, 2);
  assert.equal(registry.get('ve-financial-tolerance').name, 'Financial Ledger Tolerance Extension');
  assert.equal(registry.get('ve-cad-geometry').name, 'CAD Geometry Invariant Extension');
});

test('AC-025: numeric verification fails closed on nonfinite and absent tolerance', () => {
  assert.equal(checkNumericTolerance({ actual: 10, expected: 10 }).pass, true);
  const unequal = checkNumericTolerance({ actual: 100, expected: 1 });
  assert.equal(unequal.pass, false, 'Omitted tolerance is not unconditional acceptance');
  assert.match(unequal.reason, /no tolerance/i);

  for (const nonfinite of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(() => checkNumericTolerance({ actual: nonfinite, expected: 1, absoluteTolerance: 1 }));
    assert.throws(() => checkNumericTolerance({ actual: 1, expected: nonfinite, relativeTolerance: 1 }));
    assert.throws(() => checkNumericTolerance({ actual: 1, expected: 1, absoluteTolerance: nonfinite }));
    assert.throws(() => checkNumericTolerance({ actual: 1, expected: 1, relativeTolerance: nonfinite }));
  }

  assert.equal(checkNumericTolerance({
    actual: 1e308, expected: -1e308, absoluteTolerance: 1,
  }).pass, false, 'Overflowed difference cannot verify');
  assert.equal(checkNumericTolerance({
    actual: 100, expected: 1e308, relativeTolerance: 1e308,
  }).pass, false, 'Overflowed tolerance threshold cannot verify');
});

test('AC-026: two distinct project validators execute and failed output blocks canonical acceptance', async t => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-ext-acceptance-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs', 'spec.md'), '# Required verification\nREQ-1\n');
  const contract = createDevelopmentContract({
    rootDir,
    task: {
      id: 'TASK-EXT-001', projectId: 'proj-ext', status: 'approved',
      objective: 'Project-specific extensions must not self-accept',
      scope: { in: ['.'], out: [] }, requirements: ['REQ-1'],
      acceptanceCriteria: [
        { id: 'AC-FIN', statement: 'Financial invariant', source: 'REQ-1',
          verificationType: ['tests'], requiredEvidence: true },
        { id: 'AC-GEO', statement: 'Geometry invariant', source: 'REQ-1',
          verificationType: ['tests'], requiredEvidence: true },
      ],
      approvalPolicy: { requiredExtensions: [
        { extensionId: 've-financial', criterionId: 'AC-FIN' },
        { extensionId: 've-geometry', criterionId: 'AC-GEO' },
      ] },
    },
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required' }],
  });
  const registry = new VerificationExtensionRegistry();
  registry.register({
    extensionId: 've-financial', name: 'Financial totals',
    verify: ({ actual, expected }) => checkNumericTolerance({ actual, expected, absoluteTolerance: 0.05 }),
  });
  registry.register({
    extensionId: 've-geometry', name: 'Geometry topology',
    verify: ({ points }) => evaluateInvariant({ name: 'nonempty-geometry',
      condition: value => value.points.length > 2, value: { points } }),
  });
  const execution = await executeVerificationExtensions({
    contract, registry,
    bindings: [
      { extensionId: 've-financial', criterionId: 'AC-FIN', input: { actual: 100.1, expected: 100 } },
      { extensionId: 've-geometry', criterionId: 'AC-GEO', input: { points: [[0, 0], [1, 1]] } },
    ],
  });
  assert.deepEqual(execution.map(x => x.status), ['FAIL', 'FAIL']);
  const evidence = createVerificationRecord({
    contract, runId: 'run-ext-0001', role: 'test-engineer',
    sourceFingerprint: contract.sourceFingerprint,
    criteria: execution.map(x => ({ id: x.id, status: x.status, evidence: [], reason: x.reason })),
  });
  assert.equal(evidence.verdict, 'FAIL');
  const outcome = decideAcceptance({ contract, verification: evidence, rootDir });
  assert.equal(outcome.state, 'BLOCKED');
  assert.ok(outcome.blockers.some(x => x.code === 'REQUIRED_EXTENSION_FAILED'));
  const missing = decideAcceptance({ contract, rootDir });
  assert.equal(missing.state, 'PENDING');
  assert.ok(missing.pending.some(x => x.code === 'REQUIRED_EXTENSION_UNVERIFIED'));
  const absent = await executeVerificationExtensions({
    contract, registry: new VerificationExtensionRegistry(), bindings: [],
  });
  assert.deepEqual(absent.map(x => x.status), ['FAIL', 'FAIL']);
});

test('F8: Adversarial test - Acceptance requires strictly bound, passing extension evidence matching extensionId, criterion, and source fingerprint', async t => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-ext-f8-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs', 'spec.md'), '# Required verification\nREQ-1\n');

  const contract = createDevelopmentContract({
    rootDir,
    task: {
      id: 'TASK-EXT-F8', projectId: 'proj-ext-f8', status: 'approved',
      objective: 'Verify strict extension evidence binding',
      scope: { in: ['.'], out: [] }, requirements: ['REQ-1'],
      acceptanceCriteria: [
        { id: 'AC-EXT-1', statement: 'Custom math invariant', source: 'REQ-1',
          verificationType: ['tests'], requiredEvidence: true },
      ],
      approvalPolicy: {
        requiredExtensions: [
          { extensionId: 've-math-check', criterionId: 'AC-EXT-1' },
        ],
      },
    },
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required' }],
  });

  // 1. Adversarial Case: Unrelated PASS evidence without matching extensionId
  const unrelatedEvidenceRecord = createVerificationRecord({
    contract, runId: 'run-f8-1', role: 'test-engineer',
    sourceFingerprint: contract.sourceFingerprint,
    criteria: [{
      id: 'AC-EXT-1',
      status: 'PASS',
      evidence: [{ type: 'test', id: 'generic-test-passed' }],
    }],
  });
  const outcomeUnbound = decideAcceptance({ contract, verification: unrelatedEvidenceRecord, rootDir });
  assert.equal(outcomeUnbound.state, 'BLOCKED');
  assert.ok(outcomeUnbound.blockers.some(b => b.code === 'REQUIRED_EXTENSION_EVIDENCE_UNBOUND' && b.extensionId === 've-math-check'),
    'Must block when evidence is not bound to required extensionId');

  // 2. Adversarial Case: Forged/mismatched extensionId
  const forgedEvidenceRecord = createVerificationRecord({
    contract, runId: 'run-f8-2', role: 'test-engineer',
    sourceFingerprint: contract.sourceFingerprint,
    criteria: [{
      id: 'AC-EXT-1',
      status: 'PASS',
      evidence: [{ type: 'test', extensionId: 've-other-extension' }],
    }],
  });
  const outcomeForged = decideAcceptance({ contract, verification: forgedEvidenceRecord, rootDir });
  assert.equal(outcomeForged.state, 'BLOCKED');
  assert.ok(outcomeForged.blockers.some(b => b.code === 'REQUIRED_EXTENSION_EVIDENCE_UNBOUND'));

  // 3. Adversarial Case: Extension result failed despite criterion status PASS
  const failedExtensionEvidenceRecord = createVerificationRecord({
    contract, runId: 'run-f8-3', role: 'test-engineer',
    sourceFingerprint: contract.sourceFingerprint,
    criteria: [{
      id: 'AC-EXT-1',
      status: 'PASS',
      evidence: [{ type: 'test', extensionId: 've-math-check', result: 'FAIL' }],
    }],
  });
  const outcomeFailedExt = decideAcceptance({ contract, verification: failedExtensionEvidenceRecord, rootDir });
  assert.equal(outcomeFailedExt.state, 'BLOCKED');
  assert.ok(outcomeFailedExt.blockers.some(b => b.code === 'REQUIRED_EXTENSION_EVIDENCE_FAILED'));

  // 4. Adversarial Case: Extension evidence bound to wrong criterionId
  const mismatchedCriterionRecord = createVerificationRecord({
    contract, runId: 'run-f8-4', role: 'test-engineer',
    sourceFingerprint: contract.sourceFingerprint,
    criteria: [{
      id: 'AC-EXT-1',
      status: 'PASS',
      evidence: [{ type: 'test', extensionId: 've-math-check', result: 'PASS', criterionId: 'AC-WRONG' }],
    }],
  });
  const outcomeMismatchedCrit = decideAcceptance({ contract, verification: mismatchedCriterionRecord, rootDir });
  assert.equal(outcomeMismatchedCrit.state, 'BLOCKED');
  assert.ok(outcomeMismatchedCrit.blockers.some(b => b.code === 'REQUIRED_EXTENSION_CRITERION_MISMATCH'));

  // 5. Adversarial Case: Stale/mismatched source fingerprint on extension evidence
  const mismatchedFingerprintRecord = createVerificationRecord({
    contract, runId: 'run-f8-5', role: 'test-engineer',
    sourceFingerprint: contract.sourceFingerprint,
    criteria: [{
      id: 'AC-EXT-1',
      status: 'PASS',
      evidence: [{ type: 'test', extensionId: 've-math-check', result: 'PASS', sourceFingerprint: 'sha256:' + '0'.repeat(64) }],
    }],
  });
  const outcomeMismatchedFp = decideAcceptance({ contract, verification: mismatchedFingerprintRecord, rootDir });
  assert.equal(outcomeMismatchedFp.state, 'BLOCKED');
  assert.ok(outcomeMismatchedFp.blockers.some(b => b.code === 'REQUIRED_EXTENSION_SOURCE_MISMATCH'));
});
