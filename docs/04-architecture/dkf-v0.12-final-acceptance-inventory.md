# DKF v0.12.0 — Release Acceptance Inventory

**Status: NOT ACCEPTED / no publication authorization derived from this document.**

**Authority:** User-approved release rescope in Issue #82 and required release-closure work in Issue #85. The five deferred T04-dependent criteria AC-012–AC-015 and AC-034 remain **DEFERRED**, not PASS; top priority v0.13.0 Issue #84.

**Source:** `release/v0.12-no-state-engine`. Bind the final complete source SHA, Windows/Ubuntu GitHub Actions ID and source-bound independent reviewers **after** final freeze; historical reviewer reports for different source hashes are not sufficient.

Each row reflects the **exact canonical criterion** from `dkf-scale-context-iteration-v0.12-specification.md`. A test path is inspectable implementation evidence, **not an independent ACCEPTED verdict**.

| Criterion | Canonical requirement | Evidence or method | State |
|---|---|---|---|
| DKF-120-AC-001 | Every instrumented orchestration operation can emit a cost record containing only measured or deterministic-estimate fields. | cost-observatory.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-002 | Provider token fields remain null/unavailable unless supplied by the host/provider. | cost-observatory.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-003 | New cross-platform logical text/context comparisons normalise newline representation while preserving historical audit compatibility. | cost-observatory.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-004 | A project can register arbitrary target IDs without changing DKF core. | workspace-targets.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-005 | Target discovery/configuration does not assume a specific application domain or fixed repository topology. | workspace-targets.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-006 | Tasks/contracts can bind primary, affected, and verification targets. | workspace-targets.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-007 | Target-specific commands/capabilities resolve without hard-coded target names. | workspace-targets.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-008 | Fresh implementation/review contexts can receive deterministic Execution Capsules. | execution-capsule.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-009 | Capsule fingerprints invalidate stale capsules when relevant authority/repository state changes. | execution-capsule.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-010 | Repository/context caching has deterministic invalidation. | context-cache.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-011 | Existing section-aware source materialisation and source-fingerprint protections remain green. | token-efficiency.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-016 | Lifecycle Instances support optional parent/child relationships. | lifecycle-instances.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-017 | `COMPLETE` applies only to the active Lifecycle Instance. | lifecycle-instances.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-018 | Domain/application state cannot implicitly change DKF lifecycle acceptance/completion state. | lifecycle-instances.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-019 | Discovery events persist evidence and affected-authority references. | discovery-reentry.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-020 | The runtime computes the minimum safe re-entry stage from affected authority. | discovery-reentry.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-021 | Selective invalidation preserves unrelated accepted work. | discovery-reentry.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-022 | Gate profiles resolve generically from contract/risk/target capabilities/project configuration. | gate-profiles.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-023 | Profiles cannot downgrade existing mandatory verification, control, or human-approval gates. | gate-profiles.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-024 | Project-owned verification extensions can be added without modifying DKF core. | verification-extension-sdk.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-025 | Generic numeric checks support absolute and relative tolerances. | verification-extension-sdk.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-026 | Project-supplied invariants/custom validators can block acceptance through normal evidence/gate semantics. | verification-extension-sdk.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-027 | Reference/golden dataset fingerprints participate in evidence freshness. | verification-extension-sdk.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-028 | Complexity Delta is deterministic from repository/diff facts used by the implementation. | complexity-delta.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-029 | Complexity policy may trigger, but may not remove, the full simplicity review where existing policy requires it. | complexity-delta.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-030 | Control Center exposes the new state without becoming canonical authority. | control-center-v012.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-031 | Existing supported public commands remain compatible. | antigravity-command-discovery.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-032 | Existing control-plane and release-validation regression suites remain green. | release:validate | Provisional — final exact-source independent review required |
| DKF-120-AC-033 | Release evidence includes baseline-versus-v0.12 cost comparison. | dkf-v0.12-release-comparative-evidence.md | Provisional — final exact-source independent review required |
| DKF-120-AC-035 | Comparative evidence reports measured context/orientation improvement where observable. | dkf-v0.12-release-comparative-evidence.md | Provisional — final exact-source independent review required |
| DKF-120-AC-036 | No new false-`ACCEPTED` regression scenario is introduced. | gate-profiles.test.mjs and verification-extension-sdk.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-037 | DKF core contains no application-specific domain verification rules. | verification-extension-sdk.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-038 | At least two materially different example verification extensions can use the same SDK without core changes. | verification-extension-sdk.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-039 | Core routing is capability/configuration-driven rather than technology-name driven. | workspace-targets.test.mjs | Provisional — final exact-source independent review required |
| DKF-120-AC-040 | Release documentation includes migration, compatibility, measurement results, and known limitations. | dkf-v0.12-release-scope-amendment.md and CHANGELOG.md | Provisional — final exact-source independent review required |

## Release decision

**NO_GO until** all six Codex findings are independently verified as corrected, all applicable criteria have genuine source-bound evidence, required roles sign off, comparative results are accurately recorded, complete Windows/Ubuntu validation passes on the immutable final source, release package passes consumer verification, and all required human/release gates are satisfied.

The matched v0.11.2 vs v0.12 source comparison is in `dkf-v0.12-release-comparative-evidence.md`. Static instruction estimate was 2,820 priority tokens and 7,587 implementation hot-path tokens in both versions (**0% observed change**); provider billing and host repository-read reduction remain unavailable. Do not claim financial/token savings that were not measured.

## Explicit next release

T04 State Engine V2, original Windows legacy-backup restore and crash durability requirements (Issue #73), independent risk-3 review, plus the five deferred criteria: all remain P0 v0.13.0, not smuggled into v0.12.
