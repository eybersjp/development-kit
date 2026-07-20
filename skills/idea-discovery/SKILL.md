---
name: idea-discovery
description: >-
  Turns a rough idea into a concrete, well-defined concept. Used when the user
  has a vague request, a problem to solve, or an unrefined feature concept.
---

# Idea Discovery

## Overview

Turns a rough idea into a concrete concept. You ask focused questions to separate requirements from preferences, assumptions from facts, and essential features from attractive extras.

## When to Use

- The user has a vague or high-level request
- The user says "I want to build [something]" without details
- The user describes a problem rather than a solution
- The request mixes requirements with implementation suggestions
- Before starting any non-trivial feature work

## Process

### 1. Understand the Initial Idea
Read the user's request carefully. Identify what is clearly stated and what needs clarification.

### 2. Conduct Requirements Interview
Ask focused questions about:

- **Problem**: What specific problem are we solving? Is this the real problem or a symptom?
- **Users**: Who will use this? What are their goals and pain points?
- **Context**: Where and how will this be used (browser, mobile, CLI, API)?
- **Success**: How will we know when this works? What does "done" look like?
- **Constraints**: What limitations do we have (time, budget, technology, team)?
- **Preferences**: What would be nice to have vs what is essential?

### 3. Challenge Assumptions

- Is this the real problem or a symptom of another issue?
- Does this feature need to exist at all? (Ponytail ladder step 1)
- Are there simpler ways to achieve the same outcome?
- What assumptions are we making about users, technology, or context?
- What don't we know that we need to know?

### 4. Separate Requirements from Extras

Categorise everything into:
- **Requirements (Must)**: Essential for the solution to work
- **Preferences (Should)**: Valuable but not essential
- **Assumptions**: Things we believe to be true (should be validated)
- **Constraints**: Hard limitations we must work within
- **Future ideas**: Things explicitly deferred

### 5. Document the Idea Brief

Provide a structured output with:
- Problem statement
- Intended users
- Success criteria
- Requirements, preferences, assumptions, constraints
- Key risks and open questions

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "The user's request is clear enough, I can start" | Even clear-sounding requests hide assumptions. Surface them now, not during implementation. |
| "Asking questions will annoy the user" | A few focused questions early prevent building the wrong thing. That's more annoying. |
| "I know what they mean, it's obvious" | What's obvious to you may not be what they meant. Verify. |

## Red Flags

- Implementation starts during the discovery phase
- Assumptions are treated as facts
- The user's problem is accepted without testing it
- Requirements and implementation details are mixed together
- "Nice to have" features are included in the must-have list

## Verification

- [ ] The problem is clearly stated
- [ ] Intended users are identified
- [ ] Success criteria are defined
- [ ] Assumptions are surfaced and documented
- [ ] Requirements are separated from preferences
- [ ] Constraints and risks are documented
