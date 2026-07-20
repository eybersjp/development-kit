---
name: minimal-diff
description: >-
  Keeps changes tightly scoped to the task. Prevents unrelated refactoring,
  formatting changes, and scope creep in implementation diffs.
---

# Minimal Diff

## Overview

Keeps changes tightly scoped to the task. Every implementation diff should contain only the changes needed to satisfy the task's acceptance criteria. Unrelated refactoring, formatting changes, and scope creep make diffs harder to review, increase merge conflicts, and introduce risk.

## When to Use

- When implementing any task
- When reviewing a diff before submitting
- When preparing a pull request
- When an implementation agent is about to make changes

## Process

### 1. Define the Task Scope

Before making changes, clearly identify:
- **Files to modify**: Only the files listed in the task
- **Changes to make**: Only the specific changes required by the acceptance criteria
- **What not to touch**: Code outside the task scope

### 2. Make Targeted Changes

For each change:
- Modify only the minimum lines needed
- Do not reformat code unless the task explicitly requires it
- Do not rename variables or functions unless they're part of the task
- Do not refactor adjacent code unless it's directly related

### 3. Avoid Common Diff Pollution

**Do not**:
- Auto-format files that aren't part of the change
- Reorder imports or functions
- Rename things "while you're in there"
- Fix unrelated spelling mistakes
- Add comments to unrelated code
- Remove unused code that's not related to the task
- Upgrade dependency versions

**Do**:
- Make the minimum change to satisfy the acceptance criteria
- Leave the codebase exactly as you found it (except for your changes)
- If you find something worth fixing, create a separate task for it

### 4. Review the Diff

Before declaring completion:
- Check every changed line — is it necessary?
- Can the change be expressed in fewer changes?
- Are there formatting-only changes mixed with logic changes?
- Are there changes to files that shouldn't have been touched?

### 5. Keep Related Changes Together

While changes should be minimal, related changes should be in the same diff:
- If a function signature changes, update all callers in the same diff
- If a data model changes, update all consumers in the same diff
- If an API changes, update the frontend in the same diff (or same PR)

## Diff Review Checklist

```
- [ ] Every changed line is necessary for the task
- [ ] No formatting-only changes mixed with logic changes
- [ ] No unrelated refactoring
- [ ] No files were changed outside the task scope
- [ ] No debugging artefacts remain (console.log, TODO comments)
- [ ] No commented-out code
- [ ] No unused imports or variables added
- [ ] Related changes are in the same diff (signature + callers)
- [ ] The diff is as small as possible while satisfying acceptance criteria
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I'll just fix this formatting while I'm here" | Formatting changes add noise to the diff. Make them in a separate commit. |
| "This refactoring is needed for my change" | If it's needed, it's not unrelated. But if it's just "nice to have", don't do it. |
| "I noticed a bug in adjacent code, I'll fix it" | Fix it in a separate commit with a clear description. Don't mix fixes. |
| "The diff is small enough, a few extra changes don't matter" | Extra changes accumulate. Keep every diff pure. |
| "I rearranged the imports to be alphabetical" | Import ordering is a separate concern. Don't mix it with logic changes. |

## Red Flags

- The diff contains formatting changes mixed with logic changes
- Files outside the task scope are modified
- "While I was in there" changes appear in the diff
- The diff is significantly larger than expected for the task
- A single diff contains both refactoring and feature work
- Unrelated variable or function renames appear in the diff
- Debugging artefacts (console.log, commented code) remain

## Verification

- [ ] Every changed line is necessary for the task
- [ ] No unrelated files were modified
- [ ] No formatting-only changes mixed with logic changes
- [ ] No debugging artefacts in the diff
- [ ] No unrelated refactoring in the diff
- [ ] The diff would be easy to review and understand
- [ ] The diff size is proportional to the task scope
