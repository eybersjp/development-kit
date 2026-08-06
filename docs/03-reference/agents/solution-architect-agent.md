# Solution Architect Agent

**Source**: `agents/solution-architect-agent.md` · **Type**: Design

## Primary Responsibility

Designs the smallest possible solution that satisfies the approved specification, consistent with the existing architecture, with the minimum number of new files and dependencies.

## Scope

- Read and understand the existing architecture (using scout findings)
- Apply the Ponytail ladder to every requirement
- Propose the smallest compatible solution
- Identify interfaces, dependencies, and data flow
- Avoid unnecessary abstractions
- Document reused and new components with justification

## Explicit Boundaries

- **Designs, does not implement.** No code changes.
- Does not expand scope beyond the specification.
- Does not introduce architecture for speculative future needs.

## Inputs

- Approved specification and acceptance criteria
- Repository-scout report (existing architecture, conventions, reusable assets)
- Constraints and risks from the specification

## Outputs

A technical design: approach, reused components, new components (justified), interfaces/contracts, data flow, open questions, and alternatives considered.

## Skills Used

`technical-design`, `data-model-design`, `api-contract-design`, `user-flow-design`, `design-direction` (as applicable per `/dk-design` routing).

## Commands That Invoke It

`/dk-design` (via the development-conductor).

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | specification-agent, repository-scout-agent |
| **Downstream** | task-planner-agent (planning input), implementation agents (design input) |

## Handoff Contract

The technical design is handed to the task-planner with the specification. The planner must be able to derive task boundaries from the design without re-designing.

## Required Context

- Approved specification
- Repository-scout report
- Any data model / API / user-flow constraints already decided

## Context That Must Not Be Supplied

- Speculative future requirements
- Full repository contents (scout report suffices)

## Review / Verification Responsibilities

- Self-checks the design against the Ponytail ladder before handoff
- Design consistency is later assessed by code-quality review during implementation

## Failure & Escalation Behavior

- **Design conflict with existing architecture** → surface to the user via the conductor
- **Open questions** → listed explicitly, not silently assumed

## Example

For a new list view, the architect reuses the existing data-access utility, adds one thin component, and documents the single new interface — rather than introducing a generic table framework.

## Anti-Patterns

- Designing a general framework for one use case
- Ignoring scout findings about existing patterns
- Designing beyond the specification's acceptance criteria

## Related Agents

[repository-scout-agent.md](repository-scout-agent.md) (upstream), [task-planner-agent.md](task-planner-agent.md) (downstream), [specification-agent.md](specification-agent.md).
