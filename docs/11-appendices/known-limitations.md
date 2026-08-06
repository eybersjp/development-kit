# Known Limitations

This document records current technical and operational limitations in Development Kit v0.4.2.

## Current limitations

1. **Plugin manifest version is independent from the npm package version.** The generated Antigravity plugin manifest currently reports `0.1.0` while the public npm package is `0.4.2`. Component synchronization is validated, but version parity is not yet enforced.
2. **Installer overwrite protection requires explicit migration work.** Existing `AGENTS.md`, `opencode.json`, and skill directories are preserved by default. This protects customizations, but users upgrading from the v0.4.1 OpenCode configuration must repair the old file manually or use a reviewed `--force` reinstall.
3. **Shell quoting differs by platform.** Inline JSON and complex command arguments can require different quoting in PowerShell and POSIX shells. Prefer file-based structured inputs where the command supports them.
4. **Sub-agent context must be intentionally bounded.** High-complexity work spanning many files still requires explicit context packing and staged execution.
5. **Lifecycle task execution is sequential by default.** Development Kit prioritizes deterministic gate ordering and traceability rather than uncontrolled parallel task execution.
6. **OpenCode host behaviour is externally versioned.** Development Kit validates its own `opencode.json` contract, but OpenCode itself may change independently. Host compatibility must be reverified when OpenCode changes its configuration schema or discovery behaviour.
7. **npm credentials are maintainer-managed.** Automated npm publication depends on a valid `NPM_TOKEN`; GitHub Release publication can complete independently when npm credentials are missing or invalid.

## Resolved in v0.4.2

The v0.4.1 installer generated an obsolete OpenCode `rules` key. v0.4.2 replaces it with the official schema declaration and adds a regression gate. This defect is no longer a current limitation for new v0.4.2 installations.

## Related documentation

- [Unresolved Decisions](unresolved-decisions.md)
- [Architecture Decisions](../04-architecture/architecture-decisions.md)
- [Migration Guide](../08-maintenance-release/migration-guide.md)
- [OpenCode Integration](../04-architecture/opencode-integration.md)
