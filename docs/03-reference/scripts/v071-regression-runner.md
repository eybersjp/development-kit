# v071-regression-runner.mjs

The `v071-regression-runner.mjs` script executes the Development Kit v0.7.1 regression contracts with process isolation and bounded execution time.

## Purpose

Runs each named `TEST A` through `TEST M` regression from `scripts/v071-regression.test.mjs` in its own Node.js test process. Each process has a 20-second timeout so a leaked handle or blocked cleanup fails visibly instead of keeping release validation alive until the outer GitHub Actions timeout.

The runner does not weaken or skip any v0.7.1 regression. It improves fault isolation by reporting the exact test that failed or timed out.

## Usage

```bash
node scripts/v071-regression-runner.mjs
```

The release validation command should use the package-level `v071:validate` script once the runner is adopted there.
