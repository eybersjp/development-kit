# Release Quality Gates

This document defines the quality gates required before any work or version of Development Kit can be released.

## Release Gates

1. **Validation Gate**: `npm run validate` passes 100% of skill & schema checks.
2. **Doctor Gate**: `npm run doctor` confirms plugin mirror is fully in sync.
3. **Documentation Gate**: `npm run docs:validate` passes with 0 errors and complete coverage.
4. **Test Suite Gate**: All unit and evaluation tests pass.
5. **Clean Working Tree**: No uncommitted changes or untracked temporary files.

## Related Documentation

- [Quality Strategy](quality-strategy.md)
- [Pre-Release Checklist](../08-maintenance-release/pre-release-checklist.md)
