# Scripts Index

Development Kit ships **7 non-test Node.js scripts** in `scripts/`, exposed through the installer or `package.json`:

| Script | Package Entry | Purpose | Reference |
| :--- | :--- | :--- | :--- |
| **autopilot.mjs** | `npm run autopilot:test` | Executable runtime CLI engine for `/dk-autopilot` | [autopilot.md](autopilot.md) |
| **install-antigravity.mjs** | `npx development-kit init` / `npm run init` / `bin` | Installs the plugin into Antigravity, standalone, or OpenCode | [install-antigravity.md](install-antigravity.md) |
| **install-platform-adapters.mjs** | Platform flags on `npx development-kit init` | Installs project-local Claude Code, Cursor, VS Code with GitHub Copilot, Cline, and Windsurf adapters | [install-platform-adapters.md](install-platform-adapters.md) |
| **sync-plugin.mjs** | `npm run doctor` (`--check`) | Regenerates / checks the plugin manifest | [sync-plugin.md](sync-plugin.md) |
| **validate-skills.mjs** | `npm run validate` | Validates skills, agents, commands, and manifest references | [validate-skills.md](validate-skills.md) |
| **validate-docs.mjs** | `npm run docs:validate` | Validates documentation coverage, links, and placeholders | [validate-docs.md](validate-docs.md) |
| **validate-evals.mjs** | `npm run evals:validate` | Validates evaluation suite scenarios structure and JSON syntax | [validate-evals.md](validate-evals.md) |

## Exit Codes

- `validate-skills.mjs` — exits 1 on errors, 0 otherwise
- `sync-plugin.mjs --check` — always exits 0 (reports drift but does not fail; see [known-limitations.md](../../11-appendices/known-limitations.md))
- `validate-docs.mjs` — exits 1 on errors, 0 otherwise
- `install-antigravity.mjs` — exits 1 when no target is found and none requested; 0 otherwise

See [validation-architecture.md](../../04-architecture/validation-architecture.md) for how the scripts fit together.
