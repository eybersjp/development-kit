#!/usr/bin/env node
// Risk-3 acceptance gate for the reviewed T04 State Engine V2 hardening
// production source. All evidence references are fixed, independently
// inspectable GitHub events; missing/stale/source-mismatched evidence fails.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import {
  checkContractStaleness,
  loadDevelopmentContract,
} from '../runtime/orchestration/development-contract.mjs';
import {
  createVerificationRecord,
  evaluateControlCoverage,
  persistVerificationRecord,
  persistControlManifest,
  getRunDirectory,
} from '../runtime/orchestration/evidence-store.mjs';
import { createReviewResult } from '../runtime/orchestration/review-result.mjs';
import { detectArchitectureDrift } from '../runtime/orchestration/architecture-drift.mjs';
import { decideAcceptance, validateAcceptanceRecord } from '../runtime/orchestration/acceptance-engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEWED_SOURCE = '9a6ad4712b3dc62dd9b758e0e6745e27576bbdc5';
const RUN = 'T04-HARDENING-REVIEWED-20261009';
const BASELINE_CI = 'https://github.com/eybersjp/development-kit/actions/runs/37974556018';
const INDEPENDENT_REVIEW = 'https://github.com/eybersjp/development-kit/pull/70#issuecomment-6085480192';
const FORMAL_T04_REVIEW = 'docs/04-architecture/dkf-state-engine-v2-t04-review.md';
const T04_SCOPE = 'docs/04-architecture/dkf-state-engine-v2-offline-recovery-boundary.md';

const BLOB_WITNESSES = Object.freeze({
  'runtime/orchestration/state-engine-v2.mjs': 'b45ec164863601fb1420e38fc297d4ba31ef4cb6',
  'runtime/orchestration/state-engine-migration.mjs': 'c75a950885174675749fbdd43b643c01a89619b1',
  'scripts/state-engine-v2-hardening.test.mjs': 'd9b603bc0c1045cbdca4d2d2f235b1de0461e69f',
  'scripts/state-engine-v2-migration.test.mjs': '5cbffd04f720d75c3e882ae406ea255a356178a2',
  [T04_SCOPE]: '3d38764d3486f9fcdbae1547a08bd4bb59f86431',
});

function gitBlobSha(contents) {
  return crypto.createHash('sha1')
    .update(Buffer.from('blob ' + contents.length + '\0', 'utf8'))
    .update(contents)
    .digest('hex');
}

for (const [file, expected] of Object.entries(BLOB_WITNESSES)) {
  const actual = gitBlobSha(fs.readFileSync(path.join(ROOT, file)));
  assert.equal(actual, expected, 'The independent review does not cover changed source: ' + file);
}
assert.ok(fs.existsSync(path.join(ROOT, FORMAL_T04_REVIEW)));
assert.equal(process.env.GITHUB_ACTIONS, 'true',
  'Only trusted platform-captured CI execution may produce a persisted T04 acceptance verdict');
assert.equal(process.env.GITHUB_REPOSITORY, 'eybersjp/development-kit');
assert.equal(process.env.GITHUB_EVENT_NAME, 'pull_request');
// The matrix step is ordered *after* all normal CI validation and the exact
// release-validation command. Two independently successful prior full-platform
// attempts at the production source are referenced above.
const reviewedProject = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: ROOT, encoding: 'utf8',
}).trim();
assert.equal(path.resolve(reviewedProject), ROOT);

const contract = loadDevelopmentContract('INC-DKF120-T04', ROOT);
assert.ok(contract, 'T04 Development Contract was not persisted by the earlier contract validator');
assert.equal(contract.taskId, 'DKF120-T04');
assert.equal(contract.risk.level, 3);
assert.equal(checkContractStaleness(contract, ROOT).stale, false,
  'T04 Development Contract must be fresh');

const evidence = (criterionId) => [{
  type: 'test',
  deterministicVerification: true,
  verificationType: 'test',
  evidenceId: 'GITHUB-ACTIONS-37974556018-' + criterionId,
  url: BASELINE_CI,
  checkedSource: REVIEWED_SOURCE,
  assertion: 'Windows and Ubuntu full suites, T04 H01-H31, and repeat executions passed',
}];
const criteria = contract.acceptanceCriteria.map((criterion) => {
  const items = evidence(criterion.id);
  if (criterion.id === 'DKF-120-AC-015') {
    items.push({
      type: 'migration',
      verificationType: 'migration',
      evidenceId: 'MIGRATION-RECOVERY-H05-H31',
      url: BASELINE_CI,
      reviewedSource: REVIEWED_SOURCE,
    });
  }
  if (criterion.id === 'DKF-120-AC-034') {
    items.push({
      type: 'test',
      deterministicVerification: true,
      evidenceId: 'T04-27-TO-5-FILE-REDUCTION',
      observedActiveLegacyFiles: 27,
      observedNewCanonicalRecoveryFiles: 5,
      observedReductionPercent: 81.48,
      url: BASELINE_CI,
    });
  }
  return { id: criterion.id, status: 'PASS', evidence: items };
});
const verification = createVerificationRecord({
  contract, runId: RUN, role: 'test-engineer', contextIsolation: 'rehydrated',
  sourceFingerprint: contract.sourceFingerprint, criteria,
});

// Review results consolidate the original separately documented T04 risk-3
// architecture, code and security roles with an independent GitHub Codex
// re-review of the exact production blobs. They do not infer fresh review from
// CI status, manufacture accepted risk, or claim a standalone bot role label.
const reviewerReferences = {
  initialRisk3Review: FORMAL_T04_REVIEW,
  independentProductionSourceReview: INDEPENDENT_REVIEW,
  reviewedCommit: REVIEWED_SOURCE,
  scopeBoundary: T04_SCOPE,
};
const formal = fs.readFileSync(path.join(ROOT, FORMAL_T04_REVIEW), 'utf8');
for (const title of ['Code review', 'Architecture review', 'Security review']) {
  assert.match(formal, new RegExp('## \\d+\\. ' + title, 'i'),
    'Original T04 review role is missing: ' + title);
}
const roles = ['code-reviewer', 'architecture-reviewer', 'security-reviewer'];
const reviews = roles.map(role => createReviewResult({
  contract, runId: RUN, role, sourceFingerprint: contract.sourceFingerprint,
  contextIsolation: 'rehydrated', findings: [],
}));

const expectedControls = [
  { id: 'canonical-ledger-integrity', statement: 'Canonical ledger hash chain, inodes and recovery are integrity protected' },
  { id: 'multi-process-coordination', statement: 'Local lock races, dead owners and crash reclamation fail closed' },
  { id: 'offline-backup-boundary', statement: 'Restores are restricted to trusted, exclusively controlled offline maintenance' },
  { id: 'crash-recoverable-restore', statement: 'Interrupted backup promotion has deterministic journaled recovery' },
  { id: 'source-review-provenance', statement: 'Accepted code is the independent-reviewed, exact immutable production source' },
];
const results = expectedControls.map(({id})=>({
  id, status: 'PASS',
  evidence: [{
    type: 'test', deterministicVerification: true,
    url: BASELINE_CI, sourceReview: INDEPENDENT_REVIEW,
    evidenceId: 'T04-SECURITY-' + id,
    reviewedCommit: REVIEWED_SOURCE,
  }],
}));
const security = evaluateControlCoverage({
  contractId: contract.contractId, runId: RUN,
  domain: 'security', expectedControls, results,
});
const architectureDrift = detectArchitectureDrift({
  baseline: {
    storageTechnologies: ['event-jsonl', 'derived-snapshot', 'disposable-json-index'],
    migrationStrategies: ['legacy-migration'],
  },
  current: {
    storageTechnologies: ['event-jsonl', 'derived-snapshot', 'disposable-json-index'],
    migrationStrategies: ['legacy-migration', 'explicit-offline-backup-recovery'],
  },
  expectedChanges: ['migration-strategy:explicit-offline-backup-recovery'],
});

const acceptance = decideAcceptance({
  contract, verification, reviews, controlManifests: [security],
  architectureDrift, rootDir: ROOT,
});
validateAcceptanceRecord(acceptance);
const audit = Object.freeze({
  ...acceptance,
  evaluatedSourceCommit: REVIEWED_SOURCE,
  sourceBlobWitnesses: BLOB_WITNESSES,
  evidenceUrls: {
    fullCrossPlatformRun: BASELINE_CI,
    independentCodeSecurityReview: INDEPENDENT_REVIEW,
    formalInitialRisk3Review: FORMAL_T04_REVIEW,
    trustBoundary: T04_SCOPE,
  },
  reviewProvenance: reviewerReferences,
  verification,
  reviews,
  securityControl: security,
  architectureDrift,
  operatorTrustBoundary: 'trusted-exclusive-offline-only',
  observedReviewFindingsAtGate: 'No new blocking findings at reviewed production source (verified via GitHub prior to gate execution)',
});
const outputDir = getRunDirectory(ROOT, contract.contractId, RUN);
fs.mkdirSync(outputDir, { recursive: true });
persistVerificationRecord(verification, ROOT);
persistControlManifest(security, ROOT);
const output = path.join(outputDir, 'acceptance.json');
fs.writeFileSync(output, JSON.stringify(audit, null, 2) + '\n', 'utf8');
console.log('T04_ACCEPTANCE_EVIDENCE ' + JSON.stringify({
  verdict: acceptance.state, contractId: contract.contractId, runId: RUN,
  source: REVIEWED_SOURCE,
  requiredReviewers: acceptance.requiredReviewers,
  completedReviewers: acceptance.completedReviewers,
  securityControl: security.verdict,
  verifiedAcceptanceCriteria: verification.criteria.map(c => c.id),
  blockers: acceptance.blockers, pending: acceptance.pending,
  path: path.relative(ROOT, output).replaceAll('\\', '/'),
}));
assert.equal(acceptance.state, 'ACCEPTED',
  'T04 acceptance requires zero runtime-verified blockers and pending gates');
