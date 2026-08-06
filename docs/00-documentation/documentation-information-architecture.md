# Information Architecture

## Hierarchy Structure

The documentation system is organized into 12 top-level sections under `docs/`:

1. `00-documentation/`: Meta-documentation, specification, inventory, coverage matrix, and maintenance policy.
2. `01-overview/`: High-level principles, capabilities, mandatory task loop, and lifecycle overview.
3. `02-user-guide/`: End-user installation, workflow recipes, command selection, and troubleshooting.
4. `03-reference/`: Comprehensive reference for commands, agents, skills, hooks, templates, evals, scripts, and configuration.
5. `04-architecture/`: System context, component architecture, agent orchestration, context packing, and plugin mirrors.
6. `05-developer-guide/`: Step-by-step guides for extending the framework (adding skills, agents, commands, hooks, evals).
7. `06-internals/`: Deep technical implementation mechanics for maintainers and internal framework engineers.
8. `07-testing-quality-security/`: Quality strategy, multi-axis review pipelines, security threat models, and release quality gates.
9. `08-maintenance-release/`: Versioning policies, npm publishing, pre-release checklists, and release runbooks.
10. `09-contributing/`: Guidelines for community and internal contributors.
11. `10-examples/`: Step-by-step tutorials and realistic workflow scenarios.
12. `11-appendices/`: Glossary, component inventories, and cross-reference matrices.

## Navigation Principles

* Primary navigation is driven by `docs/SUMMARY.md`.
* `docs/README.md` acts as the main portal landing page.
* Every markdown document uses relative cross-links (e.g. `[Command Index](../03-reference/commands/README.md)`).
* Absolute local links (`file://...`) are strictly prohibited.
