---
name: accessibility-review
description: >-
  Conditional specialist review for UI tasks. Ensures the implementation is
  accessible to all users, including those using assistive technologies.
compatibility: opencode
---

# Accessibility Review

## Overview

A conditional specialist review for UI tasks. Ensures the implementation is accessible to all users, including those using screen readers, keyboard navigation, and other assistive technologies. Activated automatically for any task involving user interface changes.

## When to Use

Activate when the implementation involves:
- New UI components or pages
- Changes to existing UI components
- User interactions (forms, modals, navigation)
- Visual design changes
- Dynamic content updates
- Animations and transitions

## Process

### 1. Check Semantic HTML

- Are HTML elements used semantically (not `<div>` for everything)?
- Are headings used in a logical hierarchy (h1 → h2 → h3)?
- Are lists marked up as `<ul>` or `<ol>`?
- Are buttons `<button>` elements (not `<div>` with click handlers)?
- Are links `<a>` elements with href attributes?
- Are forms using `<form>`, `<label>`, `<fieldset>`, `<legend>`?

### 2. Check Keyboard Accessibility

- Can all interactive elements be reached with Tab?
- Is the tab order logical (matches visual order)?
- Can all actions be performed with the keyboard?
- Are focus indicators visible (not `outline: none`)?
- Is focus trapped correctly in modals and dialogs?
- Does pressing Escape close modals, menus, and dialogs?
- Are there keyboard shortcuts (and are they documented)?

### 3. Check Screen Reader Accessibility

- Do images have meaningful alt text (or `alt=""` for decorative)?
- Do form inputs have associated labels (`<label>` or `aria-label`)?
- Are dynamic content updates announced (aria-live regions)?
- Do complex components (tabs, accordions, menus) have correct ARIA roles?
- Are error messages associated with their inputs (`aria-describedby`)?
- Is the page structure announced correctly (landmarks, headings)?

### 4. Check Colour and Contrast

- Does text have sufficient contrast (WCAG AA: 4.5:1 for normal text, 3:1 for large text)?
- Are interactive elements distinguishable (not just colour)?
- Is information conveyed in more ways than just colour?
- Do focus indicators have sufficient contrast?

### 5. Check Forms and Validation

- Are required fields indicated (visually and programmatically)?
- Are error messages clear and associated with inputs?
- Is form submission confirmed (success or error message)?
- Are instructions provided for complex inputs?

### 6. Check Motion and Timing

- Can animations be disabled (prefers-reduced-motion)?
- Do auto-playing media have pause controls?
- Is there enough time for timed interactions?
- Do flashing elements respect epilepsy thresholds (no more than 3 flashes per second)?

### 7. Test at Multiple Zoom Levels

- Is the page usable at 200% zoom?
- Is the page usable at 400% zoom?
- Is there no information loss at zoomed-in states?
- Is content not cut off or overlapping?

## Accessibility Checklist

```
### Semantic HTML
- [ ] Semantic elements used correctly
- [ ] Heading hierarchy is logical
- [ ] Buttons are <button>, links are <a>

### Keyboard
- [ ] All interactive elements reachable via Tab
- [ ] Tab order matches visual order
- [ ] Focus indicators are visible
- [ ] Modals trap focus correctly
- [ ] Escape closes overlays

### Screen Reader
- [ ] Images have alt text
- [ ] Form inputs have labels
- [ ] Dynamic updates announced via aria-live
- [ ] ARIA roles are correct
- [ ] Errors are associated with inputs

### Colour & Contrast
- [ ] Text meets WCAG AA contrast (4.5:1)
- [ ] Information not conveyed by colour alone
- [ ] Focus indicators have sufficient contrast

### Motion
- [ ] Respects prefers-reduced-motion
- [ ] No flashing above epilepsy threshold
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "Our users don't use screen readers" | 1.3 billion people worldwide have some form of disability. Build for everyone. |
| "Accessibility is too expensive" | Accessibility built in from the start is cheap. Retrofitting is expensive. |
| "I'll add accessibility later" | Accessibility later means accessibility never. Build it in. |
| "WCAG compliance is too hard" | Start with the basics: semantic HTML, keyboard support, colour contrast. Most of the value comes from these. |
| "The framework handles accessibility" | Frameworks provide tools. You must use them correctly. |

## Red Flags

- Focus indicators are removed (`outline: none`)
- Images don't have alt text
- Forms don't have labels
- Colour is the only way to convey information
- Interactive elements can't be reached by keyboard
- Modals don't trap or manage focus
- Error messages are not associated with their inputs
- Low contrast text (grey on grey)

## Verification

- [ ] Semantic HTML is used correctly
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible
- [ ] Images have appropriate alt text
- [ ] Form inputs have labels
- [ ] Colour contrast meets WCAG AA
- [ ] Information is not conveyed by colour alone
- [ ] Dynamic content is announced correctly
- [ ] The implementation respects prefers-reduced-motion
- [ ] The page is usable at 200% and 400% zoom
