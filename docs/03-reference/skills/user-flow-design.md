# user-flow-design

**Source**: `skills/user-flow-design/SKILL.md` · **Category**: Artifact · **Compatibility**: `opencode`

## Purpose

Designs user-facing workflows and journeys. Maps the steps a user takes to accomplish a goal, including happy paths, edge cases, and error states.

## Lifecycle Category

DESIGN.

## Trigger Conditions

- Features with multi-step user interactions
- `/dk-design` when the feature has user journeys

## When Not to Invoke

- For features without meaningful user interaction flows

## Required Inputs

- The specification's user-facing behaviour

## Preconditions

- Users and goals are defined

## Procedure

1. Define the user's goal.
2. Map the happy-path steps.
3. Add edge cases and error states (validation failures, cancellations, timeouts).
4. Document the flow.

## Outputs

A user flow (template: `User Flow: [Feature Name]` in the skill).

## Invariants

- Flows cover happy path, edge cases, and error states.
- Flows match the specification's expected behaviour.

## Dependencies

`feature-specification`.

## Related Agents

solution-architect-agent, frontend-implementer (consumer).

## Related Commands

`/dk-design` (supporting skill).

## Verification Requirements

- [ ] Happy path mapped
- [ ] Error states covered

## Failure Behavior

- Undefined edge-case behaviour flagged for the specification.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

For a registration flow: submit → validation errors inline → duplicate-email error state → verification-email notice → link confirmation step.

## Anti-Patterns

- Mapping only the happy path
- Designing flows that contradict the spec

## Maintenance Notes

None specific.
