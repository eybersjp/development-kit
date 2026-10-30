import test from 'node:test';
import assert from 'node:assert/strict';
import * as reviewParsers from './t04-review-thread-blockers.mjs';
import {
  unresolvedReviewThreads,
  requireCanonicalReviewRequestCommit,
  parseReviewThreadPage,
  requireCanonicalGithubReviewVerdict,
  formatCanonicalT04ReviewRequest,
} from './t04-review-thread-blockers.mjs';

test('T04-A01 unresolved P2 and all other finding priorities prevent acceptance', () => {
  const p2 = { id: 'p2', isResolved: false, comments: { nodes: [{ body: '[P2] broken validator' }] } };
  const p1 = { id: 'p1', isResolved: false, comments: { nodes: [{ body: '[P1] lost data' }] } };
  const minor = { id: 'minor', isResolved: false, comments: { nodes: [{ body: 'Unanswered question' }] } };
  assert.deepEqual(unresolvedReviewThreads([p2, p1, minor]).map(x => x.id), ['p2', 'p1', 'minor']);
});

test('RI-01 source binding rejects abbreviated and uppercase alternate identifiers', () => {
  const source = 'a'.repeat(40);
  for (const alternate of ['bbbbbbb', 'B'.repeat(40), source.toUpperCase(), source.slice(0, 10)]) {
    assert.throws(() => requireCanonicalReviewRequestCommit('Commit: ' + source + '\nBaseline: ' + alternate, source));
  }
});

test('RI-01 clean verdict requires one canonical findings declaration and no structured severity', () => {
  for (const findings of ['', 'Findings: MAJOR Windows journal publication may lose data',
    'Findings: none\nSeverity: CRITICAL', 'Findings: none\nStatus: OPEN',
    'Findings: none\nFindings: none', 'Findings: none\n[MAJOR] data loss']) {
    assert.throws(() => requireCanonicalGithubReviewVerdict('Verdict: PASS\n' + findings));
  }
});

test('RI-02 authenticated scope request binds PR and exactly one role', () => {
  const source = 'a'.repeat(40);
  const request = { issue_url: 'https://api.github.com/repos/eybersjp/development-kit/issues/92',
    body: '@codex\nIndependent role: code-reviewer\nCommit: ' + source };
  assert.equal(typeof reviewParsers.requireCanonicalGithubReviewRequest, 'function');
  assert.doesNotThrow(() => reviewParsers.requireCanonicalGithubReviewRequest(request, 'code-reviewer', source));
  for (const invalid of [{ ...request, issue_url: request.issue_url.replace('/92', '/70') },
    { ...request, issue_url: request.issue_url.replace('/92', '/71') },
    { ...request, issue_url: undefined },
    { ...request, body: request.body + '\nIndependent role: code-reviewer' },
    { ...request, body: request.body + '\nIndependent role: security-reviewer' }]) {
    assert.throws(() => reviewParsers.requireCanonicalGithubReviewRequest(invalid, 'code-reviewer', source));
  }
});

test('RI-01 authenticated response binds unique anchored role and full API source', () => {
  const source = 'a'.repeat(40);
  const review = { commit_id: source, body: 'Reviewed commit: ' + source +
    '\nReview role: code-reviewer\nVerdict: PASS\nFindings: none' };
  assert.equal(typeof reviewParsers.requireCanonicalGithubReviewResponse, 'function');
  assert.doesNotThrow(() => reviewParsers.requireCanonicalGithubReviewResponse(review, 'code-reviewer', source));
  for (const invalid of [{ ...review, commit_id: 'b'.repeat(40) },
    { ...review, body: review.body.replace(source, source.slice(0, 10)) },
    { ...review, body: review.body + '\nReview role: code-reviewer' },
    { ...review, body: review.body + '\nReview role: security-reviewer' },
    { ...review, body: review.body.replace('Review role:', 'Example Review role:') },
    { ...review, body: review.body + '\nBaseline: bbbbbbb' }]) {
    assert.throws(() => reviewParsers.requireCanonicalGithubReviewResponse(invalid, 'code-reviewer', source));
  }
});

test('RI-01 final pagination cursor rejects malformed types', () => {
  for (const endCursor of [123, {}, []]) {
    assert.throws(() => parseReviewThreadPage({ nodes: [], pageInfo: { hasNextPage: false, endCursor } }));
  }
});

test('RI-01 clean declaration cannot suppress a separate structured minor finding', () => {
  for (const marker of ['Severity: MINOR', 'Finding: data loss', '[P3] unanswered question', 'Status: PENDING']) {
    assert.throws(() => requireCanonicalGithubReviewVerdict('Verdict: PASS\nFindings: none\n' + marker));
  }
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

test('T04-A07 reject extra free-text contradicting zero-findings review', () => {
  const full = 'Reviewed commit: ' + 'a'.repeat(40) +
    '\nReview role: code-reviewer\nVerdict: PASS\nFindings: none';
  assert.equal(reviewParsers.requireCanonicalGithubReviewResponse({
    commit_id: 'a'.repeat(40), body: full,
  }, 'code-reviewer', 'a'.repeat(40)), 'PASS');
  for (const additional of [
    'The restore loses the original tree after a power outage',
    'Possible loss of user data on Windows',
    'Further investigation is required',
    'Verdict: PASS',
    'Findings: none',
    '',
  ]) {
    assert.throws(() => reviewParsers.requireCanonicalGithubReviewResponse({
      commit_id: 'a'.repeat(40), body: full + '\n' + additional,
    }, 'code-reviewer', 'a'.repeat(40)), /Conflicting failure|canonical/i);
  }
});

test('T04-A08 generated reviewer request has one immutable SHA and exactly one role', () => {
  const source = 'a'.repeat(40);
  const roles = ['code-reviewer', 'architecture-reviewer', 'security-reviewer'];
  for (const role of roles) {
    const body = formatCanonicalT04ReviewRequest(role, source, 'Inspect precise T04 source and evidence.');
    assert.equal((body.match(new RegExp(source, 'g')) || []).length, 1);
    assert.equal(reviewParsers.requireCanonicalGithubReviewRequest({
      issue_url: 'https://api.github.com/repos/eybersjp/development-kit/issues/92',
      body,
    }, role, source), source);
    assert.throws(() => formatCanonicalT04ReviewRequest(
      role, source, 'Inspect a different revision ' + 'b'.repeat(40) + '.',
    ), /one canonical reviewed commit/i);
  }
});
