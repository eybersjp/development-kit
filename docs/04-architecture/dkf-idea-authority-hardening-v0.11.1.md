# DKF IDEA Authority Hardening — v0.11.1+ Integration Specification

**Tracking:** Issue #51  
**Baseline:** current `main` after Development Modes integration  
**Release status:** implementation candidate until CI, independent review and Product Owner acceptance pass.

## Objective

Make the IDEA/UNDERSTAND stage resumable and authority-safe. No conversational summary, AI proposal, stale question, replayed response or direct artifact edit may silently become approved product scope.

## Authority model

```text
surfaced requirement/question
        ↓ explicit provenance
discovery.json + discovery-journal.json
        ↓
persisted single pending interaction
        ↓
existing Numbered Decision Interface
        ↓ exact interaction fingerprint
explicit PRODUCT_OWNER consumption
        ↓
hash-chained consumption receipt
        ↓
approved requirement/scope/design decisions
        ↓
canonical Idea Brief bound to source fingerprints
        ↓
explicit Product Owner approval
```

## Persisted state

Project-local state is stored under `.development-kit/idea/`:

- `discovery.json` — current validated discovery snapshot.
- `discovery-journal.json` — hash-chained full-state journal used to recover an interrupted/stale state-file write.
- `workflow.json` — exact resumable phase and pending interaction.
- `design-state.json` — Product Owner-bound Design Authority applicability/disposition.
- `artifact.json` — canonical Idea Brief fingerprint/source binding and approval history.
- `consumptions.json` — append-only logical, hash-chained interaction-consumption receipts.

The canonical Idea Brief remains `docs/01-concept/idea-brief.md`.

## Requirement provenance

Every candidate has one explicit origin:

- `USER_STATED`
- `USER_CONFIRMED`
- `AI_PROPOSED`
- `RESEARCH_DERIVED`
- `ASSUMED`

User-origin candidates may be **CONFIRMED**. AI/research/assumed candidates must be explicitly **ADOPTED**. Material authority transitions, scope classification and question resolution require explicit `PRODUCT_OWNER`; helper defaults do not authorize them.

## Interaction contract

The runtime persists exactly one pending interaction before it is presented. The interaction contains:

- phase/type and stable interaction ID;
- one prompt;
- numbered options;
- current discovery/design source fingerprint;
- persisted numbered-menu identity/fingerprint;
- full interaction fingerprint.

A response is accepted only if:

1. the workflow still has that exact pending interaction;
2. the discovery/design source fingerprint is unchanged;
3. the matching numbered decision menu is still active;
4. the supplied `expectedInteractionFingerprint` is exact;
5. authority is explicitly `PRODUCT_OWNER`;
6. the interaction has not already been consumed.

Custom responses are themselves consumed and persisted before interpretation.

## Crash/restart behavior

Discovery commits are journal-first, then state-file. If the process stops after the journal commit but before the state file is replaced, the next load reconstructs the state from the final validated journal entry. A state file ahead of, or inconsistent with, the journal fails closed.

Pending workflow interactions are file-backed. Re-running `idea-next` or starting a fresh process returns the same pending interaction rather than proposing another question.

## Design Authority binding

The IDEA workflow itself records visual applicability and the Product Owner's design setup disposition. No caller can provide a fabricated “design already resolved” object. The binding records Product Owner decision evidence and is fingerprinted into the Idea Brief source binding.

## Idea Brief authority

Persistence requires discovery readiness and resolved design applicability/disposition. The artifact record binds:

- physical artifact fingerprint;
- discovery revision/fingerprint;
- design revision/fingerprint;
- combined source fingerprint.

Approval requires an exact current binding and explicit Product Owner authority. A discovery/design change makes the approval stale. A direct physical file edit creates a `TAMPERED` state and cannot remain approved.

## Acceptance criteria

- **IDEA-AUTH-001:** requirement provenance is explicit and legal transitions differ between user-origin and AI/research/assumed candidates.
- **IDEA-AUTH-002:** authoritative transitions require explicit Product Owner authority.
- **IDEA-AUTH-003:** exactly one pending question/decision is persisted and rehydrated across restart.
- **IDEA-AUTH-004:** the existing Numbered Decision Interface remains the decision resolver.
- **IDEA-AUTH-005:** every consumed response requires the exact persisted interaction fingerprint.
- **IDEA-AUTH-006:** discovery/design changes after presentation make the interaction stale.
- **IDEA-AUTH-007:** hash-chained consumption receipts prevent replay.
- **IDEA-AUTH-008:** journal-first persistence recovers interrupted discovery state.
- **IDEA-AUTH-009:** Design Authority applicability/disposition is Product Owner-bound, not caller-supplied mock state.
- **IDEA-AUTH-010:** canonical Idea Brief persistence validates current approved discovery content.
- **IDEA-AUTH-011:** Idea Brief approval is bound to exact artifact/discovery/design fingerprints.
- **IDEA-AUTH-012:** direct Idea Brief edits invalidate authority.
- **IDEA-AUTH-013:** implicit Product Owner defaults are removed from suggestion promotion.
- **IDEA-AUTH-014:** fresh CLI processes reconstruct the same pending interaction.
- **IDEA-AUTH-015:** corrupt journal/receipt/workflow state fails closed.
- **IDEA-AUTH-016:** full Ubuntu and Windows `npm run release:validate` pass before merge.

## CLI operations

```bash
node scripts/orchestration.mjs --operation=idea-state
node scripts/orchestration.mjs --operation=idea-record-candidate --input-json='{"statement":"...","origin":"USER_STATED"}'
node scripts/orchestration.mjs --operation=idea-record-question --input-json='{"question":"...","options":["A","B"]}'
node scripts/orchestration.mjs --operation=idea-next
node scripts/orchestration.mjs --operation=idea-consume --input-json='{"selectedNumber":1,"authority":"PRODUCT_OWNER","expectedInteractionFingerprint":"sha256:..."}'
node scripts/orchestration.mjs --operation=idea-persist-brief --input-file=<project-local-json-payload>
node scripts/orchestration.mjs --operation=idea-custom-complete --input-json='{"authority":"PRODUCT_OWNER"}'
node scripts/orchestration.mjs --operation=idea-refresh-stale --input-json='{"authority":"PRODUCT_OWNER"}'
```

## Compatibility

This hardening composes with Development Modes, Design Authority, the existing numbered-decision subsystem and downstream Development Contracts. It does not alter the canonical nine-stage lifecycle or bypass later DEFINE/DESIGN/PLAN/VERIFY/REVIEW gates.
