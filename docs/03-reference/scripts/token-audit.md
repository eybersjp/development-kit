# token-audit.mjs

## Purpose

`scripts/token-audit.mjs` measures Development Kit's **framework-induced instruction weight** using a deterministic provider-independent estimate.

It does not claim provider billing accuracy. The estimator is:

```text
estimated tokens = ceil(characters / 4)
```

## Commands

Human-readable audit:

```bash
npm run token:audit
```

JSON output:

```bash
node scripts/token-audit.mjs --json
```

CI budget check:

```bash
npm run token:audit:check
```

## Reports

The audit reports:

- canonical instruction totals for `AGENTS.md`, skills, agents and commands;
- the ten priority runtime-skill total;
- a representative implementation hot-path total;
- percentage reduction against the pre-hardening v0.10.1 baseline;
- largest instruction files;
- pass/fail against regression budgets.

## Current v0.10.1 baseline

Pre-hardening audit:

- priority runtime skills: ~10,436 estimated tokens;
- representative implementation hot path: ~19,994 estimated tokens.

The v0.10.1 token-hardening change is required to keep the priority skill set below its post-hardening budget and the representative implementation hot path below its post-hardening budget.

## Runtime context telemetry

Static instruction auditing complements the `tokenProfile` emitted by `runtime/orchestration/context-package.mjs`.

That profile reports raw versus delivered authoritative-source tokens, estimated savings, advisory role budget and over-budget warnings.

## Interpretation

Use these numbers to find DKF-controlled prompt/context waste. They are deliberately stable for regression comparison, but they are **not** exact OpenAI/Anthropic/Google/provider input or output token counts.
