# Release Notes: Development Kit v0.9.0

> **Release Date:** 2026-08-24  
> **Release Target:** Antigravity AI, OpenCode, and supported multi-platform coding environments  
> **Target Package:** `development-kit@0.9.0`  
> **Status:** Release candidate until the controlled release workflow completes

---

## Executive Summary

Development Kit `v0.9.0` introduces the **Reliability Control Plane**, a contract-driven orchestration layer that turns verification, safety, amendment handling, and acceptance from agent narrative into deterministic runtime policy.

The release was driven by a real Proposal Builder development session that exposed task-count drift, stale artifact amendments, incomplete security verification, unsafe host-level command scope, version/installer drift, and overly trusting completion claims. Those failures are now preserved as executable regression fixtures.

---

## Key Highlights

1. **Development Contracts**
   - Approved tasks become persisted contracts before execution.
   - Contracts bind objective, scope, authoritative sources, acceptance criteria, architecture/design/security constraints, risk, execution safety, required verification/review, correction policy, approval policy, and source fingerprints.
   - Source changes invalidate stale contracts rather than allowing silent continuation.

2. **Independent Verification and No Self-Certification**
   - Verifier/reviewer context is fresh or independently rehydrated from authoritative project sources.
   - Implementation reports are explicitly non-authoritative.
   - Implementation roles cannot produce authoritative verification records.
   - PASS evidence is validated and immutable/idempotent when persisted.

3. **Deterministic Acceptance**
   - Acceptance state is computed as `ACCEPTED`, `PENDING`, or `BLOCKED`.
   - Required gates are derived from task risk and contract constraints, not only from caller-supplied reviewer arrays.
   - Security-sensitive/high-risk work automatically requires the appropriate security controls and reviewers.
   - Architecture-sensitive/high-risk work requires architecture review/drift evidence.
   - Agent prose cannot directly set final acceptance.

4. **Bounded Correction**
   - Automatic correction is constrained to the Development Contract scope.
   - Retry counts are bounded.
   - Repeated failure signatures stop endless correction loops.
   - High-risk or non-correctable failures route to review instead of blind retries.

5. **Execution Safety and Blast-Radius Control**
   - Commands are classified for project scope, destructive behavior, remote mutation, and host-wide impact.
   - Project-local tasks cannot silently perform host-wide cleanup.
   - The Proposal Builder incident command `docker rm -f $(docker ps -aq)` is now a regression test and is blocked by default.
   - Destructive and remote operations require the exact contract policy and approvals.

6. **Evidence and Control Coverage**
   - Security and other control domains use expected-control manifests instead of raw test-count claims.
   - `17` passing checks against `23` required security controls evaluates to `73.91%` and `INCOMPLETE`, not PASS.
   - Missing service-role, function-owner, schema, RBAC, migration, and environment controls remain visible and blocking/pending until verified.

7. **Deterministic PLAN Validation**
   - Task count is computed from the actual plan structure.
   - Dependencies are validated and checked for cycles.
   - Resource ownership detects missing and duplicate ownership.
   - Acceptance-criterion coverage is computed rather than inferred from prose.
   - The original `20 tasks` vs `22 actual tasks` Proposal Builder failure is retained as a regression.

8. **Canonical Artifact Reconciliation**
   - Amendments require the caller's expected pre-edit fingerprint.
   - Replacement anchors must match the declared count.
   - Files are written atomically and read back for exact verification.
   - Stale amendment replay is rejected.

9. **Architecture Drift and Structured Reviews**
   - Reviewer findings are structured data with severity, evidence, status, and accepted-risk provenance.
   - Major/critical findings require evidence.
   - Unauthorized dependency or architecture changes block acceptance until explicitly resolved.

10. **Host Capability Abstraction**
    - Hosts with sub-agent support can use native isolation.
    - Hosts without sub-agents degrade to sequential fresh/rehydrated contexts.
    - Mandatory verification is never silently skipped because a host lacks a capability.

11. **Design Authority Integration**
    - UI/design-governed contracts bind authoritative `design.md` state.
    - Visual verification capability gaps require manual evidence instead of bypassing the design gate.

12. **Autopilot and Public Command Integration**
    - `/dk-build`, `/dk-build-auto`, `/dk-test`, `/dk-review`, `/dk-tasks`, `/dk-status`, and `/dk-autopilot` are bound to the reliability runtime.
    - Contract-aware VERIFY, REVIEW, and COMPLETE stages cannot advance when runtime evidence/acceptance remains unresolved.
    - Legacy projects remain backward compatible until a Development Contract exists.

13. **Installer and Version Integrity**
    - Standalone/project installation tests verify runtime and schema assets are present without repository fallbacks.
    - Stale owned files are removed during upgrade while guarded user files such as `AGENTS.md` remain preserved.
    - `package.json`, the committed plugin manifest, and Autopilot `frameworkVersion` are now release-aligned and regression-tested.

---

## Proposal Builder Regression Fixture

The v0.9 release gate explicitly tests the field failures that triggered this reliability work:

- declared task count differs from actual task count;
- dependency diagram/data mismatch;
- missing and duplicate resource ownership;
- uncovered acceptance criteria;
- incomplete required security control coverage despite passing executed tests;
- unsafe host-wide Docker cleanup from project-local work;
- implementation-agent self-certification;
- authoritative-source staleness;
- stale canonical amendment replay;
- incomplete installed runtime/schema assets;
- package/plugin/Autopilot version drift;
- sparse caller reviewer arrays that would otherwise omit risk-derived security or architecture gates.

---

## New Release Validation Gates

`npm run release:validate` now includes:

- `orchestration:validate`
- `execution-safety:validate`
- `evidence:validate`
- `orchestration-core:validate`
- `orchestration-integration:validate`
- `v09-reliability:validate`

The v0.9 reliability gate includes the Proposal Builder regression fixture, fail-closed derived-gate tests, mandatory amendment fingerprint tests, and version-consistency validation.

---

## Upgrade

After publication:

```bash
npm view development-kit version
npx development-kit@0.9.0 --global
```

For a project-local installation:

```bash
npx development-kit@0.9.0 init --project
```

Run `/dk-status` or `npm run doctor` as appropriate to verify installation state.

---

## Release Gate

This document does not itself authorize publication. `v0.9.0` is released only after:

1. the exact release-candidate commit passes full `npm run release:validate` in CI;
2. the cumulative pull request is independently reviewed and merged to `main`;
3. `main` CI is green on the merge commit;
4. the maintainer release issue `Release v0.9.0` with body `/release v0.9.0` completes successfully;
5. the annotated tag, GitHub Release, and npm publication state are independently verified.
