# repository-orientation

**Source**: `skills/repository-orientation/SKILL.md` · **Category**: Meta · **Compatibility**: `opencode`

## Purpose

Inspects a new or unfamiliar repository before changes begin. Understands project structure, conventions, and architecture before any work starts.

## Lifecycle Category

Meta / UNDERSTAND — used before design and implementation work.

## Trigger Conditions

- New or unfamiliar repository
- Any task where the codebase area is not yet understood

## When Not to Invoke

- When the repository is already well understood and scout findings are current

## Required Inputs

- The repository location and the area relevant to the task

## Preconditions

- Repository access

## Procedure

1. Inspect directory structure and module organisation.
2. Identify architectural patterns (MVC, service layer, repository, etc.).
3. Find reusable code and utilities.
4. Identify conventions: naming, imports, error handling, testing, documentation.
5. Trace the execution flow for the relevant feature.
6. Produce the orientation report.

## Outputs

An orientation report (structure, patterns, reusable assets, conventions, constraints, key files, test locations).

## Invariants

- Orientation precedes changes — never modify before understanding.
- Findings are reported, not acted on directly.

## Dependencies

None.

## Related Agents

repository-scout-agent (executes the orientation).

## Related Commands

`/dk-idea`, `/dk-design`, `/dk-build`, `/dk-build-auto`, `/dk-debug` (via the scout).

## Verification Requirements

- [ ] Architecture summary produced
- [ ] Reusable assets identified
- [ ] Conventions documented

## Failure Behavior

- Unreadable or missing code is reported as a gap; conflicting evidence is flagged.

## Antigravity & OpenCode Behavior

- Identical behaviour in both environments; the scout applies it during task context gathering.

## Practical Example

Before adding an endpoint to an Express app, the scout uses this skill to report the existing route/service pattern and the project's error-response convention.

## Anti-Patterns

- Orienting while editing at the same time
- Reporting without tracing the actual execution flow

## Maintenance Notes

Keep aligned with `agents/repository-scout-agent.md`.
