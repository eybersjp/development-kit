# /dk-design-system

**Source**: `commands/dk-design-system.md` · **Lifecycle Stage**: DESIGN / Governance

## Purpose

Establishes, inspects, verifies, and governs the project's authoritative frontend design system (`design.md`) to prevent visual drift and AI design improvisation.

## When to Use

- Starting a new UI project to set up design direction from reference images, existing UI, or requirements.
- Inspecting the current Design Authority state, version, and authority rules.
- Verifying implementation compliance against `design.md`.
- Proposing and applying controlled Design System Amendments.

## When NOT to Use

- Backend-only or non-visual projects where no user interface exists.

## Preconditions

- The project contains or will contain a frontend user interface.

## Sub-Modes

| Sub-Mode | Usage | Description |
| :--- | :--- | :--- |
| `create` | `/dk-design-system create` | Generate a complete 31-section `design.md` from requirements without reference images |
| `reference` | `/dk-design-system reference` | Ingest visual references (screenshots, mockups) and infer the design system |
| `existing` | `/dk-design-system existing` | Inspect existing frontend and document, refine, or redesign the design system |
| `inspect` | `/dk-design-system inspect` | Read-only inspection of state, version, and authority status |
| `verify` | `/dk-design-system verify` | Read-only verification of source/rendered UI against `design.md` |
| `amend` | `/dk-design-system amend` | Propose a controlled Design System Amendment |

## Outputs

- Authoritative `design.md` at project root
- State persistence in `.development-kit/design-system-state.json`
- Verification findings or amendment proposals

## Related Commands

- [`/dk-idea`](dk-idea.md): Discovers visual references early.
- [`/dk-design`](dk-design.md): Integrates Design Authority into broader technical and visual design.
- [`/dk-build`](dk-build.md): Enforces Design System Preflight before frontend tasks.
- [`/dk-test`](dk-test.md): Checks Design System Compliance.
- [`/dk-review`](dk-review.md): Executes Same Design Team Test.
- [`/dk-status`](dk-status.md): Displays active Design Authority status.
- [`/dk-ship`](dk-ship.md): Enforces Design Authority release gate.
