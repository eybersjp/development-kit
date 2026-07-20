---
name: dependency-restraint
description: >-
  Requires justification before adding any new dependency. Every new
  dependency must provide value that the platform, standard library,
  or existing dependencies cannot.
---

# Dependency Restraint

## Overview

Requires justification before adding any new dependency. Every new dependency has a cost: installation time, build complexity, security risk, maintenance burden, bundle size, and potential breakage on updates. Before adding a dependency, the team must justify that the value outweighs these costs.

## When to Use

- Before adding any new npm, pip, gem, cargo, or other package dependency
- When reviewing a proposal that includes a new dependency
- When an implementation agent proposes a new package
- During code review of a change that adds a dependency

## Process

### 1. Identify the Need

What specific capability is needed that doesn't exist in:
- The programming language's standard library?
- The native platform (browser, Node.js, OS)?
- The framework (React, Express, Django)?
- An existing dependency that's already installed?

### 2. Assess Alternatives

For each alternative, estimate the effort:
- **Standard library**: How many lines of code to implement this ourselves?
- **Native platform**: Can a built-in API do this?
- **Existing dependency**: Can we use something already installed?
- **Hand-rolled**: How complex would a minimal implementation be?

### 3. Evaluate the Dependency

If no alternative works, evaluate the candidate dependency:

**Cost Assessment**
- Bundle size impact (kB added to the bundle)
- Build complexity (new build tool, polyfill, or configuration)
- Security risk (maintenance track record, vulnerability history)
- Maintenance burden (how often does it change? breaking changes?)
- Learning curve (does the team need to learn it?)
- License compatibility

**Value Assessment**
- Does it solve a complex problem we'd struggle to solve ourselves?
- Does it save significant development time?
- Does it handle edge cases we'd miss?
- Is it the standard in the ecosystem?

### 4. Make a Decision

- **ACCEPT**: The dependency's value clearly exceeds its cost.
- **REJECT**: The cost exceeds the value. Use an alternative approach.
- **DEFER**: Not needed now. Can be added later if necessary.

### 5. Document the Decision

If accepted, document:
- What the dependency provides
- Alternatives considered and why they weren't chosen
- The specific version being added (not a range)
- The justification

## Dependency Justification Template

```
### Dependency: [package-name@version]

**Purpose**: [What it does]

**Alternatives considered**:
- Standard library: [why not suitable]
- Native platform: [why not suitable]
- Existing dependency: [why not suitable]
- Hand-rolled: [complexity estimate]

**Costs**:
- Bundle size: [kB]
- Security risk: [low/medium/high]
- Maintenance: [low/medium/high]
- License: [compatible/incompatible]

**Value**: [What it enables]

**Decision**: ACCEPT / REJECT / DEFER
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "It's just one small dependency" | Every dependency adds cost. "Just one" becomes many over time. |
| "Everyone uses this library" | Popularity is not a substitute for necessity. |
| "It's free and open source" | Free to use, not free to maintain. You're adopting its maintenance burden. |
| "We'll save time by not writing it ourselves" | Will you? Consider the time to evaluate, install, configure, learn, update, and debug the dependency. |
| "It handles edge cases we'd miss" | That's a valid reason. Document it. |
| "The API is better than the standard library" | API preference is not a justification. The standard library is stable and dependency-free. |

## Red Flags

- Dependencies are added without documented justification
- Multiple dependencies serve overlapping purposes
- A dependency is added for a small utility function (use the standard library)
- Dependency version ranges are too loose (`^1.0.0` instead of `1.2.3`)
- Dependencies are added "just in case"
- The dependency has known security vulnerabilities
- The dependency has a large number of transitive dependencies
- The dependency is not actively maintained

## Verification

- [ ] The need for the dependency is clearly identified
- [ ] Standard library and native platform alternatives were evaluated
- [ ] Existing dependencies were checked first
- [ ] A written justification exists for every new dependency
- [ ] The dependency version is pinned (not a range)
- [ ] The dependency's license is compatible
- [ ] The dependency is actively maintained
