#!/usr/bin/env node
// DKF130-T04 risk-3 acceptance: authenticated external evidence, never CI-green inference.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadDevelopmentContract, checkContractStaleness } from '../runtime/orchestration/development-contract.mjs';
import { decideAcceptance, validateAcceptanceRecord } from '../runtime/orchestration/acceptance-engine.mjs';

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

// Distinct GitHub-authored, post-source reviews. Self-authored PASS strings are
// never an approval. Each review must explicitly identify its role and SHA.
const reviewers = new Set();
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
  assert.ok(review.user?.login && review.user.login !== pr.user.login,
    'Author cannot independently approve their own code');
  assert.ok(!reviewers.has(review.user.login), 'Distinct reviewer identity required for each role');
  reviewers.add(review.user.login);
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
for (const issueNumber of [71, 73, 84]) {
  const issue = await api('issues/' + issueNumber);
  assert.equal(issue.state, 'closed', 'Mandatory T04 blocker remains open: #' + issueNumber);
}
const physical = receipts.windowsPhysicalPowerLoss;
assert.ok(physical && physical.reviewedCommit === reviewedCommit
  && typeof physical.artifactUrl === 'string'
  && physical.artifactUrl.startsWith('https://github.com/' + REPO + '/actions/runs/')
  && typeof physical.filesystem === 'string' && /^NTFS\b/.test(physical.filesystem)
  && Number.isSafeInteger(physical.independentReviewId),
  'Independent, source-bound physical NTFS power-loss evidence is mandatory');
const physicalReview = await api('pulls/92/reviews/' + physical.independentReviewId);
assert.equal(physicalReview.state, 'APPROVED');
assert.equal(physicalReview.commit_id, reviewedCommit);
assert.ok((physicalReview.body || '').includes('DKF130-T04 NTFS-PHYSICAL-POWER-LOSS ' + reviewedCommit),
  'Independent physical test review must explicitly bind source and evidence');
const artifactRun = Number(physical.artifactUrl.match(/\/actions\/runs\/([0-9]+)/)?.[1]);
assert.ok(Number.isSafeInteger(artifactRun));
const artifact = await api('actions/runs/' + artifactRun);
assert.equal(artifact.head_sha, reviewedCommit);
assert.equal(artifact.conclusion, 'success');

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
  }
}
// The canonical Development Contract acceptance engine, not a bespoke green
// flag, is the sole authority to produce a persisted ACCEPTED verdict.
const contract = loadDevelopmentContract('INC-DKF130-T04', ROOT);
assert.ok(contract, 'Persisted v0.13 Development Contract missing');
assert.equal(contract.taskId, 'DKF130-T04');
assert.equal(contract.risk.level, 3);
assert.equal(checkContractStaleness(contract, ROOT).stale, false);
const decision = decideAcceptance({ contract, rootDir: ROOT });
validateAcceptanceRecord(decision);
assert.equal(decision.state, 'ACCEPTED',
  'Deterministic risk-3 gate requires complete canonical verification, control and review records; never infer ACCEPTED from CI');
const destination = path.join(ROOT, '.development-kit', 'acceptance', 'DKF130-T04.json');
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify({
  ...decision, reviewedCommit, validationRunIds: [...validationRuns],
  independentReviewIds: [...reviewIds], physicalPowerLoss: physical,
}, null, 2) + '\n', { flag: 'wx' });
console.log('DKF130-T04 ACCEPTED ' + reviewedCommit);
