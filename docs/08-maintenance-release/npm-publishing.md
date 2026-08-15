# npm Publishing

Development Kit is published publicly as the npm package `development-kit`.

## Current package

Verify the current public version with:

```bash
npm view development-kit version
```

For the v0.7.0 release, the expected value is:

```text
0.7.0
```

## Required credentials

The maintainer release workflow reads the repository secret:

```text
NPM_TOKEN
```

The token must belong to an npm account authorized to publish the package. It must never be committed, pasted into an issue, included in logs, or stored in repository files.

## Automated publication

The supported publication path is the maintainer issue command described in [Release Process](release-process.md).

After the complete release gate passes, the workflow:

1. Checks out the release tag.
2. Reads the package name and version from `package.json`.
3. Checks whether that exact package version already exists.
4. Runs `npm publish --access public` only when publication is still required and credentials are configured.
5. Reports publication status on the release issue.

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
- `scripts/`
- `AGENTS.md`
- `README.md`
- `LICENSE`
- `opencode.json`

Run `npm pack --dry-run` when the allowlist changes.

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
- [Security Policy](../../SECURITY.md)
