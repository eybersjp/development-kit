# Release Notes v0.11.2

**Released:** 1 October 2026

## Development Modes, IDEA Authority Hardening & Workflow Modernization

Development Kit v0.11.2 integrates project-owned Development Modes and comprehensive IDEA Authority Hardening on top of the v0.11.1 Live UI Preview and Token Efficiency foundation, along with modernizing GitHub Actions workflow runtimes.

### Development Modes

- Five developer-facing methodologies: **Rapid**, **Balanced** (default), **Specification-Driven**, **Documentation-Driven**, and **Maintenance & Evolution**.
- Revisioned project-owned mode state (`.development-kit/development-mode.json`) with deterministic policy resolution, recommendation heuristics, and explicit change-control history.
- Mode-aware specification, artifact planning, and task decomposition behavior.
- Immutable Development Contract mode snapshots (`modeSnapshot`) with fingerprint verification; mode changes apply forward to new contracts without retroactively modifying existing contracts.
- Maintenance & Evolution mode enforces repository audit obligations before implementing changes.
- Mandatory reliability, verification, security, and Product Owner approval controls remain strictly non-bypassable across all modes.

### IDEA Authority Hardening

- Explicit requirement provenance tracking: `USER_STATED`, `USER_CONFIRMED`, `AI_PROPOSED`, `RESEARCH_DERIVED`, and `ASSUMED`.
- Bounded interaction flow presenting one persisted numbered interaction at a time with cryptographic interaction fingerprints.
- Journal-first, hash-chained persistence for discovery state with crash recovery and corruption fail-closed protection.
- Interaction consumption protected by hash-chained receipts preventing replay attacks.
- Design Authority applicability and disposition bound to Product Owner authority; mock authority state is rejected.
- Canonical Idea Brief (`docs/01-concept/idea-brief.md`) approval bound to exact artifact, discovery, and design fingerprints.
- Fails closed on stale sources, direct manual edits, replay attempts, or authority chain tampering.

### Modernization & Reliability

- Development Contract schema updated to v1.2.0 for mode-snapshot binding while maintaining backward compatibility with v1.0 and v1.1 contracts.
- Suggestion promotion strictly requires explicit Product Owner authority.
- GitHub Actions modernized to current actions (`checkout@v7`, `setup-node@v7`, `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`), eliminating deprecated Node 20 runtime warnings.

### Release Facts

- Package version: `0.11.2`.
- Public command surface: 16 workflow commands.
- Canonical engineering-skill count: 48.

See `CHANGELOG.md` for the complete change record.
