# /dk-build

**Source**: `commands/dk-build.md` · **Lifecycle Stage**: IMPLEMENT

## Purpose

Implements the next uncompleted task from the approved task plan. Runs the complete task loop: repository scout → readiness check → fresh implementation sub-agent → tests → spec compliance review → code quality review → simplicity review → final verification.

## When to Use

- An approved task plan exists.
- Implementing tasks one at a time with manual progression control.

## When NOT to Use

- You want automatic progression through all tasks — use `/dk-build-auto`.
- No task plan exists — use `/dk-tasks` first.

## Task Loop (Per Task)

1. **Repository Scout**: Gather task context using `repository-orientation`.
2. **Context Packing**: Assemble minimal context for the sub-agent.
3. **Task Readiness Check**: Verify task is clear enough to implement.
4. **Implementation Restraint**: Load `existing-code-first`, `native-platform-first`, `dependency-restraint`, `minimal-diff`.
5. **Fresh Sub-agent**: Spawn an isolated `implementation-agent` with full task package.
6. **Tests**: Run unit, integration, and browser tests (as applicable).
7. **Spec Review**: `spec-reviewer` checks specification compliance (first gate).
8. **Code Quality Review**: `code-reviewer` assesses code quality (second gate).
9. **Simplicity Review**: `simplicity-reviewer` applies Ponytail ladder.
10. **Final Verification**: Re-run tests after simplification.

## Stopping Conditions

- A test fails
- Spec review fails
- Code review finds critical issues
- The task cannot be completed as specified
- A dependency cannot be justified
- The diff exceeds task scope

## Skills Invoked

`subagent-driven-implementation`, `incremental-implementation`, `test-driven-development`, `existing-code-first`, `native-platform-first`, `dependency-restraint`, `minimal-diff`, `context-packing`, `test-strategy`, `specification-compliance-review`, `code-quality-review`, `simplicity-review`

## Agents Invoked

- `repository-scout-agent`
- `implementation-agent` (fresh per task)
- `spec-reviewer`
- `code-reviewer`
- `simplicity-reviewer`

## Related Commands

- `/dk-build-auto` — same process, automatic progression
- `/dk-test` — standalone verification run
- `/dk-review` — standalone review run
