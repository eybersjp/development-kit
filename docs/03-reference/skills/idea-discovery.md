# idea-discovery

**Source**: `skills/idea-discovery/SKILL.md` · **Category**: Idea & Definition · **Compatibility**: `opencode`

## Purpose

Turns a rough idea into a concrete, well-defined concept. Used when the user has a vague request, a problem to solve, or an unrefined feature concept.

## Lifecycle Category

UNDERSTAND.

## Trigger Conditions

- Vague idea, problem statement, or unrefined feature concept
- `/dk-idea` invocation

## When Not to Invoke

- When the idea is already concrete and the requirements are clear (go straight to definition)

## Required Inputs

- The user's rough idea or problem statement

## Preconditions

- None

## Procedure

1. Clarify the problem being solved.
2. Identify intended users.
3. Test assumptions (does this need to exist at all?).
4. Define success criteria.
5. Categorise requirements vs preferences vs assumptions vs constraints.
6. Produce the idea brief.

## Outputs

An idea brief: problem, intended users, success criteria, requirements, preferences, assumptions, constraints, risks, open questions.

## Invariants

- Does not proceed to implementation.
- Does not assume implementation details.

## Dependencies

None.

## Related Agents

product-discovery-agent (primary).

## Related Commands

`/dk-idea` (primary).

## Verification Requirements

- [ ] Output sections present (problem, users, success criteria, requirements, assumptions)
- [ ] No implementation details assumed

## Failure Behavior

- Unclear answers trigger `requirements-interview` and `idea-challenge`.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

"I want to add a way for users to share things" → the agent asks what problem is being solved, who will use it, and what should be shareable before producing the brief (per `evals/idea-discovery/scenario-01-vague-request.json`).

## Anti-Patterns

- Jumping to implementation from a vague request
- Assuming implementation details

## Maintenance Notes

Evaluated by `evals/idea-discovery/`.
