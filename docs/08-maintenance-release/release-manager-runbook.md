# Release Manager Runbook

The operational guide for the release manager during a release cycle.

## Runbook Steps

1. Confirm all pull requests targeting the release milestone are merged.
2. Run validation suite: `npm run validate && npm run doctor && npm run docs:validate`.
3. Verify test coverage and evaluation suites.
4. Execute release tags and publish per [Release Process](release-process.md).

## Related Documentation

- [Pre-Release Checklist](pre-release-checklist.md)
- [Post-Release Verification](post-release-verification.md)
