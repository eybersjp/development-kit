# Dependency Policy

## Current State

`package.json` declares **zero runtime dependencies** and **zero dev dependencies**. This is a deliberate, maintained property of the repository — the framework itself practices the `dependency-restraint` skill it teaches.

## Policy Rules

1. **No new dependencies without justification** — apply the Ponytail ladder:
   - Can Node's standard library do it? (`node:fs`, `node:path`, `node:url` — the existing scripts use only these)
   - Can the platform do it?
   - Can an existing dependency do it?
2. **A dependency must justify itself** by the complexity it saves — not by popularity.
3. **Validation and tooling must stay dependency-free** — the validators run with zero installs (`npm ci` then `npm run validate` works with nothing).
4. **Document the decision** — update [architecture-decisions.md](../04-architecture/architecture-decisions.md) or the relevant guide when a dependency is added.

## Why It Matters

- **Install speed & trust**: `npm install` is a no-op for the package itself; consumers get the methodology without supply-chain surface.
- **Supply-chain risk**: fewer dependencies = fewer compromised-package vectors (see [threat-model.md](../07-testing-quality-security/threat-model.md)).
- **Dogfooding**: the framework's own repo is the proof that its restraint principles work.

## When a Dependency Is Genuinely Needed

If a future feature genuinely requires a dependency (e.g. a schema parser), the bar is:

- Native options documented as insufficient
- Dependency from a trusted, maintained source
- Security review of the addition (per `security-review`)
- Justification recorded in the technical design template's Dependencies table
- Update this policy and the dependency-restraint documentation

## Evaluation Reference

`evals/dependency-restraint/scenario-01-unnecessary-dep.json` models the expected reasoning: lodash, moment, axios, and uuid all rejected in favour of native capabilities.

See [dependency-restraint.md](../03-reference/skills/dependency-restraint.md) and [native-platform-first.md](../03-reference/skills/native-platform-first.md).
