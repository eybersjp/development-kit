import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPolicyBoundDevelopmentContract } from '../runtime/orchestration/contract-policy.mjs';
import { buildContextPackage, assertIndependentVerificationContext } from '../runtime/orchestration/context-package.mjs';
import { verifyFromContext } from '../runtime/orchestration/verification-engine.mjs';
import { createReviewResult } from '../runtime/orchestration/review-result.mjs';
import { detectArchitectureDrift } from '../runtime/orchestration/architecture-drift.mjs';
import { decideAcceptance } from '../runtime/orchestration/acceptance-engine.mjs';
import { decideCorrection } from '../runtime/orchestration/correction-engine.mjs';
import { normalizeHostCapabilities, selectExecutionStrategy } from '../runtime/orchestration/host-capabilities.mjs';
import {
  createOrchestrationRun,
  loadRunManifest,
  persistRunManifest,
} from '../runtime/orchestration/orchestration-run.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

function tempProject(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-core-orchestration-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs', 'spec.md'), '# Spec\nREQ-1 Build exactly the approved behavior.\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'docs', 'architecture.md'), '# Architecture\nPreserve the boundary.\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'design.md'), '# Design Authority\nUse the approved UI system.\n', 'utf8');
  return rootDir;
}

function task(overrides = {}) {
  return {
    id: 'TASK-CORE-001',
    projectId: 'proj-core',
    status: 'approved',
    objective: 'Implement the bounded behavior',
    scope: { in: ['src/'], out: ['Do not deploy', 'Do not redesign architecture'] },
    requirements: ['REQ-1'],
    acceptanceCriteria: [
      { id: 'AC-CORE-001', statement: 'Approved behavior works', source: 'REQ-1', verificationType: ['test'], requiredEvidence: true },
    ],
    architectureConstraints: ['Preserve approved boundary'],
    designConstraints: [],
    securityConstraints: [],
    risk: { level: 2, reasons: ['Application logic'] },
    requiredVerification: ['tests'],
    requiredReviewers: ['code-reviewer'],
    ...overrides,
  };
}

function sources() {
  return [
    { path: 'docs/spec.md', kind: 'specification', authority: 'required', sections: ['REQ-1'] },
    { path: 'docs/architecture.md', kind: 'architecture', authority: 'required' },
  ];
}

function capabilities(overrides = {}) {
  return {
    fileRead: true,
    fileWrite: true,
    shell: true,
    git: true,
    freshContext: true,
    subagents: false,
    parallelAgents: false,
    browser: false,
    visualInspection: false,
    externalModelRouting: false,
    ...overrides,
  };
}

function passCriteria() {
  return [{
    id: 'AC-CORE-001',
    status: 'PASS',
    evidence: [{ type: 'test', id: 'core.approved-behavior' }],
  }];
}

function failCriteria() {
  return [{
    id: 'AC-CORE-001',
    status: 'FAIL',
    reason: 'Observed behavior differs from approved behavior',
    evidence: [{ type: 'test', id: 'core.approved-behavior', result: 'failed' }],
  }];
}

test('Phase 3/7 binds Design Authority and independently rehydrates authoritative sources', (t) => {
  const rootDir = tempProject(t);
  const contract = createPolicyBoundDevelopmentContract({
    rootDir,
    task: task({ touchesUi: true, designConstraints: ['Follow design.md'] }),
    authoritativeSources: sources(),
    createdAt: '2026-08-23T20:00:00.000Z',
  });
  const designSource = contract.authoritativeSources.find((source) => source.kind === 'design-authority');
  assert.equal(designSource.path, 'design.md');

  const context = buildContextPackage({
    contract,
    role: 'spec-reviewer',
    rootDir,
    repositoryState: { diff: 'src/page.tsx changed' },
    implementationReport: { claim: 'Everything passes' },
  });
  assert.equal(context.designAuthority.bound, true);
  assert.equal(context.contextIsolation, 'rehydrated');
  assert.match(context.authoritativeSources.find((source) => source.path === 'docs/spec.md').content, /REQ-1/);
  assert.equal(context.upstreamImplementationReport.authority, 'non-authoritative');
  assert.equal(assertIndependentVerificationContext(context), true);
});

test('Phase 3 rejects stale authoritative sources before verifier context can be created', (t) => {
  const rootDir = tempProject(t);
  const contract = createPolicyBoundDevelopmentContract({ rootDir, task: task(), authoritativeSources: sources() });
  fs.appendFileSync(path.join(rootDir, 'docs', 'spec.md'), '\nREQ-2 changed after contract creation\n');
  assert.throws(
    () => buildContextPackage({ contract, role: 'spec-reviewer', rootDir }),
    /stale Development Contract/,
  );
});

test('Phase 3 no-self-certification: implementation context cannot produce authoritative verification', (t) => {
  const rootDir = tempProject(t);
  const contract = createPolicyBoundDevelopmentContract({ rootDir, task: task(), authoritativeSources: sources() });
  const implementer = buildContextPackage({ contract, role: 'implementation-agent', rootDir });
  assert.throws(
    () => verifyFromContext({ contextPackage: implementer, runId: 'run-1', criteria: passCriteria() }),
    /Verification requires a verification context package/,
  );

  const verifier = buildContextPackage({ contract, role: 'spec-reviewer', rootDir });
  const record = verifyFromContext({ contextPackage: verifier, runId: 'run-1', criteria: passCriteria() });
  assert.equal(record.verdict, 'PASS');
  assert.equal(record.contextIsolation, 'rehydrated');
});

test('Phase 4 acceptance is deterministic and cannot be completed by implementation assertion alone', (t) => {
  const rootDir = tempProject(t);
  const contract = createPolicyBoundDevelopmentContract({ rootDir, task: task(), authoritativeSources: sources() });

  const missingVerification = decideAcceptance({ contract, rootDir });
  assert.equal(missingVerification.state, 'PENDING');
  assert.ok(missingVerification.pending.some((item) => item.code === 'MISSING_VERIFICATION'));

  const verifier = buildContextPackage({ contract, role: 'spec-reviewer', rootDir });
  const verification = verifyFromContext({ contextPackage: verifier, runId: 'run-2', criteria: passCriteria() });
  const stillPending = decideAcceptance({ contract, verification, rootDir });
  assert.equal(stillPending.state, 'PENDING');
  assert.ok(stillPending.pending.some((item) => item.code === 'MISSING_REQUIRED_REVIEW'));

  const review = createReviewResult({
    contract,
    runId: 'run-2',
    role: 'code-reviewer',
    sourceFingerprint: contract.sourceFingerprint,
    findings: [],
  });
  const accepted = decideAcceptance({ contract, verification, reviews: [review], rootDir });
  assert.equal(accepted.state, 'ACCEPTED');
  assert.deepEqual(accepted.blockers, []);
  assert.deepEqual(accepted.pending, []);
});

test('Phase 4 structured major review finding blocks acceptance and requires evidence', (t) => {
  const rootDir = tempProject(t);
  const contract = createPolicyBoundDevelopmentContract({ rootDir, task: task(), authoritativeSources: sources() });
  assert.throws(() => createReviewResult({
    contract,
    runId: 'run-review',
    role: 'code-reviewer',
    sourceFingerprint: contract.sourceFingerprint,
    findings: [{ id: 'F-1', title: 'Major issue', severity: 'MAJOR', disposition: 'OPEN' }],
  }), /requires evidence/);

  const verifier = buildContextPackage({ contract, role: 'spec-reviewer', rootDir });
  const verification = verifyFromContext({ contextPackage: verifier, runId: 'run-review', criteria: passCriteria() });
  const review = createReviewResult({
    contract,
    runId: 'run-review',
    role: 'code-reviewer',
    sourceFingerprint: contract.sourceFingerprint,
    findings: [{
      id: 'F-1',
      title: 'Major issue',
      severity: 'MAJOR',
      disposition: 'OPEN',
      evidence: [{ type: 'source', path: 'src/service.ts', range: '10-20' }],
    }],
  });
  assert.equal(review.verdict, 'FAIL');
  assert.equal(decideAcceptance({ contract, verification, reviews: [review], rootDir }).state, 'BLOCKED');
});

test('Phase 5 correction loop is bounded, scope-locked, repeat-aware and risk-aware', (t) => {
  const rootDir = tempProject(t);
  const contract = createPolicyBoundDevelopmentContract({ rootDir, task: task(), authoritativeSources: sources() });
  const verifier = buildContextPackage({ contract, role: 'spec-reviewer', rootDir });
  const failed = verifyFromContext({ contextPackage: verifier, runId: 'run-correct', criteria: failCriteria() });

  const first = decideCorrection({ contract, verification: failed, attempt: 0 });
  assert.equal(first.action, 'CORRECT');
  assert.equal(first.request.attempt, 1);
  assert.deepEqual(first.request.allowedScope, contract.scope.in);
  assert.deepEqual(first.request.prohibitedChanges, contract.scope.out);

  const repeated = decideCorrection({ contract, verification: failed, attempt: 1, priorFailureSignatures: [first.failureSignature] });
  assert.equal(repeated.action, 'PAUSE');
  assert.equal(repeated.reason, 'REPEATED_FAILURE');

  const exhausted = decideCorrection({ contract, verification: failed, attempt: contract.correctionPolicy.maxAttempts });
  assert.equal(exhausted.reason, 'MAX_ATTEMPTS_REACHED');

  const highRiskContract = createPolicyBoundDevelopmentContract({
    rootDir,
    contractId: 'INC-HIGH-RISK',
    task: task({ id: 'TASK-HIGH', risk: { level: 3, reasons: ['Security-sensitive'] } }),
    authoritativeSources: sources(),
  });
  const highContext = buildContextPackage({ contract: highRiskContract, role: 'spec-reviewer', rootDir });
  const highFailed = verifyFromContext({ contextPackage: highContext, runId: 'run-high', criteria: failCriteria() });
  assert.equal(decideCorrection({ contract: highRiskContract, verification: highFailed }).reason, 'HIGH_RISK_REQUIRES_HUMAN');
});

test('Phase 6 architecture drift requires a decision for unauthorized new dependency', () => {
  const report = detectArchitectureDrift({
    baseline: { dependencies: ['fastify'] },
    current: { dependencies: ['fastify', 'left-pad'] },
  });
  assert.equal(report.verdict, 'BLOCKED');
  assert.equal(report.findings[0].classification, 'REQUIRES_DECISION');

  const authorized = detectArchitectureDrift({
    baseline: { dependencies: ['fastify'] },
    current: { dependencies: ['fastify', 'approved-lib'] },
    authorizedChanges: ['dependency:approved-lib'],
  });
  assert.equal(authorized.verdict, 'PASS');
  assert.equal(authorized.findings[0].classification, 'AUTHORIZED');
});

test('Phase 8 host capability strategy degrades to sequential fresh context and never skips mandatory isolation', (t) => {
  const rootDir = tempProject(t);
  const contract = createPolicyBoundDevelopmentContract({ rootDir, task: task(), authoritativeSources: sources() });

  assert.equal(selectExecutionStrategy({ capabilities: capabilities(), contract }).strategy, 'sequential-fresh-context');
  assert.equal(selectExecutionStrategy({ capabilities: capabilities({ subagents: true }), contract }).strategy, 'native-multi-agent');
  assert.equal(selectExecutionStrategy({ capabilities: capabilities({ freshContext: false }), contract }).strategy, 'blocked');

  const ui = selectExecutionStrategy({ capabilities: capabilities(), contract, requiresVisualEvidence: true });
  assert.equal(ui.manualEvidenceRequired, true);
  assert.equal(normalizeHostCapabilities(capabilities()).schemaVersion, '1.0.0');
});

test('Phase 8 orchestration run manifest survives restart and is immutable', (t) => {
  const rootDir = tempProject(t);
  const contract = createPolicyBoundDevelopmentContract({ rootDir, task: task(), authoritativeSources: sources() });
  const run = createOrchestrationRun({
    contract,
    runId: 'run-resume',
    capabilities: capabilities(),
  });
  const first = persistRunManifest(run, rootDir);
  assert.equal(first.created, true);
  assert.equal(persistRunManifest(run, rootDir).created, false);
  assert.deepEqual(loadRunManifest(contract.contractId, run.runId, rootDir), run);

  const mutated = structuredClone(run);
  mutated.state = 'IMPLEMENTING';
  assert.throws(() => persistRunManifest(mutated, rootDir), /Refusing to overwrite/);
});

test('Core orchestration schemas are present and valid JSON', () => {
  const files = [
    'evidence-record.schema.json',
    'verification-result.schema.json',
    'review-result.schema.json',
    'correction-request.schema.json',
    'host-capabilities.schema.json',
    'orchestration-run.schema.json',
  ];
  for (const file of files) {
    const schema = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'schemas', file), 'utf8'));
    assert.ok(schema.$schema);
    assert.ok(schema.title);
  }
});
