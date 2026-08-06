# risk-first-planning

**Source**: `skills/risk-first-planning/SKILL.md` · **Category**: Planning · **Compatibility**: `opencode`

## Purpose

Prioritises implementation of uncertain, technically risky, or novel work before safe, cosmetic, or well-understood work.

## Lifecycle Category

PLAN.

## Trigger Conditions

- Ordering a task plan for execution
- When some tasks carry technical risk or uncertainty

## When Not to Invoke

- When all tasks are equally well understood

## Required Inputs

- The decomposed task list
- Risk and uncertainty signals per task

## Preconditions

- Tasks exist and are decomposed

## Procedure

1. Assess each task's risk: technical uncertainty, novel approach, external dependencies, blast radius.
2. Rank tasks: high-risk first, cosmetic last.
3. Document the risk assessment.

## Outputs

A risk-ranked execution order (template: `Risk Assessment` in the skill).

## Invariants

- Risky foundation work precedes safe cosmetic work.
- Risk assessment is explicit, not implicit.

## Dependencies

`task-decomposition`.

## Related Agents

task-planner-agent (primary).

## Related Commands

`/dk-tasks` (supporting skill).

## Verification Requirements

- [ ] Risks identified per task
- [ ] High-risk tasks ordered first

## Failure Behavior

- Unknown-risk tasks flagged for spike/verification before ordering.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

Auth/schema work (high risk) is scheduled before button styling (cosmetic), even though the button is user-visible.

## Anti-Patterns

- Doing cosmetic work first "because it's quick"
- Hiding uncertainty instead of ranking it

## Maintenance Notes

None specific.
