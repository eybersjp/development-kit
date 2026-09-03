---
name: dk-design-system
description: Establish, inspect, verify, and govern the project's authoritative frontend design system (design.md)
category: DESIGN
---

# /dk-design-system

Establishes, inspects, verifies, and governs the project's authoritative frontend design system:

```text
design.md
```

`design.md` is the **single authoritative source of truth** for all visual frontend design, UI styling, component appearance, layout behaviour, spacing, typography, colour, responsive behaviour, interaction states, and visual consistency in this project.

---

## Lifecycle Entry Gate

At session start or command invocation, execute the centralized lifecycle entry adapter:
```bash
node scripts/lifecycle.mjs --command=dk-design-system --phase=entry
```
This establishes and validates project bootstrap, binds project identity, and verifies execution context.

## Sub-Modes

```text
/dk-design-system [create | reference | existing | inspect | verify | amend]
```

When run with no argument, inspects current state and routes to the most relevant unresolved workflow.

---

### 1. `/dk-design-system create`
Establish a new visual design system without reference images.
- Evaluates project requirements and invokes `design-direction`.
- Generates a complete 31-section `design.md` with reasoned values clearly marked as `inferred` or `recommended`.
- Persists state and requests user approval before status becomes `approved`.

### 2. `/dk-design-system reference`
Infer and establish a reusable design system from one or more visual references.
- Ingests reference images, screenshots, mockups, or Figma exports.
- Applies `templates/design-system-reference-analysis.md` to reverse-engineer reusable tokens and components.
- Generates the complete 31-section `design.md` (or reconciles new evidence against an existing approved system via amendment proposals).

### 3. `/dk-design-system existing`
Establish design authority for an existing application codebase.
- Inspects existing CSS architecture, component libraries, typography, tokens, and layouts.
- Presents clear options:
  1. **Preserve & Document**: Reverse-engineer existing code into `design.md`.
  2. **Refine Current Design**: Improve and standardize existing styles using reference images.
  3. **Redesign**: Establish a new design system from references while preserving business logic.
  4. **Use Existing `design.md`**: Adopt existing file with lazy migration.

### 4. `/dk-design-system inspect`
Read-only inspection of Design Authority status:
- Applicability, current status, and semantic version.
- Authority file path and source mode.
- Ingested references, roles, and digests.
- Pending amendments and amendment history.
- Last verification result and Same Design Team Test status.
- Whether frontend modification is permitted.

### 5. `/dk-design-system verify`
Read-only compliance verification of frontend implementation against `design.md`:
- Audits design token usage vs raw hardcoded colors/spacing.
- Checks component state coverage, focus indicators, and contrast ratios.
- Verifies responsive layout shifts and visual invariants.
- Produces a structured Design Authority compliance report without mutating `design.md`.

### 6. `/dk-design-system amend`
Controlled change proposal workflow for updating `design.md`:
- Prompts for proposed rule change, technical/business reason, affected screens, and inconsistency risk.
- Formats a formal `DESIGN SYSTEM AMENDMENT PROPOSAL`.
- Requires explicit user approval before applying changes to `design.md` and incrementing the design system semantic version.
