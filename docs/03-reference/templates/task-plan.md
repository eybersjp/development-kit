# task-plan

**Source**: `templates/task-plan.md` · **Frontmatter**: `name: task-plan`

## Intended Lifecycle Stage

PLAN.

## Intended User / Agent

task-planner-agent (output of `/dk-tasks`).

## Purpose

Breaks work into small, verifiable tasks: execution order and per-task objective, dependencies, risk, relevant files, requirements, exclusions, subtasks, acceptance criteria, verification, and review sequence.

## Required Sections

Execution Order · Per task: Objective · Dependencies · Risk Level · Relevant Files · Requirements · Exclusions · Subtasks · Acceptance Criteria · Required Verification · Review Sequence

## Optional Sections

None.

## How the Template Is Selected

Standard artifact level; selected by adaptive-artifact-planning.

## How It Should Be Completed

- Tasks small (hours, not days)
- Each task independently verifiable
- Subtasks atomic and ordered (tests first where behaviour changes)
- Dependencies between tasks explicit

## Validation Expectations

- Every task has acceptance criteria and verification (matches `hooks/before-task.js` validation)
- Execution order respects dependencies (dependency-ordering)
- Risky tasks before cosmetic (risk-first-planning)

## Related

[task-planner-agent](../agents/task-planner-agent.md), [task-decomposition](../skills/task-decomposition.md), [before-task](../hooks/before-task.md).
