# Development Kit v0.12.0 — Phase 4 / DKF120-T02 Validation

**Status:** COMPLETE — ACCEPTED FOR PROGRESSION  
**Date:** 7 October 2026  
**Increment:** DKF120-T02 — Workspace Target Engine  
**Implementation branch:** `feature/v0.12-workspace-target-engine`  
**Validated implementation head:** `94a10a77d38bdeba57ee398cb533b2d1409afc5c`  
**Validation PR:** #63  
**Implementation validation run:** `37668415974`

## 1. Development Contract

T02 was executed under:

```text
Contract: INC-DKF120-T02
Task:     DKF120-T02
Schema:   1.3.0
Risk:     2
Stale:    false
```

Observed source fingerprint:

```text
sha256:80af00ee728b98a0055e9971272d8fc3d6f436c32a6a040109f4e5ffde27bbf2
```

Bound acceptance criteria:

- `DKF-120-AC-004`
- `DKF-120-AC-005`
- `DKF-120-AC-006`
- `DKF-120-AC-007`
- `DKF-120-AC-039`

Derived gates:

```text
verification:
  specification
  tests

reviewers:
  code-reviewer

control domains:
  none

human approvals:
  none

configuration readiness:
  not required
```

T02's own contract has no target binding because it bootstraps the target engine itself. Target-aware contracts created after this increment can bind the workspace registry normally.

## 2. Implemented capability

T02 adds:

- project-local Workspace Target Registry;
- arbitrary project-defined target IDs;
- single-target and multi-target workspace support;
- generic repository-boundary discovery;
- direct target dependencies;
- reverse dependants;
- dependency closure;
- affected-target closure;
- verification-target closure;
- generic target commands;
- project-defined target capabilities;
- optional opaque adapter metadata;
- capability/configuration-driven target routing;
- primary/affected/verification Development Contract bindings;
- workspace-registry fingerprint binding;
- workspace-registry staleness enforcement;
- Development Contract schema v1.3.0.

Canonical workspace configuration:

```text
.development-kit/workspace.json
```

## 3. Acceptance-criterion evidence

### DKF-120-AC-004

**PASS.**

Arbitrary valid target IDs are accepted and new target IDs require no DKF core modifications.

### DKF-120-AC-005

**PASS.**

Target discovery recognises generic repository boundaries but does not assign application/domain meaning to them.

Single-root projects are supported without requiring monorepo structure.

### DKF-120-AC-006

**PASS.**

Development Contracts can bind:

- primary target;
- affected targets;
- verification targets;
- the exact registry fingerprint.

A registry change makes the target-aware contract stale.

### DKF-120-AC-007

**PASS.**

Target-specific commands resolve from target configuration.

There are no built-in mandatory target names.

### DKF-120-AC-039

**PASS.**

Routing uses declared capabilities, commands, optional preferred target IDs, and project-owned adapter metadata.

It does not dispatch on target kind, technology name, application name, or business domain.

## 4. Authority and staleness

A target-aware Development Contract stores the exact fingerprint of the workspace registry used to resolve its target binding.

If the registry later changes, normal contract staleness detects that drift.

Final hardening evidence proves registry drift reaches the existing deterministic acceptance engine and changes the decision to:

```text
BLOCKED
  reason: STALE_CONTRACT
```

No parallel acceptance authority was introduced.

## 5. Focused verification

Final focused suite on the validated implementation head:

```text
tests: 14
pass:  14
fail:  0
```

The suite covers:

- arbitrary IDs;
- generic discovery;
- single-root fallback;
- graph closures;
- unknown dependency rejection;
- cycle rejection;
- capability-driven routing;
- adapter pass-through;
- path escape rejection;
- registry persistence;
- optimistic fingerprint protection;
- target-bound Development Contracts;
- target registry staleness;
- stale target authority blocking acceptance;
- project registry routing;
- schema alignment.

The focused T02 gate passed on both Ubuntu and Windows.

## 6. Full regression result

GitHub Actions run `37668415974` passed on:

- Ubuntu;
- Windows.

The validated implementation head passed:

- skills and agents;
- plugin synchronization;
- installer integrity;
- Development Contract foundation;
- execution safety;
- evidence/control coverage;
- core orchestration;
- orchestration integration;
- v0.9 reliability regressions;
- documentation validation;
- OpenCode/platform adapters;
- research contract;
- v0.7.1 regressions;
- Live UI Preview;
- token/context efficiency;
- Phase 0/1 baseline;
- Phase 2 PLAN validation;
- T01 Cost Observatory;
- T02 Workspace Target Engine;
- Design Authority;
- Autopilot/evaluations;
- exact `release:validate`.

## 7. Correction history

The verification trail preserves:

1. stale hard-coded Development Contract schema version in the orchestration contract regression test;
2. missing documentation reference for the new contract-generator script;
3. stale hard-coded Development Contract schema version in Configuration Readiness integration testing;
4. explicit verification hardening proving target-registry drift blocks normal deterministic acceptance.

See:

`dkf-workspace-target-engine-t02-review.md`

## 8. General-purpose framework check

**PASS.**

The T02 runtime contains no application-specific business policy and no industry-specific target type.

Examples of repository markers are used only for boundary discovery. They do not determine target semantics or routing.

Target names, kinds, capabilities, commands, dependency relationships, and adapter metadata are supplied by the project.

The governing rule remains:

> **DKF core provides generic mechanisms. Projects and adapters provide domain-specific policy.**

## 9. Backward compatibility

**PASS.**

Existing projects are not required to define a workspace registry for legacy non-target-aware contracts.

Single-root projects remain first-class.

Existing supported Development Contract schema versions remain readable.

The current generated contract schema advances to **1.3.0** for optional Workspace Target bindings.

## 10. Acceptance decision

**DKF120-T02 — ACCEPTED FOR PROGRESSION**

This authorises progression to the next validated v0.12 PLAN increment only.

It does not:

- publish v0.12.0;
- bump the package version;
- merge to `main`;
- create a release/tag;
- authorise T04 or later work before T03 is completed and accepted.

## 11. Next increment

```text
DKF120-T03 — Execution Capsules & Context Cache
```

T03 must receive its own Development Contract before production implementation.

Because Workspace Target Engine is now available, T03 should use a target-aware Development Contract where its scope is target-specific.
