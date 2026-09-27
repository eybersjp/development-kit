# DKF Development Modes — Increment 001 Architecture and ADR

**Decision:** Introduce a pure development-methodology policy layer separate from the existing Autopilot autonomy-level engine. This is a foundation contract, not a change to the live lifecycle.

## Repository audit (27 September 2026)

- The canonical nine-stage lifecycle and contract/evidence acceptance path exist in `runtime/autopilot/` and `runtime/orchestration/`.
- `runtime/autopilot/policy-engine.mjs` governs *autonomy levels* and mandatory human approval gates. Do not repurpose its `mode` terminology for development methodology.
- `runtime/bootstrap/project-bootstrap.mjs` owns project-local initialization; project settings already live under `.development-kit/`. Increment 002 will integrate persistence there without destructively changing existing files.
- `runtime/orchestration/development-contract.mjs`, `gate-selector.mjs`, `verification-engine.mjs` and `acceptance-engine.mjs` own the existing release-critical decisions. Modes are not permission to bypass them.
- `scripts/*.test.mjs` use Node's built-in test runner. `schemas/` holds machine-readable contracts, and `docs/SUMMARY.md` indexes each documentation page.
- `main` is v0.10.0. Draft PR #41 independently implements v0.10.1 Live UI Preview. This increment is based on `main` and neither changes its version nor claims PR #41 functionality is released.

## Decision 001-A: Methodology and project context are separate

User interface offers five named modes. Four are methodology profiles; Maintenance & Evolution is a context wrapper inheriting one of those profiles. The `existingProjectAuditRequired` output is always true when Maintenance & Evolution is selected. The first integration consumer must require evidence of repository discovery and compatibility impact assessment before implementation in that mode.

## Decision 001-B: Three policy layers, one non-configurable control floor

Input `mode` selects immutable defaults. `customPolicies` may alter discretionary defaults. `projectOverrides` must be equal or stricter than the customized result. The `mandatoryControls` manifest is fixed and unaddressable by either input layer. Project overrides reject `contextPacking` because larger context is not a security/governance escalation.

This contract does **not** set or inspect current approvals. Mandatory approval decisions remain in the existing authority engines. Later integration must compose additional gates by union, never subtract existing required gates.

## Decision 001-C: Explicit versioned input and deterministic provenance

Machine-readable input: [development-mode-config.schema.json](../../schemas/development-mode-config.schema.json). Runtime authoritative resolver: `runtime/development-modes/policy-contract.mjs`. Runtime validation includes the relational strictness check that JSON Schema alone cannot express; tests guard field/enum parity.

Example valid input:

```json
{
  "schemaVersion": 1,
  "mode": "maintenance-evolution",
  "baseMethodology": "balanced",
  "customPolicies": {
    "contextPacking": "lean"
  },
  "projectOverrides": {
    "testingDepth": "contract"
  }
}
```

Return values: `schemaVersion`, `mode`, nullable `baseMethodology`, `existingProjectAuditRequired`, `effectivePolicies`, per-field `policySources`, `mandatoryControls`. Strict input rejects unknown keys and invalid types. Resolver does not mutate input, access a file, select an agent, or call an external provider.

## Policy dimensions

| Field | Ordered values from least to most formal |
| --- | --- |
| `planningDepth` | minimal / standard / comprehensive |
| `documentationDepth` | concise / standard / comprehensive |
| `architectureDepth` | lightweight / core / comprehensive |
| `featureSpecifications` | contextual / standard / mandatory |
| `testingDepth` | essential / standard / contract / comprehensive |
| `documentationMaintenance` | progressive / incremental / traceable / continuous |
| `governance` | lightweight / standard / strict |
| `ownerAcceptance` | baseline / per-increment |
| `contextPacking` | lean / balanced / full — preference only; not a safety strength |

The `ownerAcceptance: baseline` selection never removes human approvals that existing DKF policies already require. `featureSpecifications: contextual` retains specifications for nontrivial development; it allows concise artifacts for small changes, not implementation without defined acceptance criteria. Testing depth changes the discretionary test breadth, not whether required runtime verification or controls must be evidenced.

## Data flow and future integration

```text
selected mode + optional maintenance base
            |
       profile defaults
            |
   validated customPolicies
            |
 strict projectOverrides check
            |
 immutable effective snapshot + provenance + mandatory manifest
            |
   [Increment 002] persistence and revisioned history
            |
   [Increment 003] bounded artifact/plan/gate consumers
            |
 existing Development Contract + independent verification
            |
 existing deterministic acceptance and human approvals
```

Future persistence should use `.development-kit/` in the project repository; the precise file and audit-log atomic-write mechanism are delegated to Increment 002. A change to methodology must be an explicit revisioned Product Owner action, not a silent AI adjustment. Active approved contracts must retain their original mode-policy snapshot/source fingerprint; changing mode applies to future contracts, and an in-progress contract needs reconciliation/reapproval before it can consume a new policy. Historical evidence and previously approved documents are never rewritten.

## Failure and compatibility contracts

| Condition | Required outcome |
| --- | --- |
| Invalid/unknown mode, schema or policy | `DK_MODE_CONFIG_INVALID`, no fallback to permissive defaults |
| Unknown override key or mandatory-control bypass attempt | Reject configuration |
| Project override weaker than customized profile | Reject configuration |
| Maintenance without selected base | Inherit Balanced; record the resolved base in snapshot |
| Mode configuration absent in existing repository | Increment 002 explicitly migrates/records Balanced; Increment 001 resolver does not silently infer persisted state |
| Malformed persisted config in future | Stop integration; never continue with an unverified policy |
| New policy conflicts with active contract | Reconcile in later increment; never retroactively erase contract evidence |
| UI work after PR #41 merges | Existing visual/runtime verification obligations still apply, regardless of mode |

## Files affected in this increment

- `runtime/development-modes/policy-contract.mjs` — pure profile and resolution module.
- `schemas/development-mode-config.schema.json` — portable input schema.
- `scripts/development-modes.test.mjs` — criterion and schema-parity tests.
- `package.json` — includes the tests in release validation, without changing public version.
- This specification, architecture document, `docs/SUMMARY.md`, and `memory.md`.

Do not modify `runtime/autopilot/`, `runtime/orchestration/`, installed plugin mirrors or current project settings in this increment. No new dependency is required. Do not publish, tag or merge as part of this PR.

## Acceptance and follow-on increments

[Increment 001 specification](dkf-development-modes-increment-001-spec.md) defines MOD-001 through MOD-011. The tests cover the deterministic foundation, but full integration behaviour belongs to Increments 002–005. Acceptance requires actual test evidence, independent review of the GitHub diff and Product Owner sign-off. Recommended merge order is resolution of draft PR #41's own Product Owner gate first, then coordinated rebase/revalidation of this branch before any release/version decision.
