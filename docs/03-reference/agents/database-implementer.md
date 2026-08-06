# Database Implementer

**Source**: `agents/database-implementer.md` · **Type**: Implementation (specialist fresh sub-agent)

## Primary Responsibility

Specialist implementation agent for database tasks: data models, migrations, queries, and data-access layers — correct, safe, and well-tested.

## Scope

- Implement data models and schemas
- Create and modify database migrations (reversible)
- Implement queries and data access
- Ensure data integrity and validation at the database level
- Optimise query performance for expected data volumes
- Follow the approved specification and design

## Explicit Boundaries

- Same fresh-sub-agent discipline: one task per instance
- **No destructive actions without confirmation** — dropping columns or tables requires explicit approval
- No SQL injection (parameterised queries only)
- Does not change the data model design without escalation

## Inputs

- Task, specification, data model design, and repository-scout findings (from the conductor)

## Outputs

Implemented database files (models, migrations, data-access code) plus the standard completion report.

## Skills Used

`subagent-driven-implementation`, `test-driven-development`, `existing-code-first`, `native-platform-first`, `dependency-restraint`, `minimal-diff`, `data-model-design` (compliance with the design).

## Commands That Invoke It

`/dk-build`, `/dk-build-auto` (for database tasks).

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | development-conductor, solution-architect-agent (data model design) |
| **Downstream** | test-engineer, spec-reviewer, code-reviewer, security-reviewer (conditional) |

## Handoff Contract

Returns migrations (with rollback), models, and data-access code with test results. Review gates decide completion.

## Required Context

- Task package with the data model design
- Migration conventions and ORM/query patterns (from scout findings)

## Context That Must Not Be Supplied

- Non-database task details

## Review / Verification Responsibilities

- Verifies migration idempotency and reversibility
- Verifies parameterised queries and data integrity constraints

## Failure & Escalation Behavior

- **Irreversible change needed** → escalate for explicit approval
- **Query performance risk** → flag expected data-volume concerns

## Example

For a registration feature, the database implementer creates the user schema with a unique constraint on email, an index, and a reversible migration — per the subagent-driven-implementation evaluation's database task scope.

## Anti-Patterns

- Unparameterised queries
- Irreversible migrations without rollback
- Dropping tables without confirmation
- Adding indexes speculatively

## Related Agents

[implementation-agent.md](implementation-agent.md) (generic form), [backend-implementer.md](backend-implementer.md), [solution-architect-agent.md](solution-architect-agent.md), [security-reviewer.md](security-reviewer.md).
