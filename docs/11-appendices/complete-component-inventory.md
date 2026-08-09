# Complete Component Inventory

Comprehensive inventory of the Development Kit v0.5.0 framework surface.

## Component Totals

- **Commands**: 14 slash commands (`commands/`), including `/dk-autopilot` and `/dk-research`.
- **Agents**: 18 specialist agents (`agents/`).
- **Skills**: 45 modular skills (`skills/`), including `external-research` and `agent-reach-integration`.
- **Hooks**: 4 lifecycle hooks (`hooks/`).
- **Templates**: 6 documentation templates (`templates/`).
- **Evaluation suites**: 11 suites (`evals/`).
- **Framework scripts**: 6 non-test framework/maintenance scripts plus targeted Node test suites in `scripts/`.
- **External Capability Provider architecture**: provider-neutral policy and routing with Agent-Reach as the first documented optional adapter.

## v0.5.0 Additions

| Component | Location | Role |
| :--- | :--- | :--- |
| `/dk-research` | `commands/dk-research.md` | Source-backed external research with provenance and trust controls |
| `external-research` | `skills/external-research/SKILL.md` | Provider-neutral research routing and untrusted-content policy |
| `agent-reach-integration` | `skills/agent-reach-integration/SKILL.md` | Optional Agent-Reach provider adapter guidance |
| Research contract test | `scripts/research-contract.test.mjs` | Release-critical integration validation |
| External Capability Providers | `docs/04-architecture/external-capability-providers.md` | Provider contract, capability classes, lifecycle integration, and failure behavior |

## Trust Boundary

External capability providers extend observation/tooling but do not expand Development Kit authorization. External content remains untrusted data; authenticated reads require permission; writes, installations, system changes, and destructive actions remain gated.

## Related Documentation

- [Source to Documentation Traceability](source-to-documentation-traceability.md)
- [Command Agent Skill Matrix](command-agent-skill-matrix.md)
- [External Capability Providers](../04-architecture/external-capability-providers.md)
- [Validation Reference](../07-testing-quality-security/validation-reference.md)
