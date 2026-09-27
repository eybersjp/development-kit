# DKF Development Modes — Increment 001 Feature Specification

**Status:** Implementation candidate; Product Owner acceptance pending.  
**Baseline:** `main` v0.10.0 (commit `ed6acb78540264cc242944b53942028fba1401e8`).  
**Scope boundary:** This increment defines and tests the policy contract. It does not activate mode-aware initialization or lifecycle execution.

## Problem and outcome

DKF currently uses one core lifecycle and an existing Autopilot *autonomy-level* policy. Different developers need different documentation and planning depths without weakening the existing contract/evidence/acceptance system. Development methodology must be a separate, deterministic, repository-owned selection rather than an agent recollection or a replacement lifecycle.

## Five user-facing modes

| Mode ID | Display name | Intended default |
| --- | --- | --- |
| `rapid` | Rapid Development | Concise documents, essential tests, lean context |
| `balanced` | Balanced Development | Standard artifacts and testing; default choice |
| `spec-driven` | Specification-Driven Development | Mandatory feature specifications, contract-focused testing |
| `doc-driven` | Documentation-Driven Development | Comprehensive foundation, continuous document maintenance |
| `maintenance-evolution` | Maintenance & Evolution | Existing-project discovery, inherits a selected methodology (defaults to balanced) |

Maintenance describes project context. The selected `baseMethodology` may be any of the four methodology modes; the maintenance resolver additionally flags a required repository audit. This avoids building a separate lifecycle.

## Policy layers and authority

1. Selected mode resolves an immutable default policy profile.
2. `customPolicies` may replace **discretionary** profile defaults, including reducing extra owner-review checkpoints. It cannot name or change mandatory controls.
3. `projectOverrides` may maintain or *strengthen* discretionary governance settings after customization. Context packing is a cost/preference, so it belongs in `customPolicies`, not a strictness override.
4. Existing DKF runtime gates remain authoritative; this module does not supersede the Autopilot autonomy engine, Development Contract, acceptance engine, Design Authority or release policy.

The following controls are not selectable: canonical nine-stage lifecycle, Development Contract authority, independent evidence-backed verification, source freshness/provenance, deterministic acceptance, execution safety, required human approvals, applicable security/design checks and release validation. Reduced documentation volume must not be misreported as passed verification.

## Resolution contract

`resolveDevelopmentModeConfiguration(config)` accepts a plain object with `schemaVersion: 1`, one supported `mode`, optional maintenance-only `baseMethodology`, optional `customPolicies`, and optional `projectOverrides`. Unknown top-level fields, policy names, enum values, malformed structures and unsupported schema versions are rejected with `DevelopmentModeConfigurationError` (`DK_MODE_CONFIG_INVALID`).

It returns an immutable, deterministic snapshot with `mode`, `baseMethodology`, `existingProjectAuditRequired`, `effectivePolicies`, field-level `policySources` and the non-configurable `mandatoryControls` manifest. The module performs no file reads/writes or stage transitions. `getDefaultModeConfiguration()` explicitly returns the balanced selection; absence of a persisted configuration is not silently interpreted by this resolver.

## Acceptance criteria

- **MOD-001:** Exactly five modes are declared; balanced is the explicit default.
- **MOD-002:** Every mode resolves to a complete, immutable policy snapshot with valid enum values.
- **MOD-003:** Rapid, Balanced, Spec-Driven and Doc-Driven have behaviourally distinct policy profiles.
- **MOD-004:** Maintenance inherits an explicit methodology, defaults to balanced and requires an existing-repository audit.
- **MOD-005:** Custom policy changes are reflected in the effective policy and provenance without changing mandatory controls.
- **MOD-006:** Project overrides may only maintain or increase the discretionary strictness of the customized baseline.
- **MOD-007:** Context-packing preferences cannot masquerade as stricter project governance.
- **MOD-008:** Unknown/malformed configuration and safety-bypass attempts fail closed.
- **MOD-009:** Mandatory-control manifest is immutable and mode-independent.
- **MOD-010:** Resolution is deterministic, pure and does not mutate caller input.

## Non-goals and reserved work

- **002 — Initialization:** interactive mode choice, CLI flags, persistence in the project repository, deterministic recommendation and historical change records.
- **003 — Adaptive lifecycle:** consume the validated snapshot in artifact selection, Autopilot and contract/gate construction; preserve current approval controls.
- **004 — Documentation engine:** mode-aware templates, canonical document authority, versioning, traceability and drift checks.
- **005 — Compatibility:** existing-project migration, mode-switch evidence continuity, cross-mode system tests, full host and runtime acceptance, measured token budgets.

The Increment 001 code is intentionally inert until a later increment binds it to the existing runtime. It neither modifies current project settings nor changes the v0.10.0 package version. Draft PR #41 for v0.10.1 Live UI Preview remains independent and unmerged.

## Verification and acceptance

Run `node --test scripts/development-modes.test.mjs` and the existing `npm run release:validate`; audit the PR against these ten criteria and inspect the actual diff. Passing automated checks alone do not imply Product Owner acceptance or release readiness. This increment contains no UI, so a new browser preview is not an applicable test. The PR remains draft until review and acceptance are recorded.
