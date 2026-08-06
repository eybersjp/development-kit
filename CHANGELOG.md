# Changelog

All notable changes to Development Kit are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed
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
- Formal conductor–runtime handshake.
- Fifteen Autopilot lifecycle evaluation scenarios and automated validation.

## [0.3.0] - 2026-08-06

### Added
- Production-grade 12-section documentation system.
- Documentation validation suite and installer synchronization verification.

[Unreleased]: https://github.com/eybersjp/development-kit/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/eybersjp/development-kit/compare/development-kit-v0.4.0...v0.4.1
[0.4.0]: https://github.com/eybersjp/development-kit/releases/tag/development-kit-v0.4.0
[0.3.0]: https://github.com/eybersjp/development-kit/releases/tag/v0.3.0
