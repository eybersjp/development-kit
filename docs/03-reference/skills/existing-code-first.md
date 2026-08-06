# existing-code-first

**Source**: `skills/existing-code-first/SKILL.md` · **Category**: Implementation · **Compatibility**: `opencode`

## Purpose

Searches the existing codebase for reusable code before writing new code. Prevents duplication and unnecessary new code.

## Lifecycle Category

IMPLEMENT.

## Trigger Conditions

- Before writing any new code
- As an implementation-restraint principle loaded for every task

## When Not to Invoke

- When the reuse search has already been done for the task (scout findings are current)

## Required Inputs

- The task requirements
- Repository-scout findings (reusable assets)

## Preconditions

- Scout findings available

## Procedure

1. Search for existing implementations of the required behaviour.
2. Search for utilities, helpers, and shared components.
3. Reuse or extend before writing new code.
4. Only create new code when reuse is genuinely not possible.

## Outputs

- Reuse decisions with justification for any new code

## Invariants

- Reuse before creation (Ponytail ladder step 3).
- Duplication is a review finding.

## Dependencies

`repository-orientation`.

## Related Agents

implementation agents (apply), repository-scout-agent (finds the reuse candidates).

## Related Commands

`/dk-build`, `/dk-build-auto` (supporting skill).

## Verification Requirements

- [ ] Reuse search documented
- [ ] New code justified

## Failure Behavior

- Missing a reusable asset is caught by code-quality review (duplication finding).

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

For a new list view, the agent reuses the existing data-access utility rather than writing a new one.

## Anti-Patterns

- Writing parallel implementations
- Skipping the search "because it's faster"

## Maintenance Notes

None specific.
