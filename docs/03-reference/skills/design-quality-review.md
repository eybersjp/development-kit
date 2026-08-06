# design-quality-review

**Source**: `skills/design-quality-review/SKILL.md` · **Category**: Review · **Compatibility**: `opencode`

## Purpose

Prevents generic AI-generated visual language. Assesses visual hierarchy, spacing, typography, interaction design, and overall design quality.

## Lifecycle Category

REVIEW (conditional).

## Trigger Conditions

- UI implementation with visual design
- After frontend implementation

## When Not to Invoke

- For backend-only tasks

## Required Inputs

- The UI implementation and its design direction

## Preconditions

- Implementation exists

## Procedure

1. Assess layout, hierarchy, spacing, colour, typography.
2. Check interaction design (hover, focus, transitions, loading states).
3. Check responsive design and touch targets.
4. Apply the never-allow list: generic grids, arbitrary gradients, unnecessary glassmorphism/cards, weak hierarchy, generic AI visual language, inconsistent spacing, missing states, insufficient contrast.
5. Report the verdict and visual-language assessment.

## Outputs

- A design verdict: PASS / FAIL / PASS WITH ISSUES, with strengths and issues

## Invariants

- Visual hierarchy and intentionality are required, not optional.
- Accessibility constraints are respected within design choices.

## Dependencies

`design-direction`.

## Related Agents

design-reviewer (primary).

## Related Commands

`/dk-review` (supporting), `/dk-build`, `/dk-build-auto` (conditional gate).

## Verification Requirements

- [ ] Hierarchy and spacing assessed
- [ ] Interaction states present
- [ ] Responsive verified

## Failure Behavior

- Generic visual language → FAIL with specific anti-patterns cited.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

A settings page with a flat card grid and no hierarchy fails; an intentional layout with a clear primary action and visible states passes.

## Anti-Patterns

- Approving default AI-generated layouts
- Ignoring accessibility in the name of aesthetics

## Maintenance Notes

Companion creation skill: `design-direction`.
