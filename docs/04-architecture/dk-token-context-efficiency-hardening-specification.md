# DKF Token & Context Efficiency Hardening Specification

**Target:** Development Kit Framework v0.10.1  
**Status:** Approved implementation specification  
**Scope:** Reduce framework-induced token consumption without weakening contract fidelity, verification independence, review gates, or user-visible behaviour.

---

## 1. Problem

DKF currently contains good qualitative guidance about context packing, but the runtime does not enforce that guidance strongly enough.

The principal waste mechanisms identified in the v0.10.1 audit are:

1. **Full authoritative-source materialization.** `runtime/orchestration/context-package.mjs` resolves every authoritative source by reading the entire file body into each role context, even when the Development Contract already specifies `sections`.
2. **Repeated methodology prose.** Always-on and frequently activated skills repeat rules already present in `AGENTS.md`, the Development Contract, and command definitions.
3. **Repeated repository orientation.** Repository-orientation guidance encourages re-orientation at session/task boundaries even when a previously recorded repository map remains valid.
4. **Narrative handoff growth.** Implementation/review outputs can become verbose narrative copies of information already represented by contract IDs, criterion IDs, file paths, fingerprints and evidence records.
5. **No token telemetry or budget visibility.** DKF has no built-in way to estimate static instruction weight or the size of a generated role-context package.

The result is unnecessary prompt/input expansion across conductor -> scout -> implementer -> verifier -> reviewers.

---

## 2. Audit baseline

Representative hot-path instruction files measured on the pre-hardening v0.10.1 branch total approximately **20,000 estimated tokens** using the conservative framework heuristic `ceil(characters / 4)`.

Notable individual payloads:

- `AGENTS.md`: ~1,831 estimated tokens
- `agents/development-conductor.md`: ~1,697
- `commands/dk-autopilot.md`: ~1,662
- `skills/using-development-kit/SKILL.md`: ~1,544
- `skills/native-platform-first/SKILL.md`: ~1,215
- `skills/dependency-restraint/SKILL.md`: ~1,165
- `skills/minimal-diff/SKILL.md`: ~1,091
- `skills/repository-orientation/SKILL.md`: ~964
- `skills/verification-before-completion/SKILL.md`: ~962
- `skills/context-packing/SKILL.md`: ~926

These estimates are not provider billing records. They are deterministic local approximations used to identify and prevent DKF-induced context bloat.

---

## 3. Goals

1. Materialize only requested authoritative-source sections when selectors are available.
2. Preserve source fingerprint/staleness guarantees.
3. Preserve independent verifier rehydration.
4. Keep full-source fallback when a selector cannot be resolved, rather than silently omitting authority.
5. Expose deterministic estimated token metrics on every generated role context.
6. Warn when a role context exceeds its advisory budget.
7. Add a repository-level token audit command and CI regression budget.
8. Reduce always-on/frequently activated methodology skill prose while preserving executable rules.
9. Make repository orientation cache-first rather than automatically repeating a full scan.
10. Prefer IDs, references, fingerprints and evidence pointers over repeated narrative handoffs.

---

## 4. Non-goals

v0.10.1 token hardening does **not**:

- lower model quality or automatically route to weaker models;
- skip required verification/review stages;
- allow implementation self-certification;
- omit required authoritative sources;
- change Acceptance Engine semantics;
- compress or truncate user requirements silently;
- introduce provider-specific token APIs;
- claim exact billed-token measurement where the host does not expose it;
- redesign the Development Contract schema.

---

## 5. Token estimation

DKF uses a provider-independent estimate:

```text
estimated_tokens = ceil(serialized_character_count / 4)
```

The estimate exists for relative optimization and regression detection.

When an external host later exposes actual input/output token accounting, the telemetry model may record both `estimated` and `observed` values, but v0.10.1 does not depend on host-specific accounting.

---

## 6. Section-aware authoritative sources

### Current behaviour

For every authoritative source:

```text
validate fingerprint
read entire file
embed entire file in role context
```

### Required behaviour

When `source.sections` is non-empty:

1. validate the entire file fingerprint exactly as today;
2. read the authoritative file;
3. resolve each requested selector;
4. include only the matching section/range plus small local context where appropriate;
5. record raw and delivered character/token counts;
6. record which selectors were resolved.

Supported selectors:

- Markdown heading names;
- stable requirement/criterion markers such as `REQ-1`;
- explicit line ranges in `L10-L30` form.

If any requested selector cannot be resolved, DKF fails safe for correctness by delivering the full source body and recording a `FULL_FALLBACK_UNRESOLVED_SELECTOR` warning.

No source content may be silently dropped.

---

## 7. Context-package token profile

Every `buildContextPackage()` result gains a `tokenProfile` block:

```json
{
  "estimator": "chars-div-4-v1",
  "roleBudget": 16000,
  "estimatedPackageTokens": 6200,
  "rawSourceTokens": 9000,
  "deliveredSourceTokens": 1800,
  "estimatedSourceTokensSaved": 7200,
  "sourceSavingsPercent": 80,
  "overBudget": false,
  "warnings": []
}
```

Advisory default budgets:

| Purpose | Estimated-token budget |
|---|---:|
| implementation | 16,000 |
| verification | 18,000 |
| technical-review | 12,000 |
| design-review | 14,000 |
| architecture-review | 14,000 |

Budgets are advisory in v0.10.1. They surface inefficiency but do not weaken or block correctness.

---

## 8. Static instruction budget

Add:

```text
node scripts/token-audit.mjs
npm run token:audit
```

The audit reports:

- estimated tokens by instruction file;
- totals by `AGENTS.md`, skills, agents and commands;
- a defined implementation hot-path total;
- largest instruction files;
- configured regression budgets.

CI must fail if the defined hot-path budget exceeds the post-hardening baseline by more than the allowed tolerance.

The audit must never claim provider billing accuracy.

---

## 9. Runtime-skill compression

Frequently loaded methodology skills must become executable capsules rather than mini-essays.

Runtime skill files should contain:

- purpose;
- activation condition;
- required process/rules;
- failure conditions;
- output/verification requirements where relevant.

Long rationalization tables, repeated command catalogues and repeated methodology explanations should be removed from runtime skills when those rules already exist in `AGENTS.md` or authoritative command docs.

Reference documentation may retain explanatory material.

Priority files:

- `using-development-kit`
- `context-packing`
- `repository-orientation`
- `subagent-driven-implementation`
- `existing-code-first`
- `native-platform-first`
- `dependency-restraint`
- `minimal-diff`
- `verification-before-completion`
- `test-driven-development`

Target: reduce the combined estimated token weight of these ten runtime skills by **at least 45%** while preserving their rules.

---

## 10. Repository orientation

Repository orientation changes from:

> re-orient at the start of every session

to:

> reuse a valid project-local orientation snapshot when the relevant repository fingerprints/conventions remain unchanged; perform delta inspection for the current task; run a full orientation only for a new repository, stale snapshot, architecture-level task, or material repository change.

v0.10.1 defines the behaviour at the skill/policy level. A richer semantic repository cache may be added in a later release.

---

## 11. Handoff discipline

Agent outputs should reference structured authority rather than restate it.

Implementation/verifier/reviewer handoffs should prefer:

- contract ID;
- run ID;
- source fingerprint;
- criterion IDs;
- changed file paths;
- command/test IDs and observed status;
- evidence references;
- blocking finding IDs.

Do not repeat full requirements/specification text unless the receiving role cannot resolve the referenced authority.

---

## 12. Acceptance criteria

### AC-TOK-001 — Section selectors are enforced
Given an authoritative source with `sections`, the context package delivers only resolved sections instead of the full file.

### AC-TOK-002 — Fingerprints remain whole-file authoritative
Section delivery does not change whole-file fingerprint/staleness checks.

### AC-TOK-003 — Unresolved selector fails safe
An unresolved selector causes full-source fallback with an explicit warning; content is not silently omitted.

### AC-TOK-004 — Line ranges are supported
A selector such as `L10-L20` resolves deterministic line content.

### AC-TOK-005 — Markdown headings are supported
A Markdown heading selector resolves from the matched heading through its section boundary.

### AC-TOK-006 — Stable marker selectors are supported
A requirement/criterion marker resolves a bounded local excerpt.

### AC-TOK-007 — Token profile is produced
Every role context contains estimated package/source token metrics and budget state.

### AC-TOK-008 — Verification isolation remains intact
Existing independent-context and no-self-certification tests remain green.

### AC-TOK-009 — Static token audit exists
`npm run token:audit` reports deterministic estimated token weight without external services.

### AC-TOK-010 — Hot-path regression is gated
CI detects material instruction-token regression.

### AC-TOK-011 — Runtime skills are materially smaller
The ten priority runtime skills are at least 45% smaller in combined estimated tokens than the audit baseline.

### AC-TOK-012 — Repository orientation is cache-first
Runtime guidance no longer requires unconditional full re-orientation at every session/task boundary.

### AC-TOK-013 — Reliability unchanged
Full `release:validate` remains green on Ubuntu and Windows.

---

## 13. Expected impact

The exact savings depend on project artifacts.

For sectioned specifications, source delivery should commonly fall by a large majority because only relevant sections are materialized.

For repeated implementation tasks, compressed methodology skills reduce fixed per-agent instruction overhead.

For reviewers/verifiers, token-profile telemetry makes future hotspots measurable instead of subjective.

---

## 14. Files expected to change

New:

- `runtime/orchestration/token-efficiency.mjs`
- `scripts/token-audit.mjs`
- `scripts/token-efficiency.test.mjs`
- this specification

Modified:

- `runtime/orchestration/context-package.mjs`
- priority runtime skills listed above
- mirrored Antigravity skill files
- `package.json`
- CI workflow
- changelog/release notes/reference docs

---

## 15. Release boundary

This work remains part of **v0.10.1** because it hardens the v0.10 reliability control plane without changing the lifecycle or acceptance model.

The green Live UI Preview state before this work is preserved at:

```text
checkpoint/v0.10.1-live-ui-preview-green
```
