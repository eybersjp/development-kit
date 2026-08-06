# Release Process

This document outlines the step-by-step process for preparing and completing a Development Kit release.

## Steps

1. **Pre-Release Verification**: Run `npm run validate`, `npm run doctor`, and `npm run docs:validate`.
2. **Version Bump**: Update version in `package.json`, `opencode.json`, and `.agents/plugins/development-kit/plugin.json`.
3. **Plugin Sync**: Run `node scripts/sync-plugin.mjs --fix`.
4. **Changelog Update**: Update `CHANGELOG.md` with version highlights.
5. **Git Tag & Branch Completion**: Commit release artifacts and create a release tag (`vX.Y.Z`).

> [!IMPORTANT]
> Never release without explicit instructions from the user.

## Related Documentation

- [Pre-Release Checklist](pre-release-checklist.md)
- [npm Publishing](npm-publishing.md)
