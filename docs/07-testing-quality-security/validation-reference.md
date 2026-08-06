# Validation Reference

## Validator Commands

| Command | Script | Checks | Fails |
| :--- | :--- | :--- | :--- |
| `npm run validate` | `validate-skills.mjs` | Skill/agent/command structure; manifest references | Exit 1 on errors |
| `npm run doctor` | `sync-plugin.mjs --check` | Manifest counts vs directories | Never (reports drift) |
| `npm run docs:validate` | `validate-docs.mjs` | Reference coverage, links, placeholders, navigation | Exit 1 on errors |
| `npm run docs:validate:test` | `validate-docs.test.mjs` | Automated regression test suite for documentation validator | Exit 1 on failure |

## Expected Baseline (v0.3.0)

- `npm run validate` → **277 checks passed**, 0 errors
- `npm run doctor` → counts correct (43 skills, 18 agents, 4 hooks) — in sync
- `npm run docs:validate` → **97 checks passed**, 0 errors (all reference pages present)
- `npm run docs:validate:test` → **7 tests passed**, 0 failures (fixture isolated)

## Coverage Matrix

| Component | Count | Reference Location | Validated By |
| :--- | :--- | :--- | :--- |
| Commands | 12 | `docs/03-reference/commands/` | docs:validate |
| Agents | 18 | `docs/03-reference/agents/` | validate + docs:validate |
| Skills | 43 | `docs/03-reference/skills/` | validate + docs:validate |
| Hooks | 4 | `docs/03-reference/hooks/` | docs:validate |
| Templates | 6 | `docs/03-reference/templates/` | docs:validate |
| Evaluations | 10 | `docs/03-reference/evaluations/` | docs:validate |
| Scripts | 4 | `docs/03-reference/scripts/` | docs:validate |
| Configs | 3 | `docs/03-reference/configuration/` | docs:validate |

## CI Wiring

- `ci.yml`: `validate` + `doctor` on push/PR to `main` (Node 22, ubuntu).
- `publish.yml`: `validate` + `doctor` + tag↔version check before publish.
- `docs:validate` is **not** wired into CI — documented gap.

## Interpreting Failures

- `validate` ✗ → named file; fix frontmatter/structure.
- `docs:validate` ✗ → named file + link/missing page; fix the doc.
- `doctor` drift → regenerate the manifest (`node scripts/sync-plugin.mjs`).

See [validator-internals.md](../06-internals/validator-internals.md) and [running-validation.md](../05-developer-guide/running-validation.md).
