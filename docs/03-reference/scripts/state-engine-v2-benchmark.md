# state-engine-v2-benchmark.mjs

## Purpose

A reproducible, disposable **v0.13 State Engine V2 endurance fixture** that checks canonical event append and history reconstruction without modifying an existing project.

The script creates a temporary project, appends generic entity revisions, verifies the monotonic canonical hash chain and final entity state, then removes the fixture.

## Usage

```bash
npm run state-engine-v2:benchmark
node scripts/state-engine-v2-benchmark.mjs --events 1000
```

The bounded CI/review fixture uses 300 events. The CLI accepts 1–5,000 events for targeted measurements.

## Reported observations

The script emits `T04_ENDURANCE_EVIDENCE` JSON including operation count, platform/Node version, append duration, integrity-read duration, final canonical-ledger bytes and modeled write savings against the former full-ledger-rewrite design.

The historical rewrite comparison is a deterministic calculation from observed ledger lengths, not a measured execution of the retired implementation and not a release-wide performance claim.

## Authority and safety

- `events.jsonl` remains canonical.
- Snapshot/index are rebuildable.
- Interrupted appends are recovery-gated.
- The fixture uses a disposable temporary project.
- Passing the benchmark does not satisfy independent risk-3 acceptance.
