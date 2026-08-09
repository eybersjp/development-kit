# Pre-Release Checklist

Use this checklist before authorizing any release tag, GitHub Release, or npm publication.

## Repository state

- [ ] The release change is merged into `main` through a reviewed pull request.
- [ ] `main` is synchronized with `origin/main`.
- [ ] The working tree is clean in the release runner.
- [ ] No temporary files, local paths, secrets, provider credentials, session material, or generated scratch artifacts are included.

## Version and documentation

- [ ] `package.json` contains the intended semantic version.
- [ ] `CHANGELOG.md` contains a dated entry for the version.
- [ ] README, installation, compatibility, migration, troubleshooting, validation, release, architecture, and security documentation reflect the changed behaviour.
- [ ] New commands and skills have reference pages and are registered in `docs/SUMMARY.md`.
- [ ] `opencode.json` contains the current supported OpenCode schema declaration.
- [ ] The canonical release tag will use `vMAJOR.MINOR.PATCH`.
- [ ] No redundant alias tag is planned.

## Framework synchronization

- [ ] `AGENTS.md` reflects new control-plane or trust-boundary rules.
- [ ] Development conductor and Autopilot routing reflect lifecycle changes.
- [ ] Installer command output reflects the current public command set.
- [ ] The Antigravity plugin manifest is synchronized with canonical skill/agent inventory.

## v0.5.0 external research checks

- [ ] `/dk-research` remains provider-neutral and is not treated as a tenth lifecycle stage.
- [ ] `external-research` preserves provenance and uncertainty and classifies retrieved content as untrusted data.
- [ ] `agent-reach-integration` remains optional and does not add a hidden core dependency.
- [ ] Agent-Reach or other provider installation is never silent and SYSTEM-class changes require approval.
- [ ] Authenticated reads require permission to use account/session material.
- [ ] Provider writes and destructive actions remain approval-gated.
- [ ] Credentials, tokens, browser cookies, profiles, and session material are absent from committed files and research artifacts.
- [ ] External Capability Provider architecture and threat-model documentation are current.

## Required gates

- [ ] `npm run release:validate` passes in full.
- [ ] `npm run validate` passes as part of the release suite.
- [ ] `npm run doctor` confirms plugin synchronization.
- [ ] `npm run docs:validate` and `npm run docs:validate:test` pass.
- [ ] `npm run opencode:validate` passes.
- [ ] `npm run research:validate` passes.
- [ ] Autopilot unit tests pass.
- [ ] Evaluation validation passes.
- [ ] `git diff --check` passes before merge when a local Git runner is available.
- [ ] GitHub CI passes on the final release pull-request head SHA.

Do not remove, skip, or weaken a failing gate merely to publish a release.

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
- [ ] The release workflow runs `npm run release:validate` again before tag/release creation.

## OpenCode compatibility check

For every OpenCode-related release, confirm the generated project configuration is:

```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

- [ ] The obsolete `rules` key is absent.
- [ ] Root `AGENTS.md` remains part of the installed package and is loaded automatically by OpenCode.

## Post-release verification

- [ ] The public `vMAJOR.MINOR.PATCH` tag points to the intended release commit.
- [ ] The GitHub Release is published and has the intended version.
- [ ] npm publication is verified, or a skipped publication is explicitly recorded if credentials were unavailable.
- [ ] Public badges and package/release metadata converge on the new version.

## Related documentation

- [Release Process](release-process.md)
- [Post-Release Verification](post-release-verification.md)
- [npm Publishing](npm-publishing.md)
- [Validation Reference](../07-testing-quality-security/validation-reference.md)
- [External Capability Providers](../04-architecture/external-capability-providers.md)
