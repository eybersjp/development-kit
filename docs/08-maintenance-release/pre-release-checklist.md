# Pre-Release Checklist

Use this checklist before authorizing any release tag or publishing step.

- [ ] All unit and evaluation tests pass.
- [ ] `npm run validate` passes (277 checks).
- [ ] `npm run doctor` confirms plugin is in sync.
- [ ] `npm run docs:validate` passes with 0 errors.
- [ ] Version numbers match across `package.json`, `opencode.json`, and `plugin.json`.
- [ ] `CHANGELOG.md` is updated.
- [ ] No uncommitted changes or temporary scratch files exist.

## Related Documentation

- [Release Process](release-process.md)
- [Post-Release Verification](post-release-verification.md)
