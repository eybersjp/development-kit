---
name: design-authority
description: "Governs the project's authoritative frontend design system (design.md), visual reference ingestion, design preflight, 7-level conflict resolution, and controlled amendments."
compatibility: opencode
---

# Design Authority Skill

## Purpose

Acts as the shared governance engine for visual frontend design systems in Development Kit. Governs `design.md` as the single authoritative source of truth for frontend UI styling, component appearance, layout behaviour, spacing, typography, colour, responsive behaviour, interaction states, and visual consistency in this project.

---

## When Design Authority Applies

- Applies to any project or feature with a visual frontend / user interface.
- Confirmed non-visual / backend-only projects are completely exempt from Design Authority gates (`applicable: false`).

---

## The 7-Level Conflict Priority

When making any frontend visual decision, agents must resolve conflicts according to this strict hierarchy:

1. **Explicit current user instruction**
2. **Approved Design System Amendment**
3. **Current approved `design.md`**
4. **Existing established project components**
5. **Application requirements**
6. **Framework / component-library defaults**
7. **AI implementation preference**

*Framework defaults and AI preferences never override the approved design system.*

---

## Authoritative Design System Rule

`design.md` located at the project root is the single authoritative source of truth for frontend visual design.

### Mandatory Rules

1. **Read `design.md` before performing frontend/UI work.**
2. **All UI components and screens must follow `design.md`.**
3. **Do not invent arbitrary tokens or styling** where applicable tokens/rules exist.
4. **Reuse existing tokens and components first.**
5. **Extrapolate new screens** from the established design language rather than inventing a new style.
6. **Restyle third-party components** (e.g. shadcn, Radix) to conform to `design.md`.
7. **No silent modifications to `design.md`.**
8. **Follow responsive principles** (mobile is a structured transformation, not scaled-down desktop).
9. **Respect all interaction states** (default, hover, focus, active, selected, disabled, loading, error, success, empty).
10. **Mandatory accessibility** (WCAG 2.2 AA).
11. **Apply the Same Design Team Test** before considering a frontend task complete.

---

## Design System Change Control (Amendments)

Coding agents must **never** autonomously rewrite design direction, alter foundational tokens, replace typography, swap color architecture, modify spacing/radius scales, or change visual invariants.

If an implementation requirement conflicts with `design.md`, the agent must stop and propose an explicit **Design System Amendment**:

```text
DESIGN SYSTEM AMENDMENT PROPOSAL

Current rule:
[existing rule]

Proposed rule:
[new rule]

Reason:
[why the change is necessary]

Affected components/screens:
[list]

Risk of visual inconsistency:
[low / medium / high]

Recommendation:
[accept / reject / alternative]
```

Amendments may only be applied to `design.md` after **explicit user approval**.

---

## State & Governance Model

Design Authority state is persisted per-project at `.development-kit/design-system-state.json` (schema version 1).

### Supported States
- `not_required`: Confirmed non-visual project.
- `unconfigured`: Visual project needing setup.
- `deferred`: Setup postponed during `/dk-idea`; blocks frontend implementation.
- `references_requested`: Awaiting user-provided references.
- `references_received`: References staged for analysis.
- `generating`: Analyzing references and drafting `design.md`.
- `draft`: `design.md` generated, pending review.
- `awaiting_approval`: Submitted for explicit user approval.
- `approved`: Authoritative design system active and enforced.
- `amendment_pending`: Proposed change awaiting approval.
- `superseded`: Replaced by a new major design system iteration.

### Fail-Closed Behaviour
If the state file is missing or corrupt on a visual project, frontend mutation fails closed and requires repair/setup via `/dk-design-system`, while non-visual backend work continues unimpeded.

---

## Progressive Reference Ingestion

When new references are provided to an already approved system:
1. Register and digest reference files.
2. Compare new evidence against the current approved `design.md`.
3. Identify consistent rules and non-conflicting additions.
4. If material conflicts are detected, produce amendment proposals rather than silently overwriting foundational rules.

---

## Review & Same Design Team Test

Reviewers evaluate frontend implementation against `design.md`, assign stable `DS-xxx` issue IDs, and issue a mandatory verdict:

```text
Same Design Team Test: PASS | PARTIAL | FAIL
```
- **PASS**: Touched UI convincingly belongs to the approved design system.
- **PARTIAL**: Minor non-foundational inconsistencies remain.
- **FAIL**: Material visual drift or unauthorized system change exists (blocks completion and release).
