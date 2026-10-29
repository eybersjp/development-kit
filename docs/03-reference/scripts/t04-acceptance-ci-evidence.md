# t04-acceptance-ci-evidence.mjs

## Purpose

Provides a fail-closed, authenticated GitHub Actions provenance check for the T04 risk-3 acceptance gate. It verifies **two distinct workflow executions** whose PR #70 head is the same immutable independently reviewed source and whose full Ubuntu and Windows validation jobs both completed successfully.

## Use

Imported by `scripts/t04-hardening-acceptance-gate.mjs` after authentic source-bound review receipts have been verified. This module is not an operator CLI, cannot produce an independent reviewer approval, and does not modify source or governance records.

The collector retrieves the current workflow run, an independent previous run from the same workflow and commit, and both runs' actual GitHub job results through the authenticated API. It rejects missing, duplicated, wrong-repository, wrong-event, wrong-workflow, source-mismatched, skipped or failed evidence. The current acceptance job may still be in progress; only its **completed prerequisite platform validations** qualify.

The acceptance gate uses the verified run IDs in criterion evidence instead of a hard-coded historical CI run identifier. It also checks that the original T04 source/concurrency blocker Issue #71 and Windows crash-durability Issue #73 are both closed as **completed**, not waived as **not planned**. Issue closure is necessary but does not replace independent source reviews or real physical power-loss evidence. Unit and adversarial regression coverage is in `scripts/t04-acceptance-ci-evidence.test.mjs` and runs on both CI platforms.

## Limitations

A successful hosted CI matrix proves tested software behavior, **not** NTFS power-loss durability, storage-cache persistence, or controlled restart after physical interruption. Windows restore and journal durability Issue [#73](https://github.com/eybersjp/development-kit/issues/73), the v0.13 T04 scope Issue [#84](https://github.com/eybersjp/development-kit/issues/84), and three independently authenticated code/architecture/security reviews remain separate mandatory acceptance conditions. No synthetic `ACCEPTED` verdict is permitted.
