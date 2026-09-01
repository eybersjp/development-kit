# Development Kit Documentation System

Welcome to the official documentation for **Development Kit v0.9.0** (`development-kit@0.9.0`).

Development Kit is a disciplined AI software-development workflow for Antigravity, OpenCode, Claude Code, Cursor, VS Code (GitHub Copilot), Cline, and Windsurf. It installs lifecycle commands, specialist agents, reusable skills, verification gates, Next-Step Guidance, DK Intelligence, DK Control Center, DKF Design Authority, and the persistent `/dk-autopilot` guided workflow into supported coding-agent environments.

## Current release highlights

| Package Version | 0.9.0 |
| Lifecycle Stages | 9 (UNDERSTAND through COMPLETE) |
| Workflow Commands | 16 |
| Specialist Agents | 18 |
| Engineering Skills | 47 |
| Native Workflow Adapters | 16 |

- Introduces the **v0.9 Reliability Control Plane**: approved tasks become fingerprinted Development Contracts before execution.
- Independent verifier/reviewer contexts are rehydrated from authoritative sources; implementation reports are non-authoritative evidence inputs and cannot self-certify completion.
- Acceptance is computed from acceptance criteria, evidence, required reviews, risk-derived security/architecture gates, control manifests, source freshness, Design Authority, architecture drift, and approvals.
- Correction loops are bounded by task scope, risk, attempt limits, and repeated-failure detection.
- Destructive and remote commands are evaluated against contract scope and blast radius before execution; project-local work cannot silently perform host-wide cleanup.
- Canonical artifact amendments require an expected source fingerprint, exact delta anchors, write/read-back verification, and refuse stale replay.
- PLAN validation computes task counts, dependencies, cycles, ownership, and acceptance-criterion coverage instead of trusting prose summaries.
- Includes **DKF Design Authority** with `design.md` as the single authoritative source of truth for frontend UI styling, token architecture, and visual consistency.
- Includes native Antigravity slash-workflow discovery for all 16 `/dk-*` workflows while retaining `commands/*.md` as the authoritative workflow definitions.
- Includes **DK Intelligence** and **DK Control Center** for durable engineering context and local workflow inspection.
- Standalone and project installation validation confirms `runtime/`, `schemas/`, commands, agents, skills, and plugin assets are self-contained and version-aligned.
- `/dk-research` remains provider-neutral and source-backed, with provenance, uncertainty handling, and explicit trust boundaries.
- The release validation suite now includes orchestration contracts, execution safety, evidence/control coverage, core orchestration, command integration, Proposal Builder adversarial regressions, version consistency, Design Authority, Intelligence, installer, documentation, platform, research, and Autopilot validation.

Projects installed with earlier versions should follow the [Migration Guide](08-maintenance-release/migration-guide.md).

## v0.9 reliability architecture

The v0.9 control-plane design is defined by:

* [Contract-Driven Agent Orchestration Implementation Plan](04-architecture/dk-contract-driven-agent-orchestration-implementation-plan.md)
* [Reliability Control-Plane Amendment](04-architecture/dk-reliability-control-plane-amendment.md)
* [Orchestration Runtime CLI](03-reference/scripts/orchestration.md)

## Documentation quick links

* [Information Architecture and Strategy](00-documentation/documentation-information-architecture.md)
* [Overview and Capabilities](01-overview/what-is-development-kit.md)
* [User Guide and Installation](02-user-guide/getting-started.md)
* [OpenCode Installation](02-user-guide/install-opencode.md)
* [Complete Command Reference](03-reference/commands/README.md)
* [Complete Agent Reference](03-reference/agents/README.md)
* [Complete Skill Reference](03-reference/skills/README.md)
* [Architecture and System Context](04-architecture/system-context.md)
* [Developer Guide](05-developer-guide/local-development-setup.md)
* [Internal Operating Mechanics](06-internals/internal-operating-model.md)
* [Testing, Quality, and Security](07-testing-quality-security/quality-strategy.md)
* [Maintenance and Release](08-maintenance-release/release-process.md)
* [Contributing Guidelines](09-contributing/contribution-overview.md)
* [Real-World Examples and Tutorials](10-examples/README.md)
* [Appendices and Traceability](11-appendices/glossary.md)
* [Product Evidence and Public Demonstration](../marketing/README.md)

For the complete page tree, see [SUMMARY.md](SUMMARY.md).
