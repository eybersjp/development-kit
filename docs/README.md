# Development Kit Documentation System

Welcome to the official documentation for **Development Kit v0.7.1** (`development-kit@0.7.1`).

Development Kit is a disciplined AI software-development workflow for Antigravity, OpenCode, Claude Code, Cursor, VS Code (GitHub Copilot), Cline, and Windsurf. It installs lifecycle commands, specialist agents, reusable skills, verification gates, Next-Step Guidance, DK Intelligence, DK Control Center, and the persistent `/dk-autopilot` guided workflow into supported coding-agent environments.

## Current release highlights

| Package Version | 0.7.1 |
| Lifecycle Stages | 9 (UNDERSTAND through COMPLETE) |
| Workflow Commands | 15 |
| Specialist Agents | 18 |
| Engineering Skills | 46 |

- Includes **DK Intelligence** (durable local-first engineering memory, provenance, and lifecycle context assembly).
- Includes **DK Control Center** (integrated local browser UI and secure loopback Runtime API).
- The framework includes 14 workflow commands, 18 specialist agents, 46 engineering skills, and 4 hooks.
- Next-Step Guidance automatically computes and appends context-aware recommendations across the full 9-stage lifecycle.
- Standalone installation (`installAll`) includes `runtime/` for standalone operation without repository fallbacks.
- Multi-platform adapters provide native project integration for Claude Code, Cursor, VS Code, Cline, and Windsurf.
- `/dk-research` provides provider-neutral, source-backed external research with provenance, uncertainty handling, and explicit trust boundaries.
- Skill frontmatter parsing and canonical plugin-mirror checks treat equivalent CRLF and LF content consistently across operating systems.
- OpenCode configuration uses the official schema declaration and automatically loads the root `AGENTS.md` file.
- The release validation suite covers OpenCode configuration, external research integration, platform templates, next-step guidance, standalone packaging regressions, and intelligence tests.

Projects installed with earlier versions should follow the [Migration Guide](08-maintenance-release/migration-guide.md).

## v0.7 architecture

The following documents define the architecture for **DK Intelligence and DK Control Center**:

* [DK Intelligence and Memory Architecture](04-architecture/dk-intelligence-memory-architecture.md)
* [DK Control Center Product Specification](04-architecture/dk-control-center-product-specification.md)
* [DK Runtime API](04-architecture/dk-runtime-api.md)
* [DK Memory Provider Contract](04-architecture/dk-memory-provider-contract.md)
* [v0.7 Architecture Decisions](04-architecture/v0.7-architecture-decisions.md)
* [v0.7 Security Threat Model](07-testing-quality-security/v0.7-intelligence-control-center-threat-model.md)
* [v0.7 Implementation Plan](04-architecture/v0.7-intelligence-control-center-implementation-plan.md)

---

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

For the complete page tree, see [SUMMARY.md](SUMMARY.md).