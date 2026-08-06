# incremental-implementation

**Source**: `skills/incremental-implementation/SKILL.md` · **Category**: Implementation · **Compatibility**: `opencode`

## Purpose

Implements one thin vertical slice at a time. Each slice adds end-to-end value and can be tested independently before the next slice begins.

## Lifecycle Category

IMPLEMENT.

## Trigger Conditions

- Multi-part features being implemented
- Any implementation that can be sliced vertically

## When Not to Invoke

- For single-unit tasks that cannot be sliced

## Required Inputs

- The task plan and its slices

## Preconditions

- Task approved

## Procedure

1. Plan thin vertical slices (each slice end-to-end and testable).
2. Implement slice 1 → verify → implement slice 2 → verify.
3. Never start the next slice while the current slice is failing.

## Outputs

Sequentially delivered, verified vertical slices.

## Invariants

- Each slice is independently testable before the next begins.
- Slices deliver end-to-end value (not horizontal layers).

## Dependencies

`subagent-driven-implementation`, `test-driven-development`.

## Related Agents

implementation agents (executors).

## Related Commands

`/dk-build`, `/dk-build-auto` (supporting skill).

## Verification Requirements

- [ ] Slices planned before implementation
- [ ] Each slice verified before the next starts

## Failure Behavior

- A failing slice blocks the next slice (sequential gate).

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

A checkout feature: slice 1 (cart totals API) → slice 2 (checkout page wiring) → slice 3 (confirmation flow), each verified before the next.

## Anti-Patterns

- Horizontal layers (all models, then all endpoints, then all UI)
- Multiple slices in flight at once

## Maintenance Notes

None specific.
