# Source to Documentation Traceability

This matrix maps every canonical source file in the Development Kit repository to its corresponding reference documentation page.

| Canonical Source Directory | Reference Documentation Path | Validator Check |
| :--- | :--- | :--- |
| `commands/*.md` | `docs/03-reference/commands/*.md` | `npm run docs:validate` |
| `agents/*.md` | `docs/03-reference/agents/*.md` | `npm run docs:validate` |
| `skills/*/SKILL.md` | `docs/03-reference/skills/*.md` | `npm run docs:validate` |
| `hooks/*.js` | `docs/03-reference/hooks/*.md` | `npm run docs:validate` |
| `templates/*.md` | `docs/03-reference/templates/*.md` | `npm run docs:validate` |
| `evals/*/` | `docs/03-reference/evaluations/*.md` | `npm run docs:validate` |
| `scripts/*.mjs` | `docs/03-reference/scripts/*.md` | `npm run docs:validate` |

## Related Documentation

- [Complete Component Inventory](complete-component-inventory.md)
- [Validation Reference](../07-testing-quality-security/validation-reference.md)
