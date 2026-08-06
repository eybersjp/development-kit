# review-report

**Source**: `templates/review-report.md` · **Frontmatter**: `name: review-report`

## Intended Lifecycle Stage

REVIEW.

## Intended User / Agent

All reviewers (spec-reviewer, code-reviewer, security-reviewer, accessibility-reviewer, design-reviewer, simplicity-reviewer).

## Purpose

Documents review results: review type, verdict, summary, acceptance-criteria coverage, findings by severity, strengths, and recommendation.

## Required Sections

Review Type · Verdict · Summary · Acceptance Criteria / Requirements Coverage · Findings (Critical/Major/Minor tables) · Strengths · Recommendation · Reviewed By

## Optional Sections

None.

## How the Template Is Selected

Used by every reviewer agent when producing a review verdict.

## How It Should Be Completed

- Verdict: PASS / FAIL / PASS WITH ISSUES (or SIMPLIFICATIONS RECOMMENDED for simplicity reviews)
- Every finding tagged with location and recommendation
- Coverage table filled per criterion with PASS/FAIL and evidence

## Validation Expectations

- No finding without a location and recommendation
- Verdict consistent with findings (FAIL cannot have zero issues)
- Reviewer identified

## Related

[spec-reviewer](../agents/spec-reviewer.md), [code-reviewer](../agents/code-reviewer.md), [review-pipeline-internals.md](../../06-internals/review-pipeline-internals.md).
