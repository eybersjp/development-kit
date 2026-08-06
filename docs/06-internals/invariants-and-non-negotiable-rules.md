# Invariants & Non-Negotiable Rules

## Non-Negotiable (Never Violate)

| # | Rule | Source |
| :--- | :--- | :--- |
| 1 | Lifecycle order is fixed: UNDERSTAND → DEFINE → DESIGN → PLAN → IMPLEMENT → VERIFY → REVIEW → SIMPLIFY → COMPLETE | `AGENTS.md`, conductor |
| 2 | No implementation before definition | Conductor workflow |
| 3 | Tasks are sequential; never start the next while the current has unresolved failures | Always-on rule 12 |
| 4 | Review order: spec compliance → code quality → conditional → simplicity | Always-on rule 9 |
| 5 | The conductor never implements code itself | Agent definition |
| 6 | Fresh sub-agent per implementation task | Always-on rule 7 |
| 7 | Simplicity never removes security, validation, error handling, accessibility, data integrity, or tests | Ponytail exclusions |
| 8 | Canonical-only edits; mirror never edited directly | Source-of-truth map |
| 9 | Manifest generated, never hand-edited | Source-of-truth map |
| 10 | Installer never overwrites user files without `--force` | Installer guards |
| 11 | Completion requires fresh evidence, never the implementer's word | Always-on rule 10, verification-before-completion |

## Hard Constraints (System Properties)

- Zero runtime dependencies (see [dependency-policy.md](../05-developer-guide/dependency-policy.md)).
- Node.js `>=18`.
- Validators are read-only.
- Installer uses plain copies only (no symlinks/junctions).
- `package.json` never overwritten by the installer.

## What Happens If Violated

| Violation | Detection |
| :--- | :--- |
| Mirror edited | Drift between canonical/mirror; docs mismatch |
| Manifest hand-edited | `npm run doctor` drift report |
| Frontmatter broken | `npm run validate` error |
| Doc page missing | `npm run docs:validate` error |
| Tag/version mismatch | `publish.yml` check fails |

## Rationale

These rules are the framework's identity: they convert "AI writes code" into a repeatable, verifiable engineering process. Relaxing them silently changes the product — treat any relaxation as a deliberate architecture decision (see [architecture-decisions.md](../04-architecture/architecture-decisions.md)).
