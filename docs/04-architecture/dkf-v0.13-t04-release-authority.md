# Development Kit v0.13.0 — T04 Release Authority

**Status:** Binding implementation context  
**Date:** 14 October 2026  
**Current released baseline:** v0.12.1  
**Deferred increment:** DKF120-T04 — State Engine V2  
**v0.13 implementation identity:** DKF130-T04

## 1. Release-line decision

Development Kit v0.12.0 deliberately shipped without State Engine V2.

The v0.12 release retained the stable v0.11-style persistence authority and shipped T01–T03 plus T05–T10. The following State Engine V2 criteria were explicitly deferred rather than counted as passed:

- `DKF-120-AC-012`
- `DKF-120-AC-013`
- `DKF-120-AC-014`
- `DKF-120-AC-015`
- `DKF-120-AC-034`

The repository changelog records T04 State Engine V2 as the **highest-priority v0.13.0** work.

## 2. Product Owner authority

GitHub Issue #82 is the binding Product Owner release-scope decision for v0.12.

Its effect on v0.13 is:

- T04 was deferred, not cancelled;
- the original T04 reliability intent remains;
- full Windows legacy-backup restore/recovery remains required;
- risk-3 independent code, architecture and security review remains required;
- T04 may not be represented as accepted merely because implementation tests pass.

## 3. Windows blocker

GitHub Issue #73 remains the blocking Windows durability/recovery issue.

The accepted direction requires:

- no blanket Windows restore disable;
- a documented supported Windows filesystem/API contract;
- preservation of recovery evidence when durability cannot be proven;
- deterministic crash-boundary/fault-injection coverage;
- Windows and Ubuntu exact-source validation;
- fresh code, architecture and security review before acceptance.

The current v0.13 design treats successful durability-related syscalls as API evidence, not as universal hardware power-loss certification.

## 4. Compatibility baseline

v0.12.1 is the integration baseline.

T04 implementation must preserve released behavior for:

- Cost Observatory;
- Workspace Targets;
- Execution Capsules and Context Cache;
- Lifecycle Instances;
- Discovery and Controlled Re-entry;
- Gate Profiles;
- Verification Extension SDK;
- Complexity Delta Guard;
- Control Center v0.12 projections;
- Design Authority;
- Secrets & Configuration Readiness;
- Development Modes;
- IDEA authority;
- deterministic acceptance and independent verification.

State Engine V2 replaces persistence authority under these released interfaces. It does not roll their behavior back to historical T04 branch versions.

## 5. Historical T04 branches

Historical T04 branches and PRs are evidence/source material only:

- original T04 implementation/validation;
- T04 reliability-hardening work;
- Windows durability investigations;
- audit/review findings.

They are not accepted release authority and must not be merged wholesale over v0.12.1.

v0.13 implementation starts from current `main`, selectively ports proven mechanisms, resolves the outstanding blockers and re-runs independent acceptance.

## 6. Acceptance boundary

T04 is not complete until the exact reviewed source has:

- applicable AC verification PASS;
- Ubuntu validation PASS;
- Windows validation PASS;
- code review PASS;
- architecture review PASS;
- security review PASS;
- required security control-domain PASS;
- no unresolved in-scope major/critical review findings;
- deterministic acceptance computed from source-bound evidence.

Only then may the project proceed to v0.13 release integration.
