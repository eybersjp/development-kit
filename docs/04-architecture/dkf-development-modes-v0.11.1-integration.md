# DKF Development Modes — v0.11.1 Integration Specification

**Status:** implementation branch  
**Baseline:** v0.11.1  
**Tracking:** Issue #50

## Purpose

Provide project-selectable development methodologies without creating alternate safety systems or weakening DKF's reliability control plane. Method selection is persisted, revisioned, deterministically resolved, consumed by artifact/planning/documentation behavior, and immutably bound into each new Development Contract.

## Architecture

```text
Product Owner selection
        ↓
.development-kit/development-mode.json
        ↓
pure policy resolver
        ↓
immutable mode snapshot + fingerprint
        ↓
artifact/spec/plan/document guidance
        ↓
Development Contract binding
        ↓
existing verification/review/acceptance engines
```

Autopilot autonomy remains a separate concern. The canonical nine-stage lifecycle and all mandatory controls remain authoritative.

## Acceptance Criteria

### Policy foundation

- **MODE-001:** Exactly five user-facing modes exist: Rapid, Balanced, Specification-Driven, Documentation-Driven and Maintenance & Evolution.
- **MODE-002:** Balanced is the explicit default.
- **MODE-003:** Every selection resolves deterministically to a complete immutable policy and provenance map.
- **MODE-004:** Maintenance & Evolution inherits a methodology and marks repository audit/impact analysis required.
- **MODE-005:** Mandatory controls are mode-independent and cannot be addressed by custom/project overrides.
- **MODE-006:** Project overrides may only maintain/increase policy strictness; context packing remains a preference rather than a governance escalation.
- **MODE-007:** Invalid/unknown/malformed policy fails closed.

### Initialization and persistence

- **MODE-008:** Fresh bootstrap persists one revision; headless default is Balanced and explicit selection is supported.
- **MODE-009:** Existing initialized projects without mode state receive a recorded Balanced legacy migration without rewriting identity/settings/artifacts.
- **MODE-010:** Repeated bootstrap is idempotent and never silently changes an established mode.
- **MODE-011:** Mode changes require expected revision and reason, preserve history, reject stale/concurrent writers, and use atomic replacement.
- **MODE-012:** Corrupt state, unsafe file types and project-external config paths fail closed.
- **MODE-013:** Deterministic recommendation is advisory and non-mutating.

### Runtime consumption

- **MODE-014:** Artifact/specification selection consumes mode guidance but never lowers the risk-derived artifact minimum.
- **MODE-015:** Spec-Driven behavioural work has at least Standard specification formality; Doc-Driven behavioural Standard work is Comprehensive.
- **MODE-016:** Task planning consumes planning/testing/documentation guidance while retaining deterministic PLAN validation.
- **MODE-017:** Autopilot reads mode state before lifecycle routing and blocks on invalid mode state.
- **MODE-018:** Each new schema v1.2 Development Contract binds the current mode snapshot, revision and fingerprint.
- **MODE-019:** A later mode change does not mutate or invalidate the bound snapshot of an existing contract solely because methodology changed; future contracts bind the new revision.
- **MODE-020:** Legacy Development Contract schema versions remain readable.

### Compatibility and release gates

- **MODE-021:** Existing Secrets & Configuration Readiness, Live UI Preview, token/context efficiency, Design Authority, execution safety, independent verification and deterministic acceptance remain operational.
- **MODE-022:** Ubuntu and Windows complete the full release validation suite with Development Modes tests included.
- **MODE-023:** Plugin canonical agents/commands and committed Antigravity mirror remain synchronized.
- **MODE-024:** Package dry-run contains the Development Modes runtime/schema/test-support assets required by consumers.
- **MODE-025:** Mode status is visible in `/dk-status` and invalid/absent state is explicit.

## Contract semantics

Development Contract schema v1.2 adds `developmentMode`. New contracts capture the current snapshot. Runtime validation recomputes the resolved policy and fingerprint from the stored selection, so a tampered snapshot fails closed.

Schema v1.0/v1.1 contracts remain supported for backward compatibility and do not retroactively gain invented methodology history.

## Mode-aware artifact behavior

The base artifact level is still computed from task scale/risk. Methodology is an overlay:

- Rapid and Balanced do not reduce the base.
- Specification-Driven raises behavioural work below Standard to Standard.
- Documentation-Driven raises behavioural Standard work to Comprehensive and small behavioural work to at least Standard.
- Maintenance & Evolution applies the inherited profile and adds repository audit/impact obligations.

## Exclusions

- Modes do not replace the future Adaptive Reliability/Lifecycle Compiler roadmap.
- Modes do not bypass stages, required reviewers, security controls, Design Authority, execution-safety approvals, configuration readiness or release gates.
- Modes do not rewrite historical contracts or evidence.
- No npm publication/version bump is implied by implementation on `main`; release remains a separate gated action.
