---
name: task-decomposition
description: >-
  Breaks approved specifications into small, independently verifiable tasks
  and subtasks. Orders by dependency and risk. Keeps tasks small.
compatibility: opencode
---

# Task Decomposition

## Overview

Breaks solution specifications into small, independently verifiable tasks. Each task should represent one logical unit of work, be implementable by a fresh sub-agent, and have clear acceptance criteria. Tasks are ordered by dependency and risk (risky work first).

## When to Use

- After the solution design is approved
- Before any implementation begins
- When a task turns out to be larger than expected and needs further breakdown

## Process

### 1. Understand the Design
Read the approved specification and technical design.

### 2. Identify Task Boundaries
Look for natural separation points:
- Different components or modules
- Different layers (data, logic, presentation)
- Different concerns (validation, storage, display)
- Different test scopes
- Different expertise requirements (frontend, backend, database)

### 3. Break Into Tasks
Each task should:
- Represent one logical unit of work
- Be implementable by a fresh sub-agent
- Be independently verifiable (has its own acceptance criteria)
- Take hours, not days
- Have clearly defined scope and exclusions

### 4. Order Tasks
Arrange tasks so that:
- Foundation work comes first (schema, models, core logic)
- Riskier work comes before cosmetic work
- Dependencies are satisfied before dependent tasks
- Each task builds on completed previous tasks

### 5. Add Subtasks
For each task, break into atomic steps:
1. Write failing test
2. Implement minimum code to pass
3. Refactor
4. Run verification
5. Commit

### 6. Define Verification for Each Task
Specify for each task:
- **Type of verification**: Unit tests, integration tests, browser tests, type checking, linting
- **Review gate**: Specification compliance, code quality, or both

## Task Template

```markdown
# Task NN: [Action] [Component]

## Objective
[One sentence]

## Context
[Brief description of relevant existing code and patterns]

## Relevant Files
- `path/to/file1.ts` — [what it does]
- `path/to/file2.ts` — [what it does]

## Requirements
- [Specific requirement]
- [Specific requirement]

## Exclusions
- [What is explicitly not part of this task]

## Subtasks
1. [Atomic step]
2. [Atomic step]
3. [Atomic step]

## Acceptance Criteria
- [ ] [Testable criterion]
- [ ] [Testable criterion]

## Required Verification
- [Type of verification needed]

## Review Sequence
1. Specification compliance
2. Code quality
3. [Optional] Specialist review
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "This task is simple enough, I'll just do it all at once" | If it's simple, it's easy to break down. Do it. |
| "Breaking into tasks takes too long" | A few minutes of decomposition saves hours of rework. |
| "I'll figure out the tasks as I go" | That leads to unstructured work, scope creep, and missed dependencies. |
| "The task is too small to break down further" | A task with a single concern is fine. The goal is independent verifiability. |

## Red Flags

- Tasks that take more than a day to implement
- Tasks that can't be independently tested
- Tasks that mix frontend and backend concerns
- Dependencies between tasks that aren't explicit
- Tasks that don't match the approved design
- Risky work is scheduled last instead of first
- Verification is not specified for each task

## Verification

- [ ] Each task represents one logical unit of work
- [ ] Each task is independently verifiable
- [ ] Tasks are ordered by dependency and risk
- [ ] Verification is specified for each task
- [ ] Exclusions are clear for each task
- [ ] The total task set covers the full specification
