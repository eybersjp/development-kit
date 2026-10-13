# DKF v0.12.0 — Matched Release Comparative Evidence

**Measured:** 13 October 2026. **Baseline:** Git tag `v0.11.2`. **Candidate:** `release/v0.12-no-state-engine` (commit must be rechecked at release freeze). **Scope:** Identical instruction-file selection and `chars-div-4-v1` static estimator (`Math.ceil(text.length / 4)` per file). Both snapshots were read from GitHub source blobs rather than local uncommitted state.

## AC-033 — Cost evidence

| Metric | v0.11.2 | v0.12.0 candidate | Observed change | Classification |
|---|---:|---:|---:|---|
| Priority runtime skill instruction estimate (10 exact files) | 2,820 | 2,820 | **0%** | Measured deterministic estimate |
| Implementation hot-path instruction estimate (20 exact files) | 7,587 | 7,587 | **0%** | Measured deterministic estimate |
| Provider billed input/output tokens | Unavailable | Unavailable | Not measurable | No provider telemetry |
| Actual provider charges | Unavailable | Unavailable | Not measurable | No provider billing access |
| Host repository read counts per workflow | Unavailable | Unavailable | Not measurable | Host calls not instrumented |
| Host tool calls per workflow | Unavailable | Unavailable | Not measurable | Host calls not instrumented |

The Cost Observatory implementation can compare and preserve **observed** cost records when the host supplies them. Its synthetic `cost-observatory.test.mjs` fixture demonstrates comparator arithmetic, **not measured deployment savings**. No financial cost reduction is claimed by this release.

## AC-035 — Context and repository orientation

On the matched instruction-file scope, `v0.12.0` has **not changed** the inherited v0.11.2 core prompt/instruction footprint. Therefore the directly comparable static token-estimate change is **0%**. This is not evidence of a performance gain. The v0.12 context cache adds first-class reuse and invalidation support, verified by `context-cache.test.mjs`, but measured production host read/orientation reduction is currently **unavailable** because repository tool reads are not centrally instrumented.

This is a documented missed/unobservable improvement objective, not a claim that the optimization is absent or that there is a measured improvement. Do not conflate fixture cache hit counters with observed provider billing or work hours.

## Measurement method and limitations

The exact priority-runtime skill list and 20-file implementation hot-path list are defined in `scripts/token-audit.mjs` (unchanged across comparison snapshots). Each GitHub UTF-8 source blob was measured by `Math.ceil(content.length / 4)`; sums were compared by filename between tag `v0.11.2` and current candidate source. The current estimator is **not a model token counter** and cannot measure billing usage. GitHub source blobs normalize committed line endings; differences between Windows CRLF checkout and Linux LF checkout are not evidence of model-token savings. No provider private data was queried.

Historical Phase 0/1 documentation includes earlier pre-hardening static improvements against *pre-v0.11* instruction baselines; these gains predate v0.12 and are **not attributed to v0.12**.

## Evidence verdict

**Observed static context footprint:** 0% change relative to v0.11.2, on exact matching instruction filenames.

**Actual runtime cost/orientation improvement:** UNAVAILABLE / NOT OBSERVABLE with current host telemetry. Claim neither success nor failure against unobservable runtime counters.

**Release interpretation:** AC-033 and AC-035 require transparent comparison evidence. This document provides an honest comparison on measurable static metrics, and records precisely the measurements the host cannot currently produce. A Product Owner or independent acceptance authority must decide whether this satisfies the scoped release criterion; the author cannot self-approve it.

## Reproduction

From the two source snapshots, identify the priority and hot-path file arrays in `scripts/token-audit.mjs`. For each file, compute `Math.ceil(rawUtf8Text.length / 4)` and sum. On normalized GitHub blobs:

- Priority skills: baseline **2,820**, candidate **2,820**
- Implementation hot path: baseline **7,587**, candidate **7,587**

The acceptance manifest must bind any subsequent remeasurement to the exact final source commit and report any changes.
