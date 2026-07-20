---
name: task-readiness-check
description: >-
  Verifies that a task is clear enough to implement. Prevents starting work
  on tasks that are ambiguous, incomplete, or missing acceptance criteria.
---

# Task Readiness Check

## Overview

Verifies that a task is clear enough to implement before a fresh sub-agent is spawned. Prevents wasted effort on tasks that are ambiguous, incomplete, or missing acceptance criteria.

## When to Use

- Before spawning a fresh implementation sub-agent
- When the task definition comes from an external source
- When the task seems incomplete or ambiguous
- During the build workflow, after the repository-scout has gathered context

## Process

### 1. Verify Task Completeness

Check that the task definition contains:
- [ ] **Objective**: A clear, single-sentence goal
- [ ] **Requirements**: Specific, actionable requirements
- [ ] **Exclusions**: What the task should not do
- [ ] **Acceptance criteria**: Observable conditions for completion
- [ ] **Scope boundaries**: Files to modify and files not to modify
- [ ] **Verification**: How the task will be tested

### 2. Verify Task Clarity

For each requirement and criterion, check:
- Is it specific enough to implement without guessing?
- Are terms defined and unambiguous?
- Are there referenced concepts the agent needs explained?
- Are there implicit assumptions that should be explicit?

### 3. Verify Dependencies

Check:
- Are all required dependencies (code, data, infrastructure) available?
- Are prerequisite tasks complete?
- Are any blockers documented?

### 4. Verify Testability

Check:
- Can each acceptance criterion be verified?
- Are test expectations clear?
- Are edge cases identified?

### 5. Make a Readiness Decision

- **READY**: Task is complete, clear, and actionable. Proceed with implementation.
- **NEEDS CLARIFICATION**: Task has gaps that need to be resolved before implementation.
- **BLOCKED**: Task depends on something that isn't ready yet.

### 6. Report Issues

If the task is not ready, document:
- What is missing or unclear
- What needs to happen to make it ready
- Who needs to provide the missing information

## Readiness Checklist

```
### Task Readiness Check
- [ ] Objective is clear
- [ ] Requirements are specific
- [ ] Exclusions are documented
- [ ] Acceptance criteria are testable
- [ ] Scope boundaries are defined
- [ ] Verification methods are specified
- [ ] Dependencies are available
- [ ] No ambiguous terms or concepts
- [ ] Edge cases are considered

### Verdict
[READY / NEEDS CLARIFICATION / BLOCKED]

### Issues
- [Issue 1]: [What needs to happen]
- [Issue 2]: [What needs to happen]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "The task looks fine, let's just start" | "Looks fine" isn't a readiness check. Run the checklist. |
| "The implementation agent will figure out the gaps" | Implementation agents shouldn't have to figure out gaps. They should implement. |
| "We can clarify during implementation" | Clarifying during implementation wastes the agent's context. Clarify before spawning. |
| "This task is urgent, we don't have time for a readiness check" | Urgent tasks need readiness checks more, not less. An unclear task will take longer. |

## Red Flags

- Tasks are assigned without a readiness check
- Acceptance criteria are vague or missing
- The task references concepts or code the agent won't understand
- Dependencies are not documented
- The task is too large (should be broken down further)
- "We'll figure it out as we go" is the plan

## Verification

- [ ] Task completeness is verified (objective, requirements, exclusions, criteria, scope, verification)
- [ ] Task clarity is verified (specific, unambiguous, no implicit assumptions)
- [ ] Dependencies are available or documented as blockers
- [ ] Acceptance criteria are testable
- [ ] A clear readiness verdict is reached
