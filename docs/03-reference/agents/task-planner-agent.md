# Task Planner Agent

**Source**: `agents/task-planner-agent.md` · **Type**: Planning

## Primary Responsibility

Breaks the approved solution into small, independently verifiable tasks, orders them by dependency and risk, and defines verification for every task.

## Scope

- Break the solution into tasks (one logical unit of work each)
- Break tasks into atomic, ordered subtasks
- Order tasks: foundation first, risky before cosmetic, dependencies before dependents
- Define verification (unit, integration, browser, type check, lint) per task
- Keep tasks small (hours of work, not days)
- Ensure every task is independently verifiable

## Explicit Boundaries

- **Plans only.** Does not implement.
- Does not redefine scope or the specification.
- Does not create tasks that cannot be independently verified.

## Inputs

- Approved specification and technical design
- Repository-scout report (file locations, dependencies)
- Risk and dependency information

## Outputs

A task plan: execution order, and per task — objective, dependencies, risk level, relevant files, requirements, exclusions, subtasks, acceptance criteria, required verification, and review sequence.

## Skills Used

`task-decomposition`, `subtask-decomposition`, `dependency-ordering`, `risk-first-planning`, `task-readiness-check`.

## Commands That Invoke It

`/dk-tasks` (via the development-conductor).

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | solution-architect-agent, specification-agent, repository-scout-agent |
| **Downstream** | implementation-agent (per task, via the conductor), test-engineer (verification definitions) |

## Handoff Contract

Each task in the plan is independently executable by a fresh implementation agent. The conductor selects the next uncompleted task; the plan defines its full contract (requirements, exclusions, acceptance criteria, verification).

## Required Context

- Approved design and specification
- Repository-scout findings
- Risk-first and dependency-ordering inputs

## Context That Must Not Be Supplied

- Unapproved features
- Implementation instructions that belong inside tasks

## Review / Verification Responsibilities

- Runs `task-readiness-check` on every task before it leaves the plan
- Task acceptance criteria become the compliance baseline for spec-review

## Failure & Escalation Behavior

- **Task too large** → re-decompose into subtasks
- **Undefined verification path** → add one before the task is approved

## Example

For a user-registration API endpoint, the planner produces 3–7 ordered tasks (validation, duplicate check, password hashing, token generation) each with acceptance criteria and verification types.

## Anti-Patterns

- Tasks that take days to complete
- Tasks without acceptance criteria or verification
- Ordering cosmetic work before risky foundation work

## Related Agents

[solution-architect-agent.md](solution-architect-agent.md) (upstream), [implementation-agent.md](implementation-agent.md) (downstream), [test-engineer.md](test-engineer.md).
