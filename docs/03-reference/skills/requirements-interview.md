# requirements-interview

**Source**: `skills/requirements-interview/SKILL.md` · **Category**: Idea & Definition · **Compatibility**: `opencode`

## Purpose

Asks focused questions to surface requirements, preferences, assumptions, and constraints. Separates what is needed from what is merely desired.

## Lifecycle Category

UNDERSTAND.

## Trigger Conditions

- Requirements are ambiguous
- During `/dk-idea` when the idea needs clarification

## When Not to Invoke

- When requirements are already concrete and testable

## Required Inputs

- The user's request and any prior answers

## Preconditions

- The interviewer is prepared to ask questions **one at a time**

## Procedure

1. Ask about problem, users, context, success, constraints, and preferences — **exactly one question per response**.
2. Provide **numbered options** for each question, always including a write-in choice.
3. Challenge assumptions and test whether the feature needs to exist.
4. Categorise the answers into requirements, preferences, assumptions, constraints, and deferred ideas.
5. Document the categorisation.

## Outputs

Categorised requirements with open questions.

## Invariants

- **Sequential questioning**: never multiple questions in one response.
- **Numbered options**: every question offers numbered choices plus custom input.

## Dependencies

None.

## Related Agents

product-discovery-agent (primary).

## Related Commands

`/dk-idea` (supporting skill).

## Verification Requirements

- [ ] One question per response
- [ ] Numbered options with a write-in choice provided

## Failure Behavior

- Ambiguity persists → re-interview or escalate to the user.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

"What specific problem are we solving?" → `1) Speed up finding content 2) Notify users of new content 3) Other (please describe)` — then the follow-up question is asked only after the answer.

## Anti-Patterns

- Asking multiple questions at once
- Yes/no-only questions without options
- Ignoring the answer and proceeding with assumptions

## Maintenance Notes

The sequential-questioning and numbered-options rules were added in commit `e0006c2`.
