---
name: dk-idea
description: >-
  Refine a rough idea into a concrete concept with problem definition, user
  identification, success criteria, and requirement categorisation.
---

# /dk-idea

## Purpose

Takes a rough idea and refines it into a concrete, well-defined concept. Runs the full idea discovery process: requirements interview, idea challenge, scope definition, and documentation.

## Lifecycle Entry Gate

At session start or command invocation, execute the centralized lifecycle entry adapter:
```bash
node scripts/lifecycle.mjs --command=dk-idea --phase=entry
```
This establishes and validates project bootstrap, binds project identity, and sets up structured discovery state.

> [!NOTE]
> **Runtime Project Root Authority**:
> The runtime project root is resolved deterministically by the universal dispatcher and runtime adapters. Do NOT guess or invent project roots based on `process.cwd()`. If a command execution or dispatcher invocation encounters an issue, do not search the filesystem or guess fallback directories; runtime project root remains authoritative.


## Workflow

### 1. Understand & Initial Minimal Turn
Read the user's initial request or idea carefully. For a rough or unclarified idea, the initial `/dk-idea` assistant turn must be minimal:
1. Execute the lifecycle entry adapter.
2. Persist faithfully extracted initial candidate requirements with `origin: "USER_STATED"` (or `"AI_PROPOSED"`) and `resolutionState: "UNRESOLVED"`.
3. Optionally persist ONE material open question as `UNRESOLVED`.
4. Ask **exactly ONE** focused discovery question with numbered options and a custom write-in choice.
5. **STOP and return control to the user.**

The initial turn must NOT produce a completed Idea Brief, scope table, Product Owner PODs, confirmed requirements, approval, or a `/dk-spec` recommendation.

### 2. Requirements Interview & One-Question-Per-Turn Protocol
Spawn the **product-discovery-agent** to conduct the requirements interview.

> [!IMPORTANT]
> **Canonical One-Question-Per-Turn Rule**:
> - Ask **exactly one user-facing question per assistant response**.
> - Provide numbered answer options (e.g. `1. Option A`, `2. Option B`, `3. Custom write-in`).
> - After asking the single question, **STOP and return control to the user**.
> - Never ask multiple questions in a single response. Do not combine requirements questions, idea-challenge questions, scope confirmation, design-system setup, or multi-question "Next Steps" in the same response.
> - The user's answer to question N must be received before asking question N+1.
> - Design System setup counts as ONE question.
> - Idea Challenge counts as ONE question.

> [!IMPORTANT]
> **Provenance Integrity Rule**:
> - `USER_STATED` means the substance was explicitly stated by the user. Do NOT add unstated specifics (e.g. equipment hierarchy lists, specific measurement types, digital signatures, compliance standards, OCR/SCADA integrations) under `USER_STATED`.
> - All AI elaborations and inferred capabilities MUST be recorded as `AI_PROPOSED` with `UNRESOLVED` state until explicitly confirmed by the Product Owner.
> - External research findings MUST be recorded as `RESEARCH_DERIVED` with `UNRESOLVED` state until explicitly adopted.
> - Assumptions MUST be recorded as `ASSUMED` with `UNRESOLVED` state until explicitly confirmed.
> - `USER_CONFIRMED` is not an initial capture origin; confirmation is represented through `resolutionState: "CONFIRMED"` backed by an immutable Product Owner Decision (POD).

Record structured candidate requirements and questions deterministically using the capture-only CLI operations:
```bash
# Capture initial requirement candidates (born UNRESOLVED, no POD created)
node scripts/orchestration.mjs --operation=idea-record-candidate --input-json='{"id":"IDEA-REQ-001","statement":"Capture project and equipment information.","origin":"USER_STATED"}'
node scripts/orchestration.mjs --operation=idea-record-candidate --input-json='{"id":"IDEA-REQ-002","statement":"Support CSV/Excel export of commissioning data.","origin":"AI_PROPOSED"}'

# Capture open questions (born UNRESOLVED, no POD created)
node scripts/orchestration.mjs --operation=idea-record-question --input-json='{"id":"IDEA-Q-001","question":"What tablet OS platforms must be supported?","materiality":"MATERIAL"}'
```

When an open question is answered or deferred, execute the dedicated question resolution operation:
```bash
node scripts/orchestration.mjs --operation=idea-resolve-question --input-json='{"id":"IDEA-Q-001","resolution":"ANSWERED","resolvedBy":"PRODUCT_OWNER"}'
```

If the project includes a visual user interface, prompt early for visual references as a single dedicated turn:

```text
Design System Setup

This project includes a user interface.
Do you have visual references you want the application to follow?

You can provide:
- screenshots
- application/website screens
- mockups
- Figma exports/images
- competitor/interface references
- existing project UI
- an existing design.md

Options:
1. Attach design references
2. Use an existing design.md
3. Derive the design system from an existing application
4. Create a new design direction without references
5. Defer for now (blocks first frontend implementation)
```

### 3. Idea Challenge
Test assumptions in a dedicated turn. Is this the real problem? Does it need to exist? Is there a simpler approach? Challenge the proposed solution against the problem.

### 4. Product Owner Requirement-Confirmation Turn
After discovery questions are sufficiently answered:
1. Present the exact candidate requirements table with persisted IDs, statements, and origins to the user.
2. Ask ONE confirmation question:
   - Example: "Do you confirm these exact requirement statements as the requirements for this project?"
   - Options: `1. Confirm exact statements`, `2. Modify statements`, `3. Custom write-in`.
3. **STOP and return control to the user.**
4. Do NOT call `idea-confirm-candidate`, `idea-adopt-candidate`, or `idea-classify-scope` in the same assistant turn.
5. ONLY after receiving a new user response explicitly confirming the candidates, execute the dedicated authority operations:

```bash
# Authoritative requirement confirmation (creates immutable REQUIREMENT_CONFIRMATION POD)
node scripts/orchestration.mjs --operation=idea-confirm-candidate --input-json='{"id":"IDEA-REQ-001","confirmedBy":"PRODUCT_OWNER"}'

# Authoritative research adoption (creates immutable REQUIREMENT_ADOPTION POD)
node scripts/orchestration.mjs --operation=idea-adopt-candidate --input-json='{"id":"IDEA-REQ-003","confirmedBy":"PRODUCT_OWNER"}'

# Authoritative candidate rejection (creates immutable REQUIREMENT_REJECTION POD)
node scripts/orchestration.mjs --operation=idea-reject-candidate --input-json='{"id":"IDEA-REQ-004","confirmedBy":"PRODUCT_OWNER"}'
```

#### Modifying Candidate Statements or Questions (Deterministic Path)
If the Product Owner chooses option `2. Modify statements` (or requests alterations to existing candidate statements or question text):
1. **Never attempt to rewrite an existing candidate or question statement using `idea-record-candidate` or `idea-record-question`** (statements are immutable).
2. Execute explicit supersession via:
   ```bash
   # For requirements:
   node scripts/orchestration.mjs --operation=idea-supersede-candidate --input-json='{"oldId":"IDEA-REQ-001","newCandidate":{"id":"IDEA-REQ-005","statement":"Modified statement","origin":"USER_STATED","confirmedBy":"PRODUCT_OWNER"}}'
   
   # For questions:
   node scripts/orchestration.mjs --operation=idea-supersede-question --input-json='{"oldId":"IDEA-Q-001","newQuestion":{"id":"IDEA-Q-003","question":"Modified question text","materiality":"MATERIAL","confirmedBy":"PRODUCT_OWNER"}}'
   ```
3. The replacement candidate/question is created in state `UNRESOLVED` with no `confirmedBy` or confirmation POD.
4. Return control to the user to confirm the replacement candidates under the normal candidate confirmation protocol before proceeding.

> [!NOTE]
> **Host Interaction Protocol**:
> The DKF command contract enforces strict interaction sequencing:
> `PROPOSE` → `RETURN CONTROL TO USER` → `RECEIVE USER RESPONSE` → `AUTHORITATIVE MUTATION`.
> Never execute self-confirmation within the same assistant turn. (Because Antigravity does not expose a synchronous host-level hook to cryptographically prove a human turn occurred, protocol discipline is mandatory).

### 5. Scope Definition & Confirmation Turn
Categorise every discovered candidate requirement into a proposed scope classification table:
- `MUST` — Core required functionality (1-to-1 bound to active `[IDEA-REQ-xxx]` items in Requirements (Must))
- `SHOULD` — Preferences and secondary expectations
- `FUTURE` — Explicitly deferred capabilities
- `EXCLUDED` — Out of scope / rejected capabilities

Present this scope proposal table to the user and ask for explicit Product Owner confirmation in a dedicated turn.
ONLY after receiving explicit user confirmation, execute the deterministic scope classification operation for each confirmed candidate requirement:
```bash
node scripts/orchestration.mjs --operation=idea-classify-scope --input-json='{"id":"IDEA-REQ-001","scopeDisposition":"MUST","confirmedBy":"PRODUCT_OWNER"}'
```

Evaluate discovery readiness before writing the brief:
```bash
node scripts/orchestration.mjs --operation=idea-discovery-eval
```

### 6. Determine Artifact Level
Spawn the **artifact-selector-agent** to determine whether a full idea brief is needed or a lighter artifact suffices (small, standard, or comprehensive).

### 7. Canonical Idea Brief Persistence
Document the output adhering to the 10 canonical sections matching `templates/idea-brief.md`:
- Problem
- Intended Users
- Success Criteria
- Requirements (Must) (e.g. `- [IDEA-REQ-001] Capture project and equipment information.`)
- Preferences (Should)
- Assumptions
- Constraints
- Risks
- Open Questions (e.g. `- [IDEA-Q-001] What tablet OS versions must be supported?` or `- None`)
- Future Ideas (Explicitly Deferred)

Persist canonical `idea-brief.md` to project root and register in `.development-kit/artifacts.json` via:
```bash
node scripts/orchestration.mjs --operation=idea-persist --input-json='{"content":"..."}'
```

### 8. Evaluation & Explicit Approval Gate
Compute the current lifecycle state:
```bash
node scripts/orchestration.mjs --operation=idea-state
```
When `READY_FOR_APPROVAL`, present the canonical Idea Brief to the user and request explicit Product Owner approval.
Only after the user explicitly approves, record the approval:
```bash
node scripts/orchestration.mjs --operation=idea-approve --input-json='{"approvingAuthority":"PRODUCT_OWNER"}'
```
Re-run `node scripts/orchestration.mjs --operation=idea-state` to verify transition to `APPROVED`. Only an `APPROVED` Idea Brief allows progressing to `/dk-spec`.

## Skills Activated

Primary:
- `idea-discovery` — Turns a rough idea into a concrete concept

Supporting:
- `requirements-interview` — Focused questions to surface requirements and assumptions
- `idea-challenge` — Tests whether the proposed solution solves the real problem
- `scope-definition` — Defines must-have, should-have, could-have, and excluded items

Conditional:
- `adaptive-artifact-planning` — Determines whether a full idea brief is needed or a lighter artifact suffices

## Sub-Agents

- product-discovery-agent (primary — conducts requirements interview)
- artifact-selector-agent (conditional — determines artifact level)

## Output

A canonical project-local `idea-brief.md` document registered in `.development-kit/artifacts.json` with computed lifecycle state.
