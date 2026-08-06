# technical-design

**Source**: `skills/technical-design/SKILL.md` · **Category**: Artifact · **Compatibility**: `opencode`

## Purpose

Creates an implementation-oriented design document. Describes the architecture, components, data flow, and interfaces needed to implement a feature.

## Lifecycle Category

DESIGN.

## Trigger Conditions

- Approved specification needs a design
- `/dk-design` invocation

## When Not to Invoke

- When the smallest compatible design is obvious from existing patterns (a brief design may suffice)

## Required Inputs

- The approved specification
- Repository-scout findings (existing architecture, conventions)

## Preconditions

- Specification approved

## Procedure

1. Study the existing architecture.
2. Apply the Ponytail ladder to every requirement.
3. Design the smallest compatible solution (reused components, minimal new components).
4. Document interfaces, data flow, dependencies, open questions, and alternatives considered.

## Outputs

A technical design document (template: `templates/technical-design.md`).

## Invariants

- Smallest compatible solution; consistency over innovation.
- Narrow interfaces; no premature abstraction.

## Dependencies

`repository-orientation` findings.

## Related Agents

solution-architect-agent (primary).

## Related Commands

`/dk-design` (primary).

## Verification Requirements

- [ ] Reused vs new components distinguished
- [ ] New components justified
- [ ] Open questions listed

## Failure Behavior

- Design conflicts with existing architecture → surfaced to the user.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

For a new list view, the design reuses the existing data-access utility and adds one thin component, documenting the single new interface.

## Anti-Patterns

- Designing a generic framework for one use case
- Ignoring scout findings

## Maintenance Notes

Template: `templates/technical-design.md`.
