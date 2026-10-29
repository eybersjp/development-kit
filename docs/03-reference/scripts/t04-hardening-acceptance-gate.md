# t04-hardening-acceptance-gate.mjs

## Purpose

Runs the existing DKF risk-3 `decideAcceptance` engine for the T04 State Engine V2 hardening increment. It runs **only inside GitHub Actions** after Windows and Ubuntu validation and the exact `npm run release:validate` command have passed on the source being reviewed. It is an acceptance-evidence gate, not a substitute for independent review.

## Usage

```bash
node scripts/t04-hardening-acceptance-gate.mjs
```

The command requires trusted GitHub Actions repository, pull-request, workflow and job identities, an authenticated GitHub review-read token and three genuine external role-specific reviews of the **exact immutable source commit**. It cannot issue a local or implementation-authored PASS.

## Evidence and failure conditions

The gate loads the approved T04 Development Contract `INC-DKF120-T04`; derives verification for `AC-012`, `AC-013`, `AC-014`, `AC-015` and `AC-034`; verifies full source-tree provenance against the recorded reviewed commit; and checks authenticated GitHub code, architecture and security reviewer receipts. Review requests must bind precisely one role each. The final review receipt document is `docs/04-architecture/dkf-t04-independent-review-receipts.json`.

It also checks **every review thread is resolved**. `scripts/t04-review-thread-blockers.mjs` rejects unresolved P1/P2 and lower-priority or unclassified threads alike, as the contract requires zero outstanding review comments. Regression tests are included in `npm run state-engine-v2:test`.

The command records `verification.json`, `control-security.json` and `acceptance.json`, containing the source fingerprints, typed evidence, blocker/pending lists, review provenance and deterministic verdict in the T04 run directory. CI uploads the artifacts when available. Missing, edited, stale, unauthenticated or finding-bearing review evidence fails closed.

**Passing CI alone is not acceptance.** The receipt file may remain `PENDING_INDEPENDENT_REVIEWS` until authentic reviews have completed; no reviewer receipts may be fabricated or self-certified.

## Scope and release limitations

The Product Owner deferred stronger protection against malicious concurrent same-account filesystem writers to future Issue [#72](https://github.com/eybersjp/development-kit/issues/72). T04 supports the explicitly documented trusted/exclusive local-runtime limitation, without claiming to prevent hostile same-UID path replacement. Restricted offline restoration has its own operator confirmation and recovery boundary. Security reviewers still assess all in-scope integrity and durability defects.

Only after all exact-source tests, independent review, applicable approvals and the deterministic `ACCEPTED` state may PR #70 be promoted into its approved T04 base. This does not independently authorize merging the cumulative PR #69 into `main`, commencing T05, deleting retained legacy state, or publishing v0.12.0.
