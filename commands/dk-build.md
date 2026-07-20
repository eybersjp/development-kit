---
name: build
description: >-
  Implement the next task through every verification gate: implement, test,
  spec review, code review, simplify. Stops when all gates pass. Applies
  minimum-diff and dependency-restraint discipline throughout.
---

# /dk-build

## Purpose

Implements the next uncompleted task from the approved task plan. Runs the complete task loop: repository scout, task readiness check, fresh implementation sub-agent, tests, specification compliance review, code quality review, simplicity review, and final verification.

## Workflow

### 1. Select Next Task
Choose the next uncompleted task from the approved task plan.

### 2. Repository Scout
Spawn the **repository-scout-agent** to gather task context. Apply the `repository-orientation` skill to understand the relevant code.

### 3. Validate Task Readiness
Run the task-readiness-check before spawning an implementation agent. Confirm the task is clear enough to implement.

### 4. Apply Implementation Restraint Skills
Before the implementation agent starts, ensure these principles are loaded:
- **Existing-code-first**: Search for reusable project code before writing new code
- **Native-platform-first**: Prefer standard library and built-in platform capabilities
- **Dependency-restraint**: Justify every new dependency
- **Minimal-diff**: Keep changes tightly scoped to the task

### 5. Spawn Fresh Implementation Agent
Create a new implementation sub-agent with the full task package:
- Task description
- Relevant specification section
- Relevant design section
- Allowed scope and exclusions
- Acceptance criteria
- Required tests
- Repository-scout findings
- Implementation restraint principles

### 6. Verify
Run the verification suite. Apply test-first principles:
- Unit tests
- Integration tests
- Browser tests (if applicable)

### 7. Spec Review
Spawn the **spec-reviewer** to check specification compliance. This is the first review stage.

### 8. Code Quality Review
Spawn the **code-reviewer** to assess code quality. This is the second review stage.

### 9. Simplify
Spawn the **simplicity-reviewer** to apply the Ponytail ladder. Remove unnecessary code, abstractions, and dependencies.

### 10. Final Verification
Run all tests again after simplification.

### 11. Complete
Task is done. Proceed to the next `/dk-build` or `/dk-build-auto`.

## Skills Activated

Primary:
- `subagent-driven-implementation` — Dispatches a fresh implementation sub-agent for each task

Supporting:
- `incremental-implementation` — Implements one thin vertical slice at a time
- `test-driven-development` — Red-green-refactor discipline
- `existing-code-first` — Search for reusable code before writing new code
- `native-platform-first` — Prefer built-in capabilities before adding dependencies
- `dependency-restraint` — Justify every new dependency
- `minimal-diff` — Keep changes tightly scoped to the task
- `context-packing` — Gathers only relevant context for the fresh sub-agent
- `test-strategy` — Defines how the feature will be proven correct

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

## Stopping Conditions

- A test fails
- Spec review fails
- Code review finds critical issues
- The task cannot be completed as specified
- A dependency cannot be justified
- The diff exceeds the task scope
