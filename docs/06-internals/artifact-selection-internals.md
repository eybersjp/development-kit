# Artifact Selection Internals

## Operating Model

The artifact-selector (`agents/artifact-selector-agent.md`, skill `adaptive-artifact-planning`) classifies work into **three levels** and selects the minimum artifact set.

## Level Model

| Level | Scale Signals | Artifact Set |
| :--- | :--- | :--- |
| `small` | Few files, low risk, clear requirements | Task brief, 2–3 acceptance criteria, test case |
| `standard` | Multiple components, some uncertainty | Feature spec, brief design, task plan (3–7 tasks), acceptance criteria, test plan |
| `comprehensive` | Large scope, many stakeholders, high risk | Idea brief, PRD, journeys, architecture, data model, API contracts, security considerations, design direction, roadmap, task plan, test strategy |

## Decision Inputs

- Files changed
- Risk (could it break existing functionality?)
- Uncertainty (how well understood?)
- Stakeholders (how many affected?)
- Complexity

## Selection Rule

**Minimum required documents for the level — nothing more.** The selector explicitly lists "not required" documents with reasons.

## Integration

- Runs at the DEFINE stage (before `/dk-spec`).
- Output feeds the specification-agent (which documents to produce).
- Prevents the "fifteen documents for a two-file change" failure mode.

## Failure Behavior

- High-uncertainty requests default to `standard` with uncertainty flagged.
- Scale unclear → ask the conductor for clarification.
