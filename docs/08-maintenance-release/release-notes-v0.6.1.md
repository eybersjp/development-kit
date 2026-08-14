# Development Kit v0.6.1 Release Notes (Proposed Release Candidate)

## Overview

Development Kit `v0.6.1` is a proposed maintenance and feature update that introduces **Context-Aware Next-Step Guidance**, hardens consequential action gating with fail-closed safety predicates, resolves standalone installer completeness by bundling the `runtime/` subsystem, and adds comprehensive distribution verification tests.

> [!IMPORTANT]
> **Status:** Proposed v0.6.1 Release Candidate. Publication, tagging, and deployment remain strictly pending final human approval and clean-environment certification.

## User-Visible Improvements

1. **Context-Aware Suggested Next Step Guidance:**
   - Completed Development Kit commands automatically compute and append a formatted `## Suggested Next Step(s)` section to response markdown.
   - Intelligently recommends the single most logical next command based on completed tasks, lifecycle stage, verification state, outstanding human approval gates, and safety constraints.
2. **CLI Bridge for Next-Step Calculations (`scripts/next-step.mjs`):**
   - Enables CLI and script querying of next-step recommendations via `--command`, `--stage`, `--context-json`, `--context-file`, and `--format=markdown|json`.
3. **Standalone Installer Completeness:**
   - Standalone installation (`npx development-kit init --all`) now copies the `runtime/` directory (`runtime/autopilot` and `runtime/next-step`), ensuring self-contained offline execution without repository fallback.
4. **Expanded Skill Catalogue:**
   - Total engineering skill count increased from 45 to 46 with the addition of `next-step-guidance`.

## Safety Improvements

1. **Fail-Closed Consequential `/dk-ship` Gating:**
   - Recommending `/dk-ship` requires all 9 explicit positive conditions: `success === true`, `approvalStatus === 'approved'`, `verificationStatus === 'passed'`, `testsStatus === 'passed'`, `reviewStatus === 'passed'`, `postSimplificationVerificationStatus === 'passed'`, empty `blockers`, empty `outstandingApprovals`, and non-automated mode (`!isAutomated`).
   - Absence, undefined, null, or unverified review status strictly fails closed.
2. **Post-Simplification Regression Gate:**
   - After `/dk-simplify`, the resolver recommends only `/dk-test`; `/dk-ship` is strictly prohibited immediately following simplification. Earlier test passes do not satisfy post-simplification verification.
3. **Strict Input and Context Schema Validation:**
   - CLI flags, JSON strings, and context files are strictly validated against canonical schemas before evaluation; invalid or malformed inputs exit safely with code 1.

## Installation

### Antigravity Global / Project
```bash
npx development-kit@0.6.1 init
```

### OpenCode Integration
```bash
npx development-kit@0.6.1 init --opencode
```

### Multi-Platform Adapters
```bash
npx development-kit@0.6.1 init --all-platforms
```

## Upgrade Guidance

Projects upgrading from v0.6.0 or v0.5.2 can update project skills and configurations by running:

```bash
npx development-kit@0.6.1 init --force
```

Existing customized `AGENTS.md` and repository configurations are preserved unless explicitly overridden.

## Compatibility

- **Node.js**: `>=18.0.0` (Tested on Node.js 18, 20, and 22).
- **Operating Systems**: Windows (PowerShell/CMD), macOS, Linux (Ubuntu 24.04).
- **Supported Hosts**: Antigravity, OpenCode, Claude Code, Cursor, VS Code (GitHub Copilot), Cline, Windsurf.

## Verification Evidence

All release quality gates pass cleanly across supported platforms:

- `validate` & `skills:validate:test`: Component structure, metadata, and CRLF/LF invariance verified.
- `doctor` & `sync:validate:test`: Plugin manifest and committed mirror synchronized.
- `docs:validate` & `docs:validate:test`: Documentation navigation, links, and version consistency verified.
- `opencode:validate`: Official schema-based `opencode.json` verified.
- `platform:validate`: Multi-platform adapter templates and CLI options verified.
- `research:validate`: Provider-neutral research trust boundaries and integration verified.
- `next-step:test`: 42 next-step unit, safety fail-closed, schema validation, and CLI tests passed.
- `installer:validate:test`: Standalone installation, runtime bundling, and distribution packaging verified.
- `autopilot:test` & `evals:validate`: 22 Autopilot runtime tests and 25 evaluation scenarios passed.

## Known Limitations

1. **Antigravity Plugin Manifest Versioning**: `plugin.json` reports `0.1.0` reflecting the internal Antigravity plugin schema contract rather than the npm package version.
2. **Sequential Task Discipline**: Multi-task plans execute sequentially with individual subagent dispatches to prevent assumption drift.

## Rollback Guidance

If rollback is required prior to public release:

```bash
git checkout v0.6.0
```

For installed projects, re-run `npx development-kit@0.6.0 init --force`.

## Candidate Status

- **Status**: Release Candidate (Unreleased).
- **Commit Authorization**: Local commits `f01bb35` and `24f53c7` created locally; release preparation commit pending review.
- **Publication**: NOT published, tagged, or pushed. Publication strictly requires explicit human authorization.
