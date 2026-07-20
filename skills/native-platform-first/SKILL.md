---
name: native-platform-first
description: >-
  Prefers browser, runtime, framework, and language-native capabilities over
  external packages and custom implementations.
compatibility: opencode
---

# Native Platform First

## Overview

Prefers browser, runtime, framework, and language-native capabilities over external packages and custom implementations. This is steps 4-6 of the Ponytail ladder: check the standard library, the native platform, and installed dependencies before creating new code or adding new dependencies.

## When to Use

- Before adding a new dependency
- Before implementing custom functionality that might exist in the platform
- When reviewing a proposal that includes a new package
- When an implementation agent is about to implement something from scratch

## Process

### 1. Check the Standard Library

Before implementing custom functionality:
- **JavaScript/TypeScript**: Array methods, Object methods, Map, Set, Date, Intl, URL, fetch, Web APIs
- **Python**: itertools, collections, functools, datetime, pathlib, re, json, csv
- **Go**: strings, fmt, sort, encoding/json, net/http, time, sync
- **Rust**: Iterator, Option/Result, std::collections, std::sync

### 2. Check the Native Platform

**Browser APIs** (for frontend work):
- `fetch` instead of axios or request
- `URL` and `URLSearchParams` instead of query-string libraries
- `Intl` for internationalisation instead of moment/luxon
- `IntersectionObserver` instead of scroll-position libraries
- `ResizeObserver` instead of resize-listeners
- `Element.querySelector` instead of jQuery
- `CSS Grid` and `Flexbox` instead of layout libraries
- `CSS variables` instead of design-token build steps
- `<dialog>` instead of modal libraries
- `prefers-reduced-motion`, `prefers-color-scheme` for system preferences

**Node.js Runtime** (for backend work):
- `fs/promises` for file operations
- `path` for path manipulation
- `crypto` for hashing and encryption
- `http` / `https` for basic servers
- `events` for event emitters
- `stream` for data streaming

### 3. Check Existing Dependencies

Before adding a new dependency, check if existing dependencies already provide the capability:
- Does the framework (React, Express, Next.js) have a built-in solution?
- Does an installed utility library (lodash, date-fns) already have it?
- Can an existing dependency be used differently to solve this problem?

### 4. Justify New Dependencies

If a native or existing solution doesn't exist, justify the new dependency:
- What specific capability does it provide that the platform doesn't?
- What complexity does it save vs implementing ourselves?
- Is the dependency well-maintained and compatible?

## Platform Capability Reference

```yaml
frontend:
  browser:
    - fetch: HTTP requests (replaces axios)
    - URL/URLSearchParams: URL parsing and query strings
    - Intl: Date formatting, number formatting, pluralisation
    - IntersectionObserver: Scroll-based lazy loading
    - ResizeObserver: Responsive layout
    - CSS Grid/Flexbox: Layout (replaces Bootstrap grid)
    - CSS custom properties: Theming (replaces design token systems)
    - <dialog>: Modals and dialogs
    - WebSocket: Real-time communication

backend:
  node_standard_library:
    - fs/promises: File I/O
    - crypto: Hashing, encryption, random values
    - http/https: Basic HTTP servers
    - path: Path manipulation
    - url: URL parsing
    - querystring: Query string parsing
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "It's faster to install a package" | Installing a package adds a dependency forever. The standard library is already there. |
| "This library has a better API than the native API" | The native API is stable, well-documented, and never breaks. Library APIs change. |
| "The native API doesn't support this edge case" | Check again — native APIs have improved significantly. Also, edge cases may not need special handling. |
| "Everyone uses this library" | Popularity is not a substitute for necessity. Check if the native solution works first. |

## Red Flags

- A new dependency is added for what the standard library can do
- A browser API is ignored in favour of a library
- Multiple libraries overlap in functionality
- A well-known library is used for a trivial task (e.g., lodash for `Array.map`)
- The project has dependency bloat from "it's easier to install" decisions
- A framework feature is ignored in favour of a third-party alternative

## Verification

- [ ] Standard library options were evaluated before implementing custom code
- [ ] Native browser/runtime APIs were evaluated before adding dependencies
- [ ] Existing dependencies were checked before adding new ones
- [ ] Any new dependency is justified (what it provides that the platform doesn't)
- [ ] No "just in case" dependencies were added
