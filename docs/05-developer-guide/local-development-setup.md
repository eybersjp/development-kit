# Local Development Setup

## Prerequisites

- Node.js `>=18` (CI uses 22)
- npm
- Git

## Clone & Install

```bash
git clone https://github.com/eybersjp/development-kit.git
cd development-kit
npm install   # installs no runtime dependencies; standard tooling only
```

## Verify the Environment

```bash
npm run validate          # structural validation (expect 277 checks passing)
npm run doctor            # manifest sync check
npm run docs:validate     # documentation validation
```

## Repository Layout (Canonical Only)

Edit **only** these locations:

```text
agents/     commands/   skills/   hooks/   templates/   evals/   scripts/
```

Never edit `.agents/plugins/development-kit/` directly — it is the plugin mirror.

## Development Loop

1. Make changes in canonical locations.
2. Run `npm run validate` — fix any frontmatter/structure errors.
3. If you added/removed skills, agents, or hooks: `node scripts/sync-plugin.mjs`.
4. If you changed docs: run `npm run docs:validate`.
5. Test installer changes in a scratch directory (see [testing-installer-changes.md](testing-installer-changes.md)).

## Local Antigravity Testing

Install from your working copy:

```bash
node scripts/install-antigravity.mjs --project      # into ./.agents/
node scripts/install-antigravity.mjs --global       # into ~/.gemini/config/
node scripts/install-antigravity.mjs --all --dry-run
```

## IDE/Editor Notes

- Markdown and JavaScript only; no build step.
- The repo is dependency-free (zero runtime dependencies in `package.json`).

## Common Issues

- `npm run doctor` reporting "Missing skills" — manifest drift; regenerate with `node scripts/sync-plugin.mjs` (see [sync-plugin.md](../03-reference/scripts/sync-plugin.md)).
- Mirror files out of date — run the installer or sync script; never hand-edit the mirror.

See [repository-conventions.md](repository-conventions.md) for conventions.
