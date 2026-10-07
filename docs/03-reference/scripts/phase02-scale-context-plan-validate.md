# phase02-scale-context-plan-validate.mjs

## Purpose

`scripts/phase02-scale-context-plan-validate.mjs` validates the machine-readable Development Kit v0.12.0 Scale, Context & Iteration PLAN using the existing deterministic `runtime/orchestration/plan-validator.mjs`.

It is a Phase 2 planning validator. It does not implement v0.12 runtime functionality.

## Authoritative PLAN model

```text
docs/04-architecture/dkf-scale-context-iteration-v0.12-plan-model.json
```

## Validation performed

The script checks:

- declared task count;
- dependency references;
- dependency cycles;
- declared dependency graph versus computed graph;
- required logical resource ownership;
- duplicate resource ownership;
- acceptance-criterion coverage;
- configuration dependency validity.

The acceptance-criterion authority comes from the reconciled v0.12 specification.

## Usage

```bash
node scripts/phase02-scale-context-plan-validate.mjs
```

The command prints the complete deterministic validation report as JSON and exits non-zero when the PLAN is invalid.

## Scope

This validator intentionally reuses the existing DKF PLAN validation engine instead of creating a second planning model.

A green result proves structural PLAN consistency. It does not replace specification review, architecture review, implementation verification, or Product Owner release approval.
