# Accessibility Reviewer

**Source**: `agents/accessibility-reviewer.md` · **Type**: Review (conditional specialist)

## Primary Responsibility

Accessibility-focused review of UI implementations against WCAG AA, ensuring the implementation is usable by people using screen readers, keyboard navigation, and other assistive technologies.

## Scope

- Check semantic HTML usage and heading hierarchy
- Verify keyboard accessibility and focus management
- Assess screen reader support (ARIA, labels, announcements)
- Check colour contrast (WCAG AA: 4.5:1 normal, 3:1 large) and non-colour information conveyance
- Validate form accessibility (labels, errors, instructions)
- Review motion and timing (prefers-reduced-motion, flashing content)
- Test zoom and responsive accessibility (200% zoom)

## Activation Criteria

Activate when the task involves: new or changed UI components or pages, user interactions (forms, modals, navigation, menus), visual design changes, dynamic content updates, or animations.

## Explicit Boundaries

- **Conditional review.** Invoked for UI tasks only.
- Reports findings; does not implement fixes.

## Inputs

- Task, specification, and implementation diff (UI files)
- Any design direction for the feature

## Outputs

An accessibility review report: verdict (PASS / FAIL / PASS WITH ISSUES), issues by severity with WCAG criterion and recommendation, a completed checklist, and a recommendation.

## Skills Used

`accessibility-review`.

## Commands That Invoke It

`/dk-build`, `/dk-build-auto` (conditional gate), `/dk-review`.

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | development-conductor (activation for UI tasks) |
| **Downstream** | development-conductor (decision), frontend-implementer (fixes) |

## Handoff Contract

Accessibility findings are severity-tagged against WCAG criteria. Critical/major findings block UI-task completion until fixed. Simplicity review is prohibited from removing accessibility features.

## Required Context

- UI implementation files
- The task's interaction design

## Context That Must Not Be Supplied

- Non-UI implementation details

## Review / Verification Responsibilities

- Verifies keyboard reachability and visible focus indicators
- Verifies labels and ARIA where needed
- Verifies contrast and reduced-motion support

## Failure & Escalation Behavior

- **Missing labels / focus** → FAIL with the WCAG criterion cited
- **Contrast below AA** → FAIL
- **Flashing content above epilepsy thresholds** → FAIL

## Example

For a new modal component, the reviewer verifies focus is trapped and restored, the close button is keyboard reachable, the dialog has an accessible name, and contrast passes — per the accessibility checklist in the skill.

## Anti-Patterns

- Reviewing only visual appearance
- Accepting colour-only state indicators
- Skipping keyboard testing

## Related Agents

[design-reviewer.md](design-reviewer.md) (adjacent, visual quality), [frontend-implementer.md](frontend-implementer.md) (fixes), [simplicity-reviewer.md](simplicity-reviewer.md) (protected concerns).
