# Development Kit Project Memory

## Active Architecture & Subsystems

- **Core Lifecycle**: 9 gated stages (`UNDERSTAND` → `DEFINE` → `DESIGN` → `PLAN` → `IMPLEMENT` → `VERIFY` → `REVIEW` → `SIMPLIFY` → `COMPLETE`).
- **Autopilot Runtime (`runtime/autopilot/`)**: Deterministic state machine, cryptographic tokens, lease management, non-bypassable policy engine.
- **Next-Step Guidance Subsystem (`runtime/next-step/`)**:
  - `command-registry.mjs`: Canonical registry for all 14 `/dk-*` commands with safety metadata.
  - `resolver.mjs`: Context-aware `NextStepResolver` enforcing 8 recommendation rules.
  - `formatter.mjs`: Standard Markdown response formatting (`## Suggested Next Step` / `## Suggested Next Steps`).
  - `scripts/next-step.mjs`: CLI utility for resolving next steps.
  - `skills/next-step-guidance/`: First-class skill guiding conductors and sub-agents.
- **Platform Adapters**: Claude, Cursor, VS Code, Cline, Windsurf.
- **External Research & Trust Boundaries**: Read-only defaults, provenance preservation, untrusted data isolation.

## Verified Commands (14)

1. `/dk-autopilot` — Full lifecycle in Automated Guided Workflow mode
2. `/dk-idea` — Idea discovery and requirements interview (`UNDERSTAND`)
3. `/dk-research` — Source-backed external evidence gathering
4. `/dk-spec` — Minimum specification artifact creation (`DEFINE`)
5. `/dk-design` — Technical and visual design (`DESIGN`)
6. `/dk-tasks` — Task decomposition with dependency ordering (`PLAN`)
7. `/dk-build` — Single-task TDD implementation loop (`IMPLEMENT`)
8. `/dk-build-auto` — Automated batch plan implementation (`IMPLEMENT`)
9. `/dk-test` — Verification and runtime test suite (`VERIFY`)
10. `/dk-review` — Two-stage specification and code review (`REVIEW`)
11. `/dk-simplify` — Ponytail simplicity ladder refactoring (`SIMPLIFY`)
12. `/dk-debug` — Root-cause diagnosis and remediation (`RECOVERY`)
13. `/dk-ship` — Final verification, diff review, and release prep (`COMPLETE`)
14. `/dk-status` — State, task, and lifecycle inspection (`INFORMATIONAL`)

## Key Architecture Invariants

1. **Guidance is Not Execution**: Next-Step Guidance suggests commands; it does not automatically execute them.
2. **Failure Overrides Progression**: Failures, test regressions, or active blockers halt forward progression and route to remediation.
3. **Safety Gates Authoritative**: Consequential actions (e.g. `/dk-ship`) require all human approvals to be satisfied before recommendation.
4. **Valid Commands Only**: Unregistered or fabricated commands are strictly filtered out by the canonical registry.
5. **No Intermediate Automation Spam**: Batch/automated workflows suppress intermediate next-step outputs until control returns to the user.

## Development Modes — Increment 001 (draft branch, 27 September 2026)

- Scope: isolated methodology policy foundation on `feature/development-modes-increment-001`, based on v0.10.0 `main`. This is **not released or accepted**.
- Four methodologies: Rapid, Balanced (default), Specification-Driven, Documentation-Driven. Fifth user-facing mode Maintenance & Evolution wraps an inherited methodology and requires an existing-project audit.
- Pure `runtime/development-modes/policy-contract.mjs`: validates a v1 selection, resolves profile + optional `customPolicies` + only-strengthening `projectOverrides`, returns immutable provenance and mandatory-control manifest. No persistence, no Autopilot/gate mutation and no additional dependency in Increment 001.
- Canonical design and acceptance: `docs/04-architecture/dkf-development-modes-increment-001-{spec,architecture}.md`; portable schema under `schemas/development-mode-config.schema.json`; test entry `npm run development-modes:validate` in full release validation.
- Next: Increment 002 bootstrap/persistence and historical mode changes; 003 adaptive lifecycle; 004 documentation integration; 005 compatibility and runtime acceptance. Coordinate with still-draft PR #41 (Live UI Preview v0.10.1) before rebase/release. Do not claim full end-to-end acceptance on the strength of foundation unit tests.

## Development Modes — Increment 002 (stacked draft branch, 27 September 2026)

- New `feature/development-modes-increment-002` is stacked on Increment 001 rather than merged into `main`. Both upstream PRs #41 and #42 are drafts at implementation time.
- Project bootstrap records explicit/legacy/default methodology under tracked `.development-kit/development-mode.json` using one atomically replaced revisioned record and logical history, with validation and writer lock.
- Bootstrap CLI supports numbered TTY selection, headless `--mode`/`--config-file`, read-only recommendation, status/history, and explicit `--set-mode` with expected revision and reason. Existing valid selection is preserved.
- Mode configuration remains separate from autonomy level; no new Autopilot, Development Contract, gate-selector or acceptance-engine policy consumers are installed yet. Increment 003 must bind the stored snapshot and handle active-contract reconciliation.
- Verification: `npm run development-modes:init:validate` and both OS full CI required. Independent review and Product Owner acceptance remain outstanding until evidenced.
