# Development Kit Project Memory

## Published Baseline

- **Current published release baseline:** v0.12.1 (October 2026).
- **Package version:** 0.12.1.
- **Core lifecycle:** `UNDERSTAND → DEFINE → DESIGN → PLAN → IMPLEMENT → VERIFY → REVIEW → SIMPLIFY → COMPLETE`.
- **Public command surface:** 16 workflow commands.
- **Engineering skills:** 48.
- **Primary position:** DKF is the reliability control plane for agentic software development — **AI can write it. DKF proves it.**

## v0.13.0 P0 — State Engine V2 T04 (30 October 2026)

- **W73-27 Windows ancestor alias journal-discovery hardening (30 October 2026):** diagnostic draft PR #108, test-first. Real Windows NTFS 8.3 short names were unavailable on the hosted runner (initial CI #41051765992 reported an explicit skip), so the test was extended to the alternate Windows extended-length namespace spelling of the *same verified physical parent*. Test-only CI #41052720876 reproduced a missing alias-journal rejection on Windows (the second restore reached unsafe-path preflight and failed with `EISDIR` instead of identifying the retained interrupted journal); Ubuntu passed. The corrected guard compares canonical physical parent/root identity using `fs.realpathSync.native`, including a missing target root after displacement, before allowing a new transaction. The diagnostic correction passed both complete Ubuntu and Windows v0.13 compatibility/regression jobs in [CI #41053285824](https://github.com/eybersjp/development-kit/actions/runs/41053285824). Only source and W73-27 regression test were ported to integration PR #92 in commits `f372d2ad52f1446f978be83fa19e50b3a999ba94` and `d78a98e7ac336bf1c5b2e22cd1ad2a9f211bec4a`; diagnostic CI workflow was **not** ported. **Limits:** extended-length alias behavior was exercised, not an actual NTFS 8.3 alias on this host; no physical sudden-power-loss durability is established, and this does not resolve Issue #73 or constitute independent risk-3 acceptance. Exact integration-head CI and independent source-bound reviews remain mandatory.

- **W73-25 native-helper path binding (30 October 2026):** Draft diagnostic PR #105 reproduced an unbound `Probe` path acknowledgement on exact test-only source in Ubuntu CI #41042850430 (RED, missing expected exception). The initial correction exposed genuine Windows 8.3 ancestor-alias and retained V1 journal-file rename compatibility failures in CI #41042984647 and #41043503806; these were corrected using live parent-directory identity for a renamed source and exact file/directory inode identity for published destinations. Final diagnostic commit `49c9abf0de43d50c2ca8748c2c173e51f0353275` passed the complete Ubuntu and Windows v0.13 validation lanes in CI #41044118361. Only the validated runtime and W73-25 regression test were ported to actual draft integration PR #92 as commits `6b89d9dba299b05c438480c647038590ba2d27e9` and `d32125cbcc7aa7b91119d80224eb575d948684d9`; diagnostic workflow exceptions were not ported. The helper now rejects successful responses for a different requested storage-profile, flush, source, destination or parent-flush path. This is API/path-binding evidence, **not physical NTFS power-loss proof**. Exact-head PR #92 CI, distinct independent role reviews and persisted deterministic risk-3 `ACCEPTED` remain outstanding. Issue #73 remains OPEN.

- **30 October exact-source verification checkpoint:** integration PR #92 head `1f2c909816287aeceb7aca1f2fd4e6dd9a68aadf` passed GitHub Actions CI #41030766378 on **both Ubuntu and Windows** (two platform jobs in one workflow execution; NOT two independent full runs). The diagnostic PR #99 head `51556f841bb07e9ed27436e9156bfff022487de1` passed both platform jobs in CI #41015133002; the diagnostic head is divergent and must not be merged as a substitute for PR #92. W73-21/23/24 NTFS ACL and helper-identity corrections are integrated on PR #92. Current acceptance blockers remain **controlled NTFS physical power-loss evidence under Issue #73, distinct authenticated exact-source code/architecture/security reviews, repeated complete platform validation on the final reviewed SHA, and persisted deterministic risk-3 ACCEPTED**. No acceptance, release or merge is asserted. Updating this file creates a new source commit and therefore requires fresh CI and review binding.

- **NTFS DACL private-stage hardening (30 October, W73-21/23/24):** diagnostic draft PR #104 reproduced missing ACL preservation and unverified native-helper responses on exact negative-control source (CI #41029403553). The v0.13 Windows helper now creates a maintenance-only protected stage at creation and retains its private root DACL throughout sensitive file copy; descendant original DACLs are restored post-order and whole-tree verified before the original root DACL is installed last. Native helper result checks bind operations to the actual directory identity (including verified NTFS 8.3 short-path aliases) and reject false/mismatched results. Focused real Windows NTFS W73-21/23/24 plus legacy restore fixtures passed with zero skips in CI #41029930153; Ubuntu full validation passed in CI #41029930369, with Windows full compatibility still pending at the time of this memory update. Ported only source/test files from diagnostic PR #104 into integration PR #92 through commit `11c2843bef8b8363fa39ff248ead38de705ebef0`; diagnostic workflow exceptions were NOT ported. **This is not NTFS physical power-loss proof or risk-3 ACCEPTED.** Issue #73 and three-role independent reviews remain blocking.

- **Actual integration candidate:** draft PR #92, branch `feature/v0.13-state-engine-v2`, based on released v0.12.1. Historical PR #70 and diagnostics #94–#99 are **not** release merge targets.
- **Test-first diagnostic:** PR #99 reproduced the Windows NTFS case-alias restore-journal bypass (W73-19, CI #41010567167) and orphan displaced-original bypass after journal loss (W73-20, CI #41015062706). Both failed as expected before their narrow corrections.
- **Validated candidate:** PR #99 commit `51556f841bb07e9ed27436e9156bfff022487de1`, CI #41015133002: Ubuntu and Windows v0.13 regression lanes PASS. Earlier W73-19-only candidate also passed both platforms in CI #41014994052. Hosted CI establishes API/test behavior, **not physical NTFS power-loss durability**.
- **Ported to PR #92:** commit `37d1d22d94d2fdf005c35bb1d807c059883fc50b` carries 11 verified source/test/documentation files, excluding PR #99's diagnostic-only workflow exception. Exact-head CI #41015777874 subsequently passed both Ubuntu and Windows v0.13 lanes.
- **Windows helper result contract W73-22 (test-first, 30 October):** draft diagnostic PR #102 at negative-control `ab10a41f8292d7bf0f4b1e572f709002c5b5984c` failed Ubuntu and Windows in CI #41021958044 because the helper-response verifier was absent; corrected diagnostic `7cb6ca4d04fc5dd651bc4050bb4c5128255ade11` passed both full v0.13 lanes in CI #41022103181. The source/test-only correction was ported to PR #92 in commits `4740afdfa7026dde02296dedaa73c4405111f794` and `8457a59be5e02412393515188d4601757abd0e9e`. Exit-zero native helper results now require affirmative operation-specific flush/rename flags and supported NTFS profile. PR #102 is diagnostic only; its CI workflow exception was not ported. Fresh exact-head PR #92 CI and independent review remain required. This is API result verification, **not** physical power-loss proof.
- **Safety boundary:** retain original directories, hash-chained restore journals, full Windows legacy-backup restoration, fail-closed publication and recovery, exact-source provenance and v0.12.1 compatibility.
- **Outstanding blockers:** Issue #73 Windows physical crash-durability evidence; independent P1 review findings on Windows DACL inheritance/preservation and recovery publication-barrier retry; Issues #71/#84 acceptance and distinct independent code, architecture and security approvals. No `ACCEPTED` verdict, merge or release is claimed.
- Older v0.11/v0.12 sections below preserve their historical engineering snapshots; their then-current release-status statements do not supersede the v0.12.1 baseline above.

## v0.11.2 Reliability Controls

- Development Contracts with authoritative-source fingerprints.
- Independent verification and deterministic `BLOCKED / PENDING / ACCEPTED` acceptance.
- Required-control/reviewer coverage, architecture-drift detection and source-staleness protection.
- Execution-safety and blast-radius controls with preserved human approval gates.
- Bounded correction and canonical artifact reconciliation.
- DKF Design Authority and `design.md` governance.
- DK Intelligence & Memory and DK Control Center.
- Numbered Decision Interface and structured suggestion promotion.
- **Secrets & Configuration Readiness Gate** (v0.11.0): fail-closed configuration handling, zero-credential AI-context exposure, Git tracking protection and release blocking for unresolved release-critical configuration.
- **Live UI Preview & Visual Verification** (v0.11.1): UI-context preview arming, declared dev-server start/reuse, provider-neutral browser opening, ownership-safe shutdown and VERIFY-stage browser evidence.
- **Token & Context Efficiency Hardening** (v0.11.1): section-aware source materialization, token profiles, compact role contexts and CI token budgets.

## Integrated Post-v0.11.1 Mainline Work

### Development Modes

Integrated through PR #53; Issue #50 is completed.

- Modes: Rapid, Balanced, Specification-Driven, Documentation-Driven and Maintenance & Evolution.
- Project mode state is revisioned, persisted and explicitly change-controlled.
- Mode policy affects specification/artifact/planning depth but cannot weaken mandatory DKF controls.
- New Development Contracts bind an immutable mode snapshot and fingerprint; later mode changes affect future contracts only.
- Historical pre-v0.11 PRs #42/#43 are archival evidence and must not be merged directly.
- Final PR #53 validation passed the full Ubuntu and Windows `npm run release:validate` matrix.

### IDEA Authority Hardening

Integrated through PR #54; Issue #51 is completed.

- Requirements carry explicit provenance: USER_STATED, USER_CONFIRMED, AI_PROPOSED, RESEARCH_DERIVED or ASSUMED.
- Authoritative requirement/question/scope/design/approval transitions require explicit Product Owner authority.
- IDEA presents one persisted numbered interaction at a time and requires its exact fingerprint for consumption.
- Discovery uses journal-first, hash-chained persistence with safe restart recovery and corruption fail-closed behavior.
- Interaction consumption uses hash-chained receipts to prevent replay.
- Design applicability/disposition is Product Owner-bound; caller-supplied mock authority state is not accepted.
- Canonical `docs/01-concept/idea-brief.md` approval is bound to exact artifact, discovery and design fingerprints.
- Direct edits, stale source changes, replay attempts and authority-chain corruption invalidate or block progression.
- Historical PR #35 is archival behavioral evidence and must not be merged directly.
- Final PR #54 validation passed the full Ubuntu and Windows `npm run release:validate` matrix, including the dedicated IDEA adversarial suite.

## Repository Reconciliation

- Historical draft PRs #12, #35, #42 and #43 are closed and preserved only as archival evidence.
- Production-readiness Issue #44 is closed as superseded by the v0.11.1 release.
- Development Modes Issue #50 and IDEA Authority Issue #51 are completed and closed.
- Canonical README, strategy, roadmap, release notes and changelog distinguish **published v0.11.1** from post-release functionality integrated on `main`.
- GitHub Actions are maintained on the current major versions identified by repository dependency automation to avoid deprecated action runtimes.
- Remote historical branches may remain until branch refs are explicitly deleted; their existence is not authority for current implementation state.

## Release Discipline

- Green automated tests alone do not authorize publication.
- Do not claim post-v0.11.1 mainline functionality is published until version, tag, GitHub Release and package publication gates are explicitly completed.
- After any release-impacting change, run the full release-validation/package-consumer gates on the final merge base and verify the published distribution.

## Scale, Context & Iteration — Phase 0/1 Baseline (7 October 2026)

- Phase 0/1 analysis is isolated on draft PR #59 / branch `analysis/scale-context-iteration-phase01`; no production runtime behaviour or package version has been changed.
- Live repository baseline is **v0.11.2** at main commit `62badbf7d0abee3344b1f5db2b2fbc876cf004e2`. The earlier `v0.11.0` proposal collides with released history; repository SemVer policy supports **v0.12.0** as the recommended feature-release target.
- Existing Token & Context Efficiency Hardening must be extended, not rebuilt. Current section-aware source delivery achieved 81.89% / 94.59% / 92.53% source-token reduction in representative single-package / multi-package / calculation-heavy fixtures.
- Current state persistence still creates immutable per-transition micro-files. A 26-revision Autopilot fixture produced 26 revision files + 1 pointer file (17,537 bytes), before counting per-run orchestration revisions and other DKF state.
- Current gate selection is risk/security/design aware but has no first-class engineering/numerical domain profile. The calculation-heavy fixture still resolved only specification + tests + code review.
- Current runtime does not centrally measure provider tokens, repository file reads, repository orientation scans, host agent invocations, or host tool calls. These remain unavailable rather than estimated.
- Cross-platform token-audit output differs because the chars/4 estimator counts checkout line endings; future Cost Observatory comparisons should normalize line endings while preserving historical regression compatibility.
- Phase 0/1 baseline CI passed the full Ubuntu + Windows matrix in GitHub Actions run `37618731275`.
- Canonical evidence: `docs/04-architecture/dkf-scale-context-iteration-phase01-baseline.md`.
- Next lifecycle action: reconcile the approved Scale, Context & Iteration specification with the measured baseline, then enter DEFINE/DESIGN/PLAN. Do not begin production implementation before the validated PLAN.

## Scale, Context & Iteration — Phase 2 (7 October 2026)

- Phase 2 is complete on draft PR #59 / branch `analysis/scale-context-iteration-phase01`; no production runtime implementation or package-version change has been made.
- Reconciled target release: **Development Kit v0.12.0 — Scale, Context & Iteration**.
- General-purpose architecture is locked: DKF core provides generic mechanisms; project-specific/domain rules live in project configuration, adapters, fixtures, or verification extensions. No app- or industry-specific business logic belongs in DKF core.
- Canonical terminology: **Verification Extension SDK** replaces the provisional “Domain Verification SDK”.
- Workspace targets use arbitrary project-defined IDs; examples such as web/mobile/database/calculations are non-authoritative examples only. Routing is capability/configuration driven.
- Phase 2 artifacts:
  - `docs/04-architecture/dkf-scale-context-iteration-v0.12-specification.md`
  - `docs/04-architecture/dkf-scale-context-iteration-v0.12-technical-design.md`
  - `docs/04-architecture/dkf-scale-context-iteration-v0.12-implementation-plan.md`
  - `docs/04-architecture/dkf-scale-context-iteration-v0.12-plan-model.json`
  - `docs/04-architecture/dkf-scale-context-iteration-phase02-validation.md`
- Deterministic PLAN result: `valid: true`, 10 tasks, 9 declared dependency edges, all required logical resources owned exactly once, all `DKF-120-AC-001` through `DKF-120-AC-040` criteria covered, `issues: []`.
- PLAN validation passed on Ubuntu and Windows in GitHub Actions run `37659800053`, together with the existing release-validation matrix.
- Approved execution order:
  `T01 Cost Observatory -> T02 Workspace Target Engine -> T03 Execution Capsules & Context Cache -> T04 State Engine V2 -> T05 Lifecycle Instances -> T06 Discovery & Controlled Re-entry -> T07 Generic Gate Profiles -> T08 Verification Extension SDK -> T09 Complexity Delta Guard -> T10 Control Center + Comparative Release Validation`.
- Next lifecycle action: create the Development Contract for **DKF120-T01 — Cost Observatory** from the Phase 0/1 baseline, v0.12 specification, technical design, and validated PLAN. Production implementation starts only under that contract.

## Scale, Context & Iteration — Phase 3 / T01 (7 October 2026)

- **DKF120-T01 — Cost Observatory is accepted for progression** on branch `feature/v0.12-cost-observatory`.
- Development Contract: `INC-DKF120-T01`, schema 1.2.0, final observed source fingerprint `sha256:5a89b0c0dd841d09cfcbf465ffc36c4c0e768574282c4c94aa389d713231f661`, risk 2, stale=false.
- T01 criteria: `DKF-120-AC-001`, `002`, `003`, `033`.
- Final derived gates: specification + tests; code-reviewer; no specialist control domain; no human approval; no configuration-readiness dependency.
- Implemented generic runtime: `runtime/orchestration/cost-observatory.mjs` + `schemas/cost-record.schema.json`.
- Cost records use newline-normalised logical context measurement, optional provider token observations, null for unavailable host/provider metrics, explicit DKF-controlled counters, elapsed time, append-only `.development-kit/telemetry/cost-records.jsonl`, and baseline/current comparison.
- No application-specific or industry-specific logic is present. T01 remains host/provider independent.
- Focused Cost Observatory suite: 9/9 PASS on Ubuntu; T01 gate PASS on Windows.
- Final full CI for validated T01 head `3b6164dc67a6ceb98ca43e971c2b4636a6c95aa3`: GitHub Actions run `37665136625`, Ubuntu PASS + Windows PASS, including exact `release:validate`.
- Correction history is preserved:
  - `REV-T01-001`: volatile acceptance timestamp test assertion corrected.
  - `REV-T01-002`: no-credentials architectural boundary moved out of `securityConstraints` so derived gates match the approved PLAN; no actual security gate was bypassed.
- Canonical evidence:
  - `docs/04-architecture/dkf-cost-observatory-t01-review.md`
  - `docs/04-architecture/dkf-scale-context-iteration-phase03-t01-validation.md`
- v0.12.0 is still unreleased; package version remains 0.11.2 and no merge/publish/release is authorised by T01 acceptance.
- Next validated increment: **DKF120-T02 — Workspace Target Engine**. Create a new Development Contract before implementation.

## Scale, Context & Iteration — Phase 4 / T02 (7 October 2026)

- **DKF120-T02 — Workspace Target Engine is accepted for progression** on branch `feature/v0.12-workspace-target-engine`.
- T02 Development Contract: `INC-DKF120-T02`, schema 1.3.0, observed source fingerprint `sha256:80af00ee728b98a0055e9971272d8fc3d6f436c32a6a040109f4e5ffde27bbf2`, risk 2, stale=false.
- T02 acceptance criteria: `DKF-120-AC-004`, `005`, `006`, `007`, `039`.
- Final derived gates: specification + tests; code-reviewer; no specialist control domain; no human approval; no configuration-readiness dependency.
- T02 bootstrap rule: the T02 contract itself is intentionally unbound to workspace targets because it creates the Workspace Target Engine. Target-aware contracts after T02 may bind targets normally.
- New canonical project-local registry: `.development-kit/workspace.json`, Workspace Target Registry schema v1.
- Workspace targets are fully project-defined: arbitrary safe IDs, relative paths, descriptive kind, dependencies, commands, capabilities, verification commands, and opaque adapter metadata.
- DKF core routing is capability/configuration-driven. Target names and `kind` are never dispatch policy.
- Engine provides direct dependencies, reverse dependants, dependency closure, affected closure, verification closure, command resolution, generic repository-boundary discovery, and single-root fallback.
- Invalid paths, unknown target dependencies, and dependency cycles fail closed.
- Development Contract schema advances to **1.3.0** with optional `workspaceTargets` binding: registry path/fingerprint + primary/affected/verification targets. Existing supported schema versions remain readable.
- Workspace-registry fingerprint participates in normal contract staleness. Final integration proof confirms registry drift converts a previously `ACCEPTED` target-aware contract to `BLOCKED` through the existing `STALE_CONTRACT` path.
- Focused Workspace Target Engine suite on implementation head `94a10a77d38bdeba57ee398cb533b2d1409afc5c`: 14/14 PASS.
- Full implementation CI: GitHub Actions run `37668415974`, Ubuntu PASS + Windows PASS, including the T02 gate and exact `release:validate`.
- Correction history preserved:
  - `REV-T02-001`: orchestration regression test stopped pinning obsolete Development Contract schema 1.2.0.
  - `REV-T02-002`: required reference documentation was added for the T02 contract-generator script.
  - `REV-T02-003`: Configuration Readiness integration test stopped pinning obsolete schema 1.2.0.
  - `REV-T02-004`: acceptance-path hardening added to prove workspace-registry drift blocks deterministic acceptance.
- Canonical T02 evidence:
  - `docs/04-architecture/dkf-workspace-target-engine-t02-review.md`
  - `docs/04-architecture/dkf-scale-context-iteration-phase04-t02-validation.md`
- DKF remains general-purpose: no application-specific or industry-specific target semantics entered core.
- v0.12.0 is still unreleased; package version remains 0.11.2; no merge, tag, publish, or release is authorised by T02 acceptance.
- Next validated increment: **DKF120-T03 — Execution Capsules & Context Cache**. T03 must receive its own Development Contract before implementation and should use target binding where applicable.

## Scale, Context & Iteration — Phase 5 / T03 (7 October 2026)

- **DKF120-T03 — Execution Capsules & Context Cache is accepted for progression** on branch `feature/v0.12-execution-capsules-context-cache`.
- T03 Development Contract: `INC-DKF120-T03`, schema 1.3.0, risk 3, stale=false.
- Observed T03 source fingerprint: `sha256:db93ea4d721808aa351bfedffb17d5b65ad6defca34b8322089a18d742602baf`.
- T03 is target-aware and binds `dkf-framework` as primary/affected/verification target against workspace registry fingerprint `sha256:b5c3d286ab2b1b65c68e9ac17fbb6f45698986449ffb2129fa4666eff60f9c3e`.
- T03 acceptance criteria: `DKF-120-AC-008`, `009`, `010`, `011`, `035`.
- Risk-3 derived gates: specification + tests; architecture-reviewer; code-reviewer; security-reviewer; security control domain; no human consequential-action approval.
- New runtime primitives:
  - `runtime/orchestration/context-cache.mjs`
  - `runtime/orchestration/execution-capsule.mjs`
  - Execution Capsule schema v1
  - Context Cache Entry schema v1.
- Canonical cache acceleration area: `.development-kit/cache/context/`. It is disposable, rebuildable acceleration state and is never canonical project/business/specification authority.
- Execution Capsules are deterministic reference manifests. They carry contract/task/run/lifecycle references; authoritative source paths/selectors/fingerprints without copied source content; target binding; context-cache fingerprints; compact target facts; relevant file/test fingerprints; target/dependency delta; upstream accepted-task references; verified runtime facts with provenance; and future gate/profile references.
- Runtime facts in capsules are explicitly `non-authoritative-observation`.
- `buildContextPackage()` remains the authoritative role-context constructor. With a fresh capsule it still independently re-reads authoritative sources, checks whole-file fingerprints, and uses existing section-aware materialisation; repository reorientation may come from the validated capsule.
- Capsule-aware isolation metadata distinguishes `authoritativeSourcesReRead=true`, `repositoryReRead=false`, `repositoryContextFromCapsule=true`, and `capsuleFreshnessVerified=true`.
- Deterministic invalidation covers Development Contract/source drift, workspace authority drift, selected-target structural changes, relevant file/test content, persisted Configuration Readiness registry state, missing/changed/corrupt cache entries, and future gate-profile revision input.
- Present changed files are automatically added to the relevant-file fingerprint set so a caller cannot accidentally omit changed content from invalidation.
- Changes in an unrelated unselected target do not invalidate an unrelated target-scoped capsule when contract/workspace authority remains unchanged.
- Cache deletion/corruption causes a safe miss/rebuild; an old capsule referencing missing/stale cache state is rejected rather than trusted.
- Security hardening confines low-level cache reads/writes to `.development-kit/cache/context/`, rejects relevant/changed-file symlink reads, realpath-checks project boundaries, validates cache-entry integrity before capsule creation, and fails closed on stale/tampered cache state.
- T03 correction history:
  - `REV-T03-001`: absent Configuration Readiness state originally included a synthetic changing timestamp and caused perpetual false cache misses; fixed by fingerprinting only the persisted registry file when present, absence = stable null.
  - `REV-T03-002`: cache semantic identity originally included `createdAt`; timestamp removed from semantic fingerprint while retained as audit metadata.
  - `REV-T03-003`: present changed files are now automatically unioned into relevant invalidation inputs.
  - `REV-T03-004`: cache I/O and repository-path security boundaries hardened.
  - `REV-T03-005`: capsule creation now validates supplied cache-entry integrity directly.
- Focused T03 suite on reviewed implementation head `765a64a577238d73169fc9ae91bb8697a76ded6d`: **19/19 PASS**.
- Implementation CI: GitHub Actions run `37672806212`, Ubuntu PASS + Windows PASS, focused T03 gate PASS on both, exact `release:validate` PASS on both.
- T03 focused two-target Cost Observatory evidence:
  - logical context bytes: 9,591 -> 7,053 (**26.46% reduction**);
  - estimated context tokens: 2,398 -> 1,764 (**26.44% reduction**);
  - target-orientation scans: 2 -> 1 (**50.00% reduction**);
  - current comparison used cache hit=1, miss=0.
- These are focused T03 fixture measurements only. They do **not** claim the final v0.12 release objectives (>=40% repeated context reduction, >=60% redundant repository-read reduction, >=70% repeated full orientation reduction) are achieved; release-wide validation remains later work.
- Canonical T03 evidence:
  - `docs/04-architecture/dkf-execution-capsule-t03-review.md`
  - `docs/04-architecture/dkf-scale-context-iteration-phase05-t03-validation.md`
- Architecture/code/security/security-control review verdicts: PASS; unresolved Critical 0, Major 0, Minor 0.
- DKF remains general-purpose and provider/host/domain neutral. No application-specific cache or capsule semantics entered core.
- v0.12.0 remains unreleased; package version remains 0.11.2; T03 acceptance does not merge to `main`, tag, publish, or release.
- Next validated increment: **DKF120-T04 — State Engine V2**. T04 requires its own Development Contract before production implementation.
