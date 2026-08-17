---
name: design-system-reference-analysis
description: "Canonical analysis instruction and template for reverse-engineering an implementation-grade 31-section design.md from visual references."
---

# Design System Reference Analysis & Specification Template

## Role & Mission

Act as a senior **Product Designer**, **Design Systems Architect**, **UX Engineer**, and **Frontend Architect**.

When given one or more visual references (screenshots, application/website screens, mockups, Figma exports, or existing UI), analyze the supplied images to reverse-engineer the reusable design system behind them.

Do not merely describe individual screenshots and do not clone one screen pixel-for-pixel. Determine:
*"What reusable design rules would consistently generate interfaces that look like this?"*

---

## Evidence Classification Rules

For every material design decision, explicitly classify evidence as:
- **Observed**: Directly visible in the reference evidence.
- **Inferred**: Reasonably deduced from visual structure and patterns.
- **Recommended**: Best-practice additions to ensure a complete, production-grade design system.
- Optional **Confidence**: High | Medium | Low.

*Never represent uncertain details as confirmed facts. Provide reasoned values without unresolved TBD placeholders.*

---

## Required Output Structure

The generated project `design.md` must be written to the project root and must contain every one of the following 31 numbered sections:

```markdown
# Design System

## 1. Design DNA
[Core aesthetic personality, design philosophy, foundational principles]

## 2. Reference Analysis
[Summary of analyzed references, observed patterns, reconciled differences]

## 3. Visual Direction
[Tone, visual mood, density profile, brand expression]

## 4. Application Shell
[Global navigation layout, sidebar, header, canvas areas, utility panels, overlays]

## 5. Layout & Grid
[Grid structure, columns, gutters, margins, container max-widths, responsive layout shifts]

## 6. Spacing
[Harmonic spacing scale (e.g. 4px/8px based), component internal padding, section gaps]

## 7. Color System
[Semantic token hierarchy: primary, neutral, background, surface, border, feedback/status]

## 8. Typography
[Font family recommendations/fallbacks, type scale, line heights, letter spacing, font weights]

## 9. Shape & Radius
[Border-radius scale: none, sm, md, lg, xl, full, container vs component geometry]

## 10. Borders
[Border widths, subtle divider styles, focus ring styles]

## 11. Shadows & Elevation
[Elevation levels, ambient/key shadows, layered surfaces]

## 12. Iconography
[Coherent icon family recommendation, stroke weights, optical sizes, alignment rules]

## 13. Component System
[Core UI building blocks, component hierarchy, composition guidelines]

## 14. Navigation
[Primary navigation, breadcrumbs, tabs, pagination, mobile drawer]

## 15. Buttons & Actions
[Button variants: primary, secondary, tertiary/ghost, destructive, size scale, icon alignment]

## 16. Forms
[Inputs, labels, helper text, select dropdowns, checkboxes, radio buttons, validation styling]

## 17. Cards
[Card containers, padding rules, header/body/footer divisions, rules for when NOT to use cards]

## 18. Tables & Data Display
[Data-dense grids, headers, row striping/borders, cell alignment, badges, sorting indicators]

## 19. Feedback & Status
[Alert banners, inline toasts, status pills: success, warning, error, info]

## 20. Overlays
[Modals, slide-over sheets, popovers, tooltips, backdrop blur/tint]

## 21. Interaction States
[Default, hover, focus-visible, active, selected, disabled, loading, error, success, empty states]

## 22. Motion
[Transition durations, easing curves, entrance/exit animations, prefers-reduced-motion rules]

## 23. Responsive Behaviour
[Breakpoints (sm, md, lg, xl, 2xl), mobile structural transformations, touch target minimums]

## 24. Information Density
[Compact vs comfortable modes, padding ratios, scannability rules]

## 25. Accessibility
[WCAG 2.2 AA contrast ratios, keyboard navigation, focus traps, aria landmarks]

## 26. Design Tokens
[CSS custom properties / Tailwind configuration object / theme tokens ready for code]

## 27. Frontend Implementation Rules
[Coding agent guidelines: CSS modules/Tailwind patterns, forbidden ad-hoc styling]

## 28. Visual Invariants
[Non-negotiable visual rules that must never be broken across all screens]

## 29. Do Not
[Explicit visual anti-patterns and forbidden styling choices]

## 30. New Screen Generation Rules
[Guiding heuristics for generating unseen screens in this exact system]

## 31. Design QA Checklist
[Pre-completion inspection checklist for frontend implementers and reviewers]
```

---

## The Same Design Team Test

Before finalizing `design.md`, verify:
*"If another AI coding agent receives only the application requirements and this `design.md`, could it create multiple new screens that convincingly look like they were designed by the same team that produced the reference application?"*

If not, expand the tokens, layout specifications, and component rules until this standard is achieved.
