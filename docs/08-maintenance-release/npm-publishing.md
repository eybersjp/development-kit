# npm Publishing

Development Kit is published publicly as the npm package `development-kit`.

## Current package

Verify the current public version with:

```bash
npm view development-kit version
```

For the v0.9.0 release, the expected value is:

```text
0.9.0
```

## Required credentials

The maintainer release workflow reads the repository secret:

```text
NPM_TOKEN
```

The token must belong to an npm account authorized to publish the package. It must never be committed, pasted into an issue, included in logs, or stored in repository files.

## Automated publication

The supported publication path is the maintainer issue command described in [Release Process](release-process.md).

After the complete `npm run release:validate` gate passes, the workflow:

1. Verifies the requested tag version matches `package.json`.
2. Creates or verifies the annotated release tag on `main`.
3. Checks out the exact release tag.
4. Creates or verifies the GitHub Release.
5. Checks whether that exact npm package version already exists.
6. Runs `npm publish --access public` only when publication is still required and credentials are configured.
7. Retries exact-version registry verification for a bounded propagation window.
8. Reports publication status on the release issue and closes it when complete.

The workflow is retry-safe: an existing valid tag, GitHub Release, or published npm version is verified rather than recreated blindly.

## Manual publication

Manual publication is reserved for controlled recovery and requires explicit maintainer authorization.

Before manual publication:

```bash
npm run release:validate
npm pack --dry-run
npm view development-kit version
```

Then, from the exact release commit or tag:

```bash
npm publish --access public
```

Do not publish a working tree that differs from the release tag.

## Published package contents

The package allowlist in `package.json` includes:

- `.agents/`
- `agents/`
- `skills/`
- `commands/`
- `hooks/`
- `templates/`
- `evals/`
- `runtime/`
- `schemas/`
- `scripts/`
- `AGENTS.md`
- `README.md`
- `LICENSE`
- `opencode.json`

For v0.9.0, installer/distribution tests explicitly confirm the orchestration runtime and JSON schemas are present in isolated installed copies. Run `npm pack --dry-run` when the allowlist changes.

## Credential failure and retry

A GitHub Release can succeed while npm publication is skipped or fails. After correcting `NPM_TOKEN`, reopen the same version through the maintainer release command. The workflow verifies the existing tag and GitHub Release, then attempts only missing npm publication work.

## Security guidance

- Prefer short-lived, least-privilege credentials.
- Rotate expiring tokens before release windows.
- Revoke a token immediately when exposure is suspected.
- Consider npm trusted publishing when the repository and workflow are eligible.

## Related documentation

- [Release Process](release-process.md)
- [Pre-Release Checklist](pre-release-checklist.md)
- [Post-Release Verification](post-release-verification.md)
- [Release Notes v0.9.0](release-notes-v0.9.0.md)
- [Security Policy](../../SECURITY.md)
