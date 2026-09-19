# ui-preview.mjs

## Purpose

`scripts/ui-preview.mjs` is the executable CLI adapter for DKF Live UI Preview. It classifies UI context, arms preview state, discovers a runnable frontend, starts/reuses the local development server, exposes browser display actions, reports status and performs ownership-safe shutdown.

## Operations

### Classify UI context

```bash
node scripts/ui-preview.mjs --classify --context="Update the dashboard layout"
```

### Ensure preview

```bash
node scripts/ui-preview.mjs --ensure --context="Update the dashboard layout" --route=/dashboard
```

Optional provider:

```bash
--provider=host-browser
--provider=system-browser
--provider=none
```

If an external local dev server is already known:

```bash
node scripts/ui-preview.mjs --ensure --context="Update the dashboard UI" --url=http://127.0.0.1:3000
```

DKF does not discover external project ownership merely from an open common port.

### Status

```bash
node scripts/ui-preview.mjs --status
```

### Open/reuse browser surface

```bash
node scripts/ui-preview.mjs --open --route=/dashboard
```

### Stop DKF-owned preview

```bash
node scripts/ui-preview.mjs --stop
```

A reused external development server is left running.

## Persisted state

```text
.development-kit/runtime/ui-preview.json
```

Server logs:

```text
.development-kit/runtime/ui-preview/
```

## Key states

- `INACTIVE`
- `ARMED`
- `WAITING_FOR_RUNNABLE_UI`
- `STARTING`
- `HEALTHY`
- `DISPLAYED`
- `DISCOVERY_FAILED`
- `START_FAILED`
- `HEALTH_CHECK_FAILED`
- `BROWSER_UNAVAILABLE`
- `STOPPED`

## Scope boundary

This CLI is for UI development visibility. It does not introduce generic runtime-smoke acceptance for non-UI work and does not change Acceptance Engine semantics.
