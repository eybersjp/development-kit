# Development Kit Project Memory

## Current Released Baseline

- **Current release:** v0.11.1 (released 30 September 2026).
- **Package version on `main`:** 0.11.1.
- **Core lifecycle:** `UNDERSTAND → DEFINE → DESIGN → PLAN → IMPLEMENT → VERIFY → REVIEW → SIMPLIFY → COMPLETE`.
- **Public command surface:** 16 workflow commands.
- **Engineering skills:** 48.
- **Primary product position:** DKF is the reliability control plane for agentic software development — **AI can write it. DKF proves it.**

## Shipped Reliability Controls

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

## Current Open Engineering Work

### Development Modes — Issue #50

The original implementation is preserved in historical draft PRs #42 and #43, but those branches predate v0.11.0/v0.11.1 and must not be merged directly.

Required completion:
1. Reconcile and independently verify Increment 001 policy architecture.
2. Reconcile and independently verify Increment 002 initialization/persistence.
3. Implement Increment 003: selected mode is consumed by lifecycle, artifact selection, planning/contracts and Autopilot.
4. Implement Increment 004: mode-aware documentation/artifact behavior.
5. Implement Increment 005: migrations, cross-mode compatibility and real host acceptance.
6. Preserve mandatory reliability/safety controls regardless of selected methodology.

### IDEA authority hardening — Issue #51

The supersession audit of PR #35 is complete. Current v0.11.1 retains persistent/fingerprinted Product Owner decisions and fail-closed numbered decision menus, but several older protections are missing or weaker: runtime IDEA workflow persistence, strict requirement-origin transitions, exact pending-interaction fingerprints, append-only replay protection, crash-safe discovery journaling and Idea Brief approval binding to discovery revision. These protections must be ported as bounded current-generation changes; PR #35 itself must not be merged directly.

## Repository Maintenance State

- PR #41 Live UI Preview & Token Efficiency is merged and shipped as v0.11.1.
- Production-readiness Issue #44 is superseded by the v0.11.1 release plus current Issues #50 and #51.
- Old release-era draft PRs are archival evidence, not current release candidates.
- Canonical README, strategy, roadmap, release notes and this memory file must identify v0.11.1 as the current released baseline.
- Future roadmap version numbers start at **v0.12** because v0.11.0 and v0.11.1 are already released.

## Release Discipline

- Green automated tests alone do not authorize release.
- Do not claim a capability is shipped until its integration, independent verification, required reviews and Product Owner gates pass.
- After any release-impacting change, run the full release-validation/package-consumer gates on the final merge base and verify the published distribution.
