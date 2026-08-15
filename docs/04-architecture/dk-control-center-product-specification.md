# DK Control Center Product Specification

> Status: Planned for Development Kit v0.7. This document defines target product behaviour and must not be represented as shipped functionality until implementation and validation are complete.

## Product Intent

DK Control Center is the graphical management surface for Development Kit. It is **not a standalone product** and does not have a separate installation lifecycle.

The coding environment remains where the developer builds. DK Control Center is where the developer can inspect, understand, configure, and govern how Development Kit and its AI-assisted workflow are operating.

The first implementation is a local browser-based UI served by the Development Kit runtime. Future IDE-native panels may reuse the same internal API.

## Primary Goals

1. Make Development Kit state and intelligence visible without requiring users to inspect internal JSON files.
2. Provide Tencent-style memory/asset management adapted specifically to software engineering.
3. Expose Autopilot lifecycle progress, tasks, decisions, memory, knowledge, skills, agents, verification, approvals, and providers in one interface.
4. Keep the UI optional and unobtrusive.
5. Never make the Control Center a new trust authority. It is an interface to DK Core and DK Intelligence.

## Startup Model

Development Kit activation should initialise the runtime services required by the current environment and project.

```text
Open project / activate DK
        |
        v
Resolve project identity
        |
        v
Load DK configuration
        |
        v
Load Autopilot state
        |
        v
Initialise DK Intelligence
        |
        v
Detect configured providers
        |
        v
Start local Runtime API / Control Center service when required
        |
        v
Apply Control Center auto-open setting
```

The user must not be required to separately install or manually run a memory server, vector database, dashboard, or third-party proxy to obtain the default v0.7 experience.

## Automatically Open Control Center

This is a first-class setting.

```text
Automatically open Control Center
[ On / Off ]

Default: Off
```

### Required Behaviour

When `On`, Development Kit should open the Control Center after successful interactive project activation when all of the following are true:

- the current execution context is interactive;
- the Control Center service is healthy;
- the effective project/user setting is enabled;
- the runtime is not executing in CI, a clearly headless context, automated tests, or another environment where launching a browser would be inappropriate.

When `Off`, the runtime and DK Intelligence may still operate normally. The setting controls automatic presentation only.

### Duplicate Prevention

Auto-open must not create a new browser tab/window on every DK command.

The runtime should maintain enough session state to determine whether a valid Control Center instance for the project/runtime has already been opened. Where platform APIs permit, focus/reuse is preferred. Where they do not, suppressing duplicate launches is sufficient.

### Manual Open

Manual launch remains available regardless of the auto-open setting.

Target interfaces:

```text
/dk-control
```

and/or:

```bash
development-kit control
```

The exact command surface may be refined during implementation, but at least one environment-neutral CLI path is required.

### Settings Precedence

Recommended precedence:

1. explicit project override;
2. user/global DK preference;
3. default `Off`.

A project should be able to inherit the global setting without writing project-specific configuration.

## Local Hosting

V1 should use a local HTTP server bound to loopback only by default.

Recommended behaviour:

- bind to `127.0.0.1` / loopback, not all interfaces;
- choose an available port automatically;
- persist or advertise the active endpoint through runtime state;
- do not require the user to choose a port for normal operation;
- detect and recover from stale runtime endpoint state;
- avoid exposing the Control Center to the LAN by default.

Remote access is outside the v0.7 baseline unless separately designed and security-reviewed.

## Navigation Model

The initial Control Center should include the following primary areas.

### Overview

Shows the current project and high-signal operational state:

- project identity and branch where available;
- lifecycle stage;
- current task and blockers;
- memory counts and stale-memory warnings;
- knowledge/index status;
- provider health;
- verification status;
- pending approvals;
- recommended next action.

### Workflow

Visualises the nine-stage DK lifecycle:

```text
UNDERSTAND -> DEFINE -> DESIGN -> PLAN -> IMPLEMENT
     -> VERIFY -> REVIEW -> SIMPLIFY -> COMPLETE
```

Users can inspect stage status, stage artifacts, task progress, blockers, and staleness. The UI must not silently advance stages outside normal Autopilot rules.

### Memory

Provides typed memory management:

- all records;
- facts;
- decisions;
- constraints;
- preferences;
- architecture;
- lessons;
- incidents;
- verification;
- research;
- artifact references;
- relationships;
- skill references.

Each record view should expose:

- content;
- type;
- scope;
- authority;
- confidence;
- status;
- source/provenance;
- lifecycle relevance;
- created/updated timestamps;
- expiry where relevant;
- supersession chain;
- recent usage where available.

Supported management actions should include edit, supersede, archive, forget/delete where allowed, view source, and inspect usage.

### Decisions

Decisions receive a dedicated register because they are high-value engineering assets.

The register should show:

- active/superseded status;
- decision subject;
- authority;
- source/ADR;
- date;
- supersession relationships;
- affected lifecycle stages or components where available.

A decision must not be upgraded to `user-approved` merely because it was edited in the UI unless the action itself is an explicit user confirmation flow.

### Knowledge

Provides indexed project/document knowledge including specifications, architecture, research, documentation, API references, requirements, and other ingested sources.

Knowledge should be queried on demand rather than injected wholesale into model context.

### Code Intelligence

Provides a visual surface for available code-index capabilities such as:

- file tree;
- symbol search;
- symbol detail;
- callers;
- callees;
- dependency relationships;
- impact analysis;
- index health.

The baseline must tolerate environments where only native repository lookup is available and no advanced CodeGraph provider is configured.

### Skills

Shows:

- built-in DK skills;
- user-level reusable skills;
- project-learned skills/candidates;
- provider-supplied skills where allowed;
- version/status/source metadata.

Auto-extracted skill candidates require governance before becoming trusted built-in-like procedures.

### Agents

Shows DK specialist agents and their effective loadouts:

- role;
- description;
- permitted memory scopes;
- relevant skills;
- knowledge bindings;
- provider capabilities;
- explicit exclusions.

The UI configures loadout; it does not override platform or DK safety policy.

### Research

Shows source-backed research artifacts and provenance when `/dk-research` or compatible providers produced them.

### Verification

Shows tests, runtime verification, review state, known failures, evidence, and staleness of verification artifacts.

### Approvals

Shows pending requests and historical approval/cancellation records that DK is allowed to display.

Control Center must reuse the same approval mechanisms and replay protections as DK Core. A UI button must not create a weaker parallel approval path.

### Providers

Shows provider detection and effective availability by capability class.

Example categories:

- Memory
- Knowledge
- Code Intelligence
- Research

Provider status should distinguish at least:

- available and active;
- available but disabled;
- configured but unhealthy;
- missing/not installed;
- permission required;
- incompatible.

Development Kit may automatically activate an already-installed, configured, policy-permitted provider where the provider contract explicitly allows it. It must never silently install a missing provider.

### Settings

Includes Control Center and DK Intelligence settings. The Control Center section must include:

```text
Automatically open Control Center    On / Off
Open Control Center                  [Action]
Port                                 Automatic (default)
```

Advanced/manual port configuration should be hidden or secondary unless a real need emerges.

## UX Principles

- answer-first dashboard;
- low cognitive load;
- clear authority/status labels;
- visible provenance for durable memory;
- stale/superseded information visually distinct from active information;
- destructive actions explicit and confirmable;
- accessibility at least aligned with WCAG 2.2 AA targets for the web UI;
- responsive enough for common laptop displays;
- no requirement to keep the Control Center visible for DK to function.

## Runtime Independence

The Control Center UI must consume a documented internal DK Runtime API instead of importing runtime internals directly. This preserves the option to add:

- Antigravity-native panels;
- VS Code/Cursor panels;
- alternative browser shells;
- future remote/team interfaces after separate design.

All interfaces must show the same underlying DK state and intelligence rather than maintaining separate data stores.

## Failure Behaviour

If the Control Center cannot start:

1. Development Kit core commands should continue when the UI is non-critical.
2. The user should receive a clear diagnostic and manual recovery command.
3. Memory/storage corruption must fail safely and preserve recoverable history where possible.
4. Provider UI failure must not imply provider success.
5. Auto-open failure must not cause repeated browser launch loops.

## Out of Scope for v0.7 Baseline

- a separately installed Electron/desktop application;
- mandatory cloud accounts;
- mandatory TencentDB Agent Memory;
- mandatory Docker;
- remote/LAN Control Center exposure by default;
- multi-tenant SaaS hosting;
- full collaborative team server unless introduced behind a later provider/service boundary;
- replacement of the coding environment.

## Acceptance Criteria

- DK Control Center installs/ships as part of Development Kit rather than as a separate product.
- Control Center can be opened manually from an environment-neutral interface.
- `Automatically open Control Center` exists, defaults to `Off`, persists, and works only in appropriate interactive contexts.
- Auto-open suppresses duplicate launches.
- Turning auto-open off does not disable DK Intelligence.
- The server binds to loopback by default and selects a usable port automatically.
- Core workflow remains functional when Control Center is unavailable unless a requested operation specifically depends on it.
- Memory, workflow, decisions, providers, agents, skills, knowledge, and verification are inspectable through the UI as implementation phases land.
- Approval actions reuse DK Core policy and cannot bypass replay-resistant approval controls.

## Related Planned Documents

- [DK Intelligence and Memory Architecture](dk-intelligence-memory-architecture.md)
- [DK Runtime API](dk-runtime-api.md)
- [DK Memory Provider Contract](dk-memory-provider-contract.md)
- [v0.7 Threat Model](../07-testing-quality-security/v0.7-intelligence-control-center-threat-model.md)
- [v0.7 Implementation Plan](v0.7-intelligence-control-center-implementation-plan.md)
