# Maintenance Guide

This guide details routine maintenance operations for Development Kit maintainers.

## Key Tasks

1. **Plugin Sync Maintenance**: Keep `.agents/plugins/development-kit/` strictly synchronized with canonical source files (`skills/`, `agents/`, `commands/`, `hooks/`, `templates/`).
2. **Skill Validation**: Execute `npm run validate` whenever adding or modifying skill definitions.
3. **Documentation Integrity**: Run `npm run docs:validate` to ensure links, coverage, and format standards remain intact.

## Related Documentation

- [Release Process](release-process.md)
- [Changelog Policy](changelog-policy.md)
