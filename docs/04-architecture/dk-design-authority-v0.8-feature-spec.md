# Development Kit Framework v0.8.0
# DKF Design Authority — Implementation-Ready Feature Specification

**Feature ID:** DKF-DA-001  
**Feature name:** DKF Design Authority  
**Target release:** Development Kit v0.8.0  
**Status:** Approved for implementation  
**Repository:** `eybersjp/development-kit`  
**Current canonical package version at specification time:** `0.7.0`  
**Primary authoritative artifact created in user projects:** `/design.md`

---

## 1. Product Decision

Development Kit will gain a lifecycle-wide **Design Authority** capability for projects containing a visual frontend.

The capability is not limited to generating a style guide. It governs how a project's design system is discovered, extracted, approved, applied, amended, tested, reviewed, and released.

For frontend visual decisions, an approved root-level `design.md` becomes the project's controlled visual specification and single authoritative source of truth for:

- visual design;
- UI styling;
- component appearance;
- application shell and page layout;
- spacing;
- typography;
- colour;
- borders, radii, shadows, and elevation;
- iconography;
- responsive behaviour;
- interaction states;
- motion;
- visual density;
- visual consistency;
- design tokens;
- visual accessibility rules.

Development Kit must actively prevent coding agents from silently drifting away from that design authority.

---

## 2. Problem

AI coding agents can produce individually acceptable screens while progressively drifting from the intended product design. Common failure modes include:

- inventing new colours, spacing, radii, shadows, or font sizes;
- accepting component-library default styling;
- mixing icon families;
- treating mobile as a compressed desktop layout;
- implementing new screens in a different visual language;
- silently changing established design tokens because implementation is easier;
- creating arbitrary one-off CSS values;
- losing fidelity to reference applications after several implementation cycles;
- treating a screenshot as a one-off layout instead of inferring the reusable design system behind it;
- never asking the user for visual references until implementation is already underway.

DKF already has a `design.md` concept, a `design-direction` skill, a `design-reviewer`, a `frontend-implementer`, design-aware `/dk-design`, and design gates in build/test/review. The new capability strengthens and connects those existing primitives into one governed lifecycle.

---

## 3. Goals

DKF Design Authority must:

1. Detect when a project or feature contains a visual frontend.
2. For a new frontend application, ask for design references near the start of `/dk-idea`, before significant UI direction is invented.
3. Accept one or more user-supplied visual references and distinguish their authority.
4. Reverse-engineer reference images into a reusable implementation-grade design system rather than copying screenshots pixel-for-pixel.
5. Create a root-level `design.md` that another AI agent can use to build unseen screens in the same design language.
6. Support projects that already have an established UI or an existing `design.md`.
7. Persist design-authority state under `.development-kit/`.
8. Make `design.md` a controlled specification that cannot be silently changed by implementation agents.
9. Introduce an explicit Design System Amendment workflow.
10. Inject the design authority automatically into every frontend implementation task.
11. Prevent `/dk-build`, `/dk-build-auto`, and `/dk-autopilot` from starting frontend implementation when required design authority is unresolved.
12. Detect design drift during `/dk-test` and `/dk-review`.
13. Add a human-readable **Same Design Team Test** to visual review.
14. Make unresolved material design-system failures a `/dk-ship` blocker for relevant frontend changes.
15. Preserve backward compatibility for backend-only projects and existing DKF projects.
16. Ship the capability completely across source, installer, package, docs, tests, evals, and release metadata.

---

## 4. Non-Goals

v0.8.0 does not require DKF to become:

- a Figma replacement;
- a pixel-perfect visual-diff engine;
- an image editor;
- a general-purpose brand-management platform;
- a full Storybook replacement;
- a proprietary UI component library;
- a mandatory design system for projects with no user interface.

Automated static checks may provide evidence of drift, but agent-based visual judgement remains necessary for hierarchy, composition, density, reference fidelity, and the Same Design Team Test.

---

## 5. Core Authority Rule

`design.md` is the **single authoritative source of truth for all frontend visual design, UI styling, component appearance, layout behaviour, spacing, typography, colour, responsive behaviour, interaction states, and visual consistency in the project.**

All frontend implementation must comply with `design.md`.

### Mandatory enforcement rules

1. Read `design.md` before any frontend or UI-related work.
2. All new pages, screens, components, forms, dashboards, navigation, dialogs, tables, cards, states, and responsive layouts must follow it.
3. Do not invent arbitrary colours, font sizes, weights, spacing values, radii, shadows, variants, breakpoints, icon styles, or interaction patterns where an applicable rule/token exists.
4. Reuse existing design tokens and components before creating new ones.
5. Unspecified screens must be extrapolated from the approved design language, not designed in a new style.
6. Preserve hierarchy, information density, alignment, spacing rhythm, typography hierarchy, geometry, colour discipline, and interaction behaviour.
7. Do not introduce a conflicting UI library, visual framework, icon family, typography system, or styling convention.
8. Third-party UI components may provide behaviour/accessibility primitives, but their appearance must conform to `design.md`.
9. Never silently modify `design.md`.
10. Missing design-system rules may be proposed but not silently invented as new authority.
11. If a requirement conflicts with `design.md`, report the conflicting requirement, relevant design rule, reason for conflict, and recommended resolution.
12. Never weaken the design system for implementation speed.
13. Existing noncompliant UI should be brought into compliance when materially touched unless that would unreasonably expand scope.
14. Responsive work must follow `design.md`; mobile is not merely scaled-down desktop.
15. Implement all applicable component states: default, hover, focus, active, selected, disabled, loading, error, success, empty.
16. Accessibility requirements in `design.md` are mandatory.
17. Avoid one-off CSS values. Repeated missing visual requirements should become proposed reusable tokens/rules.
18. Before frontend work is accepted, ask: **Does this screen look like it was created by the same design team and from the same design system as the reference application?** If not, revise it.

---

## 6. Conflict Priority

For frontend visual decisions, DKF must enforce this authority order:

1. Explicit current user instruction.
2. Explicitly approved Design System Amendment.
3. Current approved `design.md`.
4. Existing established project components.
5. Application requirements.
6. Framework or component-library defaults.
7. AI implementation preference.

Framework defaults and AI preferences may never override the project's approved visual system.

---

## 7. Feature Architecture

DKF Design Authority consists of these coordinated subsystems:

1. **Reference Discovery** — asks whether references exist and records them.
2. **Design Forensics** — analyses supplied images and existing UI.
3. **`design.md` Generation** — produces the complete visual specification.
4. **Design System Approval** — requires explicit approval before strict frontend enforcement starts for a newly created system.
5. **Design Context Injection** — automatically loads the current design authority for frontend tasks.
6. **Design Amendment Control** — prevents silent foundational changes.
7. **Design Drift Detection** — identifies source-level and rendered UI divergence.
8. **Compliance Testing** — records objective/mechanical design-system checks.
9. **Same Design Team Verification** — design-review judgement for implemented UI.
10. **Release Gate** — prevents shipping material frontend drift.

---

## 8. Canonical Project Files

### User-visible authoritative file

```text
/design.md
```

Do not bury the design system inside `.development-kit/`. It must be visible to developers, coding agents, and design tooling.

### DKF machine state

```text
/.development-kit/design-system-state.json
```

### Optional generated verification artifact

```text
/.development-kit/design-system-report.md
```

The report is evidence/output only. It never outranks `design.md`.

### Reference files

DKF should not force-copy user images if they already exist at stable project paths. It should record resolvable paths/identifiers in state. Where DKF must persist an imported reference into the project, use:

```text
/.development-kit/design-references/
```

No reference image may be silently deleted or modified.

---

## 9. New Command: `/dk-design-system`

Create:

```text
commands/dk-design-system.md
```

### No-argument behaviour

`/dk-design-system` inspects current state and selects the appropriate workflow. It should show status first, then act on the unresolved step.

### Supported modes

```text
/dk-design-system create
/dk-design-system reference
/dk-design-system existing
/dk-design-system inspect
/dk-design-system verify
/dk-design-system amend
```

The initial public implementation may document these as sub-modes of one command rather than registering separate commands.

### `create`

Use when a visual frontend needs a new design direction and no authoritative visual reference exists.

- Read requirements/specification.
- Inspect any existing frontend architecture if present.
- Use existing DKF `design-direction` capabilities.
- Generate a full `design.md` using the same required structure as reference-derived systems, explicitly marking rules as recommended/inferred where appropriate.
- Present for user approval.

### `reference`

Use when one or more images/screenshots are supplied.

- Record each reference and its authority role.
- Run the Design Forensics extraction specification.
- If no approved `design.md` exists, generate a draft and request approval.
- If an approved `design.md` already exists, never overwrite it simply because new references arrived. Compare new evidence to the current system and produce either:
  - consistent evidence;
  - newly discovered non-conflicting rules;
  - Design System Amendment Proposals for conflicts/foundational changes.

### `existing`

Use for an existing frontend.

Inspect, where present:

- frontend framework;
- CSS architecture;
- theme files;
- Tailwind configuration;
- component library;
- reusable components;
- fonts;
- icon families;
- breakpoints;
- existing screens;
- established tokens and variables.

Then allow the user to:

1. preserve and document the current design;
2. refine it using supplied references;
3. redesign using new references;
4. use an existing `design.md`.

Do not unnecessarily rebuild technically sound infrastructure.

### `inspect`

Read-only status. Show at least:

- applicable/not applicable;
- state/status;
- current design-system version;
- `design.md` existence;
- source mode;
- registered references and authority roles;
- pending amendments;
- last verification verdict;
- whether frontend work is currently permitted.

### `verify`

Read-only with respect to design authority.

- Read `design.md`.
- Inspect touched/relevant frontend source and rendered UI where tooling supports it.
- Run objective source checks and visual review checks.
- Produce/update `.development-kit/design-system-report.md` and state verification metadata.
- Do not alter `design.md`.

### `amend`

Create or process controlled Design System Amendment Proposals.

Approved foundational changes bump the design-system version and update `design.md`. Rejected proposals leave `design.md` unchanged.

---

## 10. Reference Authority Model

Each reference has one role:

- `authoritative` — must drive the inferred visual system unless an explicit user instruction overrides it;
- `supporting` — inspiration/evidence that may fill gaps but must not override authoritative references;
- `existing` — evidence of the current product's established implementation.

When multiple references are supplied and their intended authority is ambiguous, DKF must resolve the hierarchy before treating conflicting evidence as authoritative.

Repeated patterns across multiple authoritative images are stronger evidence than a single occurrence.

Conflicts between screenshots should be documented, not silently averaged away.

---

## 11. Design Forensics Requirements

The image-analysis workflow must create an implementation-ready design system, not a screenshot description.

Every significant rule must be classifiable as:

- **Observed** — directly visible in supplied evidence;
- **Inferred** — strongly inferred from repeated/proportional evidence;
- **Recommended** — implementation rule needed for completeness but not visible in evidence.

Add confidence where useful:

```text
Evidence: Observed | Inferred | Recommended
Confidence: High | Medium | Low
```

### Required design.md structure

```text
# Design System

## 1. Design DNA
## 2. Reference Analysis
## 3. Visual Direction
## 4. Application Shell
## 5. Layout & Grid
## 6. Spacing
## 7. Color System
## 8. Typography
## 9. Shape & Radius
## 10. Borders
## 11. Shadows & Elevation
## 12. Iconography
## 13. Component System
## 14. Navigation
## 15. Buttons & Actions
## 16. Forms
## 17. Cards
## 18. Tables & Data Display
## 19. Feedback & Status
## 20. Overlays
## 21. Interaction States
## 22. Motion
## 23. Responsive Behaviour
## 24. Information Density
## 25. Accessibility
## 26. Design Tokens
## 27. Frontend Implementation Rules
## 28. Visual Invariants
## 29. Do Not
## 30. New Screen Generation Rules
## 31. Design QA Checklist
```

No required token/value may be left as `TBD`. Unknown exact values must receive a reasoned implementation recommendation clearly marked as inferred/recommended.

Target accessibility is WCAG 2.2 AA unless project requirements explicitly set a stricter standard.

---

## 12. State Schema

File:

```text
.development-kit/design-system-state.json
```

Schema version for v0.8.0: `1`.

### Canonical example

```json
{
  "schema_version": 1,
  "applicable": true,
  "status": "approved",
  "authority_file": "design.md",
  "design_system_version": "1.0.0",
  "enforcement": "strict",
  "drift_detection": true,
  "source_mode": "reference",
  "created_at": "2026-08-17T15:00:00.000Z",
  "approved_at": "2026-08-17T15:15:00.000Z",
  "last_updated_at": "2026-08-17T15:15:00.000Z",
  "references": [
    {
      "id": "ref-001",
      "path": ".development-kit/design-references/dashboard.png",
      "role": "authoritative",
      "kind": "image",
      "status": "available",
      "sha256": "<computed-digest>"
    }
  ],
  "authority_order": [
    "explicit_user_instruction",
    "approved_design_amendment",
    "design_md",
    "established_project_components",
    "application_requirements",
    "framework_defaults",
    "ai_preference"
  ],
  "pending_amendments": [],
  "amendment_history": [],
  "last_verification": {
    "at": "2026-08-17T16:00:00.000Z",
    "verdict": "pass",
    "same_design_team": "pass",
    "critical": 0,
    "major": 0,
    "minor": 0,
    "report": ".development-kit/design-system-report.md"
  },
  "legacy_migration": null
}
```

`sha256` is optional when the runtime cannot calculate a digest, but if state management code has filesystem access it should calculate one to detect reference replacement.

### Status enum

```text
not_required
unconfigured
deferred
references_requested
references_received
generating
draft
awaiting_approval
approved
amendment_pending
superseded
```

### State transition rules

```text
UI not applicable
  -> not_required

UI applicable, no system
  -> unconfigured
  -> references_requested | generating | deferred

references_requested
  -> references_received
  -> generating
  -> draft
  -> awaiting_approval
  -> approved

deferred
  -> may continue non-frontend lifecycle work
  -> MUST resolve before first material frontend implementation

approved
  -> amendment_pending (only when a conflicting/foundational change is proposed)
  -> approved (proposal rejected, or approved amendment applied and version bumped)

approved
  -> superseded only after explicit user approval of a replacement design direction
```

Invalid state transitions must not silently rewrite the state file.

---

## 13. Design-System Versioning

Use semantic versioning for the design system independently of the DKF package version.

- Initial approved `design.md`: `1.0.0`.
- Clarification with no normative design effect: patch bump.
- Backward-compatible design-system extension/new reusable rule: minor bump.
- Foundational replacement that materially changes visual language: major bump.

The current version must be visible in `design.md` and machine state.

The state file is machine metadata; `design.md` remains the visual authority.

---

## 14. Design System Amendment Control

A coding agent must not autonomously:

- rewrite the design direction;
- change the aesthetic;
- alter core tokens;
- replace typography;
- replace colour architecture;
- change the spacing scale;
- change the radius language;
- introduce a competing component style;
- change the icon family;
- redefine visual invariants.

When needed, use exactly this decision structure:

```text
DESIGN SYSTEM AMENDMENT PROPOSAL

Current rule:
[existing rule]

Proposed rule:
[new rule]

Reason:
[why the change is necessary]

Affected components/screens:
[list]

Risk of visual inconsistency:
[low / medium / high]

Recommendation:
[accept / reject / alternative]
```

The proposal may be stored in state as pending, but `design.md` must remain unchanged until explicit approval.

After approval:

1. update `design.md`;
2. bump design-system version;
3. clear pending status;
4. append immutable summary metadata to `amendment_history`;
5. re-run affected frontend verification.

---

## 15. Lifecycle Integration

### 15.1 `/dk-idea`

For a **new project**:

1. Confirm whether the project includes a visual frontend.
2. If yes, perform Design System Discovery during the initial discovery block, before inventing detailed UI styling.
3. Ask whether the user has visual references.
4. Explain accepted forms: screenshots, application screens, website screenshots, mockups, Figma exports/images, competitor references, existing product screens, or an existing `design.md`.
5. Offer:
   - attach references;
   - use an existing `design.md`;
   - derive from an existing application;
   - create a new direction without references;
   - defer.
6. If deferred, persist `status: deferred`. Do not repeatedly nag during non-frontend work, but do not allow first material frontend implementation to bypass resolution.

For an **existing project with frontend code**:

- detect existing `design.md` and established UI first;
- ask whether to preserve/document, refine using references, redesign, or use existing `design.md`;
- do not assume a supplied inspiration image automatically outranks the existing product.

For a **backend-only/non-visual project**:

- persist or infer `not_required` only where project state is already being created;
- do not add unnecessary questioning or blocking.

Update `requirements.md` so the existing Reference-source contract becomes a **Design Authority Contract** when the project is visual.

### 15.2 `/dk-spec`

If Design Authority applies, specification artifacts must include:

- whether design authority is required;
- current `design.md` status/version;
- source mode;
- reference authority hierarchy;
- visual acceptance criteria;
- amendment rule;
- design preflight requirement for frontend tasks.

Do not duplicate the complete contents of `design.md` into the product spec.

### 15.3 `/dk-design`

Keep `/dk-design` as the broad technical + visual design command.

Change its visual branch so it delegates design-system discovery/extraction/governance to `/dk-design-system` semantics rather than maintaining a weaker parallel contract.

When Design Authority is not applicable, existing `/dk-design` behaviour remains unchanged.

### 15.4 `/dk-tasks`

Frontend tasks must explicitly carry or inherit:

```text
Design Authority: required
Authority: design.md
```

Tasks proposing a foundational visual change must be separated into an amendment/approval step before implementation.

### 15.5 `/dk-build`

Before spawning a frontend implementation agent, run **Design System Preflight**:

```text
[ ] Design Authority applicability determined
[ ] design.md exists when required
[ ] state is approved when required
[ ] current design-system version known
[ ] no unresolved amendment blocks this task
[ ] implementation agent is given design.md
[ ] relevant reference/baseline evidence is available where required
```

If required Design Authority is `deferred`, `unconfigured`, `draft`, or `awaiting_approval`, stop only the frontend task and direct the workflow to `/dk-design-system`.

Non-frontend tasks continue when independently safe.

### 15.6 `/dk-build-auto`

Apply the same preflight before every frontend slice.

Automation must never interpret “auto” as authority to:

- approve a design system;
- approve a foundational amendment;
- silently resolve a design conflict;
- bypass a missing `design.md`.

Material visual conflicts trigger the existing feature-pause mechanism. Minor implementation choices that are fully governed by `design.md` remain autonomous.

### 15.7 `/dk-autopilot`

Add Design Authority to persistent autopilot lifecycle state.

Autopilot must:

- perform reference discovery for new UI projects;
- pause for references/approval where required;
- allow safe non-frontend progress after a deferred choice;
- enforce the frontend preflight before implementation;
- include Design Authority verification before completion.

Do not create a second independent lifecycle state machine. Integrate with the existing autopilot persistence model and reference `design-system-state.json` as the design-specific authority.

### 15.8 `/dk-test`

Add a named **Design System Compliance** verification section for relevant frontend scope.

Mechanical/objective checks should cover, where applicable and technically reliable:

- use of defined visual tokens;
- introduction of unexplained raw colour literals where system tokens exist;
- arbitrary Tailwind bracket values or one-off CSS where a design token exists;
- new/mixed icon family;
- unapproved typography family;
- missing required states;
- focus visibility;
- contrast/accessibility tooling;
- responsive breakpoints/behaviour;
- baseline/runtime errors;
- known deviations from `design.md`.

Heuristic source scanners must not claim certainty they do not have. An arbitrary value is not automatically a failure if it is genuinely dynamic or is a documented exception.

For reference-driven UI, use baseline and post-implementation screenshots where browser tooling is available.

Write design results into `test-report.md` and update the last verification metadata if the check represents a full design verification.

### 15.9 `/dk-review`

Add a dedicated **Design Authority Review Pass** for material frontend work.

The design reviewer must read:

- current approved `design.md`;
- relevant requirements;
- reference evidence where available;
- implementation/screenshots;
- any approved amendments.

Review:

- hierarchy;
- spacing rhythm;
- alignment;
- typography hierarchy;
- colour discipline;
- component geometry;
- component reuse;
- density;
- icon consistency;
- visual states;
- responsive transformations;
- accessibility;
- unauthorized arbitrary values;
- reference fidelity;
- visual invariants.

#### Same Design Team Test

Return exactly one:

```text
PASS
PARTIAL
FAIL
```

Meaning:

- `PASS`: the touched UI convincingly belongs to the approved system.
- `PARTIAL`: minor non-foundational inconsistencies remain; may be shippable only when they are documented and below the configured release threshold.
- `FAIL`: material visual drift or unauthorized design-system change exists; blocks frontend acceptance.

Design violations receive stable IDs such as `DS-001`, `DS-002` and severity `critical`, `major`, or `minor`.

### 15.10 `/dk-status`

When applicable, show a concise Design Authority section:

```text
Design Authority
Status: approved
Version: 1.0.0
Authority: design.md
References: 3 (2 authoritative, 1 supporting)
Pending amendments: 0
Last verification: PASS
Same Design Team: PASS
Frontend work: allowed
```

Do not show this block for projects confidently classified as `not_required` unless the user asks for full diagnostic state.

### 15.11 `/dk-ship`

For a release containing material frontend changes, shipping requires:

- approved `design.md` when Design Authority applies;
- no unresolved blocking amendment;
- no critical/major unresolved Design Authority failure;
- latest applicable design review not `FAIL`;
- Same Design Team Test not `FAIL`;
- documentation/release notes updated where the design system changed.

A backend-only release must not fail because no design system exists.

---

## 16. Automatic Context Injection

Every implementation agent performing frontend/UI work must receive this contract automatically:

```text
FRONTEND DESIGN AUTHORITY

`design.md` is the authoritative visual specification for this project.

Before modifying or generating frontend UI:
1. Read the current approved design.md.
2. Identify applicable tokens, components, layouts, states, responsive rules, and visual invariants.
3. Reuse established components and tokens before creating new ones.
4. Do not introduce conflicting visual conventions.
5. Do not modify design.md unless working through an explicitly approved Design System Amendment.
6. If a requirement conflicts with design.md, stop that design decision and report the conflict using the Design System Amendment process.
7. Implement all applicable interaction/accessibility states.
8. Before completion, apply the Same Design Team Test.
```

This must be added to the `frontend-implementer` contract and to general implementation-agent context when the task is frontend-related.

Agents must not rely on remembering to discover `design.md` themselves.

---

## 17. Progressive Reference Ingestion

Users may add references later.

When `/dk-design-system reference` is run against an already approved system:

1. digest/register the new reference;
2. identify repeated evidence consistent with current rules;
3. identify new non-conflicting detail;
4. identify conflicts;
5. do not silently rewrite approved foundational rules;
6. propose amendments for material conflicts;
7. preserve previous approval until an amendment is approved.

Expected result format:

```text
NEW DESIGN EVIDENCE

Consistent rules: <n>
New non-conflicting rules: <n>
Potential conflicts: <n>
Amendment proposals requiring approval: <n>
```

---

## 18. Existing Project Migration / Backward Compatibility

### Case A: project has no visual frontend

No behavioural regression. Design Authority is not required.

### Case B: project already has `design.md`, but no Design Authority state

Preserve current DKF semantics instead of forcing reapproval.

On first Design Authority-aware command:

- create `design-system-state.json`;
- set `applicable: true`;
- set `status: approved`;
- set `source_mode: legacy_design_md`;
- set design-system version to `1.0.0` unless a readable version is already present;
- set `legacy_migration` metadata explaining that authority was inferred from the pre-v0.8.0 contract;
- verify at the next material frontend test/review.

Do not silently rewrite the pre-existing `design.md` during migration.

### Case C: project has frontend UI but no `design.md`

Do not retroactively block unrelated backend work. Before the next material frontend implementation, require one of:

- derive from existing UI;
- create new system;
- use references;
- use supplied existing design.md.

### Case D: project used DKF's older external reference contract

Map the old reference source into the new `references` collection and preserve the user's previous authority intent. Do not lose baseline screenshots or prior intentional-deviation decisions.

### Case E: existing component/library architecture

Preserve sound technical infrastructure. New design authority controls visual output, not gratuitous framework replacement.

---

## 19. Repository Implementation Map

The implementation must inspect exact current contents before editing, but v0.8.0 is expected to touch at least these surfaces.

### New files

```text
commands/dk-design-system.md
skills/design-authority/SKILL.md
templates/design-system-reference-analysis.md
evals/design-authority/...
scripts/design-authority.test.mjs
```

If a reusable runtime helper is justified after repository inspection:

```text
runtime/design-authority/...
```

Do not create runtime code merely to satisfy architecture aesthetics if command/state logic can remain deterministic without it.

### Existing commands to update

```text
commands/dk-idea.md
commands/dk-spec.md
commands/dk-design.md
commands/dk-tasks.md
commands/dk-build.md
commands/dk-build-auto.md
commands/dk-test.md
commands/dk-review.md
commands/dk-status.md
commands/dk-ship.md
commands/dk-autopilot.md
```

### Existing skills/agents to update

```text
skills/design-direction/SKILL.md
agents/frontend-implementer.md
agents/design-reviewer.md
```

Update general implementation/spec agents only where needed to guarantee context propagation; do not duplicate the full policy across many files.

### Packaging / release surfaces

```text
.agents/plugins/development-kit/plugin.json
scripts/install-antigravity.mjs
scripts/install-antigravity.test.mjs
package.json
README.md
CHANGELOG.md
AGENTS.md (only if project-wide agent rules need the authority invariant)
```

Also inspect platform adapter templates and generated command/help indexes. If command lists are duplicated elsewhere, update every user-facing source and add tests that prevent future divergence.

---

## 20. Skill Responsibilities

### New `design-authority` skill

This skill owns:

- authority hierarchy;
- state interpretation;
- design-system preflight;
- reference roles;
- controlled amendment behaviour;
- progressive reference ingestion;
- conflict reporting;
- Same Design Team contract;
- backward migration semantics.

It should invoke/defer to existing specialist skills rather than duplicating their core expertise:

- `design-direction` for intentional visual direction;
- `design-quality-review` for visual quality review;
- `accessibility-review` for accessibility;
- `browser-runtime-verification` for rendered/browser evidence;
- `verification-before-completion` for completion discipline.

### Updated `design-direction`

Must recognize `design.md` as controlled authority when one exists and must not “refresh” it casually. New direction for an already approved system becomes an amendment/replacement decision.

### Updated `frontend-implementer`

Must read and obey current `design.md` before frontend work and may not change it as an implementation shortcut.

### Updated `design-reviewer`

Must report Design Authority compliance and the Same Design Team verdict for governed projects.

---

## 21. Testing Strategy

### 21.1 Deterministic repository tests

Create `scripts/design-authority.test.mjs` using the repository's existing Node test conventions.

Minimum assertions:

1. `commands/dk-design-system.md` exists and documents all six modes.
2. Command contains controlled `design.md` authority rule.
3. Command contains amendment proposal contract.
4. `/dk-idea` asks for visual references for new UI projects near initial discovery.
5. `/dk-idea` supports defer and existing-project paths.
6. `/dk-design` delegates/aligns to Design Authority rather than defining a conflicting authority model.
7. `/dk-build` includes Design System Preflight.
8. `/dk-build-auto` cannot bypass unresolved required design authority.
9. `/dk-autopilot` includes the same lifecycle gate.
10. `/dk-test` contains Design System Compliance checks.
11. `/dk-review` contains the Same Design Team Test.
12. `/dk-ship` blocks material frontend release on failing design authority while preserving backend-only behaviour.
13. `/dk-status` exposes applicable design status.
14. `frontend-implementer` reads `design.md` first.
15. `design-reviewer` reports design-authority verdict.
16. `templates/design-system-reference-analysis.md` contains all required 31 design-system sections and observed/inferred/recommended evidence handling.
17. `skills/design-authority/SKILL.md` is registered in plugin manifest.
18. installer command help contains `/dk-design-system`.
19. installer tests validate the new command is present after install.
20. package/release validation invokes the new Design Authority test suite.

### 21.2 State-transition tests

If runtime/state helper code is added, test at minimum:

- `unconfigured -> deferred` allowed;
- `deferred -> generating` allowed;
- `generating -> draft -> awaiting_approval -> approved` allowed;
- unresolved `draft` cannot pass frontend preflight;
- `approved` passes frontend preflight;
- `not_required` does not block backend/nonvisual work;
- amendment proposal does not mutate authority before approval;
- approved amendment bumps version and clears pending state;
- rejected amendment leaves design.md/version unchanged;
- legacy `design.md` migrates without destructive rewrite;
- multiple reference roles preserve authority hierarchy;
- invalid/corrupt state fails closed for frontend mutation but reports a repair path.

### 21.3 Eval coverage

Add `evals/design-authority/` scenarios that evaluate agent behaviour, not just keyword presence.

Required scenarios:

1. New SaaS app, user has screenshots: asks for references early and does not invent design first.
2. New app, user defers: allows specification/backend progress but blocks first frontend build.
3. Existing app with no `design.md`: offers preserve/derive/refine/redesign choices.
4. Existing approved `design.md`, developer requests easier conflicting radius: proposes amendment rather than changing silently.
5. shadcn default appearance conflicts with design.md: retains behaviour primitive, restyles appearance.
6. New screen absent from references: extrapolates from system rather than creating new style.
7. New screenshot conflicts with approved design: progressive ingestion generates amendment proposal.
8. Backend-only CLI project: no unnecessary design gate.
9. Mobile UI: transforms according to design.md rather than scaling desktop.
10. Visual review: identifies material design drift and returns Same Design Team FAIL.

### 21.4 Regression tests

Run all existing repository validation suites. The feature must not regress:

- installer behaviour;
- autopilot lifecycle;
- next-step guidance;
- intelligence tests;
- docs validation;
- platform adapter validation;
- skill/eval validation;
- OpenCode configuration validation;
- research contract validation.

---

## 22. Acceptance Criteria

### AC-01 — Early discovery
Given a new project with a visual frontend, when `/dk-idea` begins discovery, then DKF asks for visual references during the initial discovery phase before detailed frontend styling is invented.

### AC-02 — Reference inputs
The user can provide screenshots/images, existing application screens, an existing `design.md`, or request a new direction without references.

### AC-03 — Deferral
The user may defer Design Authority setup, but a required unresolved state blocks the first material frontend implementation, not unrelated safe work.

### AC-04 — Nonvisual projects
Backend-only/nonvisual projects continue through DKF without a mandatory design-system workflow.

### AC-05 — Existing applications
Existing frontend projects are offered preserve/document, refine, redesign, and existing-design.md paths before DKF assumes a new visual direction.

### AC-06 — Authoritative root artifact
Approved design authority is stored at project root as `design.md`.

### AC-07 — Complete reference extraction
Reference analysis produces the required implementation-grade design system with the 31 defined sections, reusable tokens, visual invariants, anti-patterns, responsive rules, states, accessibility, and new-screen generation guidance.

### AC-08 — Evidence honesty
Observed, inferred, and recommended rules are distinguishable; uncertain exact values are never presented as confirmed observations.

### AC-09 — No placeholders
Generated `design.md` contains reasoned implementation values rather than unresolved `TBD` design decisions.

### AC-10 — Controlled specification
No implementation agent may silently alter approved `design.md`.

### AC-11 — Amendment process
Foundational visual changes use the defined Design System Amendment Proposal and require explicit approval before authority changes.

### AC-12 — Authority order
Frontend conflicts resolve according to the seven-level authority order defined in this specification.

### AC-13 — Automatic context injection
Every frontend implementation agent is explicitly instructed to read and obey current `design.md`.

### AC-14 — Build preflight
`/dk-build`, `/dk-build-auto`, and `/dk-autopilot` block only affected frontend implementation when required Design Authority is unresolved.

### AC-15 — Progressive references
Adding references to an approved system compares evidence and produces amendment proposals for conflicts rather than silently replacing the system.

### AC-16 — Compliance testing
`/dk-test` reports a named Design System Compliance section for material frontend scope.

### AC-17 — Visual review
`/dk-review` reports stable design issue IDs/severity and a Same Design Team verdict.

### AC-18 — Release gate
`/dk-ship` refuses a material frontend release with unresolved blocking Design Authority failures or Same Design Team FAIL.

### AC-19 — Status visibility
`/dk-status` displays current Design Authority state when applicable.

### AC-20 — Backward compatibility
Pre-v0.8.0 projects with existing `design.md` migrate non-destructively; projects without UI remain unaffected.

### AC-21 — Installer completeness
A normal Antigravity DKF installation exposes `/dk-design-system` and includes its required skill/template assets.

### AC-22 — Automated regression coverage
The new deterministic tests and evals pass, and the pre-existing full `release:validate` suite still passes after adding the new Design Authority validation.

### AC-23 — Version/release completeness
All canonical v0.8.0 version surfaces and release documentation are updated consistently according to repository release policy.

### AC-24 — No partial release
The feature is not considered complete if source files are updated but installer, package, documentation, eval, or release-validation surfaces are missing.

---

## 23. Documentation Changes

### README

Add:

- DKF Design Authority feature description;
- `/dk-design-system` to command list;
- new UI project flow;
- existing UI flow;
- `design.md` authority explanation;
- amendment/change-control explanation;
- brief Design Authority status example;
- note that backend-only projects are unaffected.

### Command documentation

Ensure lifecycle cross-links are consistent:

```text
/dk-idea -> /dk-design-system -> /dk-design -> /dk-tasks -> /dk-build
```

where applicable, while making clear `/dk-design-system` can also be invoked later for inspect/reference/verify/amend.

### CHANGELOG

Create v0.8.0 entry covering:

- Design Authority;
- reference-driven design-system extraction;
- controlled design amendments;
- build/test/review/ship gates;
- state persistence;
- installer/command updates;
- backward compatibility.

### AGENTS.md

If AGENTS.md currently establishes universal project implementation rules, add only the minimal invariant necessary to ensure frontend agents cannot bypass an approved `design.md`. Do not duplicate the entire skill text.

---

## 24. Packaging and Release Requirements

Target release: **v0.8.0**.

Before declaring release-ready:

1. Search the repository for every version-bearing package/manifest/release surface.
2. Determine which are intentionally independent and which must align.
3. Update all canonical DKF package version surfaces to `0.8.0`.
4. Do not blindly normalize an intentionally independent manifest version; document the reason if it differs.
5. Ensure `templates/`, new skill, command, evals, runtime additions, and tests are included by package `files`/installer copy logic.
6. Add `/dk-design-system` to installer help/printed command lists and any platform-specific command indexes.
7. Add `design-authority:validate` or equivalent npm script and include it in `release:validate`.
8. Run complete `npm run release:validate`.
9. Run installer dry-run/installer tests.
10. Inspect final diff for accidental unrelated changes.
11. Verify clean packaging with `npm pack --dry-run` or repository-equivalent package-content inspection.
12. Update README and CHANGELOG before release readiness is marked PASS.

Do not create a tag, publish npm, merge, or push unless the user explicitly authorizes those consequential actions in the implementation session.

---

## 25. Release Validation Gate

The implementation is ready for the v0.8.0 release only if all are true:

```text
[ ] New command implemented
[ ] Design Authority skill implemented and registered
[ ] Reference-analysis template installed/packageable
[ ] /dk-idea early reference discovery implemented
[ ] /dk-design integrated
[ ] /dk-build preflight implemented
[ ] /dk-build-auto preflight implemented
[ ] /dk-autopilot integrated
[ ] /dk-test compliance section implemented
[ ] /dk-review Same Design Team Test implemented
[ ] /dk-status reporting implemented
[ ] /dk-ship release gate implemented
[ ] frontend-implementer contract updated
[ ] design-reviewer contract updated
[ ] state/backward migration semantics implemented
[ ] deterministic tests added
[ ] evals added
[ ] installer updated and tested
[ ] README updated
[ ] CHANGELOG updated
[ ] package/release version surfaces audited
[ ] full release validation PASS
[ ] package contents verified
[ ] no unintended source drift
```

Any unchecked item means the feature is incomplete.

---

## 26. Implementation Restraints

- Extend existing DKF architecture instead of creating parallel lifecycle systems.
- Reuse existing design-direction, design-reviewer, frontend-implementer, accessibility, browser verification, and verification skills.
- Do not add a third-party dependency solely for state handling or Markdown generation.
- Prefer Node built-ins for hashing/state helpers if runtime code is required.
- Preserve current `/dk-design` and older Reference-source contract compatibility.
- Keep the diff scoped to Design Authority and release integration.
- Do not turn heuristic CSS scanning into a false-precision linter.
- Fail closed for ambiguous/corrupt Design Authority state before material frontend mutation, while explaining the repair path.
- Never fail closed on unrelated backend work merely because visual state is unresolved.

---

## 27. Definition of Done

DKF Design Authority is done when a user can start a brand-new UI application, be asked for visual references at the start, attach one or more reference screens, receive a complete approved `design.md`, let DKF build multiple new screens, and have every frontend implementation/review stage automatically enforce that design system without visual drift or silent system mutation.

It must also work for an existing application, support controlled evolution through amendments, remain invisible to backend-only projects, survive installation/package distribution, and pass the complete DKF v0.8.0 release validation suite.

The final quality test is:

> If an AI coding agent receives only the application requirements and the approved `design.md`, can it create multiple new screens that convincingly look like they were designed by the same team that produced the authoritative reference application?

If the answer is not clearly yes, the Design Authority lifecycle has not fulfilled its purpose.
