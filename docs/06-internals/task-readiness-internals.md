# Task Readiness Internals

## Operating Model

Task readiness is validated at the PLAN → IMPLEMENT boundary by two mechanisms that implement the same contract:

1. **Skill**: `task-readiness-check` (agent-facing procedure)
2. **Hook**: `hooks/before-task.js` `validateTaskReadiness(task)` (code)

## The Contract

A task is **ready** when it has all of:

| Field | Missing-Value Behaviour |
| :--- | :--- |
| `objective` | issue: "Task is missing an objective" |
| `requirements` (non-empty) | issue: "Task has no requirements defined" |
| `acceptanceCriteria` (non-empty) | issue: "Task has no acceptance criteria" |
| `verification` (non-empty) | issue: "Task has no verification specified" |
| `exclusions` (may be empty list) | issue: "Task has no exclusions defined (use empty list if none)" |

## Hook Mechanics

```javascript
validateTaskReadiness(task)
// → { ready: boolean, issues: string[] }
```

The hook also selects skills: `subagent-driven-implementation` always; `test-driven-development` when `verification` includes `unit` or `test`.

## Why It Exists

Prevents starting work on tasks that are ambiguous, incomplete, or missing acceptance criteria — the #1 source of wasted implementation cycles and assumption drift.

## Enforcement

- The conductor runs the readiness check before spawning each implementation agent.
- `/dk-build-auto` re-checks readiness per task during the automated replay.
- The hook makes the contract machine-checkable where the runtime runs hooks.

See [task-readiness-check.md](../03-reference/skills/task-readiness-check.md) and [before-task.md](../03-reference/hooks/before-task.md).
