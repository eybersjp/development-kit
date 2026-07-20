---
name: tasks
description: >-
  Break the approved design into small, independently verifiable tasks
  and subtasks ordered by dependency and risk. Uses the full planning
  skill suite to produce a rigorous, execution-ready task plan.
---

# /dk-tasks

## Purpose

Breaks the approved design into small, independently verifiable tasks ordered by dependency and risk. Each task is implementable by a fresh sub-agent. The full planning skill suite decomposes tasks into atomic subtasks, orders them by dependency, prioritises risky work, and validates task readiness before implementation begins.

## Workflow

### 1. Review Design
Read the approved specification and design.

### 2. Break Into Tasks
Spawn the **task-planner-agent** to identify natural task boundaries:
- One logical unit of work per task
- Independently verifiable
- Clear acceptance criteria

### 3. Break Tasks Into Subtasks
Break each task into atomic, ordered subtasks:
- TDD first: failing tests before implementation
- Core logic before edge cases
- Each subtask independently testable

### 4. Order by Dependency and Risk
- Hard dependencies first (tasks others depend on)
- Riskiest work before cosmetic work (risk-first planning)
- Parallel tasks identified where possible

### 5. Validate Task Readiness
Before finalising the plan, verify each task is clear enough to implement:
- Objective is specific
- Requirements are actionable
- Acceptance criteria are testable
- Scope boundaries are defined

### 6. Define Verification
For each task, specify:
- Type of verification (unit, integration, browser, type check, lint)
- Review gate (spec compliance, code quality, or both)

### 7. Present for Approval
Show the task plan to the user for approval before implementation begins.

## Skills Activated

Primary:
- `task-decomposition` — Breaks approved designs into small, verifiable tasks

Supporting:
- `subtask-decomposition` — Breaks each task into atomic, ordered steps
- `dependency-ordering` — Determines correct execution order based on dependencies
- `risk-first-planning` — Prioritises risky or uncertain work before safe work
- `task-readiness-check` — Verifies each task is clear enough to implement

## Sub-Agents

- task-planner-agent (primary)

## Output

A task plan with:
- Tasks ordered by dependency and risk
- Each task includes: objective, requirements, exclusions, subtasks, acceptance criteria, verification
- Subtask decomposition for each task
- Readiness check for each task
