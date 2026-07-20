---
name: design-quality-review
description: >-
  Prevents generic AI-generated visual language. Assesses visual hierarchy,
  spacing, typography, interaction design, and overall design quality.
---

# Design Quality Review

## Overview

Prevents generic AI-generated visual language. Assesses visual hierarchy, spacing, typography, colour usage, interaction design, and overall design quality. Ensures the UI meets a professional standard with intentional, purposeful design decisions.

## When to Use

- After UI implementation is complete
- When reviewing frontend code
- When assessing visual design quality
- Before shipping user-facing features

## Process

### 1. Assess Visual Hierarchy

Check that the most important content is the most prominent:
- Is there a clear primary action on each screen?
- Is secondary content visually subordinate?
- Is the reading order logical?
- Is there too much competing visual weight?

### 2. Check Layout and Spacing

- Is spacing consistent (using the defined spacing scale)?
- Are elements aligned properly?
- Is there sufficient breathing room between elements?
- Is the layout intentional, not default?
- No horizontal overflow or unintended overlap?

### 3. Evaluate Typography

- Is the type scale consistent?
- Are line heights readable (1.5 for body text)?
- Is the type hierarchy clear (headings vs body vs captions)?
- Are line lengths appropriate (45-75 characters for body text)?

### 4. Review Colour Usage

- Is the colour palette used consistently?
- Are colours used meaningfully (not decoratively)?
- Is text contrast sufficient (WCAG AA)?
- Are interactive elements visually identifiable?

### 5. Assess Interaction Design

- Are hover states defined for interactive elements?
- Are focus states visible for keyboard users?
- Are transitions smooth and purposeful (not gratuitous)?
- Are loading states and empty states handled?
- Are error states clear and recoverable?

### 6. Check Design Pattern Usage

- Are buttons, cards, forms consistent with the design system?
- Are similar components visually consistent?
- Are there unnecessary decorative elements?
- Are there gratuitous effects (glassmorphism, excessive gradients)?

### 7. Review Responsive Design

- Does the layout adapt appropriately to different screen sizes?
- Are touch targets at least 44x44px?
- Is content prioritised appropriately on small screens?
- Is horizontal scrolling avoided on all screen sizes?

## Never-Allow List

Flag and reject:
- Generic dashboard grids without visual hierarchy
- Excessive or arbitrary gradients
- Unnecessary glassmorphism or backdrop blur
- Unnecessary card containers (cards in cards)
- Weak visual hierarchy (everything has the same weight)
- Generic AI-generated visual language
- Inconsistent spacing throughout the UI
- Missing hover, focus, and active states
- Insufficient colour contrast
- Unnecessary animations or transitions

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "The UI looks fine to me" | Personal preference is not a quality standard. Use the checklist. |
| "I'll polish the UI later" | Design quality is not optional polish. Review it now. |
| "This is just a simple form, it doesn't need design review" | Simple forms benefit most from good design. Poor form design causes user errors. |
| "The design system handles this" | The design system provides tools. Using them correctly requires review. |

## Red Flags

- Generic dashboard layout with no visual hierarchy
- Gratuitous visual effects (glassmorphism, excessive gradients)
- Inconsistent spacing or alignment
- Missing interaction states (hover, focus)
- Low contrast or inaccessible colour choices
- Cards containing cards containing cards
- Everything has the same visual weight (no hierarchy)
- No clear primary action on any screen

## Verification

- [ ] Visual hierarchy is clear and intentional
- [ ] Spacing and alignment are consistent
- [ ] Typography has a clear hierarchy with readable line heights
- [ ] Colour palette is used consistently with sufficient contrast
- [ ] Interaction states (hover, focus, active, disabled) are defined
- [ ] Loading, empty, and error states exist
- [ ] Never-allow list items are not present
- [ ] Responsive behaviour is appropriate
- [ ] Touch targets are at least 44x44px
- [ ] No horizontal scrolling at any viewport size
