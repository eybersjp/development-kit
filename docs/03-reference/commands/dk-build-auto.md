# /dk-build-auto

**Source**: `commands/dk-build-auto.md` · **Lifecycle Stage**: IMPLEMENT

## Purpose

Processes the entire approved task plan automatically. Runs each task through the complete task loop sequentially. Pauses automatically when a failure, ambiguity, or security-sensitive decision is encountered.

## When to Use

- An approved task plan exists with multiple tasks.
- You want unattended automatic progression through all tasks.

## Auto-Pause Conditions

`/dk-build-auto` pauses and waits for user input when:
- A test fails
- A review fails (spec, code quality, or simplicity)
- A requirement is ambiguous
- A security-sensitive decision appears
- The implementation would deviate from the approved design
- A dependency cannot be justified

## Task Loop (Per Task — Same as `/dk-build`)

1. Repository scout
2. Context packing
3. Task readiness check
4. Implementation restraint loading
5. Fresh implementation sub-agent
6. Tests
7. Spec compliance review
8. Code quality review
9. Simplicity review
10. Final verification → next task

## Output

Progress report showing:
- Tasks completed (with gate status)
- Current task being processed
- Remaining tasks
- Any paused tasks with reason and recommended action

## Skills Invoked

`subagent-driven-implementation`, `incremental-implementation`, `test-driven-development`, `existing-code-first`, `native-platform-first`, `dependency-restraint`, `minimal-diff`, `context-packing`, `test-strategy`, `task-readiness-check`, `dependency-ordering`, `verification-before-completion`, `regression-testing`, `specification-compliance-review`, `code-quality-review`, `simplicity-review`

## Agents Invoked

- `repository-scout-agent`
- `implementation-agent` (fresh per task)
- `spec-reviewer`
- `code-reviewer`
- `simplicity-reviewer`

## Related Commands

- `/dk-build` — same process, manual progression control
- `/dk-status` — check progress during or after auto run
