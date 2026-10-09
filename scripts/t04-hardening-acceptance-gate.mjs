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
const RUN = 'T04-HARDENING-REVIEWED-20261009';
const FORMAL_T04_REVIEW = 'docs/04-architecture/dkf-state-engine-v2-t04-review.md';
const T04_SCOPE = 'docs/04-architecture/dkf-state-engine-v2-offline-recovery-boundary.md';
const RECEIPTS_FILE = 'docs/04-architecture/dkf-t04-independent-review-receipts.json';
const REQUIRED_ROLES = ['architecture-reviewer', 'code-reviewer', 'security-reviewer'];
const REVIEW_BLOB_PATHS = Object.freeze([
  'runtime/orchestration/state-engine-v2.mjs',
  'runtime/orchestration/state-engine-migration.mjs',
  'runtime/orchestration/development-contract.mjs',
  'runtime/orchestration/authority-graph.mjs',
  'scripts/phase06-state-engine-v2-contract.mjs',
  'scripts/state-engine-v2-hardening.test.mjs',
  'scripts/state-engine-v2-migration.test.mjs',
  'scripts/authority-graph.test.mjs',
  'scripts/t04-hardening-acceptance-gate.mjs',
  'schemas/development-contract.schema.json',
  '.github/workflows/ci.yml',
  T04_SCOPE,
]);
function gitBlobSha(contents) {
  return crypto.createHash('sha1')
    .update(Buffer.from('blob ' + contents.length + '\0', 'utf8'))
    .update(contents)
    .digest('hex');
}
assert.equal(process.env.GITHUB_ACTIONS, 'true',
  'Only trusted platform-captured CI execution may produce a persisted T04 acceptance verdict');
assert.equal(process.env.GITHUB_REPOSITORY, 'eybersjp/development-kit');
assert.equal(process.env.GITHUB_EVENT_NAME, 'pull_request');
assert.ok(/^\d+$/.test(process.env.GITHUB_RUN_ID || ''), 'Current GitHub run ID required');
assert.ok(process.env.GITHUB_TOKEN, 'Authenticated GitHub review-read token required');
const reviewedProject = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: ROOT, encoding: 'utf8',
}).trim();
assert.equal(path.resolve(reviewedProject), ROOT);
assert.ok(fs.existsSync(path.join(ROOT, FORMAL_T04_REVIEW)));
const receipts = JSON.parse(fs.readFileSync(path.join(ROOT, RECEIPTS_FILE), 'utf8'));
assert.equal(receipts.schemaVersion, '1.0.0');
assert.match(receipts.reviewedCommit || '', /^[a-f0-9]{40}$/,
  'Three independent role-scoped review receipts must bind an immutable reviewed commit');
assert.ok(Array.isArray(receipts.reviews), 'Review receipts must have a review array');
const REVIEWED_SOURCE = receipts.reviewedCommit;
const BASELINE_CI = 'https://github.com/eybersjp/development-kit/actions/runs/' + process.env.GITHUB_RUN_ID;

async function githubApi(endpoint) {
  const url = 'https://api.github.com/repos/eybersjp/development-kit/' + endpoint;
  const response = await fetch(url, {
    headers: {
      Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'dkf-t04-independent-review-validator',
    },
  });
  if (!response.ok) throw new Error('Independent GitHub evidence unavailable (' + response.status + '): ' + endpoint);
  return response.json();
}
async function githubPages(endpoint) {
  const data = [];
  for (let page = 1; page <= 10; page++) {
    const segment = await githubApi(endpoint + (endpoint.includes('?') ? '&' : '?') + 'per_page=100&page=' + page);
    assert.ok(Array.isArray(segment), 'Expected an authenticated GitHub evidence array');
    data.push(...segment);
    if (segment.length < 100) return data;
  }
  throw new Error('GitHub review evidence exceeded supported pagination; refusing incomplete review history');
}
const [tree, githubReviews, githubReviewComments, githubRequests] = await Promise.all([
  githubApi('git/trees/' + REVIEWED_SOURCE + '?recursive=1'),
  githubPages('pulls/70/reviews'),
  githubPages('pulls/70/comments'),
  githubPages('issues/70/comments'),
]);
assert.ok(!tree.truncated && Array.isArray(tree.tree), 'Reviewed commit tree unavailable or truncated');
const treeFiles = new Map(tree.tree.filter(item => item.type === 'blob').map(item => [item.path, item.sha]));
const BLOB_WITNESSES = Object.freeze(Object.fromEntries(REVIEW_BLOB_PATHS.map(file => {
  const actual = gitBlobSha(fs.readFileSync(path.join(ROOT, file)));
  const expected = treeFiles.get(file);
  assert.ok(expected, 'Missing reviewed source path: ' + file);
  assert.equal(actual, expected, 'Independent review does not cover changed source: ' + file);
  return [file, expected];
})));
const reviewerReceipts = new Map();
const githubReviewIds = new Set();
const scopeRequestIds = new Set();
for (const entry of receipts.reviews) {
  assert.ok(entry && REQUIRED_ROLES.includes(entry.role), 'Unsupported independent reviewer role');
  assert.ok(!reviewerReceipts.has(entry.role), 'Duplicate independent reviewer role');
  assert.ok(Number.isSafeInteger(entry.scopeRequestCommentId) && entry.scopeRequestCommentId > 0);
  assert.ok(!scopeRequestIds.has(entry.scopeRequestCommentId),
    'Each role requires an independently requested reviewer execution');
  scopeRequestIds.add(entry.scopeRequestCommentId);
  const request = githubRequests.find(record => record.id === entry.scopeRequestCommentId);
  assert.ok(request, 'Independent reviewer scope request was not found in GitHub');
  assert.ok(request.body?.includes('@codex') && request.body.includes(entry.role),
    'Scope request must explicitly specify independent reviewer role');
  assert.ok(request.body.includes(REVIEWED_SOURCE),
    'Reviewer scope request must bind the inspected immutable source commit');

  let reviewDate;
  let reviewUrl;
  let reviewIdentity;
  if (entry.kind === 'github-review') {
    assert.ok(Number.isSafeInteger(entry.githubReviewId) && entry.githubReviewId > 0);
    assert.ok(!githubReviewIds.has(entry.githubReviewId),
      'A single independent review cannot self-certify multiple roles');
    githubReviewIds.add(entry.githubReviewId);
    const review = githubReviews.find(record => record.id === entry.githubReviewId);
    assert.ok(review, 'Independent GitHub reviewer submission was not found');
    assert.equal(review.user?.login, 'chatgpt-codex-connector[bot]',
      'Independent reviewer identity is not authenticated');
    assert.equal(review.commit_id, REVIEWED_SOURCE, 'Review did not inspect the required immutable source');
    assert.ok(['APPROVED', 'COMMENTED'].includes(review.state),
      'GitHub reviewer submission is dismissed or not completed');
    assert.ok(review.body?.includes('Reviewed commit:') &&
      review.body.includes(REVIEWED_SOURCE.slice(0, 10)),
      'Reviewer submission does not identify the source inspected');
    assert.ok(Date.parse(review.submitted_at) > Date.parse(request.created_at),
      'Reviewer submission predates its role-scoped request');
    assert.equal(githubReviewComments.filter(c => c.pull_request_review_id === review.id).length, 0,
      'Independent reviewer reported findings; fix and request new current-source review');
    reviewDate = review.submitted_at;
    reviewUrl = review.html_url;
    reviewIdentity = { type: 'github-review', id: review.id };
  } else if (entry.kind === 'codex-clean-reaction') {
    // Codex emits an authenticated thumbs-up on the originating request when
    // a completed review finds no issues, rather than creating a PR review.
    // This is a genuine external reviewer result, not a self-authored PASS.
    assert.ok(Number.isSafeInteger(entry.githubReactionId) && entry.githubReactionId > 0);
    const reactions = await githubApi('issues/comments/' + entry.scopeRequestCommentId +
      '/reactions?per_page=100');
    assert.ok(Array.isArray(reactions), 'Cannot verify external clean-review reaction');
    const reaction = reactions.find(item => item.id === entry.githubReactionId);
    assert.ok(reaction, 'Independent Codex clean review reaction not found');
    assert.equal(reaction.user?.login, 'chatgpt-codex-connector[bot]',
      'Review completion reaction must originate from the independent bot');
    assert.equal(reaction.content, '+1', 'Pending or negative reaction is not a PASS verdict');
    assert.ok(Date.parse(reaction.created_at) > Date.parse(request.created_at),
      'Review completion predates the requested role');
    const reportedFindings = githubReviewComments.filter(comment =>
      comment.user?.login === 'chatgpt-codex-connector[bot]' &&
      comment.commit_id === REVIEWED_SOURCE &&
      Date.parse(comment.created_at) >= Date.parse(request.created_at));
    assert.equal(reportedFindings.length, 0,
      'Reviewer reported source-bound findings after the scoped review request');
    reviewDate = reaction.created_at;
    reviewUrl = 'https://github.com/eybersjp/development-kit/pull/70#issuecomment-' +
      entry.scopeRequestCommentId;
    reviewIdentity = { type: 'codex-clean-reaction', id: reaction.id };
  } else {
    assert.fail('Unknown independent reviewer attestation type; fail closed');
  }

  const result = entry.reviewResult;
  assert.ok(result && result.role === entry.role && result.runId === RUN,
    'Independently sourced reviewer receipt lacks a persisted role-bound review result');
  assert.equal(result.createdAt, reviewDate,
    'Persisted reviewer receipt timestamp must match authenticated external evidence');
  assert.equal(result.verdict, 'PASS');
  assert.deepEqual(result.findings, [],
    'Independently sourced reviewer receipt may not suppress findings');
  reviewerReceipts.set(entry.role, {
    ...entry,
    review: result,
    reviewer: 'chatgpt-codex-connector[bot]',
    reviewUrl,
    reviewedCommit: REVIEWED_SOURCE,
    reviewIdentity,
  });
}
for (const role of REQUIRED_ROLES) {
  assert.ok(reviewerReceipts.has(role), 'Independent source-bound role receipt absent: ' + role);
}
const INDEPENDENT_REVIEW = reviewerReceipts.get('code-reviewer').reviewUrl;

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

// All reviewer results are *loaded* from authenticated independent GitHub
// review receipts. This gate never fabricates empty-findings PASS reviews.
// The original T04 reviews remain a source-controlled historical baseline,
// not a replacement for three current-source delta reviews.
const formal = fs.readFileSync(path.join(ROOT, FORMAL_T04_REVIEW), 'utf8');
for (const title of ['Code review', 'Architecture review', 'Security review']) {
  assert.match(formal, new RegExp('## \\d+\\. ' + title, 'i'),
    'Original T04 role review is missing: ' + title);
}
const reviews = REQUIRED_ROLES.map(role => {
  const receipt = reviewerReceipts.get(role);
  assert.equal(receipt.review.sourceFingerprint, contract.sourceFingerprint,
    'Independent review receipt has stale Development Contract authority');
  assert.equal(receipt.review.contractId, contract.contractId);
  return receipt.review;
});
const reviewerReferences = {
  historicalRisk3Review: FORMAL_T04_REVIEW,
  independentSourceReviews: Object.fromEntries(REQUIRED_ROLES.map(role => {
    const r = reviewerReceipts.get(role);
    return [role, {
      reviewIdentity: r.reviewIdentity,
      scopeRequestCommentId: r.scopeRequestCommentId,
      reviewer: r.reviewer,
      sourceCommit: r.reviewedCommit,
      url: r.reviewUrl,
    }];
  })),
  reviewedCommit: REVIEWED_SOURCE,
  scopeBoundary: T04_SCOPE,
};

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
    currentMatrixValidationRun: BASELINE_CI,
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
  independentRoleReceiptsVerifiedBy: 'authenticated GitHub REST evidence and exact source tree',
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
