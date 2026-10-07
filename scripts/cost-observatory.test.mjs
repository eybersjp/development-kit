import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  COST_ESTIMATOR,
  appendCostRecord,
  compareCostRecords,
  createCostMeter,
  createCostRecord,
  loadCostRecords,
  measureLogicalText,
  normalizeLogicalText,
  validateCostRecord,
} from '../runtime/orchestration/cost-observatory.mjs';
import { createPolicyBoundDevelopmentContract } from '../runtime/orchestration/contract-policy.mjs';
import { createVerificationRecord } from '../runtime/orchestration/evidence-store.mjs';
import { createReviewResult } from '../runtime/orchestration/review-result.mjs';
import { decideAcceptance } from '../runtime/orchestration/acceptance-engine.mjs';

function tempProject(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-cost-observatory-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  return rootDir;
}

function record(overrides = {}) {
  return createCostRecord({
    operationId: 'operation-001',
    contractId: 'INC-DKF120-T01',
    taskId: 'DKF120-T01',
    role: 'implementation-agent',
    context: 'alpha\nbeta\n',
    startedAt: '2026-10-07T17:00:00.000Z',
    completedAt: '2026-10-07T17:00:01.250Z',
    ...overrides,
  });
}

test('AC-003 newline-normalised logical metrics are identical across LF and CRLF', () => {
  const lf = 'alpha\nbeta\ngamma\n';
  const crlf = 'alpha\r\nbeta\r\ngamma\r\n';

  assert.equal(normalizeLogicalText(crlf), lf);
  assert.deepEqual(measureLogicalText(crlf), measureLogicalText(lf));
  assert.equal(measureLogicalText(lf).estimator, COST_ESTIMATOR);
});

test('AC-001 cost meter records only explicit DKF-controlled counters', () => {
  const meter = createCostMeter();
  meter.increment('repositoryReads', 3);
  meter.increment('toolCalls', 2);
  meter.increment('verificationCommands');
  meter.increment('cacheHits', 4);

  const counters = meter.snapshot();
  assert.deepEqual(counters, {
    repositoryReads: 3,
    repositoryScans: 0,
    agentInvocations: 0,
    toolCalls: 2,
    verificationCommands: 1,
    cacheHits: 4,
    cacheMisses: 0,
  });

  const cost = record({ counters });
  assert.equal(cost.repositoryReads, 3);
  assert.equal(cost.toolCalls, 2);
  assert.equal(cost.verificationCommands, 1);
  assert.equal(cost.cacheHits, 4);
  assert.equal(validateCostRecord(cost), true);
});

test('AC-002 provider token fields are null unless provider telemetry is supplied', () => {
  const unavailable = record();
  assert.equal(unavailable.providerInputTokens, null);
  assert.equal(unavailable.providerOutputTokens, null);
  assert.equal(unavailable.providerCachedTokens, null);

  const observed = record({
    operationId: 'operation-provider',
    providerUsage: {
      inputTokens: 1200,
      outputTokens: 300,
      cachedTokens: 700,
    },
  });
  assert.equal(observed.providerInputTokens, 1200);
  assert.equal(observed.providerOutputTokens, 300);
  assert.equal(observed.providerCachedTokens, 700);
});

test('unknown host counters stay unavailable instead of becoming inferred zeroes', () => {
  const cost = record();
  assert.equal(cost.repositoryReads, null);
  assert.equal(cost.repositoryScans, null);
  assert.equal(cost.agentInvocations, null);
  assert.equal(cost.toolCalls, null);
  assert.equal(cost.verificationCommands, null);
  assert.equal(cost.cacheHits, 0);
  assert.equal(cost.cacheMisses, 0);
});

test('invalid cost values fail closed', () => {
  assert.throws(() => record({ providerUsage: { inputTokens: -1 } }), /non-negative integer/);
  assert.throws(() => record({
    startedAt: '2026-10-07T17:00:02.000Z',
    completedAt: '2026-10-07T17:00:01.000Z',
  }), /may not be before/);
  assert.throws(() => createCostMeter().increment('not-a-counter'), /Unsupported counter/);
});

test('cost ledger uses one append-only JSONL file and validates records on load', (t) => {
  const rootDir = tempProject(t);
  appendCostRecord(record(), rootDir);
  appendCostRecord(record({ operationId: 'operation-002' }), rootDir);

  const loaded = loadCostRecords(rootDir);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].operationId, 'operation-001');
  assert.equal(loaded[1].operationId, 'operation-002');

  const ledgerPath = path.join(rootDir, '.development-kit', 'telemetry', 'cost-records.jsonl');
  assert.equal(fs.existsSync(ledgerPath), true);
  assert.equal(fs.readdirSync(path.dirname(ledgerPath)).length, 1);
});

test('AC-033 comparison reports reductions only for available measurements', () => {
  const baseline = record({
    operationId: 'baseline',
    context: 'x'.repeat(400),
    counters: { repositoryReads: 10, toolCalls: 5 },
  });
  const current = record({
    operationId: 'current',
    context: 'x'.repeat(200),
    counters: { repositoryReads: 4, toolCalls: 5 },
  });

  const comparison = compareCostRecords(baseline, current);
  assert.equal(comparison.metrics.contextBytes.reductionPercent, 50);
  assert.equal(comparison.metrics.repositoryReads.reductionPercent, 60);
  assert.equal(comparison.metrics.toolCalls.reductionPercent, 0);
  assert.equal(comparison.metrics.providerInputTokens.available, false);
  assert.equal(comparison.metrics.providerInputTokens.reductionPercent, null);
});

test('Cost Observatory is observational and cannot alter deterministic acceptance', (t) => {
  const rootDir = tempProject(t);
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs', 'spec.md'), '# Spec\nREQ-1 works.\n', 'utf8');

  const contract = createPolicyBoundDevelopmentContract({
    rootDir,
    task: {
      id: 'TASK-COST-ACCEPTANCE',
      projectId: 'cost-acceptance',
      status: 'approved',
      objective: 'Prove observability does not affect acceptance',
      scope: { in: ['src/'], out: [] },
      requirements: ['REQ-1'],
      acceptanceCriteria: [{
        id: 'AC-COST-ACCEPTANCE',
        statement: 'Feature passes',
        verificationType: ['test'],
        requiredEvidence: true,
      }],
      architectureConstraints: [],
      designConstraints: [],
      securityConstraints: [],
      risk: { level: 0, reasons: [] },
      requiredVerification: ['tests'],
      requiredReviewers: ['code-reviewer'],
    },
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required' }],
    createdAt: '2026-10-07T17:00:00.000Z',
  });

  const verification = createVerificationRecord({
    contract,
    runId: 'run-cost-acceptance',
    role: 'spec-verifier',
    sourceFingerprint: contract.sourceFingerprint,
    createdAt: '2026-10-07T17:01:00.000Z',
    criteria: [{
      id: 'AC-COST-ACCEPTANCE',
      status: 'PASS',
      evidence: [{ type: 'test', id: 'cost-observatory-tests' }],
    }],
  });

  const review = createReviewResult({
    contract,
    runId: 'run-cost-acceptance',
    role: 'code-reviewer',
    sourceFingerprint: contract.sourceFingerprint,
    createdAt: '2026-10-07T17:02:00.000Z',
    findings: [],
  });

  const before = decideAcceptance({ contract, verification, reviews: [review], rootDir });
  appendCostRecord(record({ operationId: 'acceptance-observation' }), rootDir);
  const after = decideAcceptance({ contract, verification, reviews: [review], rootDir });

  assert.equal(before.state, 'ACCEPTED');
  assert.equal(after.state, 'ACCEPTED');
  assert.deepEqual(
    { ...after, createdAt: '<observed-at>' },
    { ...before, createdAt: '<observed-at>' },
  );
});

test('cost-record JSON schema is present and describes the runtime version', () => {
  const schemaPath = new URL('../schemas/cost-record.schema.json', import.meta.url);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  assert.equal(schema.title, 'Development Kit Cost Record');
  assert.equal(schema.properties.schemaVersion.const, '1.0.0');
  assert.equal(schema.properties.contextEstimator.const, COST_ESTIMATOR);
});
