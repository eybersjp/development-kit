# orchestration

`node scripts/orchestration.mjs` is the v0.9 task-orchestration CLI. It exposes deterministic runtime operations used by the public DK commands without making the shell command itself an acceptance authority.

## Operations

### Reliability Control Plane
- `prepare-run` — create/resolve the active Development Contract and orchestration run, persist the immutable initial manifest, and create state revision 1.
- `context` — build a role-specific fresh/rehydrated context package from authoritative sources.
- `verify` — create an independent evidence-backed verification record. PASS criteria must prove their declared `verificationType` when evidence is required.
- `acceptance` — compute `ACCEPTED` / `PENDING` / `BLOCKED` from verification, contract-level required verification, reviews, controls, drift, approvals, and source freshness. When the payload includes the active run, the resulting run transition is persisted as the next state revision.
- `correction` — classify failed verification and produce a bounded correction request when safe. With an active run, `CORRECT` and `PAUSE` persist a new revision; `NONE` preserves the current state and does not manufacture a pause.
- `safety` — classify command risk, blast radius, resource ownership, and required approval.
- `reconcile` — apply an exact amendment to a canonical project artifact. The caller must provide the expected pre-edit SHA-256 fingerprint; stale replay is rejected and the file is read back after atomic replacement.
- `plan-validate` — deterministically validate task count, dependencies, cycles, resource ownership, and criterion coverage while allowing legitimate independent/parallel tasks.
- `run-status` — read the latest persisted run state through the current-state pointer, falling back to the immutable initial manifest only when no state revision pointer exists.

### IDEA Discovery & Workflow
- `idea-record-candidate` — capture requirement candidate in `UNRESOLVED` status with explicit origin (`USER_STATED`, `AI_PROPOSED`, `ASSUMED`, `RESEARCH_DERIVED`).
- `idea-record-question` — capture open question in `UNRESOLVED` status with explicit materiality (`MATERIAL`, `NON_MATERIAL`).
- `idea-supersede-candidate` — supersede an existing candidate requirement, creating an `UNRESOLVED` replacement bound to `expectedInteractionFingerprint`.
- `idea-supersede-question` — supersede an existing open question, creating an `UNRESOLVED` replacement bound to `expectedInteractionFingerprint`.
- `idea-present-interaction` — advance or present the next legal Product Owner interaction, computing its SHA-256 fingerprint.
- `idea-workflow-state` — read current workflow cursor, active phase, and pending interaction.
- `idea-resolve-question` — resolve an open question (`ANSWERED`, `DEFERRED`, `REJECTED`) with mandatory `expectedInteractionFingerprint`.
- `idea-design-setup` — record Design Authority disposition (`ATTACH_REFERENCES`, `EXISTING_DESIGN_MD`, `DERIVE_EXISTING_APP`, `NEW_DIRECTION`, `DEFERRED`) with mandatory `expectedInteractionFingerprint`.
- `idea-challenge-response` — record Product Owner challenge response with mandatory `expectedInteractionFingerprint`.
- `idea-confirm-candidate` — atomically confirm requirement candidate, creating an immutable POD record bound to `expectedInteractionFingerprint`.
- `idea-adopt-candidate` — atomically adopt research-derived requirement candidate, creating an immutable POD record bound to `expectedInteractionFingerprint`.
- `idea-reject-candidate` — record candidate requirement rejection with mandatory `expectedInteractionFingerprint`.
- `idea-classify-scope` — atomically commit complete scope proposal mapping (`MUST`, `SHOULD`, `FUTURE`, `EXCLUDED`) with mandatory `expectedInteractionFingerprint`.
- `idea-discovery-eval` — evaluate discovery readiness before generating the canonical Idea Brief.
- `idea-persist` — atomically persist canonical `idea-brief.md` adhering strictly to single-source section schema.
- `idea-state` — evaluate and compute canonical Idea Brief lifecycle state (`NOT_STARTED`, `DISCOVERY_IN_PROGRESS`, `READY_FOR_APPROVAL`, `APPROVED`, `BLOCKED`).
- `idea-approve` — record Product Owner brief approval bound to artifact revision, content fingerprint, and discovery fingerprint. Unlocks `/dk-spec`.

## Input

Pass JSON through `--input-file=<project-relative-path>` or `--input-json=<json>`. Input files may not escape the project root.

## Trust Boundary

The CLI persists or computes control-plane records; it does not accept an implementation agent's narrative PASS/Done claim as authority. Contract-aware verification/review/acceptance results must retain the active contract ID, run ID, and source fingerprint. Once Autopilot binds a Development Contract, later action results may not omit orchestration evidence to downgrade the workflow to legacy mode.

## Runtime State

Contracts are stored under `.development-kit/contracts/`. Run/evidence records are stored under `.development-kit/runs/`.

Each run keeps:

- immutable `manifest.json` for the initial run definition;
- immutable `state-revisions/00000001.json`, `00000002.json`, and later revisions;
- `current-state.json`, an atomically updated pointer to the latest immutable state revision;
- immutable verification/control evidence records;
- `final-state.json` for terminal `ACCEPTED` or `BLOCKED` state.

This design lets restart/resume recover the current governed state without rewriting historical evidence. Runtime records are ignored by default and are not product source unless a project explicitly chooses otherwise.
