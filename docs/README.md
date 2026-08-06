# Development Kit Documentation System

Welcome to the official documentation for **Development Kit v0.4.2** (`development-kit@0.4.2`).

Development Kit is a disciplined AI software-development workflow for Antigravity and OpenCode. It installs lifecycle commands, specialist agents, reusable skills, verification gates, and the persistent `/dk-autopilot` guided workflow into supported coding-agent environments.

## Current release highlights

- Public GitHub release: `v0.4.2`.
- Public npm package: `development-kit@0.4.2`.
- Current OpenCode configuration uses the official schema declaration.
- OpenCode automatically loads the root `AGENTS.md` file.
- The release validation suite includes a regression test that rejects the obsolete OpenCode `rules` key.

Projects installed with v0.4.1 that report `Unrecognized key: rules` should follow the [OpenCode migration instructions](08-maintenance-release/migration-guide.md#upgrading-from-v041-to-v042).

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
* [Product Evidence and Public Demonstration](../marketing/README.md)

For the complete page tree, see [SUMMARY.md](SUMMARY.md).
