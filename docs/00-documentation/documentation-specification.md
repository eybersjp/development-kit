# Documentation Specification

## Purpose
This document specifies the requirements, scope, target audiences, and quality criteria for the complete **Development Kit** framework documentation system (`development-kit@0.3.0`).

## Target Audiences & Needs

1. **New Users**: Needs clear concepts, quick start, installation step-by-step guidance, and first workflow instructions.
2. **Experienced Users**: Needs workflow recipes, command lookup matrices, recovery steps, and edge-case handling.
3. **Framework Extension Developers**: Needs clear guidelines on adding skills, agents, commands, hooks, templates, or evals without modifying mirrored files directly.
4. **Maintainers & Internal Engineers**: Needs internal routing logic, context packing rules, conductor orchestration details, and plugin sync mechanics.
5. **Quality, Security & Evaluation Engineers**: Needs threat models, review checklists, evaluation suite runner guides, and quality traceability.
6. **Antigravity & OpenCode Users**: Needs runtime integration details, platform path mapping, and manifest compatibility contracts.
7. **AI Agents**: Needs explicit contracts, non-negotiable rules, and structured handoff boundaries.

## Scope & Exclusions

* **In Scope**: All 12 commands, 18 agents, 43 skills, 4 hooks, 6 templates, 10 evals, 4 scripts, installer flags, package configs, and integration environments.
* **Explicit Exclusions**: Speculative unreleased features, third-party framework code, invented credentials or maintainer contacts.

## Quality Gates & Verification
* `npm run validate` must pass cleanly.
* `npm run doctor` must report zero drift.
* `npm run docs:validate` must pass with zero broken links, zero missing pages, zero local file URLs, and zero placeholder markers.
