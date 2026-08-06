# Commands Index

Development Kit provides 12 slash commands covering the full software development lifecycle.

```mermaid
graph LR
    A["/dk-idea"] --> B["/dk-spec"]
    B --> C["/dk-design"]
    C --> D["/dk-tasks"]
    D --> E["/dk-build"]
    D --> F["/dk-build-auto"]
    E --> G["/dk-test"]
    F --> G
    G --> H["/dk-review"]
    H --> I["/dk-simplify"]
    I --> J["/dk-ship"]
    K["/dk-status"] -.-> A
    L["/dk-debug"] -.-> G
```

## All Commands

| Command | Lifecycle Stage | Description |
| :--- | :--- | :--- |
| [`/dk-idea`](dk-idea.md) | UNDERSTAND | Refine a rough idea into a concrete concept |
| [`/dk-spec`](dk-spec.md) | DEFINE | Create the minimum required specification artifacts |
| [`/dk-design`](dk-design.md) | DESIGN | Produce technical and visual design |
| [`/dk-tasks`](dk-tasks.md) | PLAN | Break approved work into small, verifiable tasks |
| [`/dk-build`](dk-build.md) | IMPLEMENT | Implement the next task through every gate |
| [`/dk-build-auto`](dk-build-auto.md) | IMPLEMENT | Process the entire plan automatically |
| [`/dk-test`](dk-test.md) | VERIFY | Run task-specific verification |
| [`/dk-review`](dk-review.md) | REVIEW | Run the full multi-axis review cycle |
| [`/dk-simplify`](dk-simplify.md) | SIMPLIFY | Apply the Ponytail simplicity ladder |
| [`/dk-debug`](dk-debug.md) | (Recovery) | Systematic root-cause analysis |
| [`/dk-ship`](dk-ship.md) | COMPLETE | Final verification and release preparation |
| [`/dk-status`](dk-status.md) | (Anytime) | Show current workflow state |

## Quick Decision Guide

- **Have a rough idea?** → `/dk-idea`
- **Need to debug something?** → `/dk-debug`
- **Ready to release?** → `/dk-ship`
- **Not sure where you are?** → `/dk-status`

See the [Command Selection Matrix](command-selection-matrix.md) for a complete decision tree.
