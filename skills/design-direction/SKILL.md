---
name: design-direction
description: >-
  Creates premium, intentional UI direction rather than generic generated
  layouts. Defines visual language, design principles, and aesthetic choices.
compatibility: opencode
---

# Design Direction

## Overview

Creates premium, intentional UI direction rather than generic generated layouts. Defines visual language, design principles, typography, colour, spacing, interaction patterns, and aesthetic choices before implementation begins.

## When to Use

- When building new user-facing features
- When the visual design needs intentional direction
- Before implementing complex UI components
- When the existing design language needs to be defined or refreshed

## Process

### 1. Define Design Principles

Establish 3-5 principles that guide all design decisions. Examples:
- **Clarity**: Every screen has one primary action
- **Efficiency**: Common tasks are reachable in two clicks
- **Consistency**: Similar actions behave identically everywhere
- **Delight**: Small moments of polish that reward exploration

### 2. Establish Visual Language

**Typography**
- Typeface selection (with fallback)
- Type scale (sizes and line heights)
- Font weights and usage rules
- Hierarchy rules (headings, body, captions)

**Colour**
- Primary palette (3-5 colours)
- Neutral palette (greys, backgrounds)
- Semantic colours (success, warning, error, info)
- Usage rules (what each colour is for)

**Spacing**
- Base unit (e.g., 4px or 8px grid)
- Spacing scale (xs, sm, md, lg, xl)
- Layout grid (columns, gutters, margins)

**Shadows, Borders, Radius**
- Border radius scale
- Shadow levels (for elevation)
- Border styles and colours

### 3. Define Interaction Patterns

- Hover, focus, active, disabled states
- Transition durations and easing
- Loading patterns (skeleton, spinner, optimistic)
- Error and empty state patterns
- Gesture patterns (swipe, pull-to-refresh)

### 4. Define Component Patterns

- Buttons (primary, secondary, ghost, danger, sizes)
- Forms (inputs, selects, checkboxes, validation)
- Cards, modals, drawers
- Navigation (tabs, breadcrumbs, sidebar)
- Data display (tables, lists, cards)

### 5. Document

Produce a design direction document with clear rules and examples.

## Design Direction Template

```
## Design Direction: [Project/Feature]

### Design Principles
1. [Principle 1]: [Description]
2. [Principle 2]: [Description]
3. [Principle 3]: [Description]

### Typography
- Typeface: [Name]
- Scale: [Sizes]
- Hierarchy: [Rules]

### Colour Palette
| Token | Hex | Usage |
|-------|-----|-------|
| --primary | #... | Main actions, links |
| --background | #... | Page background |
| --text | #... | Body text |

### Spacing
- Base unit: [value]
- Scale: xs=[value], sm=[value], md=[value], lg=[value], xl=[value]

### Interaction States
- Hover: [description]
- Focus: [description]
- Active: [description]
- Disabled: [description]
- Transition: [duration] [easing]

### Component Patterns
- [Component]: [Pattern rules]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "Default browser styles are fine" | Default styles look unprofessional. Intentional design builds trust. |
| "I'll polish the UI later" | Design debt accumulates just like technical debt. Plan it now. |
| "Following a design system is too much work" | A small set of rules saves countless micro-decisions during implementation. |
| "Users don't care about design" | Users might not articulate it, but they feel the difference between intentional and generic design. |

## Red Flags

- Generic dashboard grids with no hierarchy
- Excessive or arbitrary gradients
- Unnecessary glassmorphism
- Inconsistent spacing
- No hover or focus states
- Low colour contrast
- Weak visual hierarchy
- No clear primary action on screens
- Responsive behaviour is not considered

## Verification

- [ ] Design principles are defined
- [ ] Typography, colour, and spacing rules are established
- [ ] Interaction states are defined
- [ ] Component patterns are documented
- [ ] The direction produces intentional, non-generic designs
- [ ] Accessibility is considered (contrast, focus, labels)
- [ ] Responsive behaviour is addressed
