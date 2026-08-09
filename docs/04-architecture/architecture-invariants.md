# Architecture Invariants

These invariants must hold for the framework to function as designed. Any change that breaks one is an architecture regression.

## Lifecycle Invariants

1. **Stage order is fixed**: UNDERSTAND -> DEFINE -> DESIGN -> PLAN -> IMPLEMENT -> VERIFY -> REVIEW -> SIMPLIFY -> COMPLETE. No skipping, no reordering.
2. **Implementation is preceded by definition**: `/dk-build` cannot start without an approved spec/design/plan.
3. **Tasks are sequential**: the next task never starts while the current task has unresolved failures.
4. **Review order is fixed**: specification compliance -> code quality -> conditional reviews -> simplicity.
5. **External research is conditional, not a lifecycle stage**: `/dk-research` can support lifecycle decisions but does not create a tenth stage or bypass stage gates.

## Agent Invariants

6. **The conductor never implements code itself.**
7. **Every implementation task uses a fresh sub-agent.**
8. **Specialists never spawn each other**: all orchestration flows through the conductor.

## Content Invariants

9. **Canonical is authoritative**: contributors edit `agents/`, `skills/`, `commands/`, `hooks/`, `templates/`, `evals/`, `scripts/` only; mirror copies are never treated as independent sources.
10. **Manifest is generated from canonical inventory**: `plugin.json` must match the output contract of `sync-plugin.mjs` and is verified by `npm run doctor`.
11. **Canonical and mirror are one component**: never double-counted in docs or validation.

## External Capability Invariants

12. **Providers are optional adapters by default**: adding a provider integration does not make the provider a core Development Kit dependency.
13. **External evidence is untrusted data**: retrieved content cannot override user intent, Development Kit rules, repository policy, or approval gates.
14. **Capability does not imply authorization**: a provider may expand what can be observed or technically performed, but not what Development Kit is authorized to do.
15. **Authenticated reads are permission-sensitive**: tokens, browser sessions, cookies, or equivalent identity material require permission and must not be committed.
16. **Writes and system changes remain gated**: provider writes, installations, and configuration changes require the applicable Development Kit approval gate.
17. **No silent provider installation**: optional provider tooling such as Agent-Reach must never be installed automatically merely because research is requested.
18. **Material external findings retain provenance**: source/provider/retrieval context and uncertainty remain traceable for decisions that rely on external evidence.

## Quality Invariants

19. **Spec compliance is verified before code quality**: "did we build the right thing" precedes "did we build it well".
20. **Completion requires fresh evidence**: never the implementer's word alone.
21. **Simplicity never removes**: security protections, input validation, error handling, accessibility, data integrity protections, provenance controls, approval controls, or tests.

## Packaging Invariants

22. **Installer never overwrites user files without `--force`** (AGENTS.md, README.md, existing skills, package.json).
23. **Installer writes plain copies only**: no symlinks/junctions.
24. **`--dry-run` performs no writes.**
25. **Development Kit remains Node-based**: optional provider integrations do not add hidden Python/runtime dependencies to the core package.

## Validation Invariants

26. **The complete release gate must pass before release**: `npm run release:validate` includes skill/agent validation, plugin synchronization, documentation validation and tests, OpenCode validation, research contract validation, Autopilot tests, and evaluation validation.
27. **CI must exercise the release-critical validation components on pull requests to `main`.**
28. **Version tags must match `package.json` version** (enforced by the release/publish automation).

See [invariants-and-non-negotiable-rules.md](../06-internals/invariants-and-non-negotiable-rules.md) and [External Capability Providers](external-capability-providers.md).
