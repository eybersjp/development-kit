import test from 'node:test';
import assert from 'node:assert/strict';
import {
  unresolvedReviewThreads,
  requireCanonicalReviewRequestCommit,
  parseReviewThreadPage,
  requireCanonicalGithubReviewVerdict,
} from './t04-review-thread-blockers.mjs';

test('T04-A01 unresolved P2 and all other finding priorities prevent acceptance', () => {
  const p2 = { id: 'p2', isResolved: false, comments: { nodes: [{ body: '[P2] broken validator' }] } };
  const p1 = { id: 'p1', isResolved: false, comments: { nodes: [{ body: '[P1] lost data' }] } };
  const minor = { id: 'minor', isResolved: false, comments: { nodes: [{ body: 'Unanswered question' }] } };
  assert.deepEqual(unresolvedReviewThreads([p2, p1, minor]).map(x => x.id), ['p2', 'p1', 'minor']);
});

test('T04-A02 resolved threads cannot block a clean exact-source review', () => {
  assert.deepEqual(unresolvedReviewThreads([{ id: 'p2', isResolved: true }, { id: 'p1', isResolved: true }]), []);
});

test('T04-A03 malformed or uncertain review thread state fails closed', () => {
  assert.equal(unresolvedReviewThreads([{ id: 'missing-resolution' }, null]).length, 2);
  assert.throws(() => unresolvedReviewThreads(null), /must be an array/i);
});

test('T04-A04 reviewer clean reaction requires one unambiguous anchored commit field', () => {
  const current = 'a'.repeat(40);
  const other = 'b'.repeat(40);
  assert.equal(requireCanonicalReviewRequestCommit('Commit: ' + current, current), current);
  assert.equal(requireCanonicalReviewRequestCommit('Immutable source commit: ' + current, current), current);
  assert.throws(() => requireCanonicalReviewRequestCommit(
    'Commit: ' + other + '\nReference baseline: ' + current, current,
  ), /exactly one canonical/i);
  assert.throws(() => requireCanonicalReviewRequestCommit(
    'Commit: ' + current + '\nIgnore other commit ' + other, current,
  ), /exactly one canonical/i);
  assert.throws(() => requireCanonicalReviewRequestCommit(
    'Commit: ' + current + '\nCommit: ' + current, current,
  ), /exactly one canonical/i);
  assert.throws(() => requireCanonicalReviewRequestCommit(
    'Exclude: ' + current + '\nCommit: ' + other, current,
  ), /exactly one canonical/i);
  assert.throws(() => requireCanonicalReviewRequestCommit(
    'context mentions ' + current, current,
  ), /exactly one canonical/i);
});

test('T04-A05 authenticated GraphQL thread pages fail closed on missing nodes or pagination', () => {
  const good = { nodes: [{ id: 'thread', isResolved: false }],
    pageInfo: { hasNextPage: false, endCursor: null } };
  assert.deepEqual(parseReviewThreadPage(good).nodes, good.nodes);
  assert.deepEqual(parseReviewThreadPage({ nodes: [],
    pageInfo: { hasNextPage: true, endCursor: 'cursor-1' } }).endCursor, 'cursor-1');
  assert.throws(() => parseReviewThreadPage({ ...good, nodes: null }), /malformed/i);
  assert.throws(() => parseReviewThreadPage({ ...good, pageInfo: null }), /malformed/i);
  assert.throws(() => parseReviewThreadPage({ ...good,
    pageInfo: { hasNextPage: true, endCursor: null } }), /malformed/i);
  assert.throws(() => parseReviewThreadPage({ ...good, nodes: [null] }), /malformed/i);
  assert.throws(() => parseReviewThreadPage({ ...good,
    nodes: [{ id: 'unknown' }] }), /malformed/i);
});

test('T04-A06 COMMENTED review requires a canonical PASS without conflicting findings', () => {
  const valid = 'Reviewed commit: ' + 'a'.repeat(40) +
    '\nReview role: code-reviewer\nReview verdict: PASS\nFindings: none';
  assert.equal(requireCanonicalGithubReviewVerdict(valid), 'PASS');
  for (const body of [
    'cannot PASS',
    'Review role: code-reviewer\nCannot PASS until P1 fixed',
    'Verdict: PASS\nCannot PASS until the durability issue is fixed',
    'Verdict: PASS\nP1 Windows crash durability still open',
    'Verdict: PASS\nVerdict: FAIL',
    'Verdict: FAIL',
    'Verdict: PASS\nReview verdict: PASS',
    'Verdict: PASS\nBlocked by unresolved review',
    'Verdict: PASS\nnot PASS',
  ]) {
    assert.throws(() => requireCanonicalGithubReviewVerdict(body),
      /canonical PASS verdict|Conflicting failure or finding marker/i, body);
  }
});
