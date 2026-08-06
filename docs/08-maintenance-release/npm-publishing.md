# npm Publishing

This guide describes how to publish Development Kit to npm when instructed to do so.

## Pre-Publish Verification

Before publishing to npm:
- Ensure all quality gates pass (`npm run validate`, `npm run doctor`, `npm run docs:validate`).
- Verify npm package files list in `package.json` includes `bin/`, `commands/`, `agents/`, `skills/`, `hooks/`, `templates/`, `scripts/`, `docs/`, `AGENTS.md`, and `plugin.json`.

## Command

```bash
npm publish --access public
```

> [!CAUTION]
> Do not publish to npm unless explicitly instructed by the repository owner.

## Related Documentation

- [Release Process](release-process.md)
- [Pre-Release Checklist](pre-release-checklist.md)
