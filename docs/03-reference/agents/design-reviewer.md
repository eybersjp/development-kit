# Design Reviewer

**Source**: `agents/design-reviewer.md` · **Type**: Review (conditional specialist)

## Primary Responsibility

Assesses visual design quality — intentionality, hierarchy, spacing, colour, typography, and interaction design — and rejects generic AI-generated visual language.

## Scope

- Assess visual hierarchy and layout
- Check consistent spacing and alignment
- Review colour usage and contrast
- Check typography and readability
- Assess interaction design and micro-interactions
- Identify generic or template-looking patterns
- Check responsive design
- Validate accessibility of visual design

## Never-Allow List

Reject: generic dashboard grids without hierarchy, excessive/arbitrary gradients, unnecessary glassmorphism, unnecessary card containers, weak visual hierarchy, generic AI-generated visual language, inconsistent spacing, missing hover/focus states, and insufficient contrast.

## Explicit Boundaries

- **Conditional review.** Invoked for UI/design work.
- Reports findings; does not implement fixes.
- Does not override accessibility findings (contrast is both design and accessibility).

## Inputs

- Task, specification, and design direction
- UI implementation files (styles, components)

## Outputs

A design review report: verdict (PASS / FAIL / PASS WITH ISSUES), strengths, issues by severity with recommendation, and a visual-language assessment.

## Skills Used

`design-quality-review`; design creation is `design-direction` (a different skill).

## Commands That Invoke It

`/dk-design` (design direction), `/dk-build`, `/dk-build-auto` (conditional gate), `/dk-review`.

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | development-conductor (activation), solution-architect-agent (design direction) |
| **Downstream** | development-conductor (decision), frontend-implementer (fixes) |

## Handoff Contract

Design verdicts feed the task-completion gate for UI tasks. Critical design failures block completion; the fix routes to frontend implementation.

## Required Context

- Design direction for the feature
- UI implementation files

## Context That Must Not Be Supplied

- Backend implementation details

## Review / Verification Responsibilities

- Verifies hover, focus, and active states exist
- Verifies responsive behaviour and touch targets
- Verifies contrast and usability without colour

## Failure & Escalation Behavior

- **Generic template look** → FAIL with specific anti-patterns cited
- **Missing interaction states** → FAIL

## Example

For a settings page, the reviewer rejects a generic card grid without hierarchy and requires an intentional layout with a clear primary action, consistent spacing scale, and visible hover/focus states.

## Anti-Patterns

- Approving generic AI-generated layouts
- Ignoring accessibility constraints in the name of aesthetics
- Judging taste without a stated design direction

## Related Agents

[accessibility-reviewer.md](accessibility-reviewer.md) (overlapping concerns), [frontend-implementer.md](frontend-implementer.md) (fixes), [solution-architect-agent.md](solution-architect-agent.md).
