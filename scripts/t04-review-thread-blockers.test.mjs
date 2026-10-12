import test from 'node:test';
import assert from 'node:assert/strict';
import { unresolvedReviewThreads } from './t04-review-thread-blockers.mjs';

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
