---
name: requirements-interview
description: >-
  Asks focused questions to surface requirements, preferences, assumptions,
  and constraints. Separates what is needed from what is merely desired.
compatibility: opencode
---

# Requirements Interview

## Overview

Asks focused questions to surface requirements, preferences, assumptions, and constraints. The goal is to separate what is genuinely needed from what is merely desired, and to distinguish assumptions from facts. Used early in the discovery process, before any specification is written.

## When to Use

- After an initial idea is presented but before specification writing
- When requirements are unclear or incomplete
- When the user says "I need [solution]" instead of describing the problem
- When different stakeholders have conflicting expectations

## Process

### 1. Identify Knowledge Gaps

Review what is already known about the request. Identify what is unclear, missing, or assumed.

### 2. Ask Focused Questions

> [!IMPORTANT]
> **Sequential Questioning Rule**: You MUST only ask **exactly one question at a time**. Never ask multiple questions in a single response, as the answer to one question may change the direction or relevance of subsequent questions.
> **Numbered Options Rule**: For each question, you MUST provide a list of numbered suggestions/options (e.g., `1) Option A`, `2) Option B`, `3) Option C`) from which the user can choose by replying with just the option number. Always include a choice for custom input (e.g. a write-in option).

Categorise questions by area:


**Problem Area**
- What specific problem are we solving?
- Who experiences this problem?
- How do they currently solve it?
- Is this a real problem or a perceived one?
- What happens if we don't solve this?

**User Area**
- Who will use this solution?
- What is their technical skill level?
- What are their goals and motivations?
- What are their frustrations with the current approach?

**Context Area**
- Where and when will this be used?
- What devices, browsers, or platforms must be supported?
- What are the performance expectations?
- What are the security and compliance requirements?

**Success Area**
- How will we know this is working?
- What does success look like?
- What metrics matter?
- What would make this a failure?

**Constraint Area**
- What is the timeline?
- What is the budget (if applicable)?
- What technology constraints exist?
- What organisational constraints exist?

### 3. Categorise Responses

After each answer, categorise it:
- **Requirement**: Must be fulfilled for success
- **Preference**: Desirable but negotiable
- **Assumption**: Something believed to be true (needs validation)
- **Constraint**: A hard limitation
- **Future idea**: Something explicitly deferred

### 4. Validate with Follow-ups

For each response:
- If it's a requirement: "Is there any scenario where we could skip this?"
- If it's a preference: "What would make this optional?"
- If it's an assumption: "How could we verify this?"
- If it's a constraint: "Is this negotiable?"

### 5. Document

Produce a categorised list of findings ready for specification.

## Interview Questions Reference

```
PROBLEM:
- What problem are we solving?
- Who has this problem?
- How is it solved today?
- Why is the current solution insufficient?

USERS:
- Who exactly will use this?
- What is their technical level?
- What do they need to accomplish?

CONTEXT:
- Where will this be used?
- What platforms/devices must be supported?
- What performance is acceptable?

SUCCESS:
- How do we measure success?
- What is the minimum viable version?
- What would make this a failure?

CONSTRAINTS:
- What is the timeline?
- What must we keep (existing systems, data, APIs)?
- What cannot change?
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I know what they need, I don't need to ask" | Surface assumptions now, or discover they're wrong during implementation. |
| "Asking so many questions will frustrate the user" | Focused questions show you're being thorough. Vague implementation frustrates more. |
| "The requirements doc covers everything" | Docs always have gaps. Interview surfaces the gaps. |

## Red Flags

- The interview produces no new information (you weren't listening or asking the right questions)
- Every answer is treated as a hard requirement
- Assumptions are not challenged
- The user's proposed solution is accepted without understanding the underlying problem
- Technical constraints are accepted at face value without verification

## Verification

- [ ] Problem is clearly understood and articulated
- [ ] Users are identified and understood
- [ ] Requirements are separated from preferences
- [ ] Assumptions are surfaced and documented
- [ ] Constraints are identified
- [ ] Success criteria are defined
- [ ] Open questions are documented
