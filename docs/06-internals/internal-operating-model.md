# Internal Operating Model

## What the Framework Actually Is

Development Kit is a **content-and-tooling package**: markdown personas, skills, commands, templates, and evaluations (the "methodology") plus Node scripts (the "tooling"). It has **no runtime engine** of its own — the methodology is executed by an AI agent runtime (Antigravity or OpenCode) that loads the content, while the scripts handle installation, synchronisation, and validation.

```mermaid
graph TB
    subgraph Methodology (content)
        M1["agents/ (personas)"]
        M2["skills/ (procedures)"]
        M3["commands/ (bundles)"]
        M4["templates/ (artifacts)"]
        M5["evals/ (behavioural tests)"]
    end
    subgraph Tooling (scripts)
        T1["installer"]
        T2["sync"]
        T3["validators"]
    end
    subgraph Runtimes
        R1["Antigravity"]
        R2["OpenCode"]
    end
    M1 --> R1
    M2 --> R1
    M3 --> R1
    M2 --> R2
    R1 --> T1
    T2 --> T3
```

## Orchestration, Not Execution

- The **conductor** orchestrates: selects skills, spawns agents, gates progress. It implements nothing.
- **Specialist agents** do the work: scout (read), discovery/spec/design/plan (write artifacts), implementers (fresh, write code), test/reviewers (verify/judge).
- **Hooks** advise at lifecycle boundaries (readiness, gates, completion).
- **Scripts** manage the package (install, sync, validate).

## Context Model

- Session start: `using-development-kit` + `AGENTS.md` orient the agent.
- Each request: `skill-routing` classifies → selects primary/supporting/conditional skills.
- Each task: `context-packing` builds a self-contained package for a fresh agent.
- Completion: gates aggregate (tests, reviews, simplicity) → hooks confirm → next task.

## State Model

Workflow state is **derived, not stored**: artifacts (spec, design, plan), reports (scout, test, review), and hook records. `/dk-status` reconstructs the view from these. There is no state database — a documented limitation.

## Safety Model

- Installer guards + `--force` + `--dry-run` bound filesystem risk.
- Ponytail exclusions bound simplification risk.
- Fixed review order bounds quality risk.
- Fresh sub-agents bound assumption drift.

## Failure Model

Failures are **gates, not crashes**: a failed test or review stops progress and routes back through the loop. Only the scripts can truly "fail" (exit codes), and they fail loudly with named files.

See [development-conductor-internals.md](development-conductor-internals.md) and [architecture-invariants.md](../04-architecture/architecture-invariants.md).
