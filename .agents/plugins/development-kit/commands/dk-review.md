---
name: dk-review
description: >-
  Run the full review cycle: specification compliance, code quality,
  and conditional specialist reviews (security, accessibility, design
  quality). Specification compliance is always reviewed before code quality.
---

# /dk-review

## Purpose

Runs the full review cycle over the current implementation. The review is always a two-stage process: specification compliance first, then code quality. Conditional specialist reviews (security, accessibility, design quality) are added when applicable. Simplicity review is a separate command (`/dk-simplify`).

## Workflow

### Stage 1: Specification Compliance Review
Spawn the **spec-reviewer** to answer:
- Does the implementation satisfy the specification?
- Are all acceptance criteria met?
- Are exclusions respected?
- Is there scope creep?

Use the specification-compliance-review skill to check every acceptance criterion.

### Stage 2: Code Quality Review
Spawn the **code-reviewer** to assess:
- Correctness and edge case handling
- Readability and maintainability
- Error handling
- Project conventions
- Unnecessary complexity
- Duplication

Use the code-quality-review skill for structured assessment.

### Stage 3: Conditional Specialist Reviews

**Security Review** (when applicable):
- Authentication, authorisation, input handling
- Secrets, file handling, database access
- External APIs, payments, PII
- Activate the security-review skill and spawn the **security-reviewer** agent

**Accessibility Review** (for UI tasks):
- Semantic HTML, keyboard navigation, screen reader support
- Colour contrast, focus indicators, motion preferences
- Activate the accessibility-review skill and spawn the **accessibility-reviewer** agent

**Design Quality Review** (for UI tasks):
- Visual hierarchy, spacing, typography
- Interaction design, prevents generic AI-generated visual language
- Activate the design-quality-review skill and spawn the **design-reviewer** agent

### Stage 4: Report
Provide a structured review report with verdicts for each stage and a go/no-go recommendation.

## Skills Activated

Primary:
- `specification-compliance-review` — First gate: did we build the right thing?

Supporting:
- `code-quality-review` — Second gate: did we build it well?

Conditional:
- `security-review` — Security vulnerability assessment (for auth, input, payments, PII)
- `accessibility-review` — Accessibility assessment (for UI changes)
- `design-quality-review` — Visual design quality assessment (for UI changes)

## Sub-Agents

- spec-reviewer (Stage 1 — always required)
- code-reviewer (Stage 2 — always required)
- security-reviewer (conditional — for security-sensitive work)
- accessibility-reviewer (conditional — for UI changes)
- design-reviewer (conditional — for UI changes)

## Output

A structured review report with:
- Verdict for each review stage (PASS / FAIL / PASS WITH ISSUES)
- Detailed findings with file references
- Categorised issues (Critical, Major, Minor)
- Go/no-go recommendation
