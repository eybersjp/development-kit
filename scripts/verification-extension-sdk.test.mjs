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
  VerificationExtensionError,
} from '../runtime/orchestration/verification-extension-sdk.mjs';

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
