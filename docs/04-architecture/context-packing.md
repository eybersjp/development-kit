# Context Packing

## Purpose

The `context-packing` skill assembles **only the relevant** code, documents, conventions, and history for a sub-agent, preventing context bloat while keeping the package self-contained.

## Context Package Contents

```mermaid
graph LR
    T["task definition"] --> P["context package"]
    S["spec section"] --> P
    D["design section"] --> P
    RF["repository-scout findings"] --> P
    AC["acceptance criteria"] --> P
    TS["test strategy"] --> P
    RP["restraint principles (existing-code-first, native-platform-first, dependency-restraint, minimal-diff)"] --> P
```

## Packing Rules

1. **Relevance only** — unrelated code, docs, and history are excluded.
2. **Self-contained** — the fresh agent needs nothing else to start work.
3. **Scope-bounded** — other tasks' details are not included.
4. **Fresh per task** — a package is never reused across tasks.

## Why It Matters

- Prevents context bloat in long sessions (the conductor does not carry full repository context for every task).
- Enables **fresh sub-agent isolation**: a new agent with a tight package cannot inherit stale assumptions.
- Keeps sub-agent context windows small enough to be effective.

## Flow

```mermaid
sequenceDiagram
    participant C as Conductor
    participant S as Repository Scout
    participant I as Fresh Implementation Agent
    C->>S: inspect task area
    S-->>C: scout report
    C->>C: pack relevant context only
    C->>I: task + context package
    Note over I: implements from the package alone
```

See [context-packing.md](../03-reference/skills/context-packing.md) and [implementation-agent-isolation.md](../06-internals/implementation-agent-isolation.md).
