# Research Contract Validation

`npm run research:validate` runs `scripts/research-contract.test.mjs` and verifies that the v0.5.0 external research integration remains wired into the framework.

## Coverage

The contract test checks:

- `package.json` is on the v0.5.0 release line and includes `research:validate` inside `release:validate`.
- `/dk-research` exists and declares the external-content trust boundary.
- `external-research` exists and includes provider-neutral routing, provenance, and untrusted-content handling.
- `agent-reach-integration` remains optional, approval-gated, and explicit about installation and sensitive session material.
- `AGENTS.md`, the development conductor, and `/dk-autopilot` all expose `/dk-research`, approval behavior, and the untrusted-data invariant.
- The Antigravity plugin manifest registers both research skills.
- `docs/SUMMARY.md` links the research command, skills, and External Capability Provider architecture page.

## Role in Release Validation

`npm run release:validate` runs the research contract after OpenCode validation and before the Autopilot/evaluation gate. GitHub CI also runs it explicitly on pull requests targeting `main`.

This is a structural integration test. It does not contact external providers and does not install Agent-Reach or any other provider tooling.
