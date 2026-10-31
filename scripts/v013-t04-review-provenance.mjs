import assert from 'node:assert/strict';

// GitHub's single-review endpoint can return an authentic APPROVED receipt
// even after that reviewer subsequently requested changes or reapproved a
// different source commit. Require the latest *decisive* submitted review
// from the same authenticated identity to be this exact source-bound receipt.
export function assertCurrentRoleApproval(approval, submittedReviews, reviewedCommit) {
  assert.ok(approval && Number.isSafeInteger(approval.id) && approval.id > 0,
    'Authenticated role review ID is required');
  assert.equal(approval.state, 'APPROVED', 'Role review must be approved');
  assert.equal(approval.commit_id, reviewedCommit, 'Role approval source is stale');
  // GitHub logins are mutable and case-insensitive; the numeric account ID is
  // stable across renames and must bind every later decisive submission.
  const accountId = approval.user?.id;
  assert.ok(Number.isSafeInteger(accountId) && accountId > 0,
    'Immutable authenticated GitHub reviewer ID is required');
  assert.ok(Array.isArray(submittedReviews), 'Authenticated PR review timeline is unavailable');
  const decisive = submittedReviews.filter(review =>
    review?.user?.id === accountId &&
    ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state));
  assert.ok(decisive.length > 0, 'Role approval absent from authenticated review timeline');
  for (const review of decisive) {
    assert.ok(Number.isSafeInteger(review.id) && review.id > 0 &&
      typeof review.submitted_at === 'string' &&
      Number.isFinite(Date.parse(review.submitted_at)),
    'Submitted role review lacks an authenticated ordering witness');
  }
  decisive.sort((a, b) =>
    Date.parse(a.submitted_at) - Date.parse(b.submitted_at) || a.id - b.id);
  const effective = decisive.at(-1);
  assert.equal(effective.id, approval.id,
    'Role approval was superseded by a later decisive review');
  assert.equal(effective.state, 'APPROVED',
    'Effective role review is not approved');
  assert.equal(effective.commit_id, reviewedCommit,
    'Effective role approval source is stale');
}
