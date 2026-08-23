---
name: dk-review
description: >-
  Run independent specification verification and structured technical reviews, then feed verified findings into deterministic acceptance.
---

# /dk-review

## Purpose

Runs the independent review cycle for the active Development Contract. Specification verification and technical review remain separate responsibilities. Reviewer prose cannot override authoritative sources or runtime evidence.

## Workflow

1. Resolve the active contract/run and independently rehydrate authoritative sources, current repository state, actual diff, test evidence, dependency delta, and relevant design/security constraints.
2. Run specification verification first. Every acceptance criterion must have a structured evidence-backed status.
3. Run `code-reviewer` using contract scope and actual diff.
4. Select conditional reviewers from risk and impact: `security-reviewer`, `accessibility-reviewer`, `design-reviewer`, `architecture-reviewer`, and later simplicity review as applicable.
5. Reviewer findings must use structured severity INFO / WARNING / MAJOR / CRITICAL and disposition OPEN / RESOLVED / ACCEPTED_RISK / NOT_APPLICABLE.
6. MAJOR/CRITICAL findings require evidence. ACCEPTED_RISK requires approval provenance.
7. Run architecture-drift detection for new dependencies, services, storage, top-level patterns, API surfaces, environment requirements, migration strategies, and auth patterns. Classify EXPECTED / AUTHORIZED / UNAUTHORIZED / REQUIRES_DECISION.
8. For UI work, independently bind authoritative `design.md` and require design/runtime evidence; do not accept the implementer's statement that the design system was followed.
9. Submit the verification records, structured reviews, control manifests, architecture drift, and approvals to the deterministic acceptance engine.

## Acceptance Rule

The review command may recommend action but may not mark the increment accepted. Runtime acceptance is:
- `ACCEPTED` only when all required inputs pass;
- `PENDING` when required evidence/reviews/controls/approvals are incomplete;
- `BLOCKED` for failed verification/review, stale context, or unauthorized architecture drift.

## Skills Activated

- `specification-compliance-review`
- `code-quality-review`
- conditional `security-review`
- conditional `accessibility-review`
- conditional `design-quality-review`

## Sub-Agents

- `spec-reviewer`
- `code-reviewer`
- conditional `security-reviewer`
- conditional `accessibility-reviewer`
- conditional `design-reviewer`
- conditional `architecture-reviewer` capability

## Output

Structured verification/reviewer verdicts, evidence-backed findings, architecture-drift status, unresolved gate list, and deterministic acceptance state.
