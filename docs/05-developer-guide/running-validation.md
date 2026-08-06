# Running Validation

## The Three Validators

| Command | Script | What It Validates | Fails? |
| :--- | :--- | :--- | :--- |
| `npm run validate` | `scripts/validate-skills.mjs` | Skill/agent/command structure, manifest reference resolution | Exit 1 on errors (warnings allowed) |
| `npm run doctor` | `scripts/sync-plugin.mjs --check` | Manifest counts vs directories, missing entries | Never fails (reports drift) |
| `npm run docs:validate` | `scripts/validate-docs.mjs` | Doc coverage, links, placeholders, navigation | Exit 1 on errors |
| `npm run docs:validate:test` | `scripts/validate-docs.test.mjs` | Automated regression suite for documentation validator | Exit 1 on failure |

## Standard Workflow

```bash
npm run validate
npm run doctor
npm run docs:validate
npm run docs:validate:test
```

## Reading the Output

- `✓` — pass
- `⚠` — warning (non-blocking; fix when practical)
- `✗` — error (must fix; exit code 1)

## When to Run What

| Change | validate | doctor | docs:validate |
| :--- | :--- | :--- | :--- |
| Skill/agent/command content edit | ✅ | — | ✅ (if docs changed) |
| Skill/agent/hook added/removed | ✅ | ✅ (after sync) | ✅ |
| Docs edit | — | — | ✅ |
| Installer change | — | — | — (see [testing-installer-changes.md](testing-installer-changes.md)) |
| Pre-release | ✅ | ✅ | ✅ |

## CI Equivalents

- `ci.yml` runs `validate` + `doctor` on push/PR to `main`.
- `publish.yml` runs `validate` + `doctor` then a tag↔version check before `npm publish`.
- `docs:validate` is not yet in CI (see [known-limitations.md](../11-appendices/known-limitations.md)).

## Troubleshooting

- `validate` errors → fix frontmatter or structure; the error names the file.
- `doctor` drift → `node scripts/sync-plugin.mjs` (regenerate).
- `docs:validate` errors → create the missing reference page or fix the broken link; the error names the file and link.

See [validation-reference.md](../07-testing-quality-security/validation-reference.md).
