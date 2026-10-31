# v013-t04-review-provenance.mjs

## Purpose

`scripts/v013-t04-review-provenance.mjs` supplies the narrowly scoped authenticated-review effective-state guard used by the DKF130-T04 v0.13 risk-3 acceptance evaluator.

## Review provenance contract

A valid role receipt identifies a distinct authenticated GitHub `APPROVED` review bound to the immutable reviewed source commit. The single-review endpoint alone is insufficient: an earlier approved review may have been superseded by a later `CHANGES_REQUESTED`, `DISMISSED`, or approval on a different commit.

`assertCurrentRoleApproval(approval, submittedReviews, reviewedCommit)` examines the authenticated, paginated pull-request review timeline using the immutable positive numeric GitHub `user.id` (not mutable/case-insensitive `user.login`). It ignores non-decisive `COMMENTED` submissions, requires valid submitted-at ordering witnesses, and fails closed unless the latest decisive review by the same account, including after username changes, is the exact approved receipt for the exact reviewed commit. The production gate also binds distinct role reviewers, source-author exclusion and the independent physical NTFS reviewer to authenticated numeric account IDs. The caller must retrieve the review timeline through authenticated GitHub API calls and retain the independent role, distinct identity, zero unresolved threads, and physical NTFS evidence gates.

## Validation

`node --test scripts/v013-t04-acceptance-ci-contract.test.mjs` includes T04-A19/A23/A24 adversarial cases for revoked approvals, stale reapprovals, dismissed reviews, and harmless later comments. Both Ubuntu and Windows full CI jobs must pass on the same candidate commit. This helper never issues approvals, marks review threads resolved, merges PRs, or emits `ACCEPTED` by itself.
