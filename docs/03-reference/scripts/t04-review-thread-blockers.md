# t04-review-thread-blockers.mjs

## Purpose

Provides a pure, deterministic helper to identify unresolved GitHub pull-request review threads. The DKF120-T04 risk-3 independent acceptance gate must refuse approval while **any review thread remains unresolved**, including P0/P1/P2, unclassified findings and missing resolution status. Priority labels are not a sufficient substitute for the documented requirement of zero outstanding review comments.

## Usage

The helper is imported by `scripts/t04-hardening-acceptance-gate.mjs` and is not an independently runnable acceptance command.

```js
import { unresolvedReviewThreads } from './t04-review-thread-blockers.mjs';
const blockers = unresolvedReviewThreads(githubReviewThreads);
```

It returns every input thread without an explicit `isResolved: true` marker. Malformed top-level evidence fails closed. The module also provides `requireCanonicalReviewRequestCommit()` to enforce one uniquely anchored full source SHA in role-scoped review requests, and `parseReviewThreadPage()` to reject missing or malformed authenticated GraphQL thread pages before pagination. An authenticated reaction alone carries no source SHA; ambiguous or conflicting requests cannot establish it. No caller may use these functions to generate external reviewer PASS results or bypass authenticated source-bound review receipts.

## Verification

`node --test scripts/t04-review-thread-blockers.test.mjs` runs deterministic regressions covering unresolved P1/P2/unclassified comments, resolved threads, conflicting/duplicated commit SHAs, null GraphQL pages and malformed pagination evidence. It is included in `npm run state-engine-v2:test` and therefore the full `npm run release:validate` pipeline.

This helper is part of the T04 hardening increment and does not authorize T05, a merge, or publication of v0.12.0.
