---
name: adaptive-artifact-planning
description: >-
  Selects the minimum set of documents required for the work. Prevents
  over-documentation — small changes should not produce fifteen documents.
compatibility: opencode
---

# Adaptive Artifact Planning

## Overview

Determines which documents are genuinely required for the current work. The artifact level (small, standard, comprehensive) determines the minimum document set. This prevents over-documentation while ensuring necessary structure for larger efforts.

## When to Use

- At the start of any new feature or change
- When transitioning from idea discovery to specification
- When deciding what documents to create

## Process

### 1. Assess the Scale of Work

Evaluate:
- **Files changed**: How many files will be affected?
- **Risk**: How risky is this change? Could it break existing functionality?
- **Uncertainty**: How well do we understand the requirements?
- **Complexity**: How complex is the implementation?
- **Stakeholders**: How many people, systems, or users are affected?

### 2. Assign Artifact Level

```yaml
artifact_level: small | standard | comprehensive
```

**Small**: Minor, well-understood changes with low risk.
- Examples: Fix a validation message, correct a spelling error, update a CSS value
- Required: Task brief, acceptance criteria, test case

**Standard**: Moderate changes with some uncertainty.
- Examples: Add a form field, create a list view, implement a simple API endpoint
- Required: Feature specification, technical design (brief), task plan, acceptance criteria, test plan

**Comprehensive**: Large efforts with significant scope or high risk.
- Examples: Build a CRM module, implement a payment system, create a new product
- Required: Idea brief, PRD, user journeys, system architecture, data model, API contracts, security considerations, design direction, implementation roadmap, task plan, test strategy

### 3. Select Required Artifacts

Based on the assigned level, select only the required documents. Do not add extras.

### 4. Document the Selection

Report the artifact level and the exact list of documents to create.

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "It's better to have more documentation" | More documents mean more maintenance burden and less focus on what matters. Only create what's needed. |
| "The template says we need 12 documents" | The template provides options. The artifact level determines which are actually required. |
| "Let's create a PRD just in case" | If the work is small, a feature spec is sufficient. Don't over-document. |

## Red Flags

- Fifteen documents are created for a three-line change
- No documents are created for a high-risk change
- The artifact level doesn't match the actual complexity of the work
- Templates are filled out without considering whether each section is relevant

## Verification

- [ ] The artifact level is appropriate for the work
- [ ] Only required documents are created
- [ ] No unnecessary documents are included
- [ ] The rationale for the level is documented
