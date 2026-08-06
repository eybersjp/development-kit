# Agent Handoff Map

## Orchestration Overview

The development-conductor is the single coordinator. Every specialist agent is spawned by the conductor and reports back to it. Specialist agents do not spawn each other.

```mermaid
graph TD
    U["User / Command"] --> C["development-conductor"]
    C --> S["repository-scout-agent"]
    C --> P["product-discovery-agent"]
    C --> A["artifact-selector-agent"]
    C --> SP["specification-agent"]
    C --> ARC["solution-architect-agent"]
    C --> T["task-planner-agent"]
    C --> I["implementation-agent (fresh)"]
    C --> FE["frontend-implementer (fresh)"]
    C --> BE["backend-implementer (fresh)"]
    C --> DB["database-implementer (fresh)"]
    C --> TE["test-engineer"]
    C --> SR["spec-reviewer"]
    C --> CR["code-reviewer"]
    C --> SEC["security-reviewer"]
    C --> ACC["accessibility-reviewer"]
    C --> DR["design-reviewer"]
    C --> SIM["simplicity-reviewer"]
    S -. findings .-> P
    S -. findings .-> ARC
    S -. findings .-> T
    S -. findings .-> I
    P -. idea brief .-> SP
    A -. artifact level .-> SP
    SP -. spec .-> ARC
    SP -. spec .-> T
    ARC -. design .-> T
    T -. task plan .-> C
    I -. implementation .-> TE
    TE -. evidence .-> SR
    SR -. pass .-> CR
    CR -. pass .-> SIM
    SIM -. verdict .-> C
```

## Sequential Task Flow (per task in `/dk-build`)

```mermaid
sequenceDiagram
    participant C as Conductor
    participant S as Repository Scout
    participant R as Readiness Check
    participant I as Implementation Agent (fresh)
    participant T as Test Engineer
    participant SR as Spec Reviewer
    participant CR as Code Reviewer
    participant SIM as Simplicity Reviewer
    C->>S: inspect task area
    S-->>C: scout report
    C->>R: validate task readiness
    R-->>C: ready / issues
    C->>I: task package (fresh instance)
    I-->>C: implementation + local tests
    C->>T: verify + edge cases
    T-->>C: test report
    C->>SR: gate 1 (spec compliance)
    SR-->>C: verdict
    C->>CR: gate 2 (code quality)
    CR-->>C: verdict
    C->>SIM: final gate (simplicity)
    SIM-->>C: verdict
    C->>T: re-run tests after simplification
    T-->>C: green
    Note over C: task complete; next task may begin
```

## Fresh Implementation-Agent Isolation

```mermaid
graph LR
    subgraph Task 1
        I1["implementation-agent (instance 1)"]
    end
    subgraph Task 2
        I2["implementation-agent (instance 2)"]
    end
    subgraph Task 3
        I3["implementation-agent (instance 3)"]
    end
    C["development-conductor"] --> I1
    C --> I2
    C --> I3
    I1 -. no shared context .- I2
    I2 -. no shared context .- I3
```

Each task gets a **fresh** implementation instance with a self-contained context package. No long-running agent accumulates assumptions across tasks.

## Conditional Reviewer Selection

```mermaid
graph TD
    C["Conductor: task involves..."] --> Q1{"Auth / input / secrets / PII / APIs?"}
    Q1 -->|yes| SEC["security-reviewer"]
    Q1 -->|no| Q2{"UI changes?"}
    Q2 -->|yes| ACC["accessibility-reviewer"]
    Q2 -->|yes| DR["design-reviewer"]
    Q2 -->|no| DONE["no conditional reviews"]
```

## Review Order (never reordered)

**spec-compliance → code-quality → conditional reviews → simplicity → re-verify.**

See [agent-responsibility-matrix.md](agent-responsibility-matrix.md) and [command-agent-skill-matrix.md](../../11-appendices/command-agent-skill-matrix.md).
