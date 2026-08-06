# Contributing to Development Kit

Thank you for helping improve Development Kit. The project values focused changes, explicit requirements, evidence-backed claims, and small reviewable diffs.

## Before opening a change

1. Search existing issues and pull requests.
2. Open an issue for material behaviour, architecture, lifecycle, compatibility, or policy changes.
3. Keep the proposal scoped to one clear outcome.
4. Do not include secrets, customer data, or proprietary repository content.

## Development setup

```bash
git clone https://github.com/eybersjp/development-kit.git
cd development-kit
npm run release:validate
```

Node.js 18 or newer is required. CI currently runs on Node.js 22.

## Change expectations

- Inspect existing agents, skills, commands, runtime modules, and documentation before adding new components.
- Preserve the canonical lifecycle unless a deliberate framework change is approved.
- Add or update tests for behaviour changes.
- Update reference documentation and source-derived inventories when component counts or contracts change.
- Keep generated mirrors synchronized through the repository's existing scripts.
- Avoid adding dependencies when native Node.js capabilities are sufficient.

## Required verification

Run the full gate suite before submitting:

```bash
npm run release:validate
git diff --check
```

All failures must be resolved or explicitly explained in the pull request.

## Pull requests

A strong pull request includes:

- The user or maintainer problem being solved.
- The smallest chosen approach and alternatives considered.
- A concise file-level change summary.
- Test and validation evidence.
- Documentation and compatibility impact.
- Known limitations or follow-up work.

Pull requests should not combine unrelated refactors, formatting changes, and feature work.

## Commit messages

Use clear, imperative commit messages. Conventional prefixes are encouraged:

```text
feat: add a user-visible capability
fix: correct broken behaviour
docs: improve documentation
test: add or strengthen verification
refactor: change structure without changing behaviour
chore: repository maintenance
```

## Security issues

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md).

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
