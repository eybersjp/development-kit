---
name: verification-before-completion
description: >-
  Requires fresh evidence before claiming success. A task is not complete
  because the implementation agent says it is complete.
---

# Verification Before Completion

## Overview

Requires fresh evidence before claiming success. A task is not complete because the implementation agent says it is complete. The system must independently verify that the implementation works, the tests pass, the specification is satisfied, the code quality is acceptable, and the solution is appropriately simple.

## When to Use

- After each implementation task
- Before marking a task complete
- At the end of the full implementation cycle

## Process

### 1. Collect Evidence

Before any task can be marked complete, collect evidence for each gate:

**Gate 1: Functional Verification**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Browser/runtime tests pass
- [ ] Type checking passes
- [ ] Linting passes

**Gate 2: Specification Compliance**
- [ ] All acceptance criteria are satisfied
- [ ] All requirements are addressed
- [ ] Exclusions are respected
- [ ] No scope creep

**Gate 3: Code Quality**
- [ ] Code is correct and handles edge cases
- [ ] Code is readable and maintainable
- [ ] Error handling is appropriate
- [ ] Project conventions are followed
- [ ] No unnecessary complexity

**Gate 4: Security (conditional)**
- [ ] No security vulnerabilities introduced
- [ ] Input validation at trust boundaries
- [ ] Safe data handling

**Gate 5: Simplicity**
- [ ] No unnecessary code, abstractions, or dependencies
- [ ] Implementation does not exceed specification
- [ ] Native or standard library options preferred

### 2. Verify Independence

Ensure that verification was performed by:
- A review agent (not the implementation agent)
- The test suite (automated, repeatable)
- Type checking (static analysis)
- Runtime checks (where applicable)

### 3. Gate Decision

- **PASS**: All gates pass. Task is complete.
- **FAIL**: One or more gates fail. Task returns to implementation.
- **PASS WITH ISSUES**: Non-critical issues found. May proceed with agreement.

### 4. Document Completion

When a task passes all gates:
- List the verification evidence
- Note any non-critical issues
- Mark the task as complete
- Proceed to the next task

## Gate Summary

```yaml
task_completion:
  functional_verification: pass/fail
  specification_compliance: pass/fail
  code_quality: pass/fail
  security_review: pass/fail/skipped
  simplicity_review: pass/fail
  overall: pass/fail
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "The implementation agent said it works" | The implementation agent is not the verification agent. Show the evidence. |
| "I ran the tests, they pass" | That's functional verification. Also verify specification compliance, code quality, security, and simplicity. |
| "We don't need to check all the gates for a small change" | The gates scale with the change. Small changes need fewer gates. But each applicable gate must pass. |
| "The review was done informally during implementation" | Informal review is not the same as a structured gate pass. Run the gates. |

## Red Flags

- A task is marked complete without passing all applicable gates
- The implementation agent is the only source claiming completion
- Gates are skipped without justification
- Evidence is assumed rather than collected
- Review feedback is acknowledged but not addressed
- "We'll fix it later" is accepted as a pass condition

## Verification

- [ ] All applicable gates have been checked
- [ ] Verification evidence is documented
- [ ] A task is only complete when all gates pass
- [ ] The implementation agent is not the sole source of verification
- [ ] Next task does not begin until current task is complete
