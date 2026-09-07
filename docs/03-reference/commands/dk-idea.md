# /dk-idea

**Source**: `commands/dk-idea.md` ? **Lifecycle Stage**: UNDERSTAND

## Purpose

Takes a rough idea and refines it into a concrete, well-defined concept. Runs the full idea discovery process: requirements interview, idea challenge, scope definition, structured suggestion identification, numbered decision menu presentation, and documentation.

## Interaction Principle

> **Commands start capabilities. Numbers control decisions.**

Whenever Development Kit requires a bounded Product Owner decision, prefer a numbered decision interface instead of requiring the user to type or repeat an instruction.

## When to Use

- You have a vague feature request or problem statement.
- Requirements are undefined or ambiguous.
- You want to validate whether a feature is worth building and discover bounded suggestions.

## When NOT to Use

- You already have a written specification ? use `/dk-spec` instead.
- The request is a trivial, one-line fix ? document the change and proceed directly.

## Preconditions

- A user request or rough idea exists.
- No specification document is required yet.

## Workflow

1. **Understand**: Read the user's request. Identify clearly stated facts and ambiguities.
2. **Requirements Interview & Design System Discovery**: Spawn `product-discovery-agent` to surface requirements, constraints, and assumptions via sequential numbered-option questions and check for UI reference assets.
3. **Idea Challenge & Structured Suggestions**: Test whether this is the real problem. Identify structured suggestions (`IDEA-SUG-001`, etc.) with stable IDs, title, description, rationale, impact, effort, recommended scope, and state (`PENDING`, `ACCEPTED`, `DEFERRED`, `REJECTED`).
4. **Dynamic Numbered Suggestion Decision Menu**: Present suggestions and generate bounded options with recommended option clearly labeled.
5. **Deterministic Decision Resolution**: Resolve Product Owner numeric responses deterministically against the persisted active menu.
6. **Canonical Artifact Promotion & Lineage**: Accepted suggestions are promoted into `docs/01-concept/idea-brief.md`; deferred items are placed in future scope; rejections are recorded with authority to prevent re-proposing. Lineage is tracked from suggestion to downstream requirements.
7. **Routing**: New projects proceed forward (`/dk-spec`); existing projects undergo impact analysis and canonical reconciliation without restarting.
8. **Artifact Selection & Idea Brief**: Spawn `artifact-selector-agent` to finalize the idea brief.

## Skills Invoked

| Skill | Role |
| :--- | :--- |
| `idea-discovery` | Primary ? turns rough idea into concept |
| `requirements-interview` | Surfaces requirements via focused questions |
| `idea-challenge` | Tests whether solution solves real problem |
| `scope-definition` | Defines must/should/could/excluded items |
| `adaptive-artifact-planning` | Conditional ? determines minimum artifact level |

## Agents Invoked

- `product-discovery-agent` (primary)
- `artifact-selector-agent` (conditional)

## Outputs

An idea brief document containing: problem statement, intended users, success criteria, requirements, assumptions, constraints, risks, open questions, and recorded suggestion decisions.

## Example

```text
Suggestions Identified
1. Offline-first support
   Reason: Site users may operate with unreliable connectivity.
   Recommended scope: Must Have
2. Audit logging
   Reason: Important system actions should be traceable.
   Recommended scope: Should Have
3. Advanced analytics
   Reason: Useful but not required for the initial release.
   Recommended scope: Could Have

Decision Required
1. Accept 1 & 2; defer 3 ? Recommended
2. Accept all suggestions
3. Defer all suggestions
4. Custom response

Reply with 1, 2, 3, or 4.

User: 1
? Resolved Option 1: Offline-first support & Audit logging promoted to canonical scope; Advanced analytics deferred.
```

## Related Commands

- `/dk-spec` ? next step after idea brief is approved
- `/dk-status` ? check current lifecycle stage
