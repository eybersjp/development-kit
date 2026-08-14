# Known Limitations

This document records current technical and operational limitations in Development Kit v0.6.1.

## Current limitations

1. **Plugin manifest version is independent from the npm package version.** The generated Antigravity plugin manifest currently reports `0.1.0` while the public npm package uses the v0.6 release line. This is intentional for the current plugin-manifest contract; component and mirror synchronization are enforced separately.
2. **Installer overwrite protection requires explicit migration work.** Existing `AGENTS.md`, `opencode.json`, and skill directories are preserved by default. This protects customizations, but users carrying older generated configuration may need a reviewed `--force` reinstall or manual migration.
3. **Shell quoting differs by platform.** Inline JSON and complex command arguments can require different quoting in PowerShell and POSIX shells. Prefer file-based structured inputs where the command supports them.
4. **Sub-agent context must be intentionally bounded.** High-complexity work spanning many files still requires explicit context packing and staged execution.
5. **Lifecycle task execution is sequential by default.** Development Kit prioritizes deterministic gate ordering and traceability rather than uncontrolled parallel task execution.
6. **OpenCode host behaviour is externally versioned.** Development Kit validates its own `opencode.json` contract, but OpenCode itself may change independently. Host compatibility must be reverified when OpenCode changes its configuration schema or discovery behaviour.
7. **External Capability Providers are independently versioned.** Agent-Reach and future providers can change outside Development Kit. Provider compatibility and authenticated/session-sensitive behavior must be reverified when provider versions change.
8. **npm credentials are maintainer-managed.** Automated npm publication depends on a valid `NPM_TOKEN`; GitHub Release publication can complete independently when npm credentials are missing or invalid.

## Resolved in v0.6.1

1. **Standalone installer omitted `runtime/`.** Standalone installation (`installAll`) now bundles `runtime/autopilot` and `runtime/next-step` so installed projects execute without repository fallbacks.
2. **Next-Step guidance required fail-closed gating.** Next-Step guidance now enforces fail-closed multi-gate ship predicates and explicit post-simplification verification status checks.

## Resolved in v0.5.1

The committed Antigravity plugin mirror could previously drift from canonical skills, agents, commands, or hooks while `npm run doctor` still exited successfully. v0.5.1 synchronizes the mirror and changes doctor into a failing release gate for manifest, inventory, and byte-level content drift.

## Resolved in v0.4.2

The v0.4.1 installer generated an obsolete OpenCode `rules` key. v0.4.2 replaced it with the official schema declaration and added a regression gate.

## Related documentation

- [Unresolved Decisions](unresolved-decisions.md)
- [Architecture Decisions](../04-architecture/architecture-decisions.md)
- [Canonical Source & Plugin Mirror](../04-architecture/canonical-source-and-plugin-mirror.md)
- [Migration Guide](../08-maintenance-release/migration-guide.md)
- [OpenCode Integration](../04-architecture/opencode-integration.md)
