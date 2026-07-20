---
name: risk-first-planning
description: >-
  Prioritises implementation of uncertain, technically risky, or novel work
  before safe, cosmetic, or well-understood work.
compatibility: opencode
---

# Risk-First Planning

## Overview

Prioritises implementation of uncertain, technically risky, or novel work before safe, cosmetic, or well-understood work. The reasoning is simple: if the risky part turns out to be impossible or impractical, you want to know as early as possible — before you've invested time in the safe parts.

## When to Use

- When planning task execution order
- When some aspects of the work are uncertain
- When the project involves new technology or patterns
- When integrating with unfamiliar external systems
- When performance or scalability is a concern

## Process

### 1. Identify Risks

Categorise risks in the implementation:

**Technical Risks**
- Unfamiliar technology or library
- Complex algorithm or data structure
- Performance-sensitive code
- Scalability requirements
- Security requirements

**Integration Risks**
- External API that may change or be unreliable
- Third-party service with unknown behaviour
- Cross-team dependency
- Legacy system integration

**Knowledge Risks**
- Team doesn't fully understand the domain
- Requirements are uncertain
- "We'll know it when we see it"

**Schedule Risks**
- Tight deadline for a specific component
- Dependencies from other teams
- Regulatory or compliance deadlines

### 2. Assess Risk Level

For each risk, assess:
- **Impact**: How bad would it be if this fails?
- **Likelihood**: How likely is it to be a problem?
- **Discoverability**: How early in the implementation would we find out?

### 3. Order by Risk

Use these rules:

1. **Highest risk first**: Tasks with the most unknowns go first.
2. **Proof of concept before polish**: Validate the approach before making it pretty.
3. **Integration before isolation**: Test that components work together before perfecting them separately.
4. **Core path before edge cases**: Get the main flow working before handling exceptions.

### 4. Define Risk Mitigation

For each high-risk task, define:
- **What could go wrong**: The specific risk
- **How we'll know**: The signal that the risk materialised
- **Mitigation**: What we'll do if it does
- **Fallback**: The alternative approach

### 5. Produce Risk-Ordered Plan

The final execution plan should have:
- High-risk tasks in the first third of the schedule
- Medium-risk tasks in the middle
- Low-risk tasks (cosmetic, documentation, optimisation) last

## Risk Assessment Template

```yaml
risks:
  - task: "Third-party API integration"
    risk_level: high
    impact: "Blocking — if API doesn't support our use case, redesign needed"
    likelihood: medium
    discoverability: early (first API call)
    mitigation: "Build adapter layer so we can switch providers"
    fallback: "Use cached mock data"

  - task: "Performance optimisation"
    risk_level: medium
    impact: "User experience degradation"
    likelihood: low
    discoverability: medium (load testing)
    mitigation: "Profile early, optimise iteratively"
    fallback: "Simplify the feature scope"
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "Let's start with the easy stuff to build momentum" | Momentum is worthless if the hard part turns out to be impossible. Do the hard part first. |
| "The risky part will work itself out" | That's optimism, not a plan. Test the risky part first. |
| "I want to save the best for last" | Save the polish for last. Do the risky core work first. |
| "We can't start the risky part until the infrastructure is ready" | That's a genuine dependency. But start the risky part as soon as its dependencies are met. |

## Red Flags

- Low-risk cosmetic work is scheduled before high-risk technical work
- Integration risks are discovered late in the schedule
- No risk assessment was performed before ordering tasks
- "We'll deal with it if it comes up" is the risk mitigation strategy
- High-risk tasks are scheduled at the end "so we have time to prepare"
- External dependencies are not validated early

## Verification

- [ ] All tasks have been assessed for risk
- [ ] High-risk tasks are scheduled early
- [ ] Each high-risk task has a mitigation strategy
- [ ] Risk fallback plans exist for critical components
- [ ] The execution order reflects risk level, not convenience
- [ ] Integration work is validated before polish work
