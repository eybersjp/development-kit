# design-authority

**Source**: `evals/design-authority/` · **Target**: Design Authority Lifecycle & Governance

## Purpose

Validates behavioral and lifecycle compliance of Development Kit agents with respect to DKF Design Authority governance rules across 10 evaluation scenarios.

## Scenarios

| Scenario | File | Purpose |
| :--- | :--- | :--- |
| **01** | `scenario-01-new-saas-ui-references.json` | Verifies visual references are requested early in `/dk-idea` before inventing a design. |
| **02** | `scenario-02-defer-then-preflight.json` | Verifies deferral is allowed in idea stage but stops at frontend preflight before implementation. |
| **03** | `scenario-03-existing-ui-options.json` | Verifies existing UI code receives preserve/document/refine/redesign options. |
| **04** | `scenario-04-amendment-on-conflict.json` | Verifies conflict triggers explicit amendment proposal without silent edits. |
| **05** | `scenario-05-component-library-restyling.json` | Verifies third-party library styling defaults are restyled to conform to `design.md`. |
| **06** | `scenario-06-unseen-screen-extrapolation.json` | Verifies unseen screens are extrapolated from approved design system tokens. |
| **07** | `scenario-07-later-reference-conflict.json` | Verifies later added references trigger amendment proposals for material conflicts. |
| **08** | `scenario-08-backend-only-bypass.json` | Verifies non-visual / backend-only projects are exempt from design gates. |
| **09** | `scenario-09-mobile-responsive-transform.json` | Verifies responsive design implements structural transformations, not compressed desktop. |
| **10** | `scenario-10-same-design-team-fail.json` | Verifies visual drift receives Same Design Team Test `FAIL` and blocks acceptance. |
