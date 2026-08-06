# Changelog

All notable changes to Development Kit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-08-06

### Added
- **🚀 AUTOMATED GUIDED WORKFLOW (`/dk-autopilot`)**: New lifecycle-wide automated guided workflow mode.
- **Executable Runtime Subsystem (`scripts/autopilot.mjs`)**: Deterministic Node.js CLI state and policy engine supporting `--init`, `--status`, `--next`, `--begin-action`, `--record-result`, `--approve`, `--reject`, `--cancel`, `--pause`, `--resume`, `--renew-action`.
- **State Persistence & Locking (`runtime/autopilot/state-store.mjs`, `lock-manager.mjs`)**: Versioned state snapshot persistence with corrupt pointer recovery and short transaction locking (<50ms).
- **Security Tokens Architecture (`runtime/autopilot/security-tokens.mjs`)**: Replay-safe approval tokens, constant-time buffer equality (`crypto.timingSafeEqual`), and SHA-256 state hashing.
- **Policy Engine & Staleness Engine (`runtime/autopilot/policy-engine.mjs`, `staleness-engine.mjs`)**: 3 autonomy levels (`guided-autopilot`, `high-autonomy`, `review-every-stage`), 14 mandatory non-bypassable security gates, pre-authorized staging target evaluation, and artifact content fingerprinting.
- **Conductor–Runtime Handshake Protocol**: Formalized execution protocol between `development-conductor` and the Autopilot runtime CLI.
- **15 Behavioral Evaluation Scenarios (`evals/autopilot-lifecycle/`)** and validator script (`scripts/validate-evals.mjs`).

## [0.3.0] - 2026-08-06

### Added
- Production-grade 12-section documentation system, validation suite, and installer sync verification.
