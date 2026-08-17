# Workflow Sequences

## Full Lifecycle Sequence (New Feature)

```text
/dk-idea → /dk-spec → /dk-design → /dk-tasks → /dk-build-auto → /dk-review → /dk-ship
```

Use this sequence when starting from a vague concept and proceeding through to release.

## Visual Frontend Lifecycle Sequence (DKF Design Authority)

```text
/dk-idea (with visual references) → /dk-design-system (create/reference) → /dk-spec → /dk-design → /dk-tasks → /dk-build (with preflight) → /dk-test (compliance) → /dk-review (Same Design Team) → /dk-ship
```

Use this sequence for projects with a visual user interface to establish `design.md` and prevent visual drift.

## Targeted Implementation Sequence (Approved Plan)

```text
/dk-tasks → /dk-build (×N) → /dk-test → /dk-review → /dk-simplify → /dk-ship
```

Use when a design is already approved and you need to execute approved tasks one at a time.

## Bug-Fix Sequence

```text
/dk-debug → /dk-test → /dk-review → /dk-ship
```

Use when you have an identified bug. Debug finds root cause, test verifies fix, review confirms quality.

## Review & Simplify Sequence

```text
/dk-review → /dk-simplify
```

Use after a major implementation pass to enforce quality and remove unnecessary complexity.

## Status Check & Resume Sequence

```text
/dk-status → [determine next command] → continue
```

Use when picking up a workflow after an interruption.
