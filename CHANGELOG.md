# Changelog

All notable changes to Development Kit are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.5.1] - 2026-08-09

### Fixed
- Synchronized the committed Antigravity plugin mirror with canonical v0.5 research content, including `/dk-autopilot`, `/dk-research`, `external-research`, `agent-reach-integration`, and the updated development conductor.
- Strengthened `npm run doctor` so manifest drift, missing mirror files, extra mirror files, and byte-level content mismatches now fail the release gate instead of being reported only.
- Corrected plugin-mirror architecture and maintainer documentation to match the enforced synchronization contract.

### Changed
- `scripts/sync-plugin.mjs` now synchronizes canonical `skills/`, `agents/`, `commands/`, and `hooks/` into the committed mirror before regenerating `plugin.json` in write/fix mode.
- The v0.5 research contract is patch-version tolerant so patch releases do not require weakening or rewriting the feature contract.

## [0.5.0] - 2026-08-09

### Added
- `/dk-research` as a provider-neutral command for source-backed external research with provenance and uncertainty handling.
- `external-research` skill for deciding when current external evidence is required, selecting approved capability paths, and keeping retrieved content outside the trusted control plane.
- `agent-reach-integration` skill documenting Agent-Reach as the first optional External Capability Provider adapter.
- External Capability Provider architecture with READ, AUTHENTICATED READ, WRITE, SYSTEM, and DESTRUCTIVE capability classes.
- Research contract validation in the release gate to verify command, skill, plugin, trust-boundary, documentation-navigation, and package integration.

### Changed
- Development conductor and `/dk-autopilot` can conditionally route through `/dk-research` when fresh external evidence materially affects lifecycle decisions.
- Development Kit now prefers repository evidence, native capability, and already-connected services before optional external providers.
- Antigravity plugin metadata registers both new research skills.
- Public component counts are now 14 workflow commands, 18 specialist agents, and 45 engineering skills.
- Release validation now includes the external research integration contract.

### Security
- External pages, provider output, posts, comments, transcripts, documents, and other retrieved material are explicitly classified as untrusted data and cannot override user intent, Development Kit rules, repository policy, or approval gates.
- Authenticated provider reads require permission to use account/session material; provider writes and host/system changes remain approval-gated.
- Provider credentials, cookies, tokens, and session material must not be committed or placed in research artifacts.
- Optional provider installation must not occur silently; pinned tagged releases or commits are preferred over mutable installation sources such as `main.zip`.

## [0.4.2] - 2026-08-06

### Added
- `opencode:validate` release gate to reject obsolete or malformed OpenCode project configuration.

### Fixed
- Replaced the obsolete OpenCode `rules` configuration key with the current official schema-based configuration. OpenCode loads the project `AGENTS.md` automatically.
- The maintainer release command now creates the GitHub Release directly because tag pushes made with GitHub's workflow token do not recursively trigger another workflow.

## [0.4.1] - 2026-08-06

### Added
- Professional public-project foundation: contribution guide, security policy, support policy, code of conduct, issue forms, pull-request template, and root MIT license.
- `release:validate` command for the complete release gate suite.
- GitHub Release creation to the tag-driven publish workflow.
- Maintainer-only, issue-driven release command that validates the repository before creating an annotated version tag.
- CODEOWNERS coverage for the repository and release-sensitive paths.
- Monthly Dependabot monitoring for GitHub Actions.

### Changed
- Repositioned the README around user outcomes, trust signals, installation, safety controls, and the Automated Guided Workflow.
- Expanded npm package metadata, search keywords, repository links, author information, and packaged runtime files.
- Expanded CI to validate documentation, Autopilot tests, and behavioural evaluations.
- Hardened the publish workflow with the complete release validation suite and least-privilege permissions.
- Made npm publication optional so missing npm credentials cannot block the public GitHub Release.

## [0.4.0] - 2026-08-06

### Added
- **Automated Guided Workflow (`/dk-autopilot`)** for lifecycle-wide orchestration.
- Deterministic Node.js runtime supporting initialization, status, next-action planning, action recording, approval, rejection, cancellation, pause, resume, and lease renewal.
- Versioned workflow-state persistence, transaction locking, project/workspace identity, and corrupt-pointer recovery.
- Replay-resistant security tokens with constant-time verification and hashed persistent storage.
- Three autonomy levels, mandatory approval gates, staging-target policy evaluation, and artifact staleness invalidation.
- Formal conductor-runtime handshake.
- Fifteen Autopilot lifecycle evaluation scenarios and automated validation.

## [0.3.0] - 2026-08-06

### Added
- Production-grade 12-section documentation system.
- Documentation validation suite and installer synchronization verification.

[Unreleased]: https://github.com/eybersjp/development-kit/compare/v0.5.1...HEAD
[0.5.1]: https://github.com/eybersjp/development-kit/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/eybersjp/development-kit/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/eybersjp/development-kit/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/eybersjp/development-kit/compare/development-kit-v0.4.0...v0.4.1
[0.4.0]: https://github.com/eybersjp/development-kit/releases/tag/development-kit-v0.4.0
[0.3.0]: https://github.com/eybersjp/development-kit/releases/tag/v0.3.0