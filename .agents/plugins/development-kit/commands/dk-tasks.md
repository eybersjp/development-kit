---
name: dk-tasks
description: >-
  Break the approved design into small, independently verifiable tasks ordered by dependency and risk, then deterministically validate the plan before approval.
---

# /dk-tasks

## Purpose

Produces the approved implementation PLAN. Human-readable planning remains required, but v0.9 also requires a machine-readable task model so task counts, dependencies, acceptance-criterion coverage, and resource ownership are computed rather than asserted in prose.

## Workflow

1. Read the approved specification, architecture, Design Authority where applicable, current explicit user decisions, and the persisted Development Mode snapshot.
2. Apply mode guidance to planning/test detail: Rapid stays concise, Balanced uses the normal plan, Spec-Driven strengthens specification/contract traceability, Doc-Driven uses comprehensive planning/document maintenance, and Maintenance & Evolution requires repository audit/impact evidence. No mode may remove deterministic PLAN validation or required controls.
3. Spawn the `task-planner-agent` and decompose work into bounded tasks with stable IDs.
4. For every task define objective, requirements, exclusions, acceptance criteria, verification, `dependsOn`, and owned persistence/migration/resources where applicable.
5. Order by hard dependency and risk. Do not invent a dependency diagram independently of the task data.
6. Build the PLAN validation payload containing `tasks`, `declaredTaskCount`, `declaredDependencyEdges`, `requiredResources`, and `requiredAcceptanceCriteria`.
7. Run `node scripts/orchestration.mjs --operation=plan-validate --input-file=<payload>`.
8. If validation reports any issue, correct the canonical PLAN and validate again. Never claim PLAN consistency from prose alone.
9. Present the validated PLAN for the normal Product Owner approval gate.

## Deterministic PLAN Gates

The runtime must reject or surface:
- declared task count different from actual task count;
- duplicate or missing task IDs/dependencies;
- dependency cycles;
- dependency diagram mismatch;
- isolated orphan tasks where applicable;
- required persistence/resource with no owner;
- one resource owned by multiple implementation tasks;
- required acceptance criterion not mapped to a task.

## Canonical Amendment Rule

When Product Owner feedback amends an existing PLAN, do not regenerate the previous stage blindly. Read the canonical artifact, capture its fingerprint, apply only the requested delta with `node scripts/orchestration.mjs --operation=reconcile`, read it back, verify the delta, record the new fingerprint, and run PLAN validation again.

## Skills Activated

- `task-decomposition`
- `subtask-decomposition`
- `dependency-ordering`
- `risk-first-planning`
- `task-readiness-check`

## Sub-Agents

- `task-planner-agent`

## Output

A human-readable approved PLAN plus a deterministically validated machine-readable task model. Validation results are evidence; planner claims are not authority.
