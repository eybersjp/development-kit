# adaptive-artifact-planning

**Source**: `skills/adaptive-artifact-planning/SKILL.md` · **Category**: Artifact · **Compatibility**: `opencode`

## Purpose

Selects the minimum set of documents required for the work. Prevents over-documentation — small changes should not produce fifteen documents.

## Lifecycle Category

DEFINE.

## Trigger Conditions

- Before any specification work
- When deciding which artifacts a task needs

## When Not to Invoke

- When the artifact set is already agreed

## Required Inputs

- The user request and scale indicators (files changed, risk, uncertainty, stakeholders, complexity)

## Preconditions

- The request exists

## Procedure

1. Assess scale and complexity.
2. Assign an artifact level: `small`, `standard`, or `comprehensive`.
3. Select only the artifacts required for that level.
4. Reject unnecessary documents with reasons.

## Outputs

An artifact-level decision and required-document list.

## Invariants

- Minimum required documents — never extra "just in case".
- Level reassessed per request, never blindly reused.

## Dependencies

None.

## Related Agents

artifact-selector-agent (primary).

## Related Commands

`/dk-spec` (primary).

## Verification Requirements

- [ ] Artifact level assigned
- [ ] Document list matches the level

## Failure Behavior

- High-uncertainty requests default to `standard` with the uncertainty flagged.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

A validation-message fix is `small` (brief + 2–3 criteria + one test); a payment system is `comprehensive` (PRD, architecture, data model, API contracts, roadmap, etc.).

## Anti-Patterns

- Selecting `comprehensive` for trivial changes
- Adding nice-to-have documents

## Maintenance Notes

Levels mirror `agents/artifact-selector-agent.md`.
