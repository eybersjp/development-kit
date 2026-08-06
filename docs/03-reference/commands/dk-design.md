# /dk-design

**Source**: `commands/dk-design.md` · **Lifecycle Stage**: DESIGN

## Purpose

Produces technical and visual design including data models, API contracts, user flows, and design direction.

## When to Use

- A feature specification has been approved.
- Architecture or interface decisions need to be made explicit before implementation.

## When NOT to Use

- No specification exists — use `/dk-spec` first.
- The task is trivially simple with no design decisions.

## Preconditions

- An approved feature specification exists.

## Workflow

1. **Repository Orientation**: `repository-scout-agent` inspects existing architecture and patterns.
2. **Technical Design**: `solution-architect-agent` produces implementation-oriented design using `technical-design.md`.
3. **Data Model**: If persistent data changes are required, `data-model-design` produces schemas and migrations.
4. **API Contracts**: If APIs or module boundaries are changing, `api-contract-design` defines stable interfaces.
5. **User Flow**: For UI tasks, `user-flow-design` maps user journeys including edge cases.
6. **Design Direction**: For UI tasks, `design-direction` defines visual language and aesthetic choices.

## Skills Invoked

| Skill | Role |
| :--- | :--- |
| `technical-design` | Primary — implementation-oriented design document |
| `data-model-design` | Conditional — only if persistent data changes required |
| `api-contract-design` | Conditional — only if APIs/module boundaries changing |
| `user-flow-design` | Conditional — only for UI/UX tasks |
| `design-direction` | Conditional — only for visual UI tasks |

## Agents Invoked

- `solution-architect-agent` (primary)
- `repository-scout-agent` (supporting)

## Outputs

- Technical design document
- Data model / schema (conditional)
- API contract (conditional)
- User flow diagram (conditional)
- Design direction document (conditional)

## Completion Criteria

- Design is approved by the user before `/dk-tasks` begins.
- All architecture decisions are documented.

## Related Commands

- `/dk-spec` — previous step
- `/dk-tasks` — next step after approval
