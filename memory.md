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
