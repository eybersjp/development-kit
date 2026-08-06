# Adding an Evaluation

## Canonical Location

`evals/<skill-name>/scenario-XX-<topic>.json`.

## Naming Rules

- Directory: the evaluated skill's name (`idea-discovery`).
- File: `scenario-01-<topic>.json`, incrementing per scenario.

## JSON Contract

```json
{
  "skill": "<skill-name>",
  "scenario": "<human-readable description>",
  "input": { "<case inputs>" },
  "expected": {
    "must_have": [...],
    "must_not": [...],
    "verdict_contains": "...",
    "min_...": 3
  }
}
```

## What Makes a Good Scenario

- One focused behavioural expectation set (what the agent should produce/avoid).
- Concrete inputs the evaluator can present verbatim.
- Explicit `must_not` items (what the agent must not do) — these catch the most common failures.
- A scoring anchor (`verdict_contains`, minimum counts) so pass/fail is unambiguous.

## Required Docs

- `docs/03-reference/evaluations/<skill-name>.md` — the suite reference page; document the new scenario in it.
- Update `docs/03-reference/evaluations/README.md` and `docs/SUMMARY.md` if the suite is new.

## Required Validation

- `npm run docs:validate` (suite reference page required).
- Evaluations are not machine-run — see [evaluation-strategy.md](../07-testing-quality-security/evaluation-strategy.md).

## Example (Based on an Existing Evaluation)

`evals/scope-definition/scenario-01-feature-creep.json` models the ideal: input request + context, then `must_have`/`should_have`/`explicitly_excluded`/`must_not` with a rationale.

## Common Mistakes

- Vague `expected` (can't score objectively).
- Missing `must_not` items.
- Testing multiple unrelated behaviours in one scenario.

## Completion Checklist

- [ ] Scenario JSON created
- [ ] Suite reference page updated
- [ ] `npm run docs:validate` passes
- [ ] Scenario executable against a live agent (validated by an evaluator)
