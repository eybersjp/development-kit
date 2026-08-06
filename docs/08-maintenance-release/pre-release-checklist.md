# Pre-Release Checklist

Use this checklist before authorizing any release tag, GitHub Release, or npm publication.

## Repository state

- [ ] The release change is merged into `main` through a reviewed pull request.
- [ ] `main` is synchronized with `origin/main`.
- [ ] The working tree is clean.
- [ ] No temporary files, local paths, secrets, or generated scratch artifacts are included.

## Version and documentation

- [ ] `package.json` contains the intended semantic version.
- [ ] `CHANGELOG.md` contains a dated entry for the version.
- [ ] README, installation, compatibility, migration, troubleshooting, validation, and release documentation reflect the changed behaviour.
- [ ] `opencode.json` contains the current supported OpenCode schema declaration.
- [ ] The canonical release tag will use `vMAJOR.MINOR.PATCH`.
- [ ] No redundant alias tag is planned.

## Required gates

- [ ] `npm run release:validate` passes.
- [ ] `npm run opencode:validate` passes as part of the release suite.
- [ ] Autopilot unit tests pass.
- [ ] Evaluation validation passes.
- [ ] `git diff --check` passes before merge.
- [ ] CI passes on the release pull request.

## Package verification

- [ ] `npm pack --dry-run` contains only intended public package files when the package allowlist changed.
- [ ] The npm package name and version are correct.
- [ ] `NPM_TOKEN` is configured and valid when npm publication is required.
- [ ] No credential value appears in repository content or workflow output.

## Approval and publication

- [ ] The repository owner explicitly authorized the release.
- [ ] The release issue title is exactly `Release vMAJOR.MINOR.PATCH`.
- [ ] The issue body is exactly `/release vMAJOR.MINOR.PATCH`.
- [ ] The requested version matches `package.json`.

## OpenCode compatibility check

For every OpenCode-related release, confirm the generated project configuration is:

```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

- [ ] The obsolete `rules` key is absent.
- [ ] Root `AGENTS.md` remains part of the installed package and is loaded automatically by OpenCode.

## Related documentation

- [Release Process](release-process.md)
- [Post-Release Verification](post-release-verification.md)
- [npm Publishing](npm-publishing.md)
