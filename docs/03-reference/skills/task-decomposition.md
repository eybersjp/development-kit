# task-decomposition

**Source**: `skills/task-decomposition/SKILL.md` · **Category**: Planning · **Compatibility**: `opencode`

## Purpose

Breaks approved specifications into small, independently verifiable tasks and subtasks. Orders by dependency and risk. Keeps tasks small.

## Lifecycle Category

PLAN.

## Trigger Conditions

- Approved design needs a task plan
- `/dk-tasks` invocation

## When Not to Invoke

- When the work is a single small change (one task)

## Required Inputs

- The approved specification and design
- Repository-scout file mapping

## Preconditions

- Design approved

## Procedure

1. Identify natural task boundaries (components, layers, concerns, test scopes).
2. Break into tasks — each one logical unit, fresh-agent-implementable, independently verifiable, with acceptance criteria.
3. Break each task into atomic subtasks.
4. Order by dependency and risk (foundation first, risky before cosmetic).
5. Define verification per task.

## Outputs

A task plan (template: `templates/task-plan.md`).

## Invariants

- Every task independently verifiable.
- Tasks are hours of work, not days.

## Dependencies

`technical-design`.

## Related Agents

task-planner-agent (primary).

## Related Commands

`/dk-tasks` (primary).

## Verification Requirements

- [ ] 3–7 tasks for a typical feature (per evaluation)
- [ ] Each task has objective, requirements, acceptance criteria, verification
- [ ] Ordering is dependencies-first

## Failure Behavior

- Oversized tasks are re-decomposed before approval.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

Per `evals/task-decomposition/scenario-01-api-endpoint.json`: a registration endpoint becomes 3–7 tasks covering validation, duplicate check, password hashing, and token generation, ordered dependencies-first.

## Anti-Patterns

- Tasks spanning days
- Tasks without verification

## Maintenance Notes

Evaluated by `evals/task-decomposition/`.
