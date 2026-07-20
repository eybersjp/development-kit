---
name: browser-runtime-verification
description: >-
  Checks runtime behaviour in the browser: console errors, network failures,
  DOM behaviour, responsive layout, accessibility, and user interactions.
compatibility: opencode
---

# Browser Runtime Verification

## Overview

Checks runtime behaviour in the browser: console errors, network failures, DOM behaviour, responsive layout, accessibility, and user interactions. This is a verification skill used to validate frontend implementations in real browser environments.

## When to Use

- After implementing UI components or pages
- When testing user interactions
- When verifying responsive design
- When checking accessibility
- Before marking frontend tasks as complete

## Process

### 1. Check Console

Open browser developer tools and check:
- **Errors**: Any JavaScript errors in the console
- **Warnings**: Deprecation warnings, API misuse warnings
- **Network errors**: Failed API calls, missing resources
- **React/Dev warnings**: Framework-specific warnings

### 2. Verify Network Behaviour

- API calls succeed with expected responses
- Error responses are handled gracefully
- Loading states are shown during requests
- Retry mechanisms work (if applicable)
- No unnecessary requests are made
- Requests are cancelled on unmount (if applicable)

### 3. Check DOM Behaviour

- Elements render with correct attributes and content
- Dynamic content updates correctly
- Event handlers fire correctly
- Focus management works (keyboard tab order, focus trapping in modals)
- Scroll behaviour is correct
- Animations and transitions complete without jank

### 4. Verify Responsive Layout

Test at multiple viewport sizes:
- Desktop (1920×1080)
- Laptop (1366×768)
- Tablet (768×1024)
- Mobile (375×667)

For each viewport:
- No horizontal scrolling
- Content is readable
- Interactive elements are tappable (minimum 44×44px touch targets)
- Navigation is usable
- Images and media scale correctly

### 5. Verify Accessibility

- Keyboard navigation works (Tab, Enter, Escape, Arrow keys)
- Focus indicators are visible
- Screen reader announcements are correct
- ARIA labels and roles are appropriate
- Colour contrast meets WCAG AA (minimum 4.5:1 for text)
- Form inputs have associated labels

### 6. Test User Interactions

- Click/tap targets work correctly
- Form submissions work with validation
- Error messages display correctly
- Success confirmations display correctly
- Loading states are visible
- Empty states are handled
- Edge cases (rapid clicking, empty forms, long inputs)

### 7. Document Findings

Report any issues found with reproduction steps.

## Verification Checklist

```
- [ ] Console: No errors
- [ ] Console: No warnings relevant to the implementation
- [ ] Network: API calls succeed
- [ ] Network: Errors handled gracefully
- [ ] DOM: Elements render correctly
- [ ] DOM: Dynamic updates work
- [ ] Responsive: Desktop layout correct
- [ ] Responsive: Tablet layout correct
- [ ] Responsive: Mobile layout correct
- [ ] Responsive: No horizontal scrolling at any size
- [ ] Accessibility: Keyboard navigation works
- [ ] Accessibility: Focus indicators visible
- [ ] Accessibility: Sufficient colour contrast
- [ ] Interactions: Clicks/taps work
- [ ] Interactions: Form validation works
- [ ] Interactions: Loading/error/empty states display
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "The unit tests pass, so the UI must work" | Unit tests don't verify browser behaviour. Test in the browser. |
| "I tested it at one screen size, it's fine" | One screen size is not enough. Test the responsive range. |
| "I'll check accessibility later" | Accessibility issues found later cost more to fix. Check now. |
| "The console is clean during development" | Console errors from edge cases appear during real use. Check carefully. |

## Red Flags

- Console errors are ignored because "they were there before"
- Only one viewport size is tested
- Accessibility is not tested
- Network errors are not handled in the UI
- Loading and empty states are missing
- Rapid clicking causes duplicate submissions or crashes
- Keyboard navigation is broken or missing

## Verification

- [ ] Console is clean (no errors or relevant warnings)
- [ ] Network requests succeed with proper error handling
- [ ] DOM renders correctly with dynamic updates
- [ ] Responsive layout works at all target viewports
- [ ] Keyboard navigation and focus management work
- [ ] Colour contrast meets WCAG AA
- [ ] User interactions work correctly including edge cases
