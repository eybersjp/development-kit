---
name: build-auto
description: >-
  Process the entire approved task plan automatically, running each task
  through every gate sequentially. Pauses automatically on failures.
---

# /build-auto

## Purpose

Processes the entire approved task plan automatically. For each task, runs the complete task loop (repository scout, task readiness check, fresh implementation sub-agent, tests, specification compliance review, code quality review, simplicity review, and final verification). Pauses automatically when a test fails, a review fails, a requirement is ambiguous, a security-sensitive decision appears, or the implementation would deviate from the approved design.

## Workflow

### For Each Task (Sequentially)

1. **Select next task** — Choose the next uncompleted task from the approved plan
2. **Repository scout** — Gather task context using the repository-orientation skill
3. **Validate readiness** — Run the task-readiness-check before spawning an implementation agent
4. **Apply restraint principles** — Load existing-code-first, native-platform-first, dependency-restraint, and minimal-diff
5. **Spawn fresh implementation agent** — Create a new sub-agent with the full task package
6. **Run tests** — Execute verification suite (unit, integration, browser)
7. **Spec review** — Check specification compliance (first review stage)
8. **Code quality review** — Assess code correctness and conventions (second review stage)
9. **Simplicity review** — Apply the Ponytail ladder
10. **Run tests again** — Final verification after simplification
11. **Task complete** — Proceed to next task

### Auto-Pause Conditions

Pause automatically and report to the user when:
- A test fails
- A review fails (spec, code quality, or simplicity)
- A requirement is ambiguous
- A security-sensitive decision appears
- The implementation would deviate from the approved design
- A dependency cannot be justified

After pausing, wait for user input to continue or abort.

## Skills Activated

Primary:
- `subagent-driven-implementation` — Dispatches a fresh implementation sub-agent per task

Supporting:
- `incremental-implementation` — Implements one thin vertical slice at a time
- `test-driven-development` — Red-green-refactor discipline
- `existing-code-first` — Search for reusable code before writing new code
- `native-platform-first` — Prefer built-in capabilities before adding dependencies
- `dependency-restraint` — Justify every new dependency
- `minimal-diff` — Keep changes tightly scoped to the task
- `context-packing` — Gathers only relevant context for the fresh sub-agent
- `test-strategy` — Defines how the feature will be proven correct
- `task-readiness-check` — Verifies each task is clear enough to implement
- `dependency-ordering` — Ensures correct execution order
- `verification-before-completion` — Requires evidence before claiming success
- `regression-testing` — Verify existing behaviour remains intact

Review gates:
- `specification-compliance-review` — First review: did we build the right thing?
- `code-quality-review` — Second review: did we build it well?
- `simplicity-review` — Can we remove anything?

## Sub-Agents

- repository-scout-agent
- implementation-agent (fresh per task)
- spec-reviewer
- code-reviewer
- simplicity-reviewer

## Output

Progress report showing:
- Tasks completed
- Current task
- Remaining tasks
- Any paused tasks with reason and recommended action
