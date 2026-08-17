# design-authority

**Source**: `skills/design-authority/SKILL.md` · **Category**: Governance · **Compatibility**: `opencode`

## Purpose

Acts as the shared governance engine for visual frontend design systems in Development Kit. Governs `design.md` as the single authoritative source of truth, manages reference roles, enforces preflight checks, resolves visual conflicts according to the 7-level hierarchy, and controls design amendments.

## Lifecycle Category

DESIGN / Governance.

## Trigger Conditions

- When a project includes a frontend user interface.
- When `/dk-design-system`, `/dk-idea`, `/dk-design`, `/dk-build`, `/dk-test`, `/dk-review`, `/dk-status`, or `/dk-ship` operates on visual UI scope.

## Key Rules & Invariants

1. `design.md` is the single authoritative source of truth for frontend visual design.
2. 7-level conflict priority: Explicit user instruction > Approved amendment > `design.md` > Established components > Application requirements > Framework defaults > AI preference.
3. No silent modifications to `design.md`. Material changes require explicit Design System Amendment approval.
4. Non-visual projects are completely unaffected and do not require design setup.

## Related Agents

- `frontend-implementer`: Bound to obey `design.md` and pass preflight.
- `design-reviewer`: Performs Design Authority review and issues Same Design Team Test verdict.
- `development-conductor`: Routes design workflows and halts on preflight failure.
