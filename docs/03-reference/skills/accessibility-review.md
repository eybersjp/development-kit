# accessibility-review

**Source**: `skills/accessibility-review/SKILL.md` · **Category**: Review · **Compatibility**: `opencode`

## Purpose

Conditional specialist review for UI tasks. Ensures the implementation is accessible to all users, including those using assistive technologies. Reviews against WCAG AA.

## Lifecycle Category

REVIEW (conditional).

## Trigger Conditions

- New or changed UI components/pages
- User interactions (forms, modals, navigation, menus)
- Visual design changes or animations

## When Not to Invoke

- For backend-only tasks

## Required Inputs

- The UI implementation files

## Preconditions

- Implementation exists

## Procedure

1. Review semantic HTML and heading hierarchy.
2. Check keyboard accessibility and focus management.
3. Assess screen-reader support (ARIA, labels, announcements).
4. Verify colour contrast (WCAG AA) and non-colour conveyance.
5. Check forms, validation, and error association.
6. Review motion/timing (prefers-reduced-motion, flashing content).
7. Test zoom resilience (200%).
8. Report against the checklist in the skill.

## Outputs

- An accessibility verdict with WCAG-cited findings and a completed checklist

## Invariants

- Findings cite WCAG criteria.
- Critical/major findings block UI-task completion.

## Dependencies

None.

## Related Agents

accessibility-reviewer (primary).

## Related Commands

`/dk-review` (supporting), `/dk-build`, `/dk-build-auto` (conditional gate).

## Verification Requirements

- [ ] Keyboard navigation verified
- [ ] Labels/ARIA verified
- [ ] Contrast verified
- [ ] Reduced-motion respected

## Failure Behavior

- Missing labels, focus, or AA contrast → FAIL with cited criteria.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

For a modal: focus is trapped and restored, the dialog has an accessible name, the close control is keyboard reachable, and contrast passes AA.

## Anti-Patterns

- Reviewing only visual appearance
- Colour-only state indicators

## Maintenance Notes

Simplicity review must never remove accessibility features.
