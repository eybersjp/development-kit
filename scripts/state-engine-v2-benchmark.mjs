// Deterministic, disposable T04 endurance fixture. Records observed performance;
// it does not turn a host-specific elapsed time into a false release acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  appendEntityState,
  getStateEnginePaths,
  loadCanonicalEvents,
  loadEntityState,
  verifyStateEngineIntegrity,
} from '../runtime/orchestration/state-engine-v2.mjs';

const countArg = process.argv.includes('--events')
  ? Number(process.argv[process.argv.indexOf('--events') + 1])
  : 300;
assert.ok(Number.isInteger(countArg) && countArg >= 1 && countArg <= 5000, '--events must be between 1 and 5000');
const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-t04-endurance-'));
try {
  const start = performance.now();
  let modeledOldRewriteBytes = 0;
  for (let revision = 1; revision <= countArg; revision += 1) {
    appendEntityState({
      rootDir,
      entityType: 'endurance-fixture',
      entityId: 'same-entity',
      state: { stateRevision: revision, value: revision, mark: 'T04' },
      actorClass: 'endurance-test',
      timestamp: new Date(Date.UTC(2026, 9, 9, 0, 0, 0) + revision * 1000).toISOString(),
    });
    modeledOldRewriteBytes += fs.statSync(getStateEnginePaths(rootDir).events).size;
  }
  const writeDurationMs = performance.now() - start;
  const readStart = performance.now();
  const events = loadCanonicalEvents(rootDir);
  const state = loadEntityState('endurance-fixture', 'same-entity', rootDir);
  const integrity = verifyStateEngineIntegrity(rootDir);
  const readVerifyDurationMs = performance.now() - readStart;
  assert.equal(events.length, countArg);
  assert.equal(state.stateRevision, countArg);
  assert.equal(integrity.valid, true);
  const bytes = fs.statSync(getStateEnginePaths(rootDir).events).size;
  console.log('T04_ENDURANCE_EVIDENCE ' + JSON.stringify({
    events: countArg,
    platform: process.platform,
    node: process.version,
    writeDurationMs: Math.round(writeDurationMs),
    readVerifyDurationMs: Math.round(readVerifyDurationMs),
    canonicalLedgerBytes: bytes,
    physicallyAppendedEventBytes: bytes,
    historicalFullRewriteByteModel: modeledOldRewriteBytes,
    rewriteBytesAvoidedPercentModeled: Number(((1 - bytes / modeledOldRewriteBytes) * 100).toFixed(2)),
    pass: integrity.valid,
    limitations: 'Historical full-rewrite traffic is computed from file sizes, not a measured legacy run. CPU parsing/replay is still full-history.',
  }));
} finally {
  fs.rmSync(rootDir, { recursive: true, force: true });
}
