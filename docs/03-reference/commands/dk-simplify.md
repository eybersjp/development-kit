# /dk-simplify

**Source**: `commands/dk-simplify.md` · **Lifecycle Stage**: SIMPLIFY

## Purpose

Applies the Ponytail simplicity ladder to the current implementation. Identifies and removes unnecessary code, abstractions, dependencies, and files without changing behaviour.

## When to Use

- After all reviews pass.
- When code is correct and tested but may have accumulated unnecessary complexity.

## When NOT to Use

- Tests do not pass — simplify only after correctness is established.
- Reviews have not passed — spec compliance and code quality must pass first.

## The Ponytail Ladder (Applied Per Item)

1. Does this need to exist?
2. Is the required behaviour already present?
3. Can existing project code be reused?
4. Can the standard library do it?
5. Can the native platform do it?
6. Can an installed dependency do it?
7. Can a small local change do it?
8. Only then keep the new abstraction.

## Items the Simplicity Review Must NEVER Remove

- Security protections
- Input validation
- Error handling
- Accessibility features
- Data integrity protections
- Tests

## Workflow

1. **Ponytail Scan**: `simplicity-reviewer` applies the ladder to every modified file.
2. **Candidate List**: Identify code, abstractions, or dependencies that can be eliminated.
3. **Never-Remove Verification**: Confirm no protected items are being removed.
4. **Apply Simplifications**: Remove or replace bloated items.
5. **Re-verify**: Run full test suite after simplifications.

## Skills Invoked

- `simplicity-review` (primary)

## Agents Invoked

- `simplicity-reviewer`

## Outputs

Simplification report with:
- Code removed (with justification)
- Code replaced with simpler alternatives
- Dependencies removed
- Items that exceeded the specification
- Test results after simplifications

## Related Commands

- `/dk-review` — previous step
- `/dk-ship` — final step after simplification
