---
name: live-ui-preview
description: >-
  Automatically arms, starts, reuses, and displays a local development preview whenever DKF work affects a user interface.
compatibility: opencode
---

# Live UI Preview

## Overview

Keeps frontend work rendered and visible while DKF designs and implements UI changes. It arms preview as soon as UI/design intent appears, starts or reuses the project's declared dev server when runnable, and exposes a provider-neutral browser action without changing formal VERIFY-time acceptance semantics.

## Process

1. Detect material UI/design context.
2. Run `node scripts/ui-preview.mjs --ensure` immediately.
3. If the frontend is not runnable, preserve `WAITING_FOR_RUNNABLE_UI` and ensure again after scaffold.
4. Fulfil any host `OPEN_OR_REUSE` action and keep the browser surface available.
5. Reuse the same healthy dev server/HMR process through UI implementation.
6. During VERIFY, hand formal runtime/browser checking to `browser-runtime-verification`.

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
