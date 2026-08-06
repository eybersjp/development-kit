# design-direction

**Source**: `skills/design-direction/SKILL.md` · **Category**: Artifact · **Compatibility**: `opencode`

## Purpose

Creates premium, intentional UI direction rather than generic generated layouts. Defines visual language, design principles, and aesthetic choices.

## Lifecycle Category

DESIGN.

## Trigger Conditions

- UI features needing a visual design
- `/dk-design` for user-facing features

## When Not to Invoke

- For non-UI work

## Required Inputs

- The specification and user flows
- Existing UI conventions (scout findings)

## Preconditions

- Behaviour is defined

## Procedure

1. Define the visual language: hierarchy, spacing, colour, typography, interaction states.
2. Reject generic AI-generated visual language.
3. Document the direction.

## Outputs

A design direction (template: `Design Direction: [Project/Feature]` in the skill).

## Invariants

- Intentional, consistent visual language.
- Accessibility constraints are part of the direction (contrast, focus states).

## Dependencies

`user-flow-design`.

## Related Agents

solution-architect-agent, frontend-implementer (consumer), design-reviewer (assessor).

## Related Commands

`/dk-design` (supporting skill).

## Verification Requirements

- [ ] Visual language defined (hierarchy, spacing, colour, type)
- [ ] Interaction states specified

## Failure Behavior

- Vague direction is rejected by design-review at implementation time.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

For a settings page, the direction specifies a clear primary action, a consistent spacing scale, and hover/focus states — preventing a generic card grid.

## Anti-Patterns

- Defaulting to generic dashboard templates
- Deciding aesthetics without accessibility in mind

## Maintenance Notes

The companion review skill is `design-quality-review`.
