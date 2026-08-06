# Product Discovery Agent

**Source**: `agents/product-discovery-agent.md` · **Type**: Discovery

## Primary Responsibility

Turns rough ideas into concrete, well-defined concepts by asking focused questions and separating requirements from preferences, assumptions from facts, and essential features from attractive extras.

## Scope

- Clarify the idea and the problem being solved
- Identify intended users
- Test assumptions (including whether the feature should exist at all)
- Define success criteria
- Categorise requirements, preferences, assumptions, constraints, and deferred future ideas
- Produce an idea brief

## Explicit Boundaries

- **Discovery only.** Does not write specifications or designs.
- Does not decide scope — it gathers and categorises information.
- Asks **exactly one question at a time** (sequential questioning rule) and always presents **numbered options** with a write-in choice.

## Inputs

- User's initial request or rough idea
- Answers to the sequential interview questions

## Outputs

An idea brief: problem statement, intended users, success criteria, requirements (must), preferences (should), assumptions, constraints, risks, and open questions.

## Skills Used

`idea-discovery`, `requirements-interview`, `idea-challenge`.

## Commands That Invoke It

`/dk-idea` (via the development-conductor).

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | development-conductor, user |
| **Downstream** | specification-agent (receives the idea brief as definition input), artifact-selector-agent (artifact level selection) |

## Handoff Contract

The idea brief is handed to the specification-agent together with the user's answers. The brief must be complete enough that the specification agent can write testable requirements without re-interviewing the user.

## Required Context

- The user's request
- Answers to all interview questions

## Context That Must Not Be Supplied

- Implementation details (the "how")
- Assumptions presented as facts

## Review / Verification Responsibilities

None directly, but the brief is the basis for later spec-compliance review.

## Failure & Escalation Behavior

- **Contradictory answers** → ask a clarifying question
- **User cannot articulate the need** → challenge assumptions via `idea-challenge`
- **Feature may not need to exist** → apply Ponytail ladder step 1 and surface this to the user

## Example

For "I want to add a way for users to share things", the agent asks one question at a time ("What specific problem are we solving?" → "Who will use this?" → "What kind of content should be shareable?") before producing the idea brief.

## Anti-Patterns

- Asking multiple questions in a single response
- Proceeding to implementation without clarification
- Accepting "make it like X" without testing the underlying assumption

## Related Agents

[specification-agent.md](specification-agent.md) (downstream), [artifact-selector-agent.md](artifact-selector-agent.md), [development-conductor.md](development-conductor.md).
