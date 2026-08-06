# Small Bug Fix

Walkthrough of applying a targeted fix for a known, reproducible bug.

## Workflow

1. **Invoke Debug**: Run `/dk-debug` to execute the Reproduce → Localise → Root Cause → Fix → Protect cycle.
2. **Write RED Test**: Create a failing unit test reproducing the bug.
3. **Apply Fix**: Implement the minimal fix (GREEN).
4. **Verify**: Run `/dk-test` to confirm no regressions.
5. **Ship**: Run `/dk-ship`.

## Related Documentation

- [Systematic Debugging](systematic-debugging.md)
- [Examples Index](README.md)
