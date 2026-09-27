# DKF Development Modes — Increment 002: Initialization Integration

**Status:** implementation candidate; independent review and Product Owner acceptance required.  
**Dependency:** [Increment 001 contract](dkf-development-modes-increment-001-spec.md).  
**Branch:** `feature/development-modes-increment-002`, stacked on draft PR #42; do not merge or publish during this increment.

## Problem

The mode resolver from Increment 001 is pure and not connected to project initialization. DKF must present or accept a methodology choice, persist it in the project repository, retain explicit change history, make deterministic non-binding recommendations and refuse malformed policy instead of relying on an AI's conversational recollection.

## Required behaviour

- **INIT-001 — New project:** Project bootstrap persists a versioned `.development-kit/development-mode.json` in the Git-tracked state directory. With no supplied selection in non-interactive execution, explicitly records Balanced, `source: default`. An interactive terminal offers numbered mode choices, including a maintenance base-methodology follow-up. `--mode` and `--config-file` provide headless alternatives. Never conflate developer *methodology* with existing Autopilot autonomy settings.
- **INIT-002 — Legacy migration:** On existing bootstrapped projects without a mode file, bootstrap records Balanced with `source: legacy-migration`. Existing project identity, settings, documents, approved artifacts and autopilot state are unchanged.
- **INIT-003 — Idempotence:** Repeated bootstrap leaves a valid mode file and its history byte-identical. A different requested selection requires a separate explicit mode-change operation.
- **INIT-004 — Fail closed:** Invalid, corrupt, missing-history, noncontiguous-revision, or out-of-sync selection/history blocks status and initialization. No invalid state is silently reset.
- **INIT-005 — Explicit mode change:** `--set-mode` requires `--expected-revision` and a nonblank `--reason`; records actor, timestamp, source, new selection and incremented revision in an append-only logical history. Stale writers fail. A no-op selection does not add a revision. Invalid input must not modify persisted bytes.
- **INIT-006 — Validated configuration:** `--config-file` is restricted to files inside the project directory. Input is resolved through the Increment 001 policy contract before any mode write. Project overrides remain only-strengthening; mandatory controls cannot be configured.
- **INIT-007 — Recommendation:** A pure, deterministic and explainable questionnaire recommends a mode without writing it. Existing-project answers recommend Maintenance & Evolution with an inherited methodology. Developer selection always wins over recommendations.
- **INIT-008 — Status:** Bootstrap status exposes mode-state `absent | configured | invalid` and non-mutating inspection; CLI can report selected mode, policy provenance, revision, and history.
- **INIT-009 — Integrity:** Atomic write+rename in one canonical file, lock against simultaneous writers, reject symlinked state paths, and preserve old state on failures. No new third-party dependency.
- **INIT-010 — Compatibility:** The standalone installer is unchanged; Autopilot and current Development Contract/Acceptance Engine still operate as before. No new release/tag/merge.
- **INIT-011 — Verification:** Node tests cover input validation, migrations, reentry, concurrency/revision, invalid history, path confinement, CLI headless modes and recommendation determinism. Both platform CI jobs must run the new suite through `npm run release:validate`.

## CLI contract

```text
node scripts/bootstrap.mjs --init [--mode=balanced] [--no-interactive]
node scripts/bootstrap.mjs --init --mode=maintenance-evolution --base-methodology=spec-driven
node scripts/bootstrap.mjs --init --config-file=.development-kit/mode-selection.json
node scripts/bootstrap.mjs --mode-status
node scripts/bootstrap.mjs --recommend --project-type=existing --delivery=production --requirements=clear --documentation=standard --governance=strict
node scripts/bootstrap.mjs --set-mode --mode=doc-driven --expected-revision=1 --reason="Agreed process change"
node scripts/bootstrap.mjs --history
```

If `--mode` or `--config-file` are supplied to an already configured project and differ from the saved selection, bootstrap fails with explicit instructions to use `--set-mode`. The interactive choice is presented only for an unconfigured project with a real terminal; headless operation selects Balanced. Explicit recommendation is read-only.

## Exclusions

No modifications to mode policy consumption by Autopilot, context packaging, gate selection or artifact selection; those belong to Increment 003. No documentation template generation or drift checks (004), and no claim of final end-to-end host acceptance (005). No silent mode changes by an AI. No release version bump while PR #41 (Live UI Preview) and PR #42 (001) remain draft.

## Acceptance evidence

Inspect actual source, diff, GitHub CI results, tests and Product Owner response independently. Passing automation is not equivalent to Product Owner acceptance. Preserve the stacked branch relationship until upstream review and rebasing are complete.
