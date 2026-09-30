# live-ui-preview

## Purpose

`live-ui-preview` provides continuous rendered frontend visibility during UI/design work. It activates before formal verification: DKF arms the preview as soon as UI intent is identified, starts or reuses the project's declared development server when runnable, and exposes the rendered route through a provider-neutral browser action.

It does not replace Design Authority or `browser-runtime-verification`.

## Activation

Use automatically whenever work materially affects:

- frontend UI/UX;
- pages, screens, layouts, navigation, forms, dialogs, tables, cards or dashboards;
- CSS/Tailwind, typography, spacing, colour, responsive behaviour or visual interaction states;
- `design.md`, design-system or visual-reference work.

The canonical runtime call is:

```text
node scripts/ui-preview.mjs --ensure --context="<current UI intent>" --route=<affected-route>
```

## New applications

Before a runnable frontend exists, the expected state is:

```text
WAITING_FOR_RUNNABLE_UI
```

This keeps preview armed. Run `--ensure` again as soon as the first runnable frontend shell and declared `scripts.dev` exist.

## Existing applications

DKF:

1. prefers the project's declared `scripts.dev`;
2. detects npm, pnpm, yarn or bun from lockfiles;
3. reuses a healthy project-bound DKF preview;
4. starts one DKF-managed development server when required;
5. uses HMR/fast refresh for ongoing UI iteration;
6. exposes an `OPEN_OR_REUSE` browser action for host-controlled browser surfaces.

An external dev server may be adopted only when its localhost URL is explicitly supplied. DKF never assumes that an arbitrary responsive common localhost port belongs to the project.

## Browser providers

- `host-browser`: returns a provider-neutral `OPEN_OR_REUSE` action for Antigravity or another host to fulfil.
- `system-browser`: opens the default local browser using native operating-system commands.
- `none`: headless/test mode.

## Safety

- State remains project-local under `.development-kit/runtime/`.
- DKF records ownership for processes it starts.
- `--stop` does not terminate a reused external server.
- A DKF-started process is terminated only when runtime ownership can be proven.

## Verification boundary

Live UI Preview answers: **can the Product Owner see the running UI while it is being built?**

`browser-runtime-verification` answers: **does the rendered UI satisfy the required runtime/browser acceptance criteria?**

Keep those responsibilities separate.
