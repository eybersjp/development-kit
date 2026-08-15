# Changelog

All notable changes to Development Kit are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.7.0] - 2026-08-15

### Added
- **DK Intelligence**: Built-in, local-first engineering memory and intelligence layer preserving technical context, architecture decisions, and proven lessons across sessions.
- **DK Local Memory**: Offline atomic file-based persistence under `.development-kit/intelligence/memory/` with deterministic project partitioning and zero external database dependencies.
- **Authority & Trust Model**: Strict separation of authority classes (`user-approved`, `repository-verified`, `system-verified`, `inferred`, `imported-untrusted`) with transition validation.
- **Provenance & Staleness Tracking**: SHA-256 artifact fingerprinting for automatic staleness detection and invalidation, preserving complete supersession histories for architecture decisions.
- **Lifecycle-Aware Context Assembly**: Dynamic, budgeted token context retrieval prioritizing decisions matching the current lifecycle stage without exceeding context windows.
- **Candidate Extraction & Secret Filtering**: Automatic extraction of decision candidates from `/dk-design`, `/dk-debug`, `/dk-review`, and `/dk-ship` with built-in regex filtering against credentials and API tokens.
- **DK Control Center**: Integrated, zero-dependency local browser interface providing graphical inspection and management of Overview, Workflow, Memory, Decisions, Providers, and Settings.
- **Automatic Control Center Launch Engine**: Configurable `controlCenter.autoOpen` setting (default: `Off`), hierarchical project-over-global precedence, and automatic launch suppression in CI/headless/test environments.
- **Secure Local Runtime API**: Loopback-bound (`127.0.0.1`) HTTP service protected by runtime session tokens (`X-DK-Session-Token`) and strict CORS deny-by-default anti-CSRF protections.
- **Agent Loadouts & Skill Governance**: Scoped memory permissions per specialist role and governance gates for learned/provider skill candidates.
- **Import, Export & Recovery**: Portable memory bundle export and safe import with default untrusted trust classification and corrupt file isolation.
- **Native Knowledge & Code Intelligence Providers**: Lightweight filesystem-based documentation search and symbol lookup.
- **TencentDB Agent Memory Adapter**: Optional remote provider adapter with graceful degradation and zero core framework lock-in.

### Security
- Memory records are informational only and strictly cannot authorize consequential actions or bypass approval tokens.
- Remembered approval claims cannot satisfy Autopilot gates without live cryptographic tokens.
- Cross-origin browser write attempts without valid session token fail closed.
- Inferred and imported-untrusted records cannot promote themselves to `user-approved` without explicit user confirmation.

## [0.6.1] - 2026-08-13

### Added
- Context-aware Suggested Next Step guidance automatically computed and appended to completed Development Kit command responses.
- Centralized Next-Step runtime (`runtime/next-step/`) and CLI bridge (`scripts/next-step.mjs`) supporting Markdown and JSON output formatting.
- `next-step-guidance` meta skill and conductor agent integration across the complete 9-stage lifecycle.
- Strict schema validation for context inputs (`validateContextSchema`), CLI flags, and context files.
- Explicit `postSimplificationVerificationStatus` state to prevent premature shipping after code simplification.

### Changed
- Engineering skill count updated from 45 to 46 in catalogue and documentation.
- Command routing documentation updated for next-step lifecycle recommendations.
- Release validation pipeline (`release:validate`) expanded to include `next-step:test` and `installer:validate:test`.

### Fixed
- Standalone installation (`installAll`) now includes `runtime/` to prevent missing-module runtime failures.
- Distribution packaging test (`scripts/install-antigravity.test.mjs`) now verifies that all runtime modules (`autopilot`, `next-step`), skills, scripts, and plugins are packaged.
- Fixed ESM integration in `runtime/next-step/formatter.mjs` by using valid static ES module imports.
- Eliminated unsafe and premature `/dk-ship` recommendations; `/dk-ship` is strictly forbidden immediately after simplification.
- Fixed missing-review evidence defaulting; absence of review status fails closed instead of passing.
- Fixed CLI error handling so malformed context input fails safely with exit code 1.

### Security
- Consequential `/dk-ship` recommendations fail closed, requiring all 9 explicit conditions: success, approvalStatus (`approved`), verificationStatus (`passed`), testsStatus (`passed`), reviewStatus (`passed`), postSimplificationVerificationStatus (`passed`), empty blockers, empty outstandingApprovals, and non-automated mode.

## [0.6.0] - 2026-08-11

### Added
- Multi-platform integration across Claude Code (`CLAUDE.md`, `.claude/skills/`), Cursor (`.cursor/rules/dkf.mdc`), VS Code / GitHub Copilot (`.github/copilot-instructions.md`), Cline / Roo Code (`.clinerules/dkf.md`), and Windsurf (`.windsurf/rules/dkf.md`).
- CLI installer platform flags `--claude`, `--cursor`, `--vscode`, `--cline`, `--windsurf`, and `--all-platforms` for `npx development-kit init`.
- Platform template validation suite and `"platform:validate"` script in `package.json`.

## [0.5.2] - 2026-08-10

### Fixed
- Made skill frontmatter validation OS-agnostic by normalizing CRLF and LF line endings before parsing.
- Made canonical plugin mirror comparisons ignore line-ending-only differences while continuing to detect material content drift.

### Added
- Added focused regression tests covering LF, CRLF, and mixed line-ending behavior in skill validation and plugin mirror comparison.

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

[Unreleased]: https://github.com/eybersjp/development-kit/compare/v0.6.1...HEAD
[0.6.1]: https://github.com/eybersjp/development-kit/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/eybersjp/development-kit/compare/v0.5.2...v0.6.0
[0.5.2]: https://github.com/eybersjp/development-kit/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/eybersjp/development-kit/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/eybersjp/development-kit/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/eybersjp/development-kit/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/eybersjp/development-kit/compare/development-kit-v0.4.0...v0.4.1
[0.4.0]: https://github.com/eybersjp/development-kit/releases/tag/development-kit-v0.4.0
[0.3.0]: https://github.com/eybersjp/development-kit/releases/tag/v0.3.0
