---
name: idea-challenge
description: >-
  Tests whether the proposed solution is solving the real problem. Applies
  critical thinking to prevent building the wrong thing.
compatibility: opencode
---

# Idea Challenge

## Overview

Tests whether the proposed solution is solving the real problem. The idea challenge is not about being negative — it's about being rigorous before committing engineering time. It applies critical thinking to prevent building the wrong thing.

## When to Use

- Before writing a specification
- When the proposed solution seems complex or risky
- When the problem is not clearly understood
- When the solution was proposed before the problem was analysed
- Before committing significant implementation resources

## Process

### 1. Understand the Proposed Solution

Read the idea or proposed solution carefully. What is being proposed? What problem does it claim to solve?

### 2. Identify the Underlying Problem

Ask: What is the real problem here? Is the proposed solution addressing the symptom or the root cause?

### 3. Apply Challenge Questions

Test the idea with these questions:

**Necessity**
- Does this need to exist? (Ponytail ladder step 1)
- What problem does this solve?
- Is this the real problem or a symptom?
- What happens if we don't build this?

**Simplicity**
- Is there a simpler way to achieve the same outcome?
- Can we change an existing thing instead of building a new one?
- Can we remove something instead of adding something?

**Effectiveness**
- Will this solution actually solve the problem?
- Could it make the problem worse?
- What are the second-order effects?

**Alternatives**
- What alternative solutions exist?
- Why was this approach chosen over alternatives?
- What assumptions does this solution make?

**Risks**
- What could go wrong?
- What don't we know?
- What dependencies exist?

### 4. Assess Viability

For each finding, categorise:
- **Valid**: The solution is appropriate for the problem
- **Questionable**: The solution may work but has risks or assumptions that need addressing
- **Invalid**: The solution does not solve the real problem

### 5. Report

Provide structured challenge findings including:
- Problem assessment
- Challenge findings
- Valid concerns and assumptions
- Recommendations

## Challenge Report Template

```
## Idea Challenge Report

### Problem Assessment
[Is this the real problem?]

### Challenge Findings
- [Finding 1]: [Detail]
- [Finding 2]: [Detail]

### Valid Concerns
- [Concern]: [Recommendation]

### Assumptions to Validate
- [Assumption]: [How to validate]

### Verdict
[PROCEED / PROCEED WITH CAVEATS / REDIRECT / REJECT]

### Recommendation
[What to do next]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "The user already decided, I shouldn't challenge it" | The user wants the right solution, not the solution they proposed. Challenge respectfully. |
| "Challenging ideas slows us down" | Building the wrong thing is slower. Challenge early. |
| "This is what the customer asked for" | The customer describes a symptom. Find the real problem. |
| "It's too late to challenge, we already started" | It's never too late. Stopping a wrong direction saves more than it costs. |

## Red Flags

- Ideas are accepted without challenge
- Challenge findings are ignored
- The solution is complex and no simpler alternative was considered
- The problem and solution are conflated
- "We've always done it this way" blocks challenge
- Technical decisions are made for non-technical reasons

## Verification

- [ ] The real problem is identified separately from the proposed solution
- [ ] Necessity is established (Ponytail check: does this need to exist?)
- [ ] Simpler alternatives are considered
- [ ] Risks and assumptions are documented
- [ ] A clear verdict is reached: proceed, redirect, or reject
