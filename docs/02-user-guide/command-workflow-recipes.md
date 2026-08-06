# Command Workflow Recipes

Realistic command combinations for common situations. Each recipe assumes the previous stage's artifacts are approved.

## Recipe 1 — New Feature (Full Lifecycle)

```bash
/dk-idea        # concept + idea brief
/dk-spec        # specification with acceptance criteria
/dk-design      # smallest compatible design
/dk-tasks       # ordered, verifiable tasks
/dk-build       # implement task 1 (repeat for each task)
/dk-test        # task verification
/dk-review      # full review cycle
/dk-simplify    # ponytail simplification
/dk-ship        # release preparation
```

## Recipe 2 — Small, Well-Understood Change

For a change so small it needs no discovery (e.g. fixing a validation message):

```bash
/dk-spec        # short spec (artifact selector will keep it minimal)
/dk-build       # implement + gate sequence
/dk-status      # confirm all tasks complete
```

## Recipe 3 — Approved Spec, Fast Track

When the concept and spec already exist:

```bash
/dk-design      # skip if the design is obvious
/dk-tasks
/dk-build-auto  # process the whole plan, pausing on failures
/dk-review
/dk-ship
```

## Recipe 4 — Bug Fix (Recovery)

```bash
/dk-debug       # reproduce → locate → fix → protect
/dk-test        # verify no regressions
/dk-review      # review the fix
```

## Recipe 5 — Existing Project, No Prior Setup

```bash
# 1. Install (choose your mode)
npx development-kit init --project

# 2. Orient the scout on the unknown codebase
/dk-idea        # even for a clear feature — the scout inspects the repo

# 3. Continue with the normal lifecycle
/dk-spec
/dk-design
/dk-tasks
/dk-build
```

## Recipe 6 — Release Preparation

```bash
/dk-test        # full verification
/dk-review      # all review axes
/dk-simplify    # last simplification pass
/dk-ship        # completion gate + release readiness
/dk-status      # confirm final state
```

## Recipe 7 — Mid-Workflow Recovery

```bash
/dk-status      # where am I? what is blocked?
/dk-debug       # if a bug is blocking
/dk-build       # resume the next task once unblocked
```

## Abbreviated vs Full Sequences

- **Abbreviated**: `/dk-idea → /dk-spec → /dk-build` — for small changes; the conductor will not approve skipping stages, but the artifact selector keeps documents minimal.
- **Full**: the complete lifecycle in Recipe 1 — required for comprehensive projects (payment systems, new products).

See [workflow-sequences.md](../03-reference/commands/workflow-sequences.md) for the canonical sequences.
