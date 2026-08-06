# Regression & Edge Case Testing

This document describes the testing practices for preventing regressions and discovering boundary condition failures.

## Regression Testing

- Every bug fix requires a regression test that reproduced the failure (RED state) before implementation.
- The full test suite (`npm run validate`, unit tests, integration tests) is re-executed after every task loop and simplification pass.

## Edge Case Testing

Active search for failure scenarios including:
- Null, undefined, empty string, or zero inputs.
- Large payloads or extreme boundaries.
- Asynchronous timing issues and race conditions.
- Platform-specific path formatting differences (Windows vs POSIX).

## Related Documentation

- [Test Strategy](test-strategy.md)
- [Quality Strategy](quality-strategy.md)
