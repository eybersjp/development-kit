---
name: branch-completion
description: >-
  Handles final verification before a branch or task is completed: full test
  suite, diff inspection, commit preparation, and PR preparation.
compatibility: opencode
---

# Branch Completion

## Overview

Handles final verification before a branch or task is completed: final test suite run, diff inspection, documentation update, commit preparation, and PR preparation. This is the final gate before work is considered ready to merge.

## When to Use

- When all tasks in a feature or project are complete
- Before creating a pull request
- Before merging into the main branch
- When the `/dk-ship` command is used

## Process

### 1. Final Test Suite

Run the complete test suite for the entire project:
- All unit tests
- All integration tests
- All browser tests
- Type checking
- Linting
- Any other automated checks

All tests must pass. No exceptions.

### 2. Inspect the Diff

Review the complete diff:
- **Files changed**: Are all changes intentional?
- **Unintended changes**: Are there formatting changes, whitespace changes, or debugging leftovers?
- **New files**: Are they all necessary?
- **Removed files**: Is anything being removed that shouldn't be?
- **Configuration changes**: Are config changes intentional?

### 3. Update Documentation

- README updated if behaviour or setup changes
- API documentation updated if endpoints change
- Changelog updated with the change description
- Migration notes added (if applicable)

### 4. Prepare Commit

Create a clean, descriptive commit:
- **Subject**: Short description of the change (max 50 chars)
- **Body**: What was changed and why
- **References**: Task numbers, issue numbers, or PR references
- **Scope**: Only the files relevant to this work

### 5. Prepare PR Description

Prepare a pull request description:
- **Summary**: What this PR does
- **Changes**: List of changes with file references
- **Testing**: How the changes were tested
- **Screenshots**: Before/after for UI changes
- **Checklist**: Linting, tests, documentation updated

## Commit Message Template

```
[type]: [short description]

[optional body explaining what and why]

References: [task/issue number]
```

## PR Description Template

```
## Summary
[Brief description of changes]

## Changes
- [Change 1]: [Files affected]
- [Change 2]: [Files affected]

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Browser tests pass (if applicable)
- [ ] Manual testing performed

## Screenshots
[Before/after images for UI changes]

## Checklist
- [ ] Tests pass
- [ ] Linting passes
- [ ] Documentation updated
- [ ] No unintended changes in diff
- [ ] Commit messages are clear
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I'll write the commit message when I merge" | Write it now while the context is fresh. Future you will thank present you. |
| "The PR description doesn't matter for small changes" | Every change benefits from context. A short description is still necessary. |
| "I don't need to review the diff, I wrote it all" | Diff review catches unintentional changes. Automated formatting, leftover debugging, etc. |
| "I'll update docs in a separate PR" | Docs out of sync with code is worse than no docs. Update together. |

## Red Flags

- The diff contains formatting-only changes mixed with functional changes
- Debugging code (console.log, TODO comments) is still present
- The test suite is not run before commit
- Documentation is not updated for behaviour changes
- The diff is unreviewably large
- Commit messages are vague ("fix stuff", "updates")

## Verification

- [ ] Complete test suite passes
- [ ] Diff is reviewed — no unintended changes
- [ ] Documentation is updated (README, API docs, changelog)
- [ ] Commit message is clear and descriptive
- [ ] PR description is prepared (if applicable)
- [ ] No debugging artefacts remain
- [ ] No unrelated changes are included
