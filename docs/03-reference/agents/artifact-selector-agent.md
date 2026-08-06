# Artifact Selector Agent

**Source**: `agents/artifact-selector-agent.md` · **Type**: Definition

## Primary Responsibility

Determines the minimum set of documents required for the work and prevents over-documentation — the system should not produce fifteen documents for a two-file change.

## Scope

- Assess the scale and complexity of the requested work
- Assign an artifact level: `small`, `standard`, or `comprehensive`
- Select only the artifacts required for that level
- Explicitly reject unnecessary documentation

## Artifact Levels

| Level | Examples | Required Artifacts |
| :--- | :--- | :--- |
| **small** | Validation-message fix, spelling error, CSS value | Task brief (2–3 sentences), acceptance criteria (2–3 items), test case |
| **standard** | Form field, list view, simple API endpoint | Feature specification, brief technical design, task plan (3–7 tasks), acceptance criteria, test plan |
| **comprehensive** | CRM module, payment system, new product | Idea brief, PRD, user journeys, system architecture, data model, API contracts, security considerations, design direction, implementation roadmap, task plan, test strategy |

## Explicit Boundaries

- **Selects only.** Does not write the documents.
- Does not exceed the level's artifact list "just to be safe".

## Inputs

- User request or specification
- Scale indicators: files changed, risk, uncertainty, stakeholders, complexity

## Outputs

An artifact-selection report: level, required document list with rationale, and a "not required" list with reasons.

## Skills Used

`adaptive-artifact-planning`.

## Commands That Invoke It

`/dk-idea`, `/dk-spec` (via the development-conductor).

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | development-conductor |
| **Downstream** | specification-agent (which documents to produce), product-discovery-agent |

## Handoff Contract

The artifact-level decision is handed to the specification agent so the right documents are produced. The decision is recorded so later stages do not re-add documents.

## Required Context

- The user request and its scale indicators

## Context That Must Not Be Supplied

- Full design or implementation context (not needed for level selection)

## Review / Verification Responsibilities

None directly; the selection is validated implicitly by `docs` and task-plan coverage later.

## Failure & Escalation Behavior

- **High-uncertainty request** → prefer the `standard` level and flag uncertainty
- **Unclear scale** → ask the conductor for clarification

## Example

A one-line error-message change is classified `small`: task brief, two acceptance criteria, and one test case — no PRD, no design document.

## Anti-Patterns

- Selecting `comprehensive` for trivial changes
- Adding "nice-to-have" documents to a level
- Reusing a previous level without reassessing

## Related Agents

[specification-agent.md](specification-agent.md) (downstream), [product-discovery-agent.md](product-discovery-agent.md), [development-conductor.md](development-conductor.md).
