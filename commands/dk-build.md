---
name: dk-build
description: >-
  Implement the next approved task inside an immutable Development Contract, with execution safety, independent verification, structured review, bounded correction, and deterministic acceptance.
---

# /dk-build

## Purpose

Implements one approved task without allowing the implementation agent to certify its own work. v0.9 keeps the familiar task loop but makes the Development Contract, authoritative sources, evidence, safety policy, and acceptance engine the control plane.

## Workflow

1. Select the next approved task from the validated PLAN.
2. Run repository orientation and task-readiness checks. For visual UI work, execute DESIGN SYSTEM PRE-FLIGHT to verify `design.md` exists and is approved, then run `node scripts/ui-preview.mjs --ensure --context="<current UI task>" --route=<affected-route>`. Fulfil any `OPEN_OR_REUSE` browser action immediately. If the frontend is not runnable yet, keep `WAITING_FOR_RUNNABLE_UI` armed and ensure again as soon as the implementation creates the first runnable shell.
3. Create or resolve the active Development Contract and orchestration run using `node scripts/orchestration.mjs --operation=prepare-run`. Bind `design.md` automatically for UI/design-governed work.
4. Build a fresh implementation context from the contract and authoritative sources. The implementation report is an assertion only.
5. Before consequential shell, database, publication, deployment, infrastructure, or destructive actions, run the execution-safety assessment. `BLOCK` must not execute. `REQUIRE_APPROVAL` must use the normal explicit approval gate.
6. Implement only contract scope using existing-code-first, native-platform-first, dependency-restraint, minimal-diff, and test-first discipline. UI work must reuse the live preview and normal HMR/fast refresh; do not start duplicate DKF preview servers or substitute repeated production builds for rendered iteration.
7. Run `/dk-test` in an independently rehydrated verification context. Every acceptance criterion receives PASS, FAIL, PARTIAL, UNVERIFIED, or NOT_APPLICABLE with evidence where required. Live preview is development visibility; formal browser evidence remains owned by browser-runtime verification.
8. Run `/dk-review` with structured reviewer findings selected by risk and impact.
9. Evaluate deterministic acceptance from persisted verification, required reviews, control manifests, architecture drift, source freshness, and approvals.
10. If verification fails, call the correction engine. Automatically correct only when it returns `CORRECT`; obey its exact scope and attempt number. `PAUSE` never authorizes redesign or scope expansion.
11. Run simplification only inside the approved contract, reverify after changes, and evaluate acceptance again.
12. Mark the task complete only when runtime acceptance is `ACCEPTED`.

## Non-Negotiable Gates

- No self-certification by implementation context.
- PASS without required evidence is invalid.
- Stale authoritative source fingerprints block progress.
- Unverified required security/control coverage blocks acceptance.
- Unauthorized architecture drift blocks acceptance.
- Destructive/remote operations remain subject to contract safety policy and explicit approvals.
- `Done` is derived from runtime gate state, never authored by an agent.
- UI/design implementation must activate the live preview during development; preview availability does not itself create an acceptance verdict.

## Skills Activated

- `subagent-driven-implementation`
- `incremental-implementation`
- `test-driven-development`
- `existing-code-first`
- `native-platform-first`
- `dependency-restraint`
- `minimal-diff`
- `context-packing`
- `live-ui-preview` when UI/design work is present
- `verification-before-completion`
- `specification-compliance-review`
- `code-quality-review`
- `simplicity-review`

## Sub-Agents

- `repository-scout-agent`
- `implementation-agent`
- `spec-reviewer`
- `code-reviewer`
- conditional specialist reviewers selected by the runtime gate policy

## Output

Contract ID, run ID, source fingerprint, implementation assertions, independent verification verdict, required reviewer/control states, correction attempt if any, deterministic acceptance state, and live-preview URL/state for UI work when available.
