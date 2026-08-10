# Release Quality Gates

This document defines the quality gates required before any work or version of Development Kit can be released.

## Authoritative Release Gate

The authoritative command is:

```bash
npm run release:validate
```

A release is blocked unless the complete command succeeds.

## Release Gates

1. **Framework Validation Gate**: `npm run validate` passes all current skill, agent, command, compatibility, and manifest-reference checks.
2. **Plugin Synchronization Gate**: `npm run doctor` confirms the committed Antigravity plugin manifest is synchronized with canonical skills, agents, and hooks.
3. **Documentation Gate**: `npm run docs:validate` passes with zero errors and complete reference/SUMMARY coverage.
4. **Documentation Validator Regression Gate**: `npm run docs:validate:test` passes.
5. **OpenCode Compatibility Gate**: `npm run opencode:validate` passes.
6. **External Research Contract Gate**: `npm run research:validate` confirms `/dk-research`, research skills, provider trust boundaries, plugin registration, documentation navigation, and package wiring remain integrated.
7. **Autopilot Runtime Gate**: `npm run autopilot:test` passes.
8. **Evaluation Gate**: `npm run evals:validate` passes all behavioural evaluation structure/scenario checks.
9. **Pull Request CI Gate**: GitHub CI passes on the final PR head SHA before merge.
10. **Release Workflow Gate**: the maintainer release workflow reruns `npm run release:validate` on `main` before creating/verifying the version tag and GitHub Release.
11. **Clean Release State**: no unexpected temporary files, local paths, secrets, credentials, provider session material, or scratch artifacts are included.

## External Capability Provider Security Gate

For changes involving External Capability Providers:

- Retrieved content remains untrusted data.
- Authenticated reads remain permission-sensitive.
- External writes, system/provider installation, configuration changes, and destructive operations retain their required approval gates.
- Agent-Reach remains optional and outside the Development Kit core dependency graph.
- Provider credentials, cookies, tokens, browser profiles, and session material are not committed.
- Material research evidence retains provenance and uncertainty where required.

A simplification or release change must not remove these controls merely to reduce code or make validation pass.

## Failure Policy

Any failing gate blocks the release. Fix the underlying implementation, documentation, synchronization, test, or policy contract and rerun the complete affected validation path. Do not bypass the gate.

## Related Documentation

- [Quality Strategy](quality-strategy.md)
- [Validation Reference](validation-reference.md)
- [Pre-Release Checklist](../08-maintenance-release/pre-release-checklist.md)
- [External Capability Providers](../04-architecture/external-capability-providers.md)
- [Threat Model](threat-model.md)
