# DKF120-T02 — Workspace Target Engine Review

**Review status:** PASS  
**Date:** 7 October 2026  
**Branch:** `feature/v0.12-workspace-target-engine`  
**Reviewed implementation head:** `94a10a77d38bdeba57ee398cb533b2d1409afc5c`  
**Validation run:** GitHub Actions `37668415974`

## 1. Scope reviewed

Production/runtime changes:

- `runtime/orchestration/workspace-targets.mjs`
- `runtime/orchestration/development-contract.mjs`
- `runtime/orchestration/index.mjs`
- `schemas/workspace-target-registry.schema.json`
- `schemas/development-contract.schema.json`
- `.development-kit/workspace.json`

Contract/test/integration changes:

- `scripts/phase04-workspace-target-engine-contract.mjs`
- `scripts/workspace-targets.test.mjs`
- `scripts/orchestration-contract.test.mjs`
- `scripts/configuration-readiness-integration.test.mjs`
- `package.json`
- `.github/workflows/ci.yml`
- script reference documentation and documentation index.

## 2. Contract boundary

The implementation remains inside **DKF120-T02**.

It does not implement:

- Execution Capsules or context caching;
- State Engine V2;
- Lifecycle Instances;
- discovery/re-entry;
- Gate Profiles;
- Verification Extension SDK;
- Complexity Delta Guard;
- Control Center v0.12 integration.

No application-specific or industry-specific routing semantics were introduced.

## 3. General-purpose architecture review

### 3.1 Arbitrary target IDs

PASS.

Target IDs are project-defined and validated only for safe persisted identifier/path syntax.

Tests use deliberately unrelated examples such as:

```text
@alpha
service:beta
shared/common
custom/project-unit
```

No DKF core change is required to add a new valid target ID.

### 3.2 Target kind

PASS.

`kind` is descriptive metadata only.

Routing does not branch on `kind`, application type, framework name, language, infrastructure technology, or business domain.

### 3.3 Capability/configuration-driven routing

PASS.

Target selection uses:

- declared capability;
- declared command;
- optional preferred target IDs;
- project-owned adapter metadata.

The router does not infer behaviour from target IDs or descriptive kinds.

### 3.4 Adapter boundary

PASS.

Adapter metadata is opaque to the Workspace Target Engine and remains project-owned.

The engine may return adapter metadata with a resolved route, but it does not assign domain semantics to it.

## 4. Workspace registry

Canonical project-local registry:

```text
.development-kit/workspace.json
```

Registry schema:

```text
Workspace Target Registry schema v1
```

Supported generic target properties:

- path;
- optional descriptive kind;
- dependencies;
- commands;
- capabilities;
- verification command references;
- optional adapter metadata.

The DKF repository itself is represented through one project-defined target, `dkf-framework`. That identifier is project configuration, not a reserved DKF core target name.

## 5. Single-target and multi-target behaviour

PASS.

A project may explicitly configure one target or many targets.

Generic discovery recognises repository boundary markers but emits only neutral `discovered-boundary` records. It does not infer business role or routing policy from those markers.

If no recognised marker is found, discovery produces one generic root target.

Monorepo use is therefore optional.

## 6. Target graph

PASS.

The engine provides:

- direct dependencies;
- reverse dependants;
- dependency closure;
- affected-target closure;
- verification-target closure.

Unknown dependencies, self-dependencies, and dependency cycles fail closed.

Target paths are project-relative and path escape is rejected.

## 7. Development Contract integration

PASS.

The current Development Contract schema advances to **1.3.0** and remains compatible with readable older supported schemas.

A target-aware contract may persist:

```json
{
  "registryPath": ".development-kit/workspace.json",
  "registryFingerprint": "sha256:...",
  "primary": "project-defined-target",
  "affected": ["project-defined-target"],
  "verification": ["project-defined-target"]
}
```

The registry fingerprint is separate from authoritative-source fingerprints but participates in normal Development Contract staleness evaluation.

This prevents target paths, dependency relationships, commands, capabilities, or adapter configuration from changing silently after target-aware contract approval.

## 8. Acceptance integration

PASS.

No second acceptance mechanism was created.

Workspace-registry drift flows through the existing:

```text
checkContractStaleness()
  -> acceptance-engine
  -> STALE_CONTRACT
  -> BLOCKED
```

The final focused suite proves a previously acceptable target-aware contract becomes `BLOCKED` after the bound workspace registry changes.

## 9. T02 bootstrap contract

PASS with documented bootstrap exception.

The Development Contract for T02 itself has no target binding because T02 is the increment that creates the Workspace Target Engine.

Its final observed runtime contract is:

- Contract ID: `INC-DKF120-T02`
- Contract schema: `1.3.0`
- Source fingerprint: `sha256:80af00ee728b98a0055e9971272d8fc3d6f436c32a6a040109f4e5ffde27bbf2`
- Risk: 2
- Stale: false
- Target binding: null

This exception does not apply to later target-aware work after T02 is available.

## 10. Review findings and corrections

### REV-T02-001 — Legacy orchestration test pinned the previous contract schema

**Classification:** compatibility test maintenance  
**Status:** Corrected

The first CI run failed because `orchestration-contract.test.mjs` asserted literal schema version `1.2.0`.

The production contract correctly emitted `1.3.0`.

Correction:

- the regression test now imports `DEVELOPMENT_CONTRACT_SCHEMA_VERSION`;
- it therefore verifies the current canonical contract version rather than a stale literal.

Correction commit:

`10e2f6bd6a58deda5e91e7daf43ee328935a9250`

### REV-T02-002 — New executable script lacked its required documentation reference

**Classification:** documentation-integrity defect  
**Status:** Corrected

The DKF documentation validator correctly rejected the new T02 contract-generator script because no corresponding reference page existed.

Correction:

- added `docs/03-reference/scripts/phase04-workspace-target-engine-contract.md`;
- indexed it in `docs/SUMMARY.md`.

Final documentation correction head:

`74a0f56f3c7c0f54bfb2fa2cb4f8973178225b2a`

### REV-T02-003 — Configuration Readiness integration test pinned schema 1.2.0

**Classification:** compatibility test maintenance  
**Status:** Corrected

The focused T02 gate passed, but exact `release:validate` found a second historical test that asserted literal contract schema `1.2.0`.

Correction:

- `configuration-readiness-integration.test.mjs` now uses the exported canonical schema version.

Correction commit:

`a472a7ab0559bbc5b39c425138cb1f121c8f9b8b`

### REV-T02-004 — Explicit acceptance-blocking proof added

**Classification:** verification hardening  
**Status:** Completed

Code review identified that staleness detection should be proven through the final acceptance path, not only through `checkContractStaleness()`.

A focused integration test was added proving:

1. valid target-aware contract + PASS verification + PASS code review -> `ACCEPTED`;
2. bound registry changes;
3. same evidence is reevaluated;
4. acceptance becomes `BLOCKED` with `STALE_CONTRACT`.

Hardening commit:

`94a10a77d38bdeba57ee398cb533b2d1409afc5c`

## 11. Final verification

Focused Workspace Target Engine suite:

```text
tests: 14
pass:  14
fail:  0
```

GitHub Actions run `37668415974`:

- Ubuntu: PASS;
- Windows: PASS;
- T02 focused gate: PASS on both;
- exact `release:validate`: PASS on both.

## 12. Outstanding findings

Critical: **0**  
Major: **0**  
Unresolved minor: **0**

## 13. Review verdict

**PASS**

The Workspace Target Engine is generic, configuration-driven, contract-aware, fail-closed on target-authority drift, and compatible with the existing DKF acceptance model.
