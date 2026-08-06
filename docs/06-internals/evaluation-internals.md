# Evaluation Internals

## Model

Evaluations are **behavioural test cases** stored as JSON scenarios under `evals/<skill-name>/`. Each scenario describes an input and the expected agent behaviour.

## Scenario Structure

```json
{
  "skill": "the skill under test",
  "scenario": "description",
  "input": { ... },            // or "implementation": { ... }
  "expected": {
    "should_identify": [...],  // things the agent must find
    "should_pass": [...],
    "should_fail": [...],
    "must_not": [...],         // things the agent must not do
    "verdict_contains": "...", // expected verdict substring
    "min_...": n               // minimum counts
  }
}
```

## Expected-Behaviour Patterns

| Pattern | Meaning | Example |
| :--- | :--- | :--- |
| `verdict_contains` | Verdict string must include the token | `"FAIL"`, `"SIMPLIFICATIONS_RECOMMENDED"` |
| `must_not` | Prohibited behaviours | "approve without changes", "remove validation" |
| `should_identify` | Findings that must be surfaced | code-review issues list |
| Minimums | Lower bounds | `task_count_min: 3`, `minimum_sub_agents: 3` |

## Execution

There is **no runner** in the repository. Execution is manual or semi-automated: an evaluator presents the scenario input to an agent applying the skill and scores the output against `expected`.

## Scoring Semantics

Pass = every positive expectation met AND no `must_not` violated. Any `must_not` violation fails the scenario regardless of positives (e.g. removing a protected item).

## Adding a Scenario

1. Create `evals/<skill>/scenario-0N-<topic>.json` per the contract.
2. Update `docs/03-reference/evaluations/<skill>.md`.
3. No structural validation exists for these files (documented gap).

## Coverage

10 suites × 1 scenario. Not all 43 skills are evaluated — the evaluated set covers the most behaviour-heavy lifecycle stages. See [evaluation-strategy.md](../07-testing-quality-security/evaluation-strategy.md).
