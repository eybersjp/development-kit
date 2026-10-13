# DKF v0.12.0 — Product Owner release-scope amendment

**Status:** Authorized release-scope change, **NOT** acceptance or publication.
**PO authority:** [Issue #82](https://github.com/eybersjp/development-kit/issues/82), 13 October 2026.
**Effective version:** 0.12.0.
**Original baseline:** Approved T01–T03 source, `feature/v0.12-execution-capsules-context-cache`.
**Excluded feature:** DKF120-T04 State Engine V2 in its entirety.

## Authoritative release scope

The original scale/context v0.12 specification and ten-task PLAN are preserved as historical planning evidence, but the PO explicitly superseded their release scheduling and T04 requirement through Issue #82. This document and the machine-readable `dkf-v0.12-release-scope.json` now govern **v0.12.0 release scope only**.

| Release task | Feature | Accepted predecessor for integration |
|---|---|---|
| DKF120-T01 | Cost Observatory | None |
| DKF120-T02 | Workspace Target Engine | T01 |
| DKF120-T03 | Execution Capsules and Context Cache | T02 |
| DKF120-T05 | Lifecycle Instances over existing stable state authority | T03 |
| DKF120-T06 | Discovery and Controlled Re-entry | T05 |
| DKF120-T07 | Generic Gate Profiles | T06 |
| DKF120-T08 | Verification Extension SDK | T07 |
| DKF120-T09 | Complexity Delta Guard | T08 |
| DKF120-T10 | Read-only Control Center and comparative release verification | T09 |

T04 is not being accepted, integrated, supplied as a stub, or partially enabled in v0.12. The incumbent v0.11 versioned-autopilot-snapshot state authority remains supported. New features must not import T04 source, depend on its schema/index, or hide a T04 requirement behind a positive health flag. No application-specific verification enters DKF core.

## Acceptance criteria

**Required in v0.12:** all original `DKF-120-AC-001` through `DKF-120-AC-040` except `AC-012`, `AC-013`, `AC-014`, `AC-015` (T04 canonical State Engine) and `AC-034` (state micro-file reduction contingent on that engine): **35 required criteria**.

**Deferred to v0.13 (NOT PASSED):** `AC-012`, `AC-013`, `AC-014`, `AC-015`, `AC-034`. No measured performance improvement for these five is claimed or assumed. AC-035, AC-033 and T10 comparative performance evidence remain required where measurements are observable. All existing public commands and backward compatibility remain required.

Any contract whose exact source authority was bound to the superseded T04 predecessor must be refreshed against this addendum and the accepted stable-state baseline. Original T04 contracts and audit evidence remain intact and BLOCKED, not falsified as accepted. Other contracts are not silently marked accepted.

## v0.13.0 priority #1

Implement T04 State Engine V2 with its complete migration, canonical ledger, pending journal, state reconstruction, Windows crash-durable backup restoration and recovery, filesystem/hardware evidence, and independent code/architecture/security role reviews. See Issue #73, PR #70 and Issue #82. Full Windows restore support **has not been dropped**, only moved to v0.13. The separate hostile same-account writer threat model deferral remains Issue #72.

## Release readiness

- Verified real implementation of T01–T03 and T05–T10 over the stable state authority; actual cross-feature integration tests and a read-only Control Center; no T04 imports in shipping modules.
- Deterministic scope check, 35 applicable acceptance criteria, risk-appropriate independent review and mandatory security/design/human gates. No self-certification or stale-source receipts.
- Full `npm run release:validate` green on the exact Windows and Ubuntu final SHA; regression and public CLI compatibility checks.
- Truthful baseline-versus-release token/cost/microfile measurement; unsupported metrics marked unavailable rather than fabricated.
- Package, lockfile, changelog, documentation, installation manifest and plugin adapters versioned consistently at 0.12.0.
- Product Owner has explicitly requested publication when accepted. Publish via the authenticated established maintainer workflow **only after final checks**, then confirm GitHub release and npm availability.

This amendment makes shipping v0.12 feasible without forcing unfinished T04 into production, while preserving every relevant acceptance control for shipped functionality.
