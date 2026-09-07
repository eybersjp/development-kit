# Release Notes: Development Kit v0.10.0

> **Release Date:** 2026-09-07  
> **Release Target:** Antigravity AI, OpenCode, and supported multi-platform coding environments  
> **Target Package:** `development-kit@0.10.0`  
> **Status:** Release candidate until the controlled release workflow completes

---

## Executive Summary

Development Kit `v0.10.0` introduces the **Numbered Decision Interface** and structured suggestion-promotion workflow, establishing the foundational UX principle:

> **Commands start capabilities. Numbers control decisions.**

Development Kit simplifies Product Owner interaction by doing the reasoning, presenting bounded choices as persisted numbered menus, and resolving bare numeric replies deterministically against runtime state.

---

## Key Highlights

1. **Numbered Decision Interface**
   - Bounded Product Owner choices are formatted as structured numbered menus.
   - Recommended options are visibly distinguished with `? Recommended`.
   - Menus are persisted as runtime state (`DEC-XXX`) prior to presentation.
   - Bare numeric inputs (e.g. `1`, `2`, `3`, `4`) resolve deterministically; LLM guessing is strictly blocked.
   - Fails closed on missing menus, out-of-bounds options, stale fingerprints, or stage mismatches.

2. **Structured Idea Suggestions**
   - Discovered recommendations in `/dk-idea` become structured records (`IDEA-SUG-001`).
   - Each suggestion tracks stable ID, title, description, rationale, impact, effort, recommended scope, decision state, and audit provenance.
   - AI recommendations never enter approved implementation scope automatically without explicit Product Owner decision.

3. **Dynamic Suggestion Menus**
   - Generates bounded, meaningful decision options dynamically based on the identified suggestions.
   - Avoids combinatorial explosion; presents recommended subset, broad/narrow alternatives, and custom response.

4. **Explicit PO Decision Semantics**
   - `ACCEPT`: Promotes suggestion into approved scope with full traceability down to task contracts.
   - `DEFER`: Retains suggestion in future scope backlog without entering active specification.
   - `REJECT`: Authoritatively records rejection with rationale to prevent re-proposing.

5. **Canonical Artifact Reconciliation & Promotion**
   - Accepted suggestions are reconciled directly into `docs/01-concept/idea-brief.md` under verified SHA-256 fingerprints.
   - Deferred suggestions are appended to `Future Ideas (Explicitly Deferred)`.

6. **New vs. Existing Project Routing**
   - New projects proceed forward into `/dk-spec`.
   - Existing projects run impact analysis and canonical delta reconciliation without full project regeneration.

7. **Autopilot Integration**
   - Unresolved decisions pause Autopilot progression.
   - Numbered menus persist across sessions, process restarts, and rehydrated state.
   - Numeric responses resume the workflow deterministically.

8. **Runtime API & Control Center Support**
   - Extended Runtime API exposes `activeDecision`, suggestions, and `/v1/decisions/resolve`.
   - Control Center data models reflect active and historical decision state.

9. **Legacy Version Drift Resolution**
   - Eliminated obsolete root `plugin.json` (0.1.0) in favor of the authoritative packaged plugin manifest at `.agents/plugins/development-kit/plugin.json` (0.10.0), with automated regression assertions.
