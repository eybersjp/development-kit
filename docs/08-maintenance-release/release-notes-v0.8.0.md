# Release Notes: Development Kit v0.8.0

> **Release Date:** 2026-08-17  
> **Release Target:** Antigravity AI, OpenCode, and supported multi-platform coding environments  
> **Target Package:** `development-kit@0.8.0`  
> **Status:** Released

---

## Executive Summary

Development Kit `v0.8.0` introduces **DKF Design Authority**, an authoritative design system governance lifecycle capability designed to eliminate visual frontend drift across AI coding workflows. In projects with a user interface, `design.md` at the project root becomes the single authoritative source of truth for UI styling, token architecture, layout rules, spacing, typography, responsive behavior, and accessibility.

---

## Key Highlights

1. **Authoritative `design.md` Governance**:
   - `design.md` is the single source of truth for visual UI.
   - Comprehensive 31-section specification structure generated from requirements or visual references.

2. **`/dk-design-system` Command**:
   - Dedicated command with 6 operational sub-modes (`create`, `reference`, `existing`, `inspect`, `verify`, `amend`).

3. **Visual Reference Ingestion**:
   - Analyzes screenshots, mockups, Figma exports, or existing UI to infer the reusable design system.
   - Categorizes decisions as Observed, Inferred, or Recommended.

4. **Design System Preflight**:
   - Mandatory `DESIGN SYSTEM PRE-FLIGHT` gate preventing unapproved UI execution in `/dk-build`, `/dk-build-auto`, and `/dk-autopilot`.

5. **Same Design Team Test & Compliance**:
   - Heuristic compliance checks in `/dk-test`.
   - Specialist Design Authority review pass in `/dk-review` issuing `DS-xxx` issue IDs and a gating `Same Design Team Test: PASS | PARTIAL | FAIL` verdict.

6. **Controlled Change Management**:
   - Strict 6-field `DESIGN SYSTEM AMENDMENT PROPOSAL` flow requiring explicit user approval before foundational changes to `design.md`.

7. **Backward Compatibility & Non-Visual Exemption**:
   - Pre-v0.8 projects with existing `design.md` are migrated non-destructively.
   - Non-visual and backend-only projects are completely exempt from design gates.
