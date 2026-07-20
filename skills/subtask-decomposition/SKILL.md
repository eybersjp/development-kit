---
name: subtask-decomposition
description: >-
  Breaks each task into atomic, ordered steps. Ensures every task has a
  clear, executable sequence of work items.
---

# Subtask Decomposition

## Overview

Breaks each task into atomic, ordered steps. While task-decomposition identifies the work units, subtask-decomposition ensures every task has a clear, executable sequence of steps that an implementation agent can follow without needing to plan further.

## When to Use

- After high-level tasks are identified by task-decomposition
- When a task is too complex to implement in a single pass
- When preparing a task package for a fresh implementation sub-agent
- When reviewing whether a task is well-defined enough to implement

## Process

### 1. Identify Subtask Boundaries

For the given task, identify natural break points:
- **Distinct concerns**: Validation, persistence, response formatting
- **Testability**: Each subtask should be independently testable
- **Ordering**: Some steps must happen before others
- **Rollback points**: Natural points where work could be safely reverted

### 2. Define the Sequence

Order subtasks so that:
1. Foundation comes first (types, interfaces, schemas)
2. Tests come before implementation (TDD: RED phase)
3. Core logic follows (the main behaviour change)
4. Integration comes next (wiring things together)
5. Edge cases and error handling follow
6. Verification and cleanup come last

### 3. Write Atomic Subtasks

Each subtask should:
- Represent one logical step
- Be completable in a short time
- Have a clear success condition
- Not depend on future subtasks

### 4. Validate the Sequence

Check:
- Is every subtask necessary?
- Is the ordering correct (can't skip a dependency)?
- Is each subtask independently verifiable?
- Are there clear completion criteria for each subtask?

## Subtask Template

```markdown
### Subtask 1: [Action]
- **Objective**: [What this subtask achieves]
- **Files affected**: [Files]
- **Success**: [How to verify]
- **Dependencies**: [None / prior subtask]

### Subtask 2: [Action]
- **Objective**: [What this subtask achieves]
- **Files affected**: [Files]
- **Success**: [How to verify]
- **Dependencies**: [Subtask 1]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "This task is simple, it doesn't need subtasks" | Even simple tasks benefit from a step-by-step plan. Write 2-3 subtasks. |
| "I'll figure out the steps as I implement" | Planning the steps upfront prevents missed edge cases and rework. |
| "Too many subtasks will slow me down" | Each subtask takes minutes. Rework from missed steps takes hours. |
| "Subtasks are just busywork" | Subtasks are the execution plan. They prevent implementation drift. |

## Red Flags

- Subtasks are too large to complete in one focused session
- Subtasks are not independently testable
- Subtask ordering doesn't respect dependencies
- Tests are the last subtask instead of the first
- Edge case handling is not in the subtask list
- Error handling is treated as a separate subtask instead of integrated

## Verification

- [ ] Each subtask is atomic (one logical step)
- [ ] Subtasks are ordered logically
- [ ] Each subtask has a clear success condition
- [ ] Tests subtasks come before implementation subtasks
- [ ] Edge cases and error handling are included
- [ ] Implementation agent can follow the sequence without replanning
