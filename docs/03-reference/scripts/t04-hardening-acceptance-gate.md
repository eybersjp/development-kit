# t04-hardening-acceptance-gate.mjs

## Purpose

Runs the established DKF `decideAcceptance` engine for the T04 State Engine V2 hardening increment **only in GitHub Actions** after the full CI verification and exact `npm run release:validate` step has passed.

This is an audit/acceptance evidence gate, not a replacement for independent review. It checks the Git blob identifiers of each independently reviewed State Engine source, both new regression suites and the approved offline recovery boundary. If a reviewed file changes, execution fails closed until new review evidence is established.

## Usage

```bash
node scripts/t04-hardening-acceptance-gate.mjs
```

The command **must be executed in trusted CI**, with the repository and pull request context available. It cannot report acceptance from an arbitrary local working tree.

## Evidence

The gate loads the T04 Development Contract `INC-DKF120-T04` from the prior T04 validator; assembles verification for AC-012, AC-013, AC-014, AC-015 and AC-034; and checks the original role-specific T04 review document together with the independently completed source-level Codex review at exact source commit `9a6ad4712b3dc62dd9b758e0e6745e27576bbdc5`.

It exercises the actual runtime control-coverage and acceptance engines and records:

- `verification.json` with typed evidence and source fingerprints;
- `control-security.json` with full security control coverage;
- `acceptance.json` with the computed verdict, complete blocker/pending arrays, reviewed file witnesses and provenance.

Acceptance requires **zero blockers and zero pending gates**; any unmet requirement fails the CI step rather than being silently promoted.

CI uploads the artifacts from `.development-kit/runs/INC-DKF120-T04/T04-HARDENING-REVIEWED-20261009/`.

## Review authority and limitations

The final review must remain attributable to independent source inspection; test success cannot itself replace review. The original T04 code, architecture and security role reviews are recorded in `docs/04-architecture/dkf-state-engine-v2-t04-review.md`. The hardening changes were independently re-reviewed in PR #70; no new unresolved P1/P2 issues were reported on the reviewed production source. Reviewer records consolidate these known reviews, and do not represent separate newly executed reviewer-agent jobs.

The supported legacy backup restoration operation remains exclusively controlled, trusted, offline maintenance; no arbitrary same-UID hostile process isolation is claimed. Windows custom ACLs require separate host-native validation where nonstandard ACLs apply.

Only the stacked T04 feature branch may integrate PR #70 once all gates pass. This does **not** authorize merging cumulative PR #69 to `main`, publishing v0.12, deleting legacy data or starting T05 without its own approved contract.
