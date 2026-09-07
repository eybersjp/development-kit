# Development Kit Framework Documentation

Welcome to the official documentation for **Development Kit Framework v0.10.0** (`development-kit@0.10.0`).

DKF is evolving into **the reliability control plane for agentic software development**.

> **AI can write it. DKF proves it.**

The current v0.10 release is the reliability baseline. It already provides Development Contracts, independent verification, deterministic acceptance, execution-safety controls, DKF Design Authority, DK Intelligence, DK Control Center, and the Numbered Decision Interface. The future direction is published separately so planned capabilities are never confused with implemented behavior.

## Strategic documents

- [DKF Strategic Direction](../STRATEGY.md)
- [DKF Roadmap](../ROADMAP.md)
- [Repository README](../README.md)

## Current release highlights

| Package Version | 0.10.0 |
| Lifecycle Stages | 9 (current fixed v0.10 lifecycle) |
| Workflow Commands | 16 |
| Specialist Agents | 18 |
| Engineering Skills | 47 |
| Native Workflow Adapters | 16 |

- **Reliability Control Plane:** approved tasks become fingerprinted Development Contracts before execution.
- **Independent verification:** implementation reports remain non-authoritative and cannot self-certify completion.
- **Deterministic acceptance:** acceptance is computed from criteria, evidence, required reviews, risk-derived gates, controls, source freshness, Design Authority, architecture drift, traceability, and approvals.
- **Authority Graph:** incomplete requirement/task/evidence traceability can block acceptance.
- **Bounded correction:** correction loops remain constrained by scope, risk, attempt limits, and repeated-failure detection.
- **Execution safety:** destructive and remote commands are evaluated against contract scope and blast radius.
- **Canonical reconciliation:** artifact amendments require exact source fingerprints and write/read-back verification.
- **Deterministic PLAN validation:** task counts, dependencies, cycles, ownership, and acceptance-criterion coverage are computed rather than trusted from prose.
- **DKF Design Authority:** `design.md` is the authoritative frontend visual source of truth when established for a project.
- **DK Intelligence and DK Control Center:** durable engineering context plus a local governance and inspection surface.
- **Provider-neutral research:** source-backed research retains provenance, uncertainty, and explicit trust boundaries.
- **Numbered Decision Interface:** bounded Product Owner choices resolve deterministically from structured runtime state.
- **Release validation:** orchestration, execution safety, evidence/control coverage, reliability regressions, Intelligence, Design Authority, installer, documentation, platform adapters, research, Autopilot, and numbered-decision tests are part of the release gate.

Projects installed with earlier versions should follow the [Migration Guide](08-maintenance-release/migration-guide.md).

## Reliability architecture

The current control-plane design is documented by:

- [Contract-Driven Agent Orchestration Implementation Plan](04-architecture/dk-contract-driven-agent-orchestration-implementation-plan.md)
- [Reliability Control-Plane Amendment](04-architecture/dk-reliability-control-plane-amendment.md)
- [Orchestration Runtime CLI](03-reference/scripts/orchestration.md)
- [Architecture Invariants](04-architecture/architecture-invariants.md)
- [DK Intelligence & Memory Architecture](04-architecture/dk-intelligence-memory-architecture.md)
- [DK Control Center Product Specification](04-architecture/dk-control-center-product-specification.md)

## Roadmap boundary

The v0.11–v1.0 roadmap is **planned work**, not current functionality.

The planned sequence is intentionally ordered around reliability:

1. Adaptive Reliability and policy-driven lifecycle compilation.
2. DKF Proof and Acceptance Certificates.
3. Repository/PR enforcement.
4. Public reliability benchmarking.
5. Isolated execution.
6. Safe parallelism.
7. Multi-repository Change Contracts.
8. Evidence-strength governance and verifier diversity.
9. Control Center Flight Recorder.
10. v1.0 only after the reliability claim is externally measurable.

See [ROADMAP.md](../ROADMAP.md) for release-by-release detail.

## Documentation quick links

- [Information Architecture and Strategy](00-documentation/documentation-information-architecture.md)
- [Overview and Capabilities](01-overview/what-is-development-kit.md)
- [User Guide and Installation](02-user-guide/getting-started.md)
- [OpenCode Installation](02-user-guide/install-opencode.md)
- [Complete Command Reference](03-reference/commands/README.md)
- [Complete Agent Reference](03-reference/agents/README.md)
- [Complete Skill Reference](03-reference/skills/README.md)
- [Architecture and System Context](04-architecture/system-context.md)
- [Developer Guide](05-developer-guide/local-development-setup.md)
- [Internal Operating Mechanics](06-internals/internal-operating-model.md)
- [Testing, Quality, and Security](07-testing-quality-security/quality-strategy.md)
- [Maintenance and Release](08-maintenance-release/release-process.md)
- [Contributing Guidelines](09-contributing/contribution-overview.md)
- [Real-World Examples and Tutorials](10-examples/README.md)
- [Appendices and Traceability](11-appendices/glossary.md)

For the complete documentation page tree, see [SUMMARY.md](SUMMARY.md).
