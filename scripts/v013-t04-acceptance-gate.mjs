#!/usr/bin/env node
// DKF130-T04 risk-3 acceptance: authenticated external evidence, never CI-green inference.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadDevelopmentContract, checkContractStaleness } from '../runtime/orchestration/development-contract.mjs';
import { decideAcceptance, validateAcceptanceRecord } from '../runtime/orchestration/acceptance-engine.mjs';
import { createVerificationRecord, evaluateControlCoverage, getRunDirectory,
  persistVerificationRecord, persistControlManifest } from '../runtime/orchestration/evidence-store.mjs';
import { createReviewResult } from '../runtime/orchestration/review-result.mjs';
import { detectArchitectureDrift } from '../runtime/orchestration/architecture-drift.mjs';
import { assertCurrentRoleApproval } from './v013-t04-review-provenance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'eybersjp/development-kit';
const RECEIPTS = 'docs/04-architecture/dkf-v013-t04-independent-review-receipts.json';
const ROLES = ['code-reviewer', 'architecture-reviewer', 'security-reviewer'];
const SHA = /^[a-f0-9]{40}$/;
const runId = process.env.GITHUB_RUN_ID;
const token = process.env.GITHUB_TOKEN;
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'T04 verdict must originate in GitHub Actions');
assert.equal(process.env.GITHUB_REPOSITORY, REPO);
assert.equal(process.env.GITHUB_EVENT_NAME, 'pull_request');
assert.equal(process.env.GITHUB_JOB, 't04_acceptance');
assert.match(runId || '', /^[1-9][0-9]*$/);
assert.ok(token, 'Authenticated GitHub API token required');
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
assert.equal(event.pull_request?.number, 92, 'Only v0.13 integration PR #92 can be accepted');
assert.equal(event.pull_request?.head?.ref, 'feature/v0.13-state-engine-v2');
assert.equal(event.pull_request?.head?.repo?.full_name, REPO);
const receipts = JSON.parse(fs.readFileSync(path.join(ROOT, RECEIPTS), 'utf8'));
assert.equal(receipts.schemaVersion, '1.0.0');
assert.match(receipts.reviewedCommit || '', SHA, 'Missing exact-source independent reviews');
assert.equal(receipts.status, 'INDEPENDENT_REVIEWS_COMPLETE', 'Review register must be complete');
assert.ok(Array.isArray(receipts.reviews) && receipts.reviews.length === 3,
  'Three separate authenticated code, architecture and security reviews are mandatory');
const reviewedCommit = receipts.reviewedCommit;

async function api(endpoint) {
  const response = await fetch('https://api.github.com/repos/' + REPO + '/' + endpoint, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'dkf-v013-t04-acceptance' },
  });
  assert.ok(response.ok, 'GitHub evidence unavailable: ' + endpoint + ' (' + response.status + ')');
  return response.json();
}
async function graphql(query, variables) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
      'User-Agent': 'dkf-v013-t04-acceptance' },
    body: JSON.stringify({ query, variables }),
  });
  assert.ok(response.ok, 'Authenticated review-thread query failed');
  const data = await response.json();
  assert.ok(!data.errors?.length, 'Review-thread API returned GraphQL errors');
  return data.data;
}
// A receipt-only follow-up commit is permitted; every other tracked blob and
// executable mode must match the immutable source actually reviewed.
const tree = await api('git/trees/' + reviewedCommit + '?recursive=1');
assert.ok(!tree.truncated && Array.isArray(tree.tree), 'Complete reviewed tree required');
const expected = new Map(tree.tree.filter(x => x.type === 'blob')
  .map(x => [x.path, { sha: x.sha, mode: x.mode }]));
const index = execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: ROOT, encoding: 'utf8' });
const observed = new Map();
for (const line of index.split('\0').filter(Boolean)) {
  const m = /^(\d+) ([a-f0-9]{40}) \d+\t([\s\S]+)$/.exec(line);
  assert.ok(m, 'Unparseable tracked Git index entry');
  observed.set(m[3], { sha: m[2], mode: m[1] });
}
for (const [name, blob] of expected) {
  if (name !== RECEIPTS) assert.deepEqual(observed.get(name), blob,
    'Unreviewed source change or deletion: ' + name);
}
for (const name of observed.keys()) {
  if (name !== RECEIPTS) assert.ok(expected.has(name), 'Unreviewed new source: ' + name);
}
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
  cwd: ROOT, encoding: 'utf8' }).trim(), '', 'Modified tracked source invalidates review');
const pr = await api('pulls/92');
assert.equal(pr.state, 'open');
assert.equal(pr.head.sha, event.pull_request.head.sha, 'Stale PR event/source');
assert.equal(pr.base.ref, 'main');
assert.equal(pr.head.repo.full_name, REPO);
assert.ok(Number.isSafeInteger(pr.user?.id) && pr.user.id > 0,
  'Immutable authenticated PR author ID required');

// Distinct GitHub-authored, post-source reviews. Self-authored PASS strings are
// never an approval. Each review must explicitly identify its role and SHA.
// Fetch all submitted PR reviews, including later revocations or source-stale
// reapprovals; the individual review endpoint alone cannot prove an approval
// is still the effective review from that independent identity.
const allSubmittedReviews = [];
for (let page = 1; ; page++) {
  const batch = await api('pulls/92/reviews?per_page=100&page=' + page);
  assert.ok(Array.isArray(batch), 'Authenticated PR review timeline is unavailable');
  allSubmittedReviews.push(...batch);
  if (batch.length < 100) break;
}

const reviewers = new Set();
const authenticatedReviews = new Map();
const reviewIds = new Set();
for (const role of ROLES) {
  const receipt = receipts.reviews.find(x => x?.role === role);
  assert.ok(receipt, 'Missing independent role: ' + role);
  assert.ok(Number.isSafeInteger(receipt.githubReviewId) && receipt.githubReviewId > 0);
  assert.ok(!reviewIds.has(receipt.githubReviewId), 'Review reused for multiple roles');
  reviewIds.add(receipt.githubReviewId);
  const review = await api('pulls/92/reviews/' + receipt.githubReviewId);
  assert.equal(review.commit_id, reviewedCommit, 'Review is stale');
  assert.equal(review.state, 'APPROVED', 'Only authenticated GitHub approval is PASS');
  assert.ok(Number.isSafeInteger(review.user?.id) && review.user.id > 0 &&
    review.user.id !== pr.user.id,
    'Author cannot independently approve their own code, including after account rename');
  assert.ok(!reviewers.has(review.user.id), 'Distinct immutable reviewer ID required for each role');
  reviewers.add(review.user.id);
  assertCurrentRoleApproval(review, allSubmittedReviews, reviewedCommit);
  authenticatedReviews.set(role, review);
  assert.ok((review.body || '').includes('DKF130-T04 ' + role + ' ' + reviewedCommit),
    'Approval must explicitly bind role and exact source SHA');
  const comments = await api('pulls/92/reviews/' + receipt.githubReviewId + '/comments?per_page=1');
  assert.ok(Array.isArray(comments) && comments.length === 0,
    'Review with findings is not a clean acceptance review');
}
assert.equal(reviewIds.size, 3);
const query = `query($cursor:String){repository(owner:"eybersjp",name:"development-kit"){pullRequest(number:92){reviewThreads(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{isResolved}}}}}`;
let cursor = null;
for (;;) {
  const data = await graphql(query, { cursor });
  const threads = data?.repository?.pullRequest?.reviewThreads;
  assert.ok(Array.isArray(threads?.nodes), 'Review threads unavailable');
  assert.ok(threads.nodes.every(t => t.isResolved === true), 'Unresolved P1/P2 or other review threads');
  if (!threads.pageInfo?.hasNextPage) break;
  assert.ok(threads.pageInfo.endCursor && threads.pageInfo.endCursor !== cursor);
  cursor = threads.pageInfo.endCursor;
}
// A closed issue is necessary, not sufficient: retain independent physical
// power-loss evidence and externally verified artifact provenance.
const durabilityIssue = await api('issues/73');
assert.equal(durabilityIssue.state, 'closed', 'Physical NTFS durability blocker #73 remains open');
assert.notEqual(durabilityIssue.state_reason, 'not_planned',
  'Issue #73 cannot be waived instead of resolved');
const acceptanceTrackingIssue = await api('issues/71');
assert.notEqual(acceptanceTrackingIssue.state_reason, 'not_planned',
  'Risk-3 acceptance blocker #71 cannot be waived');
// Issue #71 is the acceptance tracking ticket and may be closed AFTER the
// persisted ACCEPTED verdict; requiring closure here would deadlock the gate.
const physical = receipts.windowsPhysicalPowerLoss;
assert.ok(physical && physical.reviewedCommit === reviewedCommit
  && typeof physical.artifactUrl === 'string'
  && physical.artifactUrl.startsWith('https://github.com/' + REPO + '/actions/runs/')
  && typeof physical.filesystem === 'string' && /^NTFS\b/.test(physical.filesystem)
  && typeof physical.artifactName === 'string' && physical.artifactName.length > 0
  && /^sha256:[a-f0-9]{64}$/.test(physical.artifactDigest || '')
  && Number.isSafeInteger(physical.independentReviewId)
  && physical.cleanupSafety === 'CLEANUP_SAFE'
  && physical.originalTreesPreserved === true
  && physical.hashChainedJournalRecovered === true,
  'Independent, source-bound physical NTFS power-loss evidence is mandatory');
const physicalReview = await api('pulls/92/reviews/' + physical.independentReviewId);
assert.equal(physicalReview.state, 'APPROVED');
assert.ok(Number.isSafeInteger(physicalReview.user?.id) && physicalReview.user.id > 0 &&
  physicalReview.user.id !== pr.user.id,
  'Physical NTFS power-loss reviewer must be independent of the source author');
assert.equal(physicalReview.commit_id, reviewedCommit);
// A previously approved physical test may later be revoked or superseded.
// Apply the same authenticated latest-decisive-review guard as the three roles.
assertCurrentRoleApproval(physicalReview, allSubmittedReviews, reviewedCommit);
assert.ok((physicalReview.body || '').includes('DKF130-T04 NTFS-PHYSICAL-POWER-LOSS ' + reviewedCommit),
  'Independent physical test review must explicitly bind source and evidence');
const artifactRun = Number(physical.artifactUrl.match(/\/actions\/runs\/([0-9]+)/)?.[1]);
assert.ok(Number.isSafeInteger(artifactRun));
const artifact = await api('actions/runs/' + artifactRun);
assert.equal(artifact.head_sha, reviewedCommit);
assert.equal(artifact.conclusion, 'success');
const artifacts = await api('actions/runs/' + artifactRun + '/artifacts?per_page=100');
const physicalArtifact = artifacts.artifacts?.find(x => x.name === physical.artifactName);
assert.ok(physicalArtifact && !physicalArtifact.expired &&
  physicalArtifact.digest === physical.artifactDigest,
  'Authenticated immutable physical NTFS power-loss artifact and SHA-256 digest required');
assert.ok((physicalReview.body || '').includes(physical.artifactDigest),
  'Independent physical review must bind the exact artifact digest');

// Two distinct full Ubuntu/Windows workflows on the exact reviewed commit.
// The current run does not count while its acceptance job is executing.
assert.ok(Array.isArray(receipts.validationRunIds) && receipts.validationRunIds.length >= 2);
const validationRuns = new Set(receipts.validationRunIds);
assert.equal(validationRuns.size, receipts.validationRunIds.length);
for (const id of validationRuns) {
  assert.ok(Number.isSafeInteger(id) && id > 0 && String(id) !== runId);
  const run = await api('actions/runs/' + id);
  assert.equal(run.head_sha, reviewedCommit, 'Validation run is not exact-source');
  assert.equal(run.event, 'pull_request');
  assert.equal(run.path, '.github/workflows/ci.yml',
    'Only the authoritative full CI workflow can count as risk-3 validation evidence');
  assert.equal(run.repository?.full_name, REPO,
    'Cross-repository or unrelated workflow evidence is not admissible');
  assert.equal(run.status, 'completed');
  // Diagnostic/production acceptance jobs may fail while validation succeeds:
  // verify both full platform jobs individually, not overall run conclusion.
  const jobs = [];
  for (let page = 1; ; page++) {
    const batch = await api('actions/runs/' + id + '/jobs?per_page=100&page=' + page);
    jobs.push(...batch.jobs);
    if (batch.jobs.length < 100) break;
  }
  for (const os of ['ubuntu-latest', 'windows-latest']) {
    const matches = jobs.filter(job => job.name === 'validate (' + os + ')');
    assert.equal(matches.length, 1, 'Missing unique full validation for ' + os);
    assert.equal(matches[0].conclusion, 'success', 'Full validation failed on ' + os);
    // A separate workflow may reuse the validate job name without executing
    // the v0.13 compatibility, source-security or acceptance negative controls.
    // Require authenticated successful step-level witnesses on BOTH platforms.
    for (const required of [
      'Validate v0.13 State Engine V2 increment',
      'Validate v0.13 full compatibility regression',
      'Verify v0.13 risk-3 acceptance job contract (negative control)',
    ]) {
      const matchingSteps = (matches[0].steps || []).filter(step => step.name === required);
      assert.equal(matchingSteps.length, 1,
        'Missing unique mandatory full-validation step on ' + os + ': ' + required);
      for (const step of matchingSteps) {
        assert.ok(step.conclusion === 'success',
          'Mandatory full-validation step did not pass on ' + os + ': ' + required);
      }
    }
  }
}
// The canonical Development Contract acceptance engine, not a bespoke green
// flag, is the sole authority to produce a persisted ACCEPTED verdict.
const contract = loadDevelopmentContract('INC-DKF130-T04', ROOT);
assert.ok(contract, 'Persisted v0.13 Development Contract missing');
assert.equal(contract.taskId, 'DKF130-T04');
assert.equal(contract.risk.level, 3);
assert.equal(checkContractStaleness(contract, ROOT).stale, false);
const evidenceRunId = 'T04-V013-' + reviewedCommit.slice(0, 16);
const verifiedCiEvidence = [...validationRuns].map(id => ({
  type: 'test', deterministicVerification: true, verificationType: 'test',
  url: 'https://github.com/' + REPO + '/actions/runs/' + id,
  evidenceId: 'GITHUB-ACTIONS-' + id, reviewedCommit,
}));
const criteria = contract.acceptanceCriteria.map(c => ({
  id: c.id, status: 'PASS',
  evidence: c.id === 'DKF-120-AC-015'
    ? [...verifiedCiEvidence, {
      type: 'external', authoritativeExternalState: true,
      verificationType: 'security',
      url: physical.artifactUrl, reviewedCommit,
      evidenceId: 'INDEPENDENT-NTFS-POWER-LOSS-' + physical.independentReviewId,
    }]
    : verifiedCiEvidence,
}));
const verification = createVerificationRecord({
  contract, runId: evidenceRunId, role: 'test-engineer',
  sourceFingerprint: contract.sourceFingerprint,
  contextIsolation: 'rehydrated', criteria,
});
const reviews = ROLES.map(role => createReviewResult({
  contract, runId: evidenceRunId, role,
  sourceFingerprint: contract.sourceFingerprint,
  contextIsolation: 'rehydrated',
  createdAt: authenticatedReviews.get(role).submitted_at,
  findings: [],
}));
const requiredControls = [
  { id: 'ledger-integrity', statement: 'Canonical event chain and index recovery remain integrity protected' },
  { id: 'multi-process-concurrency', statement: 'Concurrent writes and bootstrap recovery preserve committed events' },
  { id: 'acl-path-isolation', statement: 'Restore and canonical paths reject link and alias escapes' },
  { id: 'ntfs-crash-restore', statement: 'Supported NTFS sudden-power-loss restore and journal recovery verified' },
  { id: 'source-provenance', statement: 'Review and CI are bound to immutable final source' },
];
assert.ok(Array.isArray(receipts.securityControls) &&
  receipts.securityControls.length === requiredControls.length,
  'Authenticated independent security-control evidence is mandatory');
const controlResults = [];
for (const control of requiredControls) {
  const witness = receipts.securityControls.find(x => x?.id === control.id);
  assert.ok(witness && witness.reviewedCommit === reviewedCommit &&
    Number.isSafeInteger(witness.githubReviewId) &&
    Number.isSafeInteger(witness.workflowRunId),
    'Security control missing independent source-bound witness: ' + control.id);
  assert.ok(validationRuns.has(witness.workflowRunId),
    'Security control witness must cite an authenticated full Ubuntu/Windows validation run on the exact reviewed source');
  assert.equal(witness.githubReviewId, authenticatedReviews.get('security-reviewer').id,
    'Security control witnesses must bind the independently approved security review');
  const witnessReview = await api('pulls/92/reviews/' + witness.githubReviewId);
  assert.equal(witnessReview.state, 'APPROVED');
  assert.equal(witnessReview.commit_id, reviewedCommit);
  assert.ok((witnessReview.body || '').includes('DKF130-T04 CONTROL ' + control.id + ' ' + reviewedCommit));
  const witnessRun = await api('actions/runs/' + witness.workflowRunId);
  assert.equal(witnessRun.head_sha, reviewedCommit);
  assert.equal(witnessRun.status, 'completed');
  // The full Ubuntu/Windows validation jobs and mandatory steps were already
  // authenticated above for this exact run ID. The separate independent
  // acceptance job must fail closed before reviews/physical evidence exist,
  // so requiring the *overall* run conclusion to be success would deadlock
  // the first legitimate acceptance. Never weaken the per-platform checks.
  controlResults.push({
    id: control.id, status: 'PASS',
    evidence: [{ type: 'test', deterministicVerification: true,
      reviewedCommit, evidenceId: 'CONTROL-' + control.id + '-' + witness.workflowRunId,
      url: 'https://github.com/' + REPO + '/actions/runs/' + witness.workflowRunId }],
  });
}
const security = evaluateControlCoverage({
  contractId: contract.contractId, runId: evidenceRunId,
  domain: 'security', expectedControls: requiredControls, results: controlResults,
});
const architectureDrift = detectArchitectureDrift({
  baseline: { storageTechnologies: ['event-jsonl', 'derived-snapshot', 'disposable-json-index'],
    migrationStrategies: ['legacy-migration'] },
  current: { storageTechnologies: ['event-jsonl', 'derived-snapshot', 'disposable-json-index'],
    migrationStrategies: ['legacy-migration', 'explicit-offline-backup-recovery'] },
  expectedChanges: ['migration-strategy:explicit-offline-backup-recovery'],
});
const decision = decideAcceptance({
  contract, verification, reviews, controlManifests: [security],
  architectureDrift, rootDir: ROOT,
});
validateAcceptanceRecord(decision);
assert.equal(decision.state, 'ACCEPTED',
  'Deterministic risk-3 gate requires complete canonical verification, control and review records; never infer ACCEPTED from CI');
const runDirectory = getRunDirectory(ROOT, contract.contractId, evidenceRunId);
fs.mkdirSync(runDirectory, { recursive: true });
persistVerificationRecord(verification, ROOT);
persistControlManifest(security, ROOT);
const destination = path.join(ROOT, '.development-kit', 'acceptance', 'DKF130-T04.json');
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify({
  ...decision, reviewedCommit, validationRunIds: [...validationRuns],
  independentReviewIds: [...reviewIds], physicalPowerLoss: physical,
  verification, reviews, securityControl: security, architectureDrift,
}, null, 2) + '\n', { flag: 'wx' });
console.log('DKF130-T04 ACCEPTED ' + reviewedCommit);
