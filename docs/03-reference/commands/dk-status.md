# /dk-status

**Source**: `commands/dk-status.md` · **Lifecycle Stage**: Any

## Purpose

Shows the current workflow state: active lifecycle stage, current task, completed tasks, pending reviews, and any blocked items. Informational only — no code changes are made.

## When to Use

- At the start of a session to assess where work left off.
- After a pause to determine what to do next.
- Any time workflow state is unclear.

## Workflow

1. **Gather State**: Collect active lifecycle stage, current task, completed tasks with gate results, pending tasks, blocked items, and pending reviews.
2. **Report**: Present a structured status summary.

## Skills Invoked

- `skill-routing` — determines active workflow stage and loaded skills
- `using-development-kit` — methodology context for interpreting workflow state

## Agents Invoked

None. This command is informational only.

## Example Output

```text
## Status Report

### Lifecycle Stage
IMPLEMENT

### Current Task
Task 2: Implement settings panel toggle — In Progress

### Completed Tasks
- Task 1: Add dark mode CSS variables — ✅ All gates passed

### Pending Tasks
- Task 3: Persist preference in localStorage
- Task 4: Write end-to-end tests

### Blocked Items
(none)

### Pending Reviews
(none — reviews run after all tasks complete)

### Workflow State
- Skills active: subagent-driven-implementation, test-driven-development
- Waiting on: implementation sub-agent output
```

## Related Commands

- All commands — use `/dk-status` to determine which command to run next
- [Command Selection Matrix](command-selection-matrix.md)
