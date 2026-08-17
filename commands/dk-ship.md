---
name: dk-ship
description: >-
  Performs final verification and release preparation: full test suite,
  diff inspection, documentation update, task completion gate, branch
  completion, and release readiness assessment.
---

# /dk-ship

## Purpose

Performs final verification and release preparation. Runs the full test suite, inspects the diff, documents completion, verifies release readiness, and prepares the commit. This is the final gate before work is considered ready to merge.

## Workflow

### 1. Task Completion & Design Authority Gate
Before shipping, verify every task has passed its completion gate:
- All acceptance criteria satisfied
- All tests pass
- Spec review passed
- Code review passed
- Simplicity review passed
- **Design Authority Gate** (for visual UI scope):
  - `Same Design Team Test: PASS`
  - No unresolved `DS-xxx` blocking issues
  - `design.md` is approved and up-to-date
  - Exempt if project is confirmed non-visual (`applicable: false`)

If any task has not passed all gates, stop and report which tasks are incomplete.

### 2. Final Test Suite
Run the complete test suite:
- Unit tests
- Integration tests
- Browser tests
- Type checking
- Linting

### 3. Full Review Cycle
Spawn the **spec-reviewer** and **code-reviewer** to run specification compliance and code quality review on the full diff.

### 4. Documentation Check
Verify that documentation is updated:
- README changes
- API documentation
- Changelog entries
- Migration notes (if applicable)

### 5. Simplicity Review
Spawn the **simplicity-reviewer** to run the simplicity review on the full diff. Check for unnecessary code, abstractions, and dependencies.

### 6. Release Readiness Assessment
Assess broader release readiness:
- Dependency audit (no known vulnerabilities)
- Secrets scan (no credentials in codebase)
- Build process completes
- Rollback plan exists
- Release notes prepared

### 7. Commit Preparation
Prepare a clean commit with:
- Descriptive commit message
- Related task references
- Change summary

### 8. Branch Completion
Complete the branch:
- Final diff inspection
- PR description prepared
- Branch ready for merge

## Skills Activated

Primary:
- `branch-completion` — Final verification, diff inspection, commit and PR preparation

Supporting:
- `task-completion-gate` — Verifies every task has passed all gates
- `release-readiness` — Broader pre-release check (security, performance, docs, deployment)

Conditional:
- `specification-compliance-review` — Full diff spec review
- `code-quality-review` — Full diff code review
- `simplicity-review` — Full diff simplicity review
- `regression-testing` — Verify existing behaviour remains intact

## Sub-Agents

- spec-reviewer
- code-reviewer
- simplicity-reviewer

## Output

Ship report including:
- Task completion gate status
- Test results
- Review results
- Documentation status
- Release readiness assessment
- Commit summary
- Go/no-go recommendation
