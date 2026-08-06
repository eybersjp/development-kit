# validate-docs

**Source**: `scripts/validate-docs.mjs` · **Package entry**: `npm run docs:validate`

## Purpose

Validates the documentation system: coverage (every command, agent, skill, hook, template, evaluation, and script has a reference page), link integrity, navigation, and content rules.

## Syntax

```bash
node scripts/validate-docs.mjs
npm run docs:validate
npm run docs:validate:test
```

## What It Checks

### Coverage (03-reference)

- Every file in `commands/` → `docs/03-reference/commands/<name>.md`
- Every file in `agents/` → `docs/03-reference/agents/<name>.md`
- Every directory in `skills/` → `docs/03-reference/skills/<name>.md`
- Every file in `hooks/` → `docs/03-reference/hooks/<name>.md`
- Every file in `templates/` → `docs/03-reference/templates/<name>.md`
- Every directory in `evals/` → `docs/03-reference/evaluations/<name>.md`
- Every `.mjs` file in `scripts/` → `docs/03-reference/scripts/<name>.md`

### Content & Link Integrity

- Uncompleted placeholder text — error
- Local `file://` protocol URLs — error
- Broken relative Markdown links — error
- Pages not listed in `docs/SUMMARY.md` — error

## Automated Regression Tests

The validator has a permanent, dependency-free automated test suite:

- **Source**: `scripts/validate-docs.test.mjs`
- **Command**: `npm run docs:validate:test` (`node --test scripts/validate-docs.test.mjs`)
- **Engine**: Node.js built-in `node:test` and `node:assert` modules.
- **Fixture Isolation**: Tests execute against temporary isolated directories created via `fs.mkdtempSync` in OS temp space. Real repository documentation is never mutated.
- **Test Scenarios (7)**:
  1. Valid fixture passes cleanly.
  2. Broken relative Markdown link fails.
  3. Placeholder marker fails.
  4. Missing required command reference page fails.
  5. Markdown page absent from `docs/SUMMARY.md` fails.
  6. Prohibited local file URL fails.
  7. Broken link registered in `docs/SUMMARY.md` fails.

## Output

Coverage and integrity lines, then a summary with pass/warning/error counts.

## Exit Codes

- 0 when no errors
- 1 when any error is present

## Idempotency

Read-only.

## Security & Path Safety

- Resolves doc links within `docs/`; no writes.

See [validator-internals.md](../../06-internals/validator-internals.md) and [documentation-maintenance-policy.md](../../00-documentation/documentation-maintenance-policy.md).
