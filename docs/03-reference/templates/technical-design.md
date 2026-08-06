# technical-design

**Source**: `templates/technical-design.md` · **Frontmatter**: `name: technical-design`

## Intended Lifecycle Stage

DESIGN.

## Intended User / Agent

solution-architect-agent (output of `/dk-design`).

## Purpose

Concise technical design: approach, reused vs new components, interfaces, data flow, dependencies, open questions, and alternatives considered.

## Required Sections

Approach · Reused Components (table) · New Components (table with justification) · Interfaces (API/module contracts, data flow) · Dependencies (table with justification) · Open Questions · Alternatives Considered (table)

## Optional Sections

None.

## How the Template Is Selected

Standard artifact level; selected by adaptive-artifact-planning.

## How It Should Be Completed

- Reused components listed first (reuse before create)
- Every new component justified (why new code is needed)
- Alternatives considered with reasons for rejection (prevents "obvious" choices going unchallenged)

## Validation Expectations

- No new component without justification
- No new dependency without justification
- Open questions explicit (never silently assumed)

## Related

[solution-architect-agent](../agents/solution-architect-agent.md), [technical-design](../skills/technical-design.md).
