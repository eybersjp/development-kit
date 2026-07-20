---
name: task-completion-gate
description: >-
  Defines the gate that every task must pass before it is considered complete.
  A task passes only when acceptance criteria pass, tests pass, spec review
  passes, code review passes, and simplification review passes.
---

# Task Completion Gate

## Overview

Defines the gate that every task must pass before it is considered complete. A task is not complete because the implementation agent says it is complete. The task passes only when all gates have been independently verified.

## When to Use

- After each implementation task
- After code review and simplification
- Before marking a task as complete
- Before starting the next task

## Process

### 1. Verify Each Gate

The task passes through five gates. Each gate must be independently verified:

**Gate 1: Acceptance Criteria**
- [ ] All acceptance criteria from the task are satisfied
- [ ] Each criterion is demonstrably met (test or observation)
- [ ] No criteria are partially satisfied

**Gate 2: Functional Verification**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Browser tests pass (if applicable)
- [ ] Type checking passes
- [ ] Linting passes

**Gate 3: Specification Compliance Review**
- [ ] Spec review passed
- [ ] No scope creep identified
- [ ] Exclusions respected

**Gate 4: Code Quality Review**
- [ ] Code review passed
- [ ] No critical or unresolved major issues
- [ ] Code follows project conventions

**Gate 5: Simplicity Review**
- [ ] Simplicity review passed
- [ ] No unnecessary code, abstractions, or dependencies
- [ ] Implementation does not exceed specification

### 2. Determine Gate Verdict

- **PASS**: All gates pass. Task is complete.
- **FAIL**: One or more gates fail. Task returns to implementation.
- **PASS WITH NOTES**: All gates pass but non-critical observations exist. Task is complete.

### 3. Record Completion

When a task passes all gates:
- Record the gate results
- Note any non-critical observations
- Update task status to complete
- Proceed to the next task

## Gate Decision Matrix

```yaml
task_completion_gate:
  acceptance_criteria: pass/fail
  functional_verification: pass/fail
  specification_compliance: pass/fail
  code_quality: pass/fail
  simplicity: pass/fail
  overall: pass/fail
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "The task is done, the code is working" | Working code that hasn't been reviewed is not done. Run the gates. |
| "Some gates are not relevant to this small task" | Scale the gates to the task. If a gate is relevant, it must pass. |
| "The spec review passed, that's enough" | Spec compliance ensures you built the right thing. Code quality and simplicity ensure you built it well. |
| "We can skip the simplicity review, the code is simple" | If it's already simple, the simplicity review will confirm it quickly. Don't skip. |

## Red Flags

- Tasks are marked complete without passing all gates
- Gates are skipped without documented justification
- The implementation agent is the sole source of completion claims
- "We'll fix it later" is accepted as a pass condition
- Acceptance criteria are marked as "partially met"
- Review findings are acknowledged but not addressed

## Verification

- [ ] All five gates have been checked
- [ ] Each gate independently verified (not by the implementation agent)
- [ ] Acceptance criteria are fully satisfied (not partially)
- [ ] No critical or major issues remain from reviews
- [ ] Task is only marked complete when all gates pass
