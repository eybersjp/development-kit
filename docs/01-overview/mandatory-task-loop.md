# Mandatory Task Loop

The **Mandatory Task Loop** is the core operational engine executed during the `IMPLEMENT` stage (`/dk-build` or `/dk-build-auto`).

```mermaid
sequenceDiagram
    participant Conductor as development-conductor
    participant Scout as repository-scout-agent
    participant SubAgent as implementation-agent (Fresh)
    participant Tester as test-engineer
    participant Reviewer as spec & code reviewers

    Conductor->>Scout: Pack context for Task N
    Scout-->>Conductor: Packed Context
    Conductor->>SubAgent: Invoke fresh sub-agent for Task N
    SubAgent->>SubAgent: Run TDD Cycle (Red -> Green -> Refactor)
    SubAgent-->>Conductor: Implementation Complete
    Conductor->>Tester: Run Verification Suite
    Tester-->>Conductor: Tests Pass (Empirical Evidence)
    Conductor->>Reviewer: Run Spec Compliance & Code Quality Review
    Reviewer-->>Conductor: Gate Passed
    Conductor->>Conductor: Mark Task N Complete -> Advance to Task N+1
```

## Mandatory Task Rules

1. **Sub-agent Isolation**: Every task MUST be executed by a fresh sub-agent (`implementation-agent`, `frontend-implementer`, `backend-implementer`, or `database-implementer`).
2. **Sequential Gating**: Never begin Task N+1 while Task N has unresolved test failures or open review findings.
3. **Empirical Proof**: A task is NOT complete when an implementation sub-agent claims it is complete. Proof requires clean execution of verification commands (`npm run validate`, `npm test`, etc.).
