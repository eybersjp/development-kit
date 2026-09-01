---
name: dk-ship
description: >-
  Perform final deterministic acceptance, full release validation, documentation/version checks, diff review and controlled release preparation.
---

# /dk-ship

## Purpose

Final release gate. Shipping is not authorized by an agent's completion claim: every active contract must be runtime-accepted and the repository's complete release validation must pass before merge/tag/publication preparation.

## Workflow

1. Verify no active contract/run is PENDING or BLOCKED. For contract-aware work, acceptance must be `ACCEPTED`, source fingerprints current, required controls/reviews complete, and no unresolved architecture/design/security gate present.
2. For UI scope verify authoritative `design.md`, Same Design Team/visual evidence requirements, and no blocking Design Authority findings.
3. Run `npm run release:validate` from the exact candidate commit. Do not substitute a smaller test subset.
4. Inspect the complete diff for scope, generated/stale files, dependency/architecture delta, credentials/secrets, migration history, installer/package contents and version consistency.
5. Run the full independent spec/code/simplicity and conditional security/accessibility/design/architecture reviews required by the release risk.
6. Verify README/docs/changelog/release notes/migration guidance and active-version references.
7. Verify package version, plugin manifest version, release tag target and installable npm package contents agree.
8. Prepare the PR/merge only when all gates are green.
9. Publication/tag/npm/GitHub Release remains a consequential remote action and must use the repository's controlled maintainer release workflow after the final main commit is verified.

## Fail-Closed Conditions

Stop shipping for any PENDING/BLOCKED acceptance, stale contract, unverified required control, failed regression, docs validation error, plugin/package mismatch, install isolation failure, unresolved reviewer finding, unauthorized architecture drift, or release-validation failure.

## Skills Activated

- `branch-completion`
- `task-completion-gate`
- `release-readiness`
- `verification-before-completion`
- `regression-testing`
- conditional specification/code/security/accessibility/design/simplicity review skills

## Sub-Agents

- `spec-reviewer`
- `code-reviewer`
- `simplicity-reviewer`
- conditional specialist reviewers selected by risk

## Output

A source-backed ship report with exact candidate commit, runtime acceptance state, full `release:validate` result, installer/package/version state, unresolved blockers, final diff/review status and controlled release recommendation.
