---
name: live-ui-preview
description: >-
  Automatically arms, starts, reuses, and displays a local development preview whenever DKF work affects a user interface.
compatibility: opencode
---

# Live UI Preview

## Rule

If UI/design context is present, do not wait for `/dk-test` to render the application.

Run:

```text
node scripts/ui-preview.mjs --ensure --context="<current UI intent>" --route=<affected-route>
```

If the result contains `browserAction.type = OPEN_OR_REUSE`, immediately fulfil that action using the host's browser capability and keep that browser surface available while implementation continues.

## New applications

A `WAITING_FOR_RUNNABLE_UI` result is expected before the frontend exists. Keep the preview armed and run `--ensure` again as soon as the first runnable frontend shell/package.json dev script exists.

## Existing applications

- Reuse a healthy preview server.
- Do not start duplicate dev servers.
- Use the project's declared `scripts.dev` and detected package manager.
- Keep HMR/fast refresh running during UI implementation.
- Do not substitute repeated production builds for live preview.
- If a project server is already running outside DKF, adopt it only when its localhost URL is explicitly supplied with `--url`; never infer ownership from a responsive common port.

## Design Authority

Read and obey approved `design.md` before visual implementation. Live preview shows the rendered result; it does not override Design Authority.

## Verification boundary

Live preview is continuous development visibility. `browser-runtime-verification` remains the authoritative browser verification procedure during VERIFY.
