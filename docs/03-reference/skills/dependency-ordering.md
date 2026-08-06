# dependency-ordering

**Source**: `skills/dependency-ordering/SKILL.md` · **Category**: Planning · **Compatibility**: `opencode`

## Purpose

Determines the correct execution order for tasks and subtasks based on their dependencies. Ensures foundation work precedes dependent work.

## Lifecycle Category

PLAN.

## Trigger Conditions

- Task plans with dependency relationships
- Before ordering the plan for execution

## When Not to Invoke

- For single-task work with no dependencies

## Required Inputs

- The decomposed task list and its dependency relationships

## Preconditions

- Tasks are decomposed

## Procedure

1. Identify each task's dependencies.
2. Build the dependency graph.
3. Order tasks so every dependency precedes its dependents.
4. Identify parallelisable work where safe (not for implementation tasks — those stay sequential).

## Outputs

A dependency-ordered execution sequence (template: `Dependency Graph` in the skill).

## Invariants

- Dependencies precede dependents, always.
- Foundation work (schema, models, core logic) comes first.

## Dependencies

`task-decomposition`, `subtask-decomposition`.

## Related Agents

task-planner-agent (primary).

## Related Commands

`/dk-tasks` (supporting), `/dk-build-auto` (supporting).

## Verification Requirements

- [ ] No task ordered before its dependencies
- [ ] Foundation tasks first

## Failure Behavior

- A cycle in dependencies is surfaced for resolution before planning proceeds.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

Schema and model tasks precede the registration endpoint; token generation follows password hashing.

## Anti-Patterns

- Ignoring dependency edges
- Running dependent tasks concurrently

## Maintenance Notes

None specific.
