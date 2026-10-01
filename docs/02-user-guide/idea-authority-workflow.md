# IDEA Authority Workflow

Use `/dk-idea` normally; the runtime operations below explain what DKF is enforcing underneath.

## Start or resume

```bash
node scripts/orchestration.mjs --operation=idea-state
node scripts/orchestration.mjs --operation=idea-next
```

If an interaction is already pending, `idea-next` returns the same fingerprinted question. It does not generate another one.

## Record discovery input

Requirements must have explicit provenance:

```json
{
  "statement": "The site survey must work offline.",
  "origin": "USER_STATED"
}
```

AI recommendations use `AI_PROPOSED`; external findings use `RESEARCH_DERIVED`; assumptions use `ASSUMED`. Those candidates do not become approved requirements until the Product Owner explicitly adopts them.

Interview questions must include numbered options. DKF then presents only one persisted question at a time.

## Answer a pending decision

Read the `pendingInteraction.fingerprint` returned by `idea-next`, then consume the user's numeric response with that exact fingerprint and explicit authority:

```json
{
  "selectedNumber": 1,
  "authority": "PRODUCT_OWNER",
  "expectedInteractionFingerprint": "sha256:..."
}
```

A stale fingerprint, replay or implicit authority is rejected.

## Custom responses

Selecting the Custom option requires `customText`. DKF records the custom response before an agent interprets it. Apply the explicit discovery delta it authorizes, then complete the custom-review checkpoint and continue.

## Idea Brief

When the runtime reaches `BRIEF_DRAFT`, write the canonical file through the runtime. The Brief is bound to the current discovery and design fingerprints. Approval is therefore invalidated automatically if requirements/design authority later change, or if the physical file is edited outside the controlled persistence path.

## Recovery

The discovery journal is written before the current state file. If a process stops between those writes, the next run reconstructs the state from the validated journal. Broken hash chains, contradictory revisions and corrupted authority state stop the workflow rather than being silently repaired into an approved state.
