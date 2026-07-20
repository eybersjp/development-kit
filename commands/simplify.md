---
name: simplify
description: >-
  Run the Ponytail simplicity ladder over the current diff. Check whether
  code, abstractions, dependencies, or files can be removed.
---

# /simplify

## Purpose

Runs the Ponytail simplicity ladder over the current diff. Checks whether any code, abstraction, dependency, or file can be removed. Ensures the implementation is as simple as possible while maintaining correctness, security, and accessibility.

## Workflow

### 1. Read the Diff
Review all files that were created or modified.

### 2. Apply the Simplicity Ladder
Spawn the **simplicity-reviewer** to run the Ponytail simplicity ladder over the diff:
- Can code be deleted?
- Does the feature already exist elsewhere?
- Was a dependency added unnecessarily?
- Was a custom component built where a native element works?
- Was a general framework created for one use case?
- Did the implementation exceed the specification?
- Can the same behaviour be achieved more directly?

### 3. Never Remove Check
Verify that no simplification removes:
- Security protections
- Input validation
- Error handling
- Accessibility
- Data integrity protections
- Tests

### 4. Verify After Simplification
After applying simplifications, re-run the test suite to confirm nothing broke.

### 5. Report
Provide a simplification report with specific, actionable recommendations.

## Skills Activated

Primary:
- `simplicity-review` — Ponytail-style minimum-solution inspection

## Sub-Agents

- simplicity-reviewer

## Output

A simplification report with:
- Code that can be removed (with justification)
- Code that can be replaced with simpler alternatives
- Code that can be consolidated
- Items that exceeded the specification
- Never-remove list verification
- Test results after simplifications
