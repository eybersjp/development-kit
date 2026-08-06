# Simplification Cycle

Walkthrough of running `/dk-simplify` to clean up code after reviews pass.

## Process

1. **Traverse Ponytail Ladder**: Evaluate every abstraction and dependency for necessity.
2. **Never-Remove Check**: Verify no security guards, tests, or error handlers were removed.
3. **Re-Test**: Re-run the full verification suite after code removal.

## Related Documentation

- [/dk-simplify Command Reference](../03-reference/commands/dk-simplify.md)
- [Simplicity Review](../07-testing-quality-security/simplicity-review.md)
