# Migration Guide

This guide covers supported upgrades between published Development Kit versions.

## General upgrade procedure

1. Confirm the target package version:

```bash
npm view development-kit version
```

2. Preview the installer:

```bash
npx development-kit@latest init --opencode --dry-run
```

3. Review project-specific files before using `--force`.
4. Install the new version.
5. Run the relevant host verification and the complete source-repository validation suite when maintaining a checkout.

## Upgrading from v0.4.1 to v0.4.2

v0.4.2 fixes an OpenCode compatibility defect in the generated project configuration.

### Affected projects

A project is affected when its `opencode.json` contains:

```json
{
  "rules": ["AGENTS.md"]
}
```

Current OpenCode versions reject that key with `Unrecognized key: rules`.

### Required repair

Replace the complete file with:

```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

OpenCode automatically loads the root `AGENTS.md`, so no extra registration is required.

Then reload OpenCode and confirm the project opens without configuration errors.

### Reinstallation option

Because the installer preserves existing files by default, a normal reinstall may skip the old `opencode.json`. Either repair the file manually or review a forced reinstall first:

```bash
npx development-kit@0.4.2 init --opencode --dry-run --force
npx development-kit@0.4.2 init --opencode --force
```

Use `--force` only when replacing existing Development Kit-managed files is intended.

### Verification

From a source checkout:

```bash
npm run opencode:validate
npm run release:validate
```

From an installed project:

- Confirm `opencode.json` is valid JSON.
- Confirm the `$schema` value is `https://opencode.ai/config.json`.
- Confirm the obsolete `rules` key is absent.
- Confirm root `AGENTS.md` exists.
- Reload OpenCode.

## Upgrading from v0.4.0 to v0.4.2

Upgrade directly to the latest package. v0.4.2 includes the public-project improvements from v0.4.1 and the OpenCode configuration correction.

Review the v0.4.1 and v0.4.2 entries in [CHANGELOG.md](../../CHANGELOG.md), then follow the general upgrade procedure above.

## Upgrading from v0.3.0

v0.4.x introduces the production `/dk-autopilot` runtime, new release validation gates, expanded public project metadata, and current OpenCode integration.

- Review Autopilot state and approval policy documentation before enabling automated guided workflows.
- Reinstall the desired integration mode.
- Do not copy old `opencode.json` content forward.
- Run the current validation suite rather than relying on v0.3.0 pass counts.

## Related documentation

- [Versioning Policy](versioning-policy.md)
- [Compatibility Matrix](compatibility-matrix.md)
- [Install OpenCode](../02-user-guide/install-opencode.md)
- [Post-Release Verification](post-release-verification.md)
