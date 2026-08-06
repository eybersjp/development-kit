# Systematic Debugging

An in-depth tutorial demonstrating systematic root-cause debugging using `/dk-debug`.

## The 5-Phase Debug Cycle

1. **Reproduce**: Document exact input payloads, steps, and environment flags.
2. **Localise**: Binary search the codebase and stack traces to isolate the failing component.
3. **Root Cause**: Identify the precise logic violation or assumption failure.
4. **Fix**: Write a failing regression test (RED) then minimal code to pass (GREEN).
5. **Protect**: Add permanent regression protection test suite entry.

## Related Documentation

- [Small Bug Fix](small-bug-fix.md)
- [/dk-debug Command Reference](../03-reference/commands/dk-debug.md)
