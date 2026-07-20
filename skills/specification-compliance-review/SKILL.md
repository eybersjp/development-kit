---
name: specification-compliance-review
description: >-
  The first gate in the two-stage review process. Verifies that the
  implementation satisfies the specification, before assessing code quality.
---

# Specification Compliance Review

## Overview

The first stage of the two-stage review process. Verifies that the implementation satisfies the approved specification and all acceptance criteria. This review focuses on **what** was built, not **how** it was built. Code quality, style, and performance are not assessed here.

## When to Use

- After implementation is complete
- Before code quality review
- When the implementation agent reports task completion

## Process

### 1. Read the Specification

Review every part of the approved specification:
- Problem statement
- Expected behaviour
- Requirements
- Acceptance criteria
- Exclusions
- Constraints

### 2. Read the Implementation

Review the code changes to understand what was built:
- Files created or modified
- New behaviour introduced
- Behaviour that was changed or removed

### 3. Verify Compliance

For each acceptance criterion:
- [ ] Is this criterion satisfied?
- [ ] Can I verify this from the implementation?
- [ ] Is there a test for this?

For each requirement:
- [ ] Is this requirement addressed?
- [ ] Is the behaviour correct as specified?

For each exclusion:
- [ ] Was this exclusion respected?
- [ ] Is there any code that violates the exclusion?

### 4. Identify Issues

- **Non-compliance**: A requirement or criterion is not met
- **Scope creep**: Unspecified behaviour was added
- **Exclusion violation**: Something explicitly excluded was implemented
- **Missing coverage**: Acceptance criteria that cannot be verified

### 5. Report

Provide a clear verdict and detailed findings.

## Compliance Categories

| Status | Meaning |
|--------|---------|
| **Compliant** | The implementation satisfies all criteria |
| **Partially compliant** | Some criteria are satisfied, some are not |
| **Non-compliant** | Critical criteria are not met |
| **Exceeded scope** | The implementation goes beyond the specification |

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "The code looks good, let's just check quality" | Spec compliance first. If it doesn't do what was specified, code quality doesn't matter. |
| "The implementation adds some nice extras, that's fine" | That's scope creep. Extras should be specified and approved. |
| "This criterion is hard to verify, I'll assume it's fine" | If it can't be verified, it should be removed from the criteria. |
| "The spirit of the spec is there" | The letter of the spec is what matters. Compliance is binary. |

## Red Flags

- Acceptance criteria cannot be verified from the implementation
- The implementation adds behaviour not in the specification
- Exclusions are violated
- The implementation removes or changes specified behaviour
- The spec was ambiguous and the implementation chose a different interpretation

## Verification

- [ ] All acceptance criteria are satisfied
- [ ] All requirements are addressed
- [ ] Exclusions are respected
- [ ] No scope creep (unspecified behaviour added)
- [ ] Each criterion can be verified from the implementation or tests
