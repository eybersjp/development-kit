#!/usr/bin/env node

/**
 * Development Kit v0.7.1 regression runner.
 *
 * Runs each named regression in its own Node test process. This prevents one
 * leaked handle or stuck cleanup from hiding which contract failed, and places
 * a hard upper bound on every regression so release validation fails closed
 * instead of hanging until the outer GitHub Actions timeout.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testFile = join(__dirname, 'v071-regression.test.mjs');
const testIds = 'ABCDEFGHIJKLM'.split('');
const timeoutMs = 20_000;

let failures = 0;

console.log('=== Development Kit v0.7.1 Regression Runner ===');
console.log(`Running ${testIds.length} regressions with ${timeoutMs / 1000}s per-test timeout.\n`);

for (const id of testIds) {
  const pattern = `^TEST ${id}:`;
  const startedAt = Date.now();
  const result = spawnSync(
    process.execPath,
    ['--test', `--test-name-pattern=${pattern}`, testFile],
    {
      encoding: 'utf8',
      timeout: timeoutMs,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'test',
        DK_HEADLESS: process.env.DK_HEADLESS || '1',
      },
    },
  );
  const durationMs = Date.now() - startedAt;

  if (result.error?.code === 'ETIMEDOUT') {
    failures += 1;
    console.error(`✗ TEST ${id} timed out after ${durationMs}ms`);
    continue;
  }

  if (result.status !== 0) {
    failures += 1;
    console.error(`✗ TEST ${id} failed after ${durationMs}ms`);
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
    continue;
  }

  console.log(`✓ TEST ${id} passed in ${durationMs}ms`);
}

if (failures > 0) {
  console.error(`\n${failures} v0.7.1 regression test(s) failed or timed out.`);
  process.exit(1);
}

console.log(`\nAll ${testIds.length} v0.7.1 regression tests passed.`);
