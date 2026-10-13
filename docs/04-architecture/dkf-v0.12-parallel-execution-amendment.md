# DKF v0.12.0 — Product Owner-approved parallel execution amendment

**Authority:** Approved Product Owner decision (13 October 2026), tracked in [Issue #74](https://github.com/eybersjp/development-kit/issues/74) and [PR #70 decision](https://github.com/eybersjp/development-kit/pull/70#issuecomment-6140991711).
**Status:** Scheduling-policy amendment, independently reviewable; not task acceptance or release authorization.
**Amends:** Section 1, implementation **start** restriction of `dkf-scale-context-iteration-v0.12-implementation-plan.md`. All unchanged provisions remain binding.

## Purpose and precedence

The original Phase 2 PLAN requires dependency acceptance before starting the next implementation, *unless the PLAN is explicitly revalidated after an approved amendment*. The Product Owner approves this narrow scheduling amendment: isolated provisional implementation and testing of DKF120-T05–DKF120-T10 may start while T04 is not yet accepted.

To avoid invalidating immutable T01–T04 Development Contract source fingerprints solely because of an execution-schedule clarification, the existing historical PLAN text and deterministic dependency model remain byte-identical. **This additive document is the authoritative approved amendment to its section 1 scheduling rule**, subject to deterministic validation by `scripts/phase02-parallel-execution-amendment-validate.mjs`.

If its validator fails or the source authority differs, the exception must fail closed until revalidated. This amendment changes *when isolated development may start*, not what may be accepted, merged or published.

## Explicit execution policy

1. T05–T10 may be implemented, tested and developed in bounded provisional isolated branches/worktrees before their upstream tasks are accepted, using explicit assumptions for unaccepted interfaces.
2. The unchanged `dependsOn` graph `T01 -> T02 -> T03 -> T04 -> T05 -> T06 -> T07 -> T08 -> T09 -> T10` still governs formal acceptance, integration and promotion. No acceptance or protected-branch merge before the full dependency chain is accepted.
3. For each speculative task: create a task-specific Development Contract, mark its engineering result PROVISIONAL, document upstream assumptions and track source fingerprints. Never misrepresent the provisional implementation as formally `ACCEPTED`.
4. When an upstream source or contract changes or is accepted, reconcile against the newly accepted source, invalidate affected tests and reviews, rerun regression/integration, obtain required independent source-bound acceptance, and integrate in dependency order.
5. Draft PRs should target their **immediate predecessor feature branch** to show only task-specific changes, while their source lineage remains explicit. Governance amendment PR should target the T04 source branch, not `main` to avoid a misleading cumulative diff. Retarget/rebase when the canonical integration baseline advances; do not merge drafts prematurely.
6. No weakening of Development Contracts, deterministic acceptance, independent review, Design Authority, configuration/security/human gates, evidence provenance or the 40 v0.12.0 acceptance criteria.
7. Full Windows legacy-backup restoration/recovery remains mandatory under Issue #73. Hostile same-account concurrent writer isolation is separately deferred under Issue #72 and does not waive Windows crash durability.
8. T10 comparative/benchmark and Control Center evidence must come from real canonical runtime behavior, not hardcoded healthy-status or capability placeholders. Release publication still requires explicit final Product Owner approval.

## Deterministic revalidation

The accompanying JSON policy specifies permitted speculative task IDs and immutable acceptance/integration edges. The `phase02-parallel-execution-amendment-validate.mjs` command checks:

- the exact T05–T10 provisional-start scope;
- ten tasks and all nine existing dependency edges unchanged;
- 40 required acceptance criteria retained;
- explicit separation of speculative implementation permission from acceptance/integration gates;
- refusal of any publication authorization.

If validation fails, do not apply this scheduling exception.

## Branch and review boundaries

Existing draft branches are **stacked**, not six independent branches from `main`; do not treat cumulative PR diffs against `main` as isolated evidence. Set PR #75 base to T04, PR #76 base to T05's predecessor/T04 (or the accepted governance integration branch as appropriate), and PRs #77–81 to their immediate predecessor feature branches. Reconcile the governance amendment into working branches without resetting their existing implementation.

This amendment is NOT a T04 PASS review, T05–T10 accepted Development Contracts, approval to merge PR #69/#70, or release authorization.
