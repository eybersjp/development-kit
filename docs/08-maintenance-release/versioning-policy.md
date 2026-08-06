# Versioning Policy

Development Kit follows Semantic Versioning 2.0.0 using `MAJOR.MINOR.PATCH`.

## Version definitions

- **MAJOR:** incompatible changes to lifecycle commands, persistent state, safety contracts, host integration, or installer behaviour.
- **MINOR:** backwards-compatible commands, agents, skills, hooks, runtime capabilities, or other user-facing features.
- **PATCH:** backwards-compatible bug fixes, compatibility repairs, documentation corrections, validation improvements, and internal maintenance.

The OpenCode configuration compatibility correction from v0.4.1 to v0.4.2 is a patch because it restores intended host support without changing the public workflow model.

## Package version source

`package.json` is the source for the public npm package version.

The release tag must use:

```text
v<package.json version>
```

For example, package version `0.4.2` uses tag `v0.4.2`.

## Configuration versions

`opencode.json` is a host configuration file, not a package-version registry. It declares the current official OpenCode schema and does not contain the Development Kit package version.

`.agents/plugins/development-kit/plugin.json` currently has an independent plugin manifest version. Its component references must remain synchronized, but its version is not automatically forced to equal `package.json`. This limitation is documented in [Known Limitations](../11-appendices/known-limitations.md).

## Release consistency requirements

Before release:

- `package.json` version matches the requested `vMAJOR.MINOR.PATCH` tag.
- `CHANGELOG.md` contains the release entry.
- Documentation reflects the current behaviour and migration requirements.
- `opencode.json` satisfies the current OpenCode configuration regression gate.
- The complete release validation suite passes.

## Tag policy

Use one canonical public tag per release:

```text
vMAJOR.MINOR.PATCH
```

Do not create redundant aliases for the same commit.

## Related documentation

- [Release Process](release-process.md)
- [Changelog Policy](changelog-policy.md)
- [Compatibility Matrix](compatibility-matrix.md)
