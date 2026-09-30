---
name: dk-build
description: >-
  Implement the next approved Development Contract task through required safety, verification, review, correction, and acceptance gates.
---

# /dk-build

## Workflow

1. Select the next approved validated PLAN task.
2. Use cached repository orientation when valid; perform task-specific delta inspection and readiness checks.
3. For UI work execute DESIGN SYSTEM PRE-FLIGHT to verify `design.md`, ensure Live UI Preview, fulfil `OPEN_OR_REUSE`, and preserve HMR.
4. Check and discover configuration dependencies (`node scripts/orchestration.mjs --operation=configuration-readiness --action=discover`). If missing configuration is detected:
   - Prepare target locations (`.env.local`) safely with line numbers and `.gitignore` safety.
   - Generate `.development-kit/SECRETS_SETUP.md`.
   - PAUSE for Product Owner decision (`configure`, `defer`, `generate`, `cancel`). Never invent credentials or fake values.
5. Create/resolve contract + run with `node scripts/orchestration.mjs --operation=prepare-run`.
6. Build fresh implementation context. Sensitive values are never exposed to AI contexts. Use source sections and inspect `tokenProfile`; repack over-budget context instead of dropping required authority.
7. Preflight consequential commands through execution safety.
8. Implement only contract scope using existing-code-first, native-platform-first, dependency restraint, minimal diff and required tests.
9. Run `/dk-test` in independent verification context; every required criterion/control receives evidence-backed status. Criteria depending on deferred or missing configuration remain UNVERIFIED.
10. Run only required/risk-selected reviewers and evaluate deterministic acceptance.
11. If correction engine returns `CORRECT`, apply only its exact bounded scope and reverify; otherwise pause.
12. Simplify only inside scope, reverify changes, and complete only at acceptance `ACCEPTED`.

## Non-Negotiable Gates

- No self-certification by implementation context.
- Secrets & Configuration Readiness Gate: Unresolved or invalid configuration blocks acceptance; missing release-critical configuration blocks release; deferred configuration forces dependent criteria to UNVERIFIED.
- PASS without required evidence is invalid.
- Stale authoritative source fingerprints block progress.
- Unverified required security/control coverage blocks acceptance.
- Unauthorized architecture drift blocks acceptance.
- Destructive/remote operations remain subject to contract safety policy and explicit approvals.
- Preview availability is not acceptance.
- `Done` is derived from runtime gate state, never authored by an agent.

## Output

Contract/run/fingerprint, changed files/evidence references, verification/review states, correction attempt, acceptance state, blockers, and preview URL/state when relevant. Do not restate full source text.
