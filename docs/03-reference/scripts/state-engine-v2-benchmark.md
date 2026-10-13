# state-engine-v2-benchmark.mjs

## Purpose

A reproducible, disposable **T04 State Engine V2 endurance fixture** that checks canonical event append and history reconstruction without modifying an existing project.

The script creates a temporary project, appends a sequence of generic entity revisions, verifies that every event remains in its monotonic canonical hash chain, verifies the final entity state, then removes the temporary project.

## Usage

```bash
npm run state-engine-v2:benchmark
node scripts/state-engine-v2-benchmark.mjs --events 1000
```

The CI matrix uses 300 events on **Ubuntu and Windows** to keep continuous verification bounded. The CLI accepts 1–5,000 events for targeted endurance measurements.

## Reported observations

The script reports `T04_ENDURANCE_EVIDENCE` JSON containing operation count, platform/Node version, append duration, read/integrity verification duration, final canonical ledger bytes and modeled disk-write savings against the previous full-ledger rewrite design.

**Measurement boundary:** the historical rewrite comparison is a deterministic calculation from observed event-ledger lengths, not a measured execution of the old implementation. These are local deterministic fixtures, not user billing-token observations or release-wide performance claims. The implementation still revalidates/replays canonical history on reads and that CPU cost can increase with event count.

## Authority and safety

- `events.jsonl` remains canonical; snapshot/index are rebuildable.
- The pending journal permits deterministic repair of interrupted append writes.
- Event writes and preparation are confined under the process-aware project-local lock.
- History and final entity state must pass integrity validation.
- The fixture never modifies canonical repository release data.
- No v0.12 release approval is implied by passing this benchmark.

## Scope

This is T04 technical verification, not a replacement for T10 release-wide baseline comparison.
