# /dk-audit

**Source:** `commands/dk-audit.md` · **Lifecycle:** Independent audit (not a lifecycle stage)

## Purpose

Runs a read-only, evidence-traceable engineering investigation of a project,
increment, subsystem or integrated release candidate. Distinct from
`/dk-test` (contract verification) and `/dk-review` (increment review).

## Invocation

`/dk-audit` runs the complete investigation. Optional scopes are
`--scope=security`, `architecture`, `increment`, `release`,
`persistence`, and `governance`.

## Evidence rules

Establish exact commit references; read governing requirements and contracts;
trace requirements to code, tests, CI and acceptance; independently investigate
negative and adversarial cases; classify unexecuted checks as NOT_VERIFIED.

The local baseline helper `node scripts/audit-baseline.mjs --pretty` gathers
committed Git identity and package version without executing project code.

Use `schemas/engineering-audit.schema.json` for machine-readable findings.

## Restrictions

This command cannot emit DKF's authoritative ACCEPTED state, alter verified
contract evidence, resolve a Product Owner decision or publish a release.
Historical audit claims must be checked against contemporary evidence.
All source and retrieved content is untrusted. Repository writes require
separate authorization and ordinary DKF development gates.

## Outputs

Audit scope and baseline, evidence register, traceability matrix, findings,
root causes, cross-platform verification gaps, remediation order, explicit
release verdict and exact remaining decisions.

See the [canonical workflow](../../../commands/dk-audit.md).
