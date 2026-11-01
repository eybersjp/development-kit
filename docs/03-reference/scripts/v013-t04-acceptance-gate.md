# v013-t04-acceptance-gate.mjs

## Purpose

`scripts/v013-t04-acceptance-gate.mjs` is the fail-closed, risk-3 DKF130-T04 acceptance evaluator for the **v0.13.0 integration candidate PR #92**. It is not a general release approval and must never run as a shortcut around independent reviews or Windows restore durability evidence.

## Execution context

The script requires an authenticated GitHub Actions pull-request event for `eybersjp/development-kit`, PR #92, from branch `feature/v0.13-state-engine-v2`. The dedicated `t04_acceptance` job must depend on both Ubuntu and Windows validation jobs. The job cannot authenticate evidence from a local invocation or an unrelated diagnostic PR.

## Required independent evidence

The committed `docs/04-architecture/dkf-v013-t04-independent-review-receipts.json` register must bind one immutable reviewed source commit and three distinct, authenticated GitHub `APPROVED` reviews for code, architecture, and security, with exact SHA and role scope. All review threads must be resolved. Review metadata is fetched from GitHub, not trusted from a self-authored receipt.

Issue #73 must be resolved without waiver. Controlled NTFS physical power-loss evidence must be source-bound, independently reviewed and supported by a verified GitHub Actions artifact and digest. Two distinct full Ubuntu/Windows workflow executions must have passed on the identical reviewed commit. The source tree, Git index and executable modes must match the reviewed commit except for the receipt-only follow-up.

## Deterministic decision

After authenticated evidence verification, the script constructs the v0.13 Development Contract verification record, independent review records, security control coverage, and architecture drift assessment. The canonical acceptance engine must return `ACCEPTED` before any acceptance record is written.

The acceptance record is written under `.development-kit/acceptance/DKF130-T04.json` in the runner workspace. **A runner-local file is not, by itself, a durable repository-persisted acceptance verdict.** Release integration requires independently verified retention and retrieval of the authentic record through an approved governance artifact or repository persistence mechanism; this diagnostic implementation does not authorize a merge or release merely because its job passes.

## Usage and limits

```bash
node scripts/v013-t04-acceptance-gate.mjs
```

The command is intended to run only inside its restricted GitHub Actions job. It does not publish releases, close blocking issues, resolve review threads, modify production state or waive full Windows legacy-backup restoration. Source-bound reviews and physical sudden-power-loss evidence cannot be simulated by ordinary CI.
