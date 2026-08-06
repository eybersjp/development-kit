# subagent-driven-implementation

**Source**: `skills/subagent-driven-implementation/SKILL.md` · **Category**: Implementation · **Compatibility**: `opencode`

## Purpose

Dispatches a fresh implementation sub-agent for each task. Prevents assumption drift by creating new agents rather than reusing long-running ones.

## Lifecycle Category

IMPLEMENT.

## Trigger Conditions

- Every implementation task in `/dk-build` and `/dk-build-auto`
- Complex tasks that need sub-agent assignments (see evaluation)

## When Not to Invoke

- When implementation is not yet authorised (definition and design must precede)

## Required Inputs

- The task package (description, spec section, design section, scope, exclusions, acceptance criteria, tests, scout findings, restraint principles)

## Preconditions

- Task passed readiness check
- Specification and design approved

## Procedure

1. Prepare the task package with full context.
2. Spawn a **fresh** implementation sub-agent (or assign specialist sub-agents for complex tasks: database, backend, integration).
3. Each assignment has clear scope boundaries, acceptance criteria, exclusions, and verification.
4. Collect results; route through gates.

## Outputs

- A spawned fresh agent per task with a self-contained package

## Invariants

- **Fresh agent per task** — never reuse a long-running implementation agent.
- Every sub-assignment has acceptance criteria and verification.

## Dependencies

`context-packing`, `task-readiness-check`.

## Related Agents

development-conductor (dispatcher), implementation/frontend/backend/database-implementers (recipients).

## Related Commands

`/dk-build` (primary), `/dk-build-auto` (primary).

## Verification Requirements

- [ ] Fresh instance per task
- [ ] Task package self-contained

## Failure Behavior

- A failed task returns to implementation with a fresh agent and the failure evidence.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

Per `evals/subagent-driven-implementation/scenario-01-registration-flow.json`: a registration feature is assigned to at least 3 sub-agents (database schema, backend endpoint, email/verification integration), each with scope boundaries — never one agent for everything, and no frontend scope (not requested).

## Anti-Patterns

- Reusing one agent across tasks
- Assigning everything to a single agent
- Skipping acceptance criteria for any assignment

## Maintenance Notes

Evaluated by `evals/subagent-driven-implementation/`.
