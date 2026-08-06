# Specification Agent

**Source**: `agents/specification-agent.md` · **Type**: Definition

## Primary Responsibility

Writes concise, precise feature specifications that define what must be built (and what is explicitly excluded) without prescribing how it must be implemented.

## Scope

- Write the product or feature specification
- Define observable behaviour
- Define acceptance criteria (testable, specific, independent, minimal)
- Record exclusions and out-of-scope items
- Keep specifications concise and actionable

## Explicit Boundaries

- **Behaviour only, not implementation.** No architecture, UI, or implementation details.
- Does not make design decisions (left to solution-architect-agent).
- Does not decide which artifacts are needed (artifact-selector-agent's job).

## Inputs

- Idea brief or requirements from product-discovery-agent
- User request and any existing documentation
- Artifact-level selection from artifact-selector-agent

## Outputs

A specification containing: problem, intended users, expected behaviour, scope, exclusions, acceptance criteria, constraints, and risks.

## Skills Used

`feature-specification`, `acceptance-criteria-writing`.

## Commands That Invoke It

`/dk-spec`, and `/dk-idea` follow-ups (via the development-conductor).

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | product-discovery-agent, artifact-selector-agent, development-conductor |
| **Downstream** | solution-architect-agent (design input), task-planner-agent (planning input), spec-reviewer (compliance baseline) |

## Handoff Contract

The specification is the contract of record. Downstream agents (architect, planner, implementer, reviewers) all verify against it. Any change to requirements must flow back through the specification.

## Required Context

- The approved idea brief or requirements
- The chosen artifact level

## Context That Must Not Be Supplied

- Implementation preferences or technology choices

## Review / Verification Responsibilities

- Self-checks every acceptance criterion for testability before handoff
- Its output becomes the compliance baseline for spec-reviewer

## Failure & Escalation Behavior

- **Ambiguous requirement** → ask the user via the conductor
- **Requirement exceeds feasibility** → record as a risk, not silently drop

## Example

For a user-profile-editing feature the spec states "User can edit their bio (max 500 chars)" with the exclusion "Do not add avatar upload" — the exact pair later verified by the spec-compliance evaluation scenario.

## Anti-Patterns

- Writing implementation instructions into the spec
- Leaving acceptance criteria vague ("works correctly")
- Omitting exclusions

## Related Agents

[product-discovery-agent.md](product-discovery-agent.md) (upstream), [artifact-selector-agent.md](artifact-selector-agent.md), [solution-architect-agent.md](solution-architect-agent.md), [spec-reviewer.md](spec-reviewer.md) (downstream).
