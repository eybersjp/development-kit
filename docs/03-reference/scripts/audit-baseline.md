# Audit Baseline Helper

**Source:** `scripts/audit-baseline.mjs`

## Purpose

Creates a read-only JSON snapshot of a local repository for the independent
`/dk-audit` investigation. This is repository identification, not a security
audit, a test runner or a release certification.

## Usage

```sh
node scripts/audit-baseline.mjs --pretty
node scripts/audit-baseline.mjs --root /absolute/project/path --pretty
```

The helper reads `package.json` as data, asks Git for root/HEAD/branch and
tracked working-tree status, and produces a SHA-256 fingerprint of those
observations. It does not run npm scripts, make network requests or write files.

No committed Git repository or inaccessible root results in NOT_VERIFIED or
a nonzero error, as appropriate. Remote state, CI, ignored/untracked files,
tests, security and release state require separate evidence.

## Verification

`node --test scripts/audit-baseline.test.mjs`.
