# feature-specification

**Source**: `skills/feature-specification/SKILL.md` · **Category**: Artifact · **Compatibility**: `opencode`

## Purpose

Creates a concise, precise feature specification. Defines what must be built without prescribing how it must be implemented. Includes explicit exclusions.

## Lifecycle Category

DEFINE.

## Trigger Conditions

- Approved concept needs a specification
- `/dk-spec` invocation

## When Not to Invoke

- For trivial changes where a task brief suffices (see adaptive-artifact-planning)

## Required Inputs

- The approved idea brief and scope classification

## Preconditions

- The concept is approved

## Procedure

1. Write the problem (1–2 sentences) and intended users.
2. Define expected behaviour in observable terms.
3. List scope and explicit exclusions.
4. Write testable acceptance criteria.
5. Record constraints and risks.

## Outputs

A feature specification following the template (`templates/feature-spec.md`).

## Invariants

- Behaviour, not implementation.
- Exclusions explicit.
- Acceptance criteria testable.

## Dependencies

`scope-definition`, `acceptance-criteria-writing`.

## Related Agents

specification-agent (primary).

## Related Commands

`/dk-spec` (supporting skill).

## Verification Requirements

- [ ] Spec template sections present
- [ ] Acceptance criteria testable

## Failure Behavior

- Ambiguity is resolved before approval; risks are recorded, not hidden.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

The user-profile editing spec in `evals/specification-compliance-review/scenario-01-spec-compliance.json` is a direct example: 4 requirements, 2 exclusions, and later verified for compliance.

## Anti-Patterns

- Including implementation instructions
- Omitting exclusions

## Maintenance Notes

Template: `templates/feature-spec.md`.
