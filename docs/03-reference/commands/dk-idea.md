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

1. **Understand & Capture**: Capture initial requirements and open questions with provenance (`USER_STATED`, `AI_PROPOSED`, `ASSUMED`, `RESEARCH_DERIVED`) into `.development-kit/idea/discovery.json`.
2. **Requirements Interview**: Present sequential one-question-per-turn interactions (`idea-present-interaction`). Resolve questions via `idea-resolve-question` bound to `expectedInteractionFingerprint`.
3. **Design System Setup**: For UI projects, present `DESIGN_SYSTEM_SETUP` to capture visual preferences (`idea-design-setup`) into `.development-kit/design-system-state.json`.
4. **Idea Challenge**: Run dedicated assumption-testing turn (`idea-challenge-response`).
5. **Requirement Confirmation Turn**: Present exact candidate requirements table. Product Owner confirms via `idea-confirm-candidate` or `idea-adopt-candidate`, creating immutable PODs.
6. **Scope Confirmation Turn**: Present complete proposed scope mapping. Product Owner confirms via `idea-classify-scope`, generating `SCOPE_CLASSIFICATION` PODs.
7. **Canonical Idea Brief**: Document output adhering strictly to the 10 canonical sections matching `templates/idea-brief.md`, persisted via `idea-persist`.
8. **Explicit Approval Gate**: Request Product Owner approval (`idea-approve`), binding the 4-tuple approval to artifact revision, fingerprint, and discovery state.

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

A canonical project-local `idea-brief.md` document registered in `.development-kit/artifacts.json` with computed lifecycle state (`APPROVED`).

## Completion Criteria

- Requirements have been surfaced, confirmed by Product Owner, and persisted with immutable POD evidence.
- Scope is explicitly defined and confirmed by Product Owner.
- Canonical `idea-brief.md` is registered and approved by Product Owner (`APPROVED` state).
- `/dk-spec` gate unlocks only after `APPROVED` state is reached.

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
