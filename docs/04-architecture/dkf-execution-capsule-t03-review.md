# DKF120-T03 — Execution Capsules & Context Cache Review

**Review status:** PASS  
**Date:** 7 October 2026  
**Increment:** DKF120-T03  
**Branch:** `feature/v0.12-execution-capsules-context-cache`  
**Reviewed implementation head:** `765a64a577238d73169fc9ae91bb8697a76ded6d`  
**Implementation validation run:** `37672806212`

## 1. Review gates

The T03 Development Contract is risk level 3.

Derived gates:

- specification verification;
- tests;
- code-reviewer;
- architecture-reviewer;
- security-reviewer;
- security control domain.

No human consequential-action approval was derived.

All required review perspectives are recorded below.

## 2. Code review

**Verdict: PASS**

The implementation adds:

- `runtime/orchestration/context-cache.mjs`;
- `runtime/orchestration/execution-capsule.mjs`;
- capsule-aware integration in `context-package.mjs`;
- public orchestration exports;
- Execution Capsule and context-cache schemas;
- focused acceptance tests.

The implementation remains within T03 scope.

No T04+ production capability was introduced.

### Code-review findings

#### REV-T03-001 — Synthetic configuration timestamp caused permanent cache misses

**Severity:** Major during implementation  
**Status:** Corrected

When no Configuration Readiness registry existed, `loadConfigurationRegistry()` returned an in-memory object containing a fresh `updatedAt` timestamp.

Fingerprinting that synthetic object made identical cache inputs look different on every call.

Correction:

- cache invalidation now fingerprints the persisted Configuration Readiness registry file only when it exists;
- absence is represented by stable `null`;
- persisted registry changes still invalidate the cache.

This converted repeated false misses into deterministic hits without weakening configuration invalidation.

#### REV-T03-002 — Cache entry semantic fingerprint originally included creation time

**Severity:** Major for determinism  
**Status:** Corrected before acceptance

`createdAt` was removed from semantic cache-entry fingerprinting.

The timestamp remains audit metadata, while identical semantic inputs now produce the same cache-entry and capsule identity across rebuilds.

#### REV-T03-003 — Changed files could have depended on caller relevance classification

**Severity:** Major reliability risk  
**Status:** Corrected

Present changed files are now automatically unioned into the relevant-file invalidation set.

A caller can no longer provide a changed-file delta while accidentally omitting the same present file from content-fingerprint invalidation.

#### REV-T03-004 — Low-level cache I/O needed an explicit storage boundary

**Severity:** Security hardening  
**Status:** Corrected

Cache load/write helpers now refuse paths outside:

```text
.development-kit/cache/context
```

Relevant/changed file reads are project-root checked, symbolic-link content reads are rejected, and target roots are realpath checked before scanning.

#### REV-T03-005 — Capsule creation needed to validate cache-entry integrity directly

**Severity:** Security/reliability hardening  
**Status:** Corrected

`createExecutionCapsule()` now validates the supplied cache entry before using it.

A forged or internally inconsistent cache entry cannot be converted into a valid capsule.

## 3. Architecture review

**Verdict: PASS**

### 3.1 Existing context authority preserved

T03 does **not** replace `buildContextPackage()`.

The flow is:

```text
Development Contract
        +
Workspace target binding
        +
Repository context cache
        +
Relevant file/test fingerprints
        +
Runtime/evidence references
        ↓
Execution Capsule
        ↓
buildContextPackage()
        ↓
fresh / independently rehydrated role context
```

Authoritative sources are still independently:

1. located;
2. whole-file fingerprint checked;
3. section materialised;
4. inserted into the role context.

The capsule does not carry authoritative source content.

### 3.2 Cache remains acceleration-only

The context cache is not canonical state.

Deletion results in a safe cache miss.

Corruption results in a safe cache miss and rebuild.

An old capsule whose referenced cache entry disappears becomes stale and cannot be used until a new capsule is built.

### 3.3 Target-aware invalidation

T03 builds on the T02 target model.

Cache inputs include:

- Development Contract source fingerprint;
- Development Mode fingerprint;
- workspace registry fingerprint where target-aware;
- persisted Configuration Readiness fingerprint where present;
- selected target structural fingerprints;
- relevant file fingerprints;
- relevant test fingerprints;
- optional future gate-profile revision.

Target structure facts contain path/structure information only.

Content changes outside the declared relevant file/test set do not invalidate structural facts unless repository structure itself changes.

### 3.4 Unrelated target isolation

A file/content/structure change in an unselected unrelated target does not invalidate a target-scoped cache or capsule when the Development Contract/workspace authority is otherwise unchanged.

This is the key scaling property required by the multi-target architecture.

### 3.5 Fresh-role isolation preserved

Implementation and verification contexts may receive the same deterministic capsule references, but:

- verifier roles are still independently rehydrated;
- implementation output remains non-authoritative;
- the capsule is freshness checked before context construction;
- authoritative source reads still happen independently.

## 4. Security review

**Verdict: PASS**

The review considered stale-context injection, path escape, cache tampering, symlink content access, cache poisoning, and authority escalation.

Controls confirmed:

- project-root path checks;
- context-cache-root write/read confinement;
- cache-entry content fingerprint validation;
- capsule semantic fingerprint validation;
- Development Contract identity/fingerprint binding;
- workspace registry binding;
- relevant file/test content fingerprints;
- automatic changed-file invalidation participation;
- corrupted cache fail-safe miss;
- missing cache stale-capsule rejection;
- non-authoritative runtime-fact marking;
- no copied secret values in cache invalidation;
- no cached summary becomes specification/business authority.

No unresolved critical/major security finding remains.

## 5. Security control-domain review

**Verdict: PASS**

The risk-3 security control domain is satisfied by deterministic rejection of untrusted/stale cache state before role context construction.

The security boundary is fail closed for:

- path escape;
- invalid cache-entry fingerprints;
- stale relevant files/tests;
- stale Development Contract authority;
- stale workspace registry;
- stale configuration registry;
- missing capsule cache entry;
- capsule/cache mismatch.

A cache miss affects performance only; it cannot grant authority or bypass verification.

## 6. Verification evidence

Focused T03 suite on the reviewed implementation head:

```text
tests: 19
pass:  19
fail:  0
```

GitHub Actions run `37672806212`:

- Ubuntu: PASS;
- Windows: PASS;
- focused T03 gate: PASS on both;
- exact `release:validate`: PASS on both.

## 7. Measured context-economy evidence

The focused two-target fixture recorded:

| Measure | Baseline | Capsule/cache | Reduction |
|---|---:|---:|---:|
| Logical context bytes | 9,591 | 7,053 | 26.46% |
| Estimated context tokens | 2,398 | 1,764 | 26.44% |
| Target-orientation scans | 2 | 1 | 50.00% |
| Cache hit | 0 | 1 | — |
| Cache miss | 0 | 0 | — |

These are T03 fixture results only.

They are **not** a claim that the release-wide v0.12 performance objectives have already been reached.

Release-wide targets remain owned by later comparative validation.

## 8. Scope check

T03 did not implement:

- State Engine V2;
- Lifecycle Instances;
- discovery/re-entry;
- Gate Profiles;
- Verification Extension SDK;
- Complexity Delta Guard;
- Control Center v0.12 integration.

## 9. Outstanding findings

Critical: **0**  
Major: **0**  
Unresolved minor: **0**

## 10. Review decision

**PASS**

DKF120-T03 is technically suitable for acceptance and progression to the next validated PLAN increment.
