# /dk-idea

**Source**: `commands/dk-idea.md` · **Lifecycle Stage**: UNDERSTAND

## Purpose

Takes a rough idea and refines it into a concrete, well-defined concept. Runs the full idea discovery process: requirements interview, idea challenge, scope definition, and documentation.

## When to Use

- You have a vague feature request or problem statement.
- Requirements are undefined or ambiguous.
- You want to validate whether a feature is worth building.

## When NOT to Use

- You already have a written specification — use `/dk-spec` instead.
- The request is a trivial, one-line fix — document the change and proceed directly.

## Preconditions

- A user request or rough idea exists.
- No specification document is required yet.

## Workflow

1. **Understand**: Read the user's request. Identify clearly stated facts and ambiguities.
2. **Requirements Interview**: Spawn `product-discovery-agent` to surface requirements, constraints, and assumptions via sequential numbered-option questions.
3. **Idea Challenge**: Test whether this is the real problem. Is a simpler approach available?
4. **Scope Definition**: Separate into must-have, should-have, could-have, and explicitly excluded.
5. **Artifact Selection**: Spawn `artifact-selector-agent` to determine minimum required artifact level.
6. **Idea Brief**: Document output using the `idea-brief.md` template.

## Skills Invoked

| Skill | Role |
| :--- | :--- |
| `idea-discovery` | Primary — turns rough idea into concept |
| `requirements-interview` | Surfaces requirements via focused questions |
| `idea-challenge` | Tests whether solution solves real problem |
| `scope-definition` | Defines must/should/could/excluded items |
| `adaptive-artifact-planning` | Conditional — determines minimum artifact level |

## Agents Invoked

- `product-discovery-agent` (primary)
- `artifact-selector-agent` (conditional)

## Outputs

An idea brief document containing: problem statement, intended users, success criteria, requirements, assumptions, constraints, risks, and open questions.

## Completion Criteria

- Requirements have been surfaced and documented.
- Scope is explicitly defined with exclusions.
- An idea brief or lightweight equivalent is produced.

## Example

```text
User: "I want to add dark mode to the admin dashboard."

/dk-idea →
  product-discovery-agent asks: "Who are the primary users? 
  Is this for accessibility, aesthetics, or both?"
  ...
  Outputs: idea-brief.md with scope: "Dark mode toggle in admin 
  settings. Excludes email templates and PDF exports."
```

## Related Commands

- `/dk-spec` — next step after idea brief is approved
- `/dk-status` — check current lifecycle stage
