# Release Process

Development Kit uses a maintainer-only, issue-driven release workflow that validates `main`, creates or verifies an annotated `vMAJOR.MINOR.PATCH` tag, publishes a GitHub Release, and publishes to npm when credentials are configured.

## Release preparation

1. Work through a reviewed pull request.
2. Update `package.json` to the intended semantic version.
3. Update `CHANGELOG.md` and all affected documentation.
4. Confirm `opencode.json` and host integration contracts are current.
5. Run:

```bash
npm run release:validate
git diff --check
```

6. Merge only after CI passes.
7. Confirm `main` is clean and synchronized.

Do not update `opencode.json` or `plugin.json` merely to force package-version parity. `opencode.json` is a schema-based host configuration without a version field. The Antigravity plugin manifest currently has an independent version contract recorded in [Known Limitations](../11-appendices/known-limitations.md).

## Maintainer release command

Open a GitHub issue with the exact title:

```text
Release vMAJOR.MINOR.PATCH
```

Use the exact body:

```text
/release vMAJOR.MINOR.PATCH
```

The workflow verifies that:

- The issue was opened by the repository owner.
- The title and command match.
- The requested tag uses semantic version syntax.
- `package.json` has the same version.
- The complete release validation suite passes.
- An existing tag, when present, is contained in current `main`.

## Publication behaviour

The maintainer workflow:

1. Creates and pushes the annotated tag when it does not already exist.
2. Creates the GitHub Release directly.
3. Detects whether `NPM_TOKEN` is configured.
4. Publishes the package from the release tag when needed.
5. Reports `published`, `already-published`, `failed`, or skipped npm status.
6. Comments on and closes the release issue when the public release is confirmed.

GitHub Release publication and npm publication are tracked separately so a missing npm credential does not invalidate a successful GitHub Release.

## Tag naming

The canonical public tag format is:

```text
vMAJOR.MINOR.PATCH
```

Do not create parallel aliases such as `development-kit-vMAJOR.MINOR.PATCH` for the same release.

## Required approval

Creating tags, GitHub Releases, or npm publications is consequential. Never execute a release without explicit authorization from the repository owner.

## Related documentation

- [Pre-Release Checklist](pre-release-checklist.md)
- [npm Publishing](npm-publishing.md)
- [Post-Release Verification](post-release-verification.md)
- [Versioning Policy](versioning-policy.md)
