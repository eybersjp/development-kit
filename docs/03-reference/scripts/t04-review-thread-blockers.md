# t04-review-thread-blockers.mjs

## Purpose

Provides deterministic helpers for the **v0.13 T04 risk-3 review gate**.

T04 acceptance must refuse approval while an authenticated review thread remains unresolved, while source anchoring is ambiguous, or while authenticated review evidence is malformed.

## Usage

The module is imported by T04 acceptance/review tooling and is not itself an acceptance authority.

```js
import { unresolvedReviewThreads } from './t04-review-thread-blockers.mjs';
const blockers = unresolvedReviewThreads(githubReviewThreads);
```

The helper also validates canonical review-request source SHA anchoring and authenticated review-thread page structure.

## Verification

```bash
node --test scripts/t04-review-thread-blockers.test.mjs
```

The regressions cover unresolved findings, conflicting or duplicated source SHAs, malformed review evidence and pagination failures.

This helper cannot generate reviewer PASS results, resolve comments, or bypass source-bound independent review.
