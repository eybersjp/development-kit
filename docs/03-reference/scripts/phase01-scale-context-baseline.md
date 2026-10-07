# phase01-scale-context-baseline.mjs

## Purpose

`scripts/phase01-scale-context-baseline.mjs` is an analysis-only baseline runner for the Development Kit Scale, Context & Iteration initiative.

It measures the current framework before implementation changes are made. The script does not modify DKF production runtime behaviour, change package versions, publish releases, or mutate repository state outside temporary test fixtures.

## What it measures

The runner records:

- repository, test, and canonical instruction-file inventory;
- the existing deterministic token/context audit;
- representative single-package context packaging;
- representative multi-package context packaging;
- representative calculation-heavy context packaging;
- Autopilot state-file growth across 26 immutable revisions;
- current observability gaps for provider token usage, repository reads/scans, agent invocations, and host tool calls.

## Representative fixtures

The fixtures are synthetic and deterministic. They exercise the existing DKF runtime APIs rather than claiming to reproduce provider billing or a specific production repository exactly.

The multi-package fixture contains web, mobile, shared, calculation, and database-style paths. The calculation-heavy fixture establishes a baseline before domain/numerical gate profiles exist.

## Usage

Print JSON to standard output:

```bash
node scripts/phase01-scale-context-baseline.mjs
```

Optionally persist the JSON output:

```bash
node scripts/phase01-scale-context-baseline.mjs --out=path/to/baseline.json
```

## Measurement rules

The runner reuses `scripts/token-audit.mjs` and the existing `runtime/orchestration/token-efficiency.mjs` estimator.

Estimated token values therefore remain deterministic `ceil(characters / 4)` approximations and must not be represented as provider billing-token counts.

Metrics that the current runtime cannot observe are emitted as unavailable with a reason instead of being estimated or fabricated.

## Scope

This script belongs to Phase 0/1 evidence gathering only. Later Cost Observatory work may extend or replace parts of this runner after the baseline has been preserved.
