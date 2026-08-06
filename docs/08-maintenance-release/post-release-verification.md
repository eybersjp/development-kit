# Post-Release Verification

After publishing a new release:

1. **Clean Installation Test**: In a clean temporary directory, run `npx development-kit --project` and confirm successful installation.
2. **Doctor Verification**: Execute `npm run doctor` to verify installed framework integrity.
3. **Command Sanity Test**: Confirm `/dk-status` responds accurately in test workspaces.

## Related Documentation

- [Release Process](release-process.md)
- [Pre-Release Checklist](pre-release-checklist.md)
