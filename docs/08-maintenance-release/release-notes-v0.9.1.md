# Release Notes — Development Kit v0.9.1 (Draft)

**Status**: PENDING LIVE FIELD ACCEPTANCE  
**Target Release Line**: v0.9.1  
**Current Published Release**: v0.9.0  

---

## Overview

Development Kit v0.9.1 is a critical field-hardening patch focused on closing subtle authority bypasses, strengthening workflow interaction integrity, and ensuring fail-closed persistence across all supported AI coding agent runtimes.

During extended field evaluation of the v0.9.0 Reliability Control Plane, edge cases were identified where agents could attempt single-turn self-confirmation, where state records could be affected by abrupt host interrupts, or where unclassified scope could default without explicit human Product Owner consent. v0.9.1 resolves these vectors through cryptographic interaction fingerprinting, atomic two-phase commit (2PC) journaling, append-only hash-chained consumption receipts, and live Design Authority state verification.

---

## Key Improvements

### 1. Cryptographic Interaction Fingerprinting
All human-in-the-loop discovery interactions (`REQUIREMENTS_INTERVIEW`, `DESIGN_SYSTEM_SETUP`, `IDEA_CHALLENGE`, `REQUIREMENT_CONFIRMATION`, `SCOPE_CONFIRMATION`, `BRIEF_APPROVAL`) now compute a SHA-256 fingerprint over their interaction ID, phase, prompt, and candidate state. Authority operations (`idea-confirm-candidate`, `idea-adopt-candidate`, `idea-resolve-question`, `idea-design-setup`, `idea-challenge-response`, `idea-classify-scope`, `idea-approve`) strictly reject calls lacking the matching `expectedInteractionFingerprint`.

### 2. Atomic Two-Phase Commit (2PC) Journaling
Discovery state updates are written through an append-only journal (`.development-kit/idea/discovery-journal.json`) before being committed to `discovery.json`. Abrupt interruptions, crash recoveries, or power losses are detected automatically, and incomplete writes are recovered or rejected with fail-closed errors.

### 3. Append-Only Hash-Chained Consumption Receipts
Every interaction consumed by an authority operation produces an immutable receipt in `.development-kit/idea/consumptions.json`. Each receipt cryptographically seals the previous receipt's hash (`hashChain`), preventing receipt forgery, replay attacks, or re-consumption of stale interaction checkpoints.

### 4. Design Authority State Truthfulness
The Design System Setup disposition is verified against real state persisted in `.development-kit/design-system-state.json`. Orchestration CLI commands reject caller-provided unconfirmed mock state, preventing bypass of design system establishment or visual reference capture.

### 5. Exact Scope Proposal Binding
Scope classification prior to Product Owner review is strictly modeled as an AI proposal. Complete mappings covering all active requirements must be persisted and explicitly confirmed; implicit fallback to MUST or unclassified omission is rejected.

### 6. Project-Root Boundary Hardening
Root detection logic was rewritten to reliably resolve workspace boundaries in the presence of symlinks, paths with spaces, or invocations from within deeply nested `.agents/` plugin hierarchies across Windows, macOS, and Linux.

---

## Verification & Validation Status

- **Automated Field Hardening Regression Suite**: 87/87 tests PASSING (`scripts/v091-field-hardening.test.mjs`)
- **Complete Test Suite**: 384 checks across 35 evaluation scenarios PASSING (`npm test`)
- **Full Release Validation**: PASSING (`npm run release:validate`)
- **Documentation Link Validation**: PASSING (`npm run docs:validate`)
- **Live Acceptance Sign-off**: PENDING (Subject to final maintainer live run)
