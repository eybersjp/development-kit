# /dk-spec

**Source**: `commands/dk-spec.md` · **Lifecycle Stage**: DEFINE

## Purpose

Creates the minimum required specification artifacts for an approved concept. Produces a feature specification with acceptance criteria, explicit exclusions, and a test strategy.

## When to Use

- An idea brief has been approved.
- You need a feature specification before design begins.

## When NOT to Use

- The idea has not been validated — use `/dk-idea` first.
- The request is trivial and requires no formal specification.

## Preconditions

- An approved idea brief or equivalent concept document exists.

## Workflow

1. **Artifact Selection**: `artifact-selector-agent` determines minimum artifact set (small/standard/comprehensive).
2. **Feature Specification**: `specification-agent` creates the feature specification using `feature-spec.md` template.
3. **Acceptance Criteria**: Writes observable, testable conditions using `acceptance-criteria-writing`.
4. **Scope Boundaries**: Explicit must-have, should-have, could-have, and excluded items documented.
5. **Test Strategy**: Maps acceptance criteria to test levels (unit, integration, browser).

## Skills Invoked

| Skill | Role |
| :--- | :--- |
| `feature-specification` | Primary — creates concise, precise specification |
| `acceptance-criteria-writing` | Converts requirements to testable conditions |
| `test-strategy` | Defines how the feature will be proven correct |
| `adaptive-artifact-planning` | Selects minimum required document set |
| `scope-definition` | Enforces explicit exclusion boundaries |

## Agents Invoked

- `specification-agent` (primary)
- `artifact-selector-agent` (conditional)

## Outputs

- Feature specification document
- Acceptance criteria list
- Test strategy outline
- Explicit exclusions list

## Completion Criteria

- Specification is approved by the user.
- Every requirement has at least one observable acceptance criterion.
- Exclusions are documented explicitly.

## Example

```text
Idea brief: "Dark mode toggle in admin settings"

/dk-spec →
  Produces feature-spec.md:
  - Must: toggle in settings panel, persist preference in localStorage
  - Must not: affect email templates or PDF exports
  - Acceptance: toggle renders, preference persists across refresh
```

## Related Commands

- `/dk-idea` — previous step
- `/dk-design` — next step after approval
