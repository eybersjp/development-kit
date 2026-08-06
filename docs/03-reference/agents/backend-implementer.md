# Backend Implementer

**Source**: `agents/backend-implementer.md` · **Type**: Implementation (specialist fresh sub-agent)

## Primary Responsibility

Specialist implementation agent for backend tasks: API endpoints, business logic, services, middleware, and data access — correct, well-tested, and following project conventions.

## Scope

- Implement API endpoints and routes
- Implement business logic and services
- Implement middleware and request handling
- Implement data access and persistence
- Ensure error handling and validation at trust boundaries
- Follow the approved specification and design

## Explicit Boundaries

- Same fresh-sub-agent discipline: one task per instance
- Does not add dependencies without justification
- Does not change API contracts decided in design

## Inputs

- Task, specification, technical design, and repository-scout findings (from the conductor)

## Outputs

Implemented backend files plus the standard completion report (files, acceptance-criteria status, test results, dependencies, open issues).

## Skills Used

`subagent-driven-implementation`, `test-driven-development`, `existing-code-first`, `native-platform-first`, `dependency-restraint`, `minimal-diff`, `api-contract-design` (compliance with contracts).

## Commands That Invoke It

`/dk-build`, `/dk-build-auto` (for backend tasks).

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | development-conductor, repository-scout-agent (findings) |
| **Downstream** | test-engineer, spec-reviewer, code-reviewer, security-reviewer (conditional) |

## Handoff Contract

Returns implemented code with local test results. Review gates decide completion.

## Required Context

- Task package with technical design and API contracts

## Context That Must Not Be Supplied

- Frontend task details

## Review / Verification Responsibilities

- Self-verifies error handling (no unhandled rejections), type safety, and boundary validation before reporting

## Failure & Escalation Behavior

- **Contract ambiguity** → escalate to the conductor
- **Input cannot be validated safely** → flag to security-reviewer via the conductor

## Example

For a registration endpoint task, the backend implementer validates input, checks duplicates, hashes the password before storage, and returns the documented error responses — matching the evaluation scenario's scope.

## Anti-Patterns

- Trusting unvalidated input at boundaries
- Logging sensitive data
- Adding a framework where native features suffice

## Related Agents

[implementation-agent.md](implementation-agent.md) (generic form), [frontend-implementer.md](frontend-implementer.md), [database-implementer.md](database-implementer.md), [security-reviewer.md](security-reviewer.md).
