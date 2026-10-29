# t04-acceptance-ci-evidence.mjs

## Purpose

Provides a fail-closed, authenticated GitHub Actions provenance check for the T04 risk-3 acceptance gate. It verifies **two distinct workflow executions** whose PR #70 checkout is the same immutable execution commit **C**, with the same authenticated PR base SHA and complete successful Ubuntu and Windows validation jobs. The independently reviewed commit **R** may precede C when C changes only the authenticated review-receipts file; the acceptance gate separately proves the entire checked-out Git index is byte-for-byte and mode-for-mode identical to R except for that one receipts file.

## Use

Imported by `scripts/t04-hardening-acceptance-gate.mjs` after authentic source-bound review receipts have been verified. This module is not an operator CLI, cannot produce an independent reviewer approval, and does not modify source or governance records.

The collector retrieves the current workflow run, an independent previous run from the same workflow and execution commit, and both runs' actual GitHub job results through the authenticated API. Production T04 PR #70 explicitly checks out its immutable head in Ubuntu, Windows and acceptance jobs; unrelated PRs retain ordinary merge-ref integration validation. The gate compares that checkout HEAD against GitHub's authenticated pull-request event, while the collector rejects PR base drift even if a workflow run reports an unchanged head SHA. It rejects missing, duplicated, wrong-repository, wrong-event, wrong-workflow, source-mismatched, skipped or failed evidence. The current acceptance job may still be in progress; only its **completed prerequisite platform validations** qualify.

The collector queries GitHub Actions for the authenticated workflow ID and **requires that it resolves to `.github/workflows/ci.yml`**, rejecting a different workflow with spoofed job names. It filters by exact run-head SHA and paginates authenticated workflow-run results until it finds a second **successful** complete matrix; a cancelled or failed earlier run cannot conceal an older valid one. Missing, malformed, duplicate, or incomplete job evidence remains fail-closed. Because GitHub selects `pull_request` workflow definitions from the merge ref even when the job checks out the PR head, the gate authenticates the current PR #70 merge commit's exact base/head parents and compares its `.github/workflows/ci.yml` blob to the independently reviewed workflow blob. A different merge-ref workflow cannot supply acceptable evidence. If the PR merge ref changes, the gate fails closed and requires new source-bound CI.

The acceptance gate uses the verified run IDs in criterion evidence instead of a hard-coded historical CI run identifier. It also checks that the original T04 source/concurrency blocker Issue #71 and Windows crash-durability Issue #73 are both closed as **completed**, not waived as **not planned**. Issue closure is necessary but does not replace independent source reviews or real physical power-loss evidence. Unit and adversarial regression coverage is in `scripts/t04-acceptance-ci-evidence.test.mjs` and runs on both CI platforms.

## Limitations

A successful hosted CI matrix proves tested software behavior, **not** NTFS power-loss durability, storage-cache persistence, or controlled restart after physical interruption. Windows restore and journal durability Issue [#73](https://github.com/eybersjp/development-kit/issues/73), the v0.13 T04 scope Issue [#84](https://github.com/eybersjp/development-kit/issues/84), and three independently authenticated code/architecture/security reviews remain separate mandatory acceptance conditions. No synthetic `ACCEPTED` verdict is permitted.
