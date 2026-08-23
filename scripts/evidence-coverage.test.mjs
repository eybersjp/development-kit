import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  EvidencePersistenceError,
  EvidenceValidationError,
  VERDICTS,
  createVerificationRecord,
  evaluateControlCoverage,
  persistControlManifest,
  persistVerificationRecord,
} from '../runtime/orchestration/evidence-store.mjs';

function contract() {
  return {
    contractId: 'INC-TASK-SEC-01',
    sourceFingerprint: `sha256:${'a'.repeat(64)}`,
    acceptanceCriteria: [
      {
        id: 'AC-SEC-001',
        statement: 'Tenant isolation is enforced',
        requiredEvidence: true,
      },
      {
        id: 'AC-SEC-002',
        statement: 'Direct unauthorized mutation is denied',
        requiredEvidence: true,
      },
      {
        id: 'AC-SEC-003',
        statement: 'No unsupported privilege broadening exists',
        requiredEvidence: false,
      },
    ],
  };
}

function testEvidence(id) {
  return [{ type: 'test', id }];
}

function expectedSecurityControls(count = 23) {
  return Array.from({ length: count }, (_, index) => ({
    id: `SEC-${String(index + 1).padStart(3, '0')}`,
    statement: `Security control ${index + 1}`,
    required: true,
    requiredEvidence: true,
  }));
}

function passingControlResults(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `SEC-${String(index + 1).padStart(3, '0')}`,
    status: 'PASS',
    evidence: testEvidence(`security.control.${index + 1}`),
  }));
}

test('ORCH-002 creates PASS only when every acceptance criterion reaches an acceptance status', () => {
  const record = createVerificationRecord({
    contract: contract(),
    runId: 'run-001',
    role: 'spec-verifier',
    contextIsolation: 'fresh',
    sourceFingerprint: contract().sourceFingerprint,
    createdAt: '2026-08-23T12:00:00.000Z',
    criteria: [
      { id: 'AC-SEC-001', status: 'PASS', evidence: testEvidence('tenant-isolation') },
      { id: 'AC-SEC-002', status: 'PASS', evidence: testEvidence('mutation-denial') },
      { id: 'AC-SEC-003', status: 'PASS', evidence: [] },
    ],
  });

  assert.equal(record.verdict, VERDICTS.PASS);
  assert.equal(record.criteria.length, 3);
});

test('ORCH-002 treats evidence exemption as evidence exemption, not criterion optionality', () => {
  const missing = createVerificationRecord({
    contract: contract(),
    runId: 'run-002',
    role: 'spec-verifier',
    sourceFingerprint: contract().sourceFingerprint,
    criteria: [
      { id: 'AC-SEC-001', status: 'PASS', evidence: testEvidence('tenant-isolation') },
      { id: 'AC-SEC-002', status: 'PASS', evidence: testEvidence('mutation-denial') },
    ],
  });
  assert.equal(missing.verdict, VERDICTS.INCOMPLETE);
  assert.equal(missing.criteria.find((criterion) => criterion.id === 'AC-SEC-003').status, 'UNVERIFIED');

  const failed = createVerificationRecord({
    contract: contract(),
    runId: 'run-003',
    role: 'spec-verifier',
    sourceFingerprint: contract().sourceFingerprint,
    criteria: [
      { id: 'AC-SEC-001', status: 'PASS', evidence: testEvidence('tenant-isolation') },
      { id: 'AC-SEC-002', status: 'PASS', evidence: testEvidence('mutation-denial') },
      { id: 'AC-SEC-003', status: 'FAIL', evidence: [] },
    ],
  });
  assert.equal(failed.verdict, VERDICTS.FAIL);
});

test('ORCH-002 rejects PASS without required evidence', () => {
  assert.throws(
    () => createVerificationRecord({
      contract: contract(),
      runId: 'run-004',
      role: 'spec-verifier',
      sourceFingerprint: contract().sourceFingerprint,
      criteria: [
        { id: 'AC-SEC-001', status: 'PASS', evidence: [] },
      ],
    }),
    /requires evidence/,
  );
});

test('ORCH-002 rejects self-certification by implementation roles', () => {
  assert.throws(
    () => createVerificationRecord({
      contract: contract(),
      runId: 'run-005',
      role: 'implementation-agent',
      sourceFingerprint: contract().sourceFingerprint,
      criteria: [],
    }),
    /may not produce an authoritative verification record/,
  );
});

test('ORCH-002 rejects stale source fingerprints and non-isolated verification contexts', () => {
  assert.throws(
    () => createVerificationRecord({
      contract: contract(),
      runId: 'run-006',
      role: 'spec-verifier',
      sourceFingerprint: `sha256:${'b'.repeat(64)}`,
      criteria: [],
    }),
    /source fingerprint does not match/,
  );

  assert.throws(
    () => createVerificationRecord({
      contract: contract(),
      runId: 'run-007',
      role: 'spec-verifier',
      contextIsolation: 'implementation-context',
      sourceFingerprint: contract().sourceFingerprint,
      criteria: [],
    }),
    /fresh or rehydrated/,
  );
});

test('ORCH-002 rejects unsupported evidence types', () => {
  assert.throws(
    () => createVerificationRecord({
      contract: contract(),
      runId: 'run-008',
      role: 'spec-verifier',
      sourceFingerprint: contract().sourceFingerprint,
      criteria: [
        { id: 'AC-SEC-001', status: 'PASS', evidence: [{ type: 'agent-assertion', value: 'looks good' }] },
      ],
    }),
    /Unsupported evidence type/,
  );
});

test('ORCH-002 reproduces the Proposal Builder security gap: all executed tests pass but missing required controls keep gate INCOMPLETE', () => {
  const manifest = evaluateControlCoverage({
    contractId: 'INC-TASK-04A',
    runId: 'run-security-001',
    domain: 'security',
    expectedControls: expectedSecurityControls(23),
    results: passingControlResults(17),
  });

  assert.equal(manifest.verdict, VERDICTS.INCOMPLETE);
  assert.equal(manifest.coverage.expectedRequired, 23);
  assert.equal(manifest.coverage.verifiedRequired, 17);
  assert.equal(manifest.coverage.percent, 73.91);
  assert.equal(manifest.controls.filter((control) => control.status === 'UNVERIFIED').length, 6);
});

test('ORCH-002 security control manifest passes only after every required control is verified', () => {
  const manifest = evaluateControlCoverage({
    contractId: 'INC-TASK-04A',
    runId: 'run-security-002',
    domain: 'security',
    expectedControls: expectedSecurityControls(23),
    results: passingControlResults(23),
  });

  assert.equal(manifest.verdict, VERDICTS.PASS);
  assert.equal(manifest.coverage.percent, 100);
});

test('ORCH-002 required control failure overrides otherwise complete coverage', () => {
  const results = passingControlResults(23);
  results[4] = {
    id: 'SEC-005',
    status: 'FAIL',
    evidence: [{ type: 'manual', finding: 'Unnecessary service_role grant remains' }],
  };
  const manifest = evaluateControlCoverage({
    contractId: 'INC-TASK-04A',
    runId: 'run-security-003',
    domain: 'security',
    expectedControls: expectedSecurityControls(23),
    results,
  });
  assert.equal(manifest.verdict, VERDICTS.FAIL);
});

test('ORCH-002 rejects control PASS without evidence and NOT_APPLICABLE without reason', () => {
  assert.throws(
    () => evaluateControlCoverage({
      contractId: 'INC-TASK-04A',
      runId: 'run-security-004',
      domain: 'security',
      expectedControls: expectedSecurityControls(1),
      results: [{ id: 'SEC-001', status: 'PASS', evidence: [] }],
    }),
    /requires evidence/,
  );

  assert.throws(
    () => evaluateControlCoverage({
      contractId: 'INC-TASK-04A',
      runId: 'run-security-005',
      domain: 'security',
      expectedControls: expectedSecurityControls(1),
      results: [{ id: 'SEC-001', status: 'NOT_APPLICABLE', evidence: [] }],
    }),
    /requires a reason/,
  );
});

test('ORCH-002 rejects results for controls outside the expected control set', () => {
  assert.throws(
    () => evaluateControlCoverage({
      contractId: 'INC-TASK-04A',
      runId: 'run-security-006',
      domain: 'security',
      expectedControls: expectedSecurityControls(1),
      results: [{ id: 'SEC-999', status: 'PASS', evidence: testEvidence('invented-control') }],
    }),
    /not part of the expected control set/,
  );
});

test('ORCH-002 evidence persistence is immutable and idempotent', (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-evidence-test-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const record = createVerificationRecord({
    contract: contract(),
    runId: 'run-persist-001',
    role: 'spec-verifier',
    sourceFingerprint: contract().sourceFingerprint,
    createdAt: '2026-08-23T12:00:00.000Z',
    criteria: [
      { id: 'AC-SEC-001', status: 'PASS', evidence: testEvidence('tenant-isolation') },
      { id: 'AC-SEC-002', status: 'PASS', evidence: testEvidence('mutation-denial') },
      { id: 'AC-SEC-003', status: 'PASS', evidence: [] },
    ],
  });

  const first = persistVerificationRecord(record, rootDir);
  assert.equal(first.created, true);
  assert.equal(persistVerificationRecord(record, rootDir).created, false);

  const changed = structuredClone(record);
  changed.verdict = 'FAIL';
  assert.throws(() => persistVerificationRecord(changed, rootDir), EvidencePersistenceError);

  const manifest = evaluateControlCoverage({
    contractId: record.contractId,
    runId: record.runId,
    domain: 'security',
    expectedControls: expectedSecurityControls(1),
    results: passingControlResults(1),
  });
  assert.equal(persistControlManifest(manifest, rootDir).created, true);
  assert.equal(persistControlManifest(manifest, rootDir).created, false);
});
