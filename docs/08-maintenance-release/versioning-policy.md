# Versioning Policy

Development Kit follows Semantic Versioning (SemVer 2.0.0): `MAJOR.MINOR.PATCH`.

## Version Definitions

- **MAJOR**: Breaking changes to lifecycle commands, rules contract in `AGENTS.md`, or installer behavior.
- **MINOR**: New commands, agents, skills, hooks, or templates added backwards-compatibly.
- **PATCH**: Bug fixes, documentation updates, or internal refactoring.

## Package Versioning

`package.json`, `opencode.json`, and `.agents/plugins/development-kit/plugin.json` must share the exact same version string.

## Related Documentation

- [Release Process](release-process.md)
- [Changelog Policy](changelog-policy.md)
