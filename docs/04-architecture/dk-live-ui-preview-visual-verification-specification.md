# DKF Live UI Preview & Visual Verification Specification

**Target:** Development Kit Framework v0.10.1  
**Status:** Approved implementation specification  
**Scope:** Automatic local live UI preview for UI-related work and browser-visible visual verification support.  
**Explicit exclusions:** generic runtime-smoke verification for non-UI changes, Acceptance Engine redesign, baseline-failure semantics, CI/browser acceptance enforcement, screenshot-diff infrastructure, and deferred v0.11 Adaptive Reliability work.

---

## 1. Problem

DKF can guide, implement, test, review, and accept frontend work without reliably placing the running UI in front of the Product Owner while the work is being performed.

For UI work, source inspection, tests, type checks, and production builds are not substitutes for seeing the rendered application.

DKF therefore needs a first-class local preview capability with this invariant:

> **If DKF changes something visual, DKF must render it and make the rendered application available for inspection.**

For a new application, preview activation begins as soon as UI/design intent is identified. If no runnable frontend exists yet, DKF arms the preview and launches it automatically as soon as a runnable frontend becomes available.

---

## 2. Goals

1. Detect UI-related context deterministically enough for DKF workflow routing.
2. Arm preview immediately when UI/design context is detected.
3. Discover a runnable frontend and its package manager without inventing project commands.
4. Start or reuse the project's normal development server.
5. Keep the development server alive across DKF lifecycle actions.
6. Avoid duplicate DKF-managed development servers.
7. Open or request reuse of a browser surface for the running application.
8. Preserve provider independence so Antigravity is supported without becoming DKF's architectural dependency.
9. Persist preview runtime state under `.development-kit/`.
10. Make preview failures visible and recoverable without misrepresenting UI work as visually verified.
11. Integrate with Design Authority and existing browser-runtime-verification behaviour.

---

## 3. Non-goals

v0.10.1 does **not**:

- require runtime smoke verification for every web application;
- change deterministic acceptance semantics for unrelated non-UI work;
- redesign baseline-failure handling;
- introduce visual-regression image diffs;
- require a production build after every UI edit;
- introduce a generic browser automation framework;
- add remote preview hosting;
- replace `/dk-test` browser/runtime verification;
- change the v0.11 Adaptive Reliability roadmap.

Development uses the project's normal dev/HMR workflow. Production build verification remains where the existing DKF lifecycle already requires it.

---

## 4. Trigger model

UI preview is required when DKF encounters material UI/design context, including:

- frontend/UI/UX work;
- pages, screens, layouts, navigation, forms, dialogs, tables, cards, dashboards;
- CSS, Tailwind, typography, spacing, colour, responsive behaviour;
- component appearance or interaction states;
- `design.md`, design-system, visual-reference, or Design Authority work.

The runtime classifier returns:

```json
{
  "affectsUi": true,
  "previewRequired": true,
  "signals": ["design-system", "layout"]
}
```

Conversation understanding remains the responsibility of the active capable agent. The runtime classifier is a deterministic supporting control, not an LLM replacement.

---

## 5. State model

Persist state at:

```text
.development-kit/runtime/ui-preview.json
```

States:

```text
INACTIVE
  |
  | UI context detected
  v
ARMED
  |
  +---- no runnable frontend ----> WAITING_FOR_RUNNABLE_UI
  |                                  |
  |                                  | later ensure
  |                                  v
  +------------------------------> DISCOVERING
                                     |
                                     v
                                  STARTING
                                     |
                                     v
                                   HEALTHY
                                     |
                                     v
                                  DISPLAYED
```

Failure/recovery states:

```text
DISCOVERY_FAILED
START_FAILED
HEALTH_CHECK_FAILED
BROWSER_UNAVAILABLE
STOPPED
```

A subsequent `ensure` may recover from a recoverable failure.

---

## 6. Runtime components

### 6.1 UIContextClassifier

Responsibilities:

- normalize supplied context;
- identify UI/design signals;
- return `affectsUi`, `previewRequired`, and matched signals;
- never infer acceptance or verification status.

### 6.2 FrontendProjectDetector

Responsibilities:

- locate/read `package.json`;
- identify an existing project `dev` script;
- detect package manager from lockfiles;
- infer framework and normal candidate development ports;
- refuse to invent a missing dev script.

Supported initial framework hints:

- Next.js
- Vite
- React/Vite
- Vue/Vite
- SvelteKit
- Nuxt
- Angular
- Astro
- Remix
- Expo Web where a normal project dev/web script is declared
- generic package.json projects with an explicit `dev` script

### 6.3 PreviewRuntimeManager

Responsibilities:

- arm preview;
- discover existing healthy server;
- reuse existing DKF-managed runtime when healthy;
- start the declared dev script when necessary;
- persist PID/URL/package-manager/dev-command/runtime state;
- poll candidate ports for health;
- stop only a process that DKF itself started;
- never kill unrelated processes merely because they occupy a candidate port.

### 6.4 BrowserProvider contract

```ts
interface BrowserProvider {
  id: string;
  isAvailable(): Promise<boolean>;
  display(input: {
    url: string;
    reuseKey: string;
    route?: string;
  }): Promise<{
    displayed: boolean;
    reused: boolean;
    mode: string;
    instructions?: string;
  }>;
}
```

Providers may be host-driven or local-system driven.

v0.10.1 provides:

- `host-browser`: emits a deterministic OPEN_OR_REUSE request for the active agent/platform browser capability.
- `system-browser`: opens the default local browser using the operating system without adding a dependency.
- `none`: explicit no-browser provider for tests/headless operation.

Provider selection must not make Antigravity a core runtime dependency.

### 6.5 PreviewStateStore

Responsibilities:

- atomic JSON persistence where practical;
- tolerate missing state;
- expose status without starting work;
- keep state project-local.

---

## 7. CLI contract

Authoritative entrypoint:

```text
node scripts/ui-preview.mjs
```

Operations:

```text
--classify --context="..."
--ensure --context="..." [--route=/path] [--provider=host-browser|system-browser|none]
--status
--open [--route=/path] [--provider=...]
--stop
```

### ensure result

Example when runnable:

```json
{
  "success": true,
  "previewRequired": true,
  "state": "DISPLAYED",
  "url": "http://127.0.0.1:3000",
  "reusedServer": false,
  "browserAction": {
    "provider": "host-browser",
    "type": "OPEN_OR_REUSE",
    "url": "http://127.0.0.1:3000"
  }
}
```

Example for a new app before scaffold:

```json
{
  "success": true,
  "previewRequired": true,
  "state": "WAITING_FOR_RUNNABLE_UI",
  "reason": "No package.json with a dev script is available yet."
}
```

This waiting state is expected behaviour, not a failure.

---

## 8. Workflow integration

### Global DKF rule

Any capable DKF agent that identifies UI/design work must run preview `--ensure` immediately. It must not wait until `/dk-test`.

### /dk-autopilot

During UNDERSTAND, DEFINE, or DESIGN, when UI intent first becomes clear:

1. call preview `--ensure`;
2. if no runnable UI exists, persist `WAITING_FOR_RUNNABLE_UI`;
3. call `--ensure` again after frontend scaffold/structure becomes runnable;
4. preserve the same preview runtime through implementation.

### /dk-design

UI/design work invokes preview early. Design Authority remains authoritative.

### /dk-build and /dk-build-auto

Before/while implementing visual UI:

1. ensure preview is healthy;
2. pass affected route when known;
3. use HMR/fast refresh rather than repeated production builds;
4. do not spawn duplicate servers.

### Frontend Implementer

Before visual implementation, read `design.md`, ensure preview, and keep the preview available while implementing.

### /dk-test

Existing browser-runtime-verification remains the authoritative verification procedure. The preview runtime may be reused as evidence infrastructure, but this feature does not redefine Acceptance Engine semantics.

---

## 9. Server discovery and reuse rules

1. Prefer the project's declared `scripts.dev`.
2. Detect package manager by lockfile:
   - `pnpm-lock.yaml` -> pnpm
   - `yarn.lock` -> yarn
   - `bun.lock` or `bun.lockb` -> bun
   - `package-lock.json` -> npm
   - fallback -> npm
3. If persisted preview URL responds successfully, reuse it.
4. Before starting a new process, probe framework candidate ports.
5. If an already-running healthy project server is found, reuse it and record `startedByDkf: false`.
6. Only terminate a PID when `startedByDkf: true` and the persisted PID belongs to the DKF-launched process.
7. Store logs under `.development-kit/runtime/ui-preview/`.

---

## 10. Failure handling

| Failure | Required behaviour |
|---|---|
| No package.json/dev script yet | `WAITING_FOR_RUNNABLE_UI`; retry later |
| Invalid package.json | `DISCOVERY_FAILED`; report exact parse error |
| Dev process exits before healthy | `START_FAILED`; include log path |
| Port candidates never become healthy | `HEALTH_CHECK_FAILED` |
| Browser provider unavailable | Keep server healthy; return `BROWSER_UNAVAILABLE` and actionable browser request |
| Existing healthy server | Reuse; do not start duplicate |
| Stale PID/state | Discard stale runtime identity, rediscover safely |
| Occupied port owned by unrelated process | Never kill it; probe other expected project candidates or fail visibly |

Preview failure must not be silently represented as visual verification success.

---

## 11. Visual review behaviour

The preview subsystem makes rendered UI available continuously.

At a meaningful UI milestone DKF should surface:

```text
UI Preview Ready

Route: <rendered route>
Preview: <local URL>

1 - Accept visual result
2 - Request changes
3 - Continue and review later
4 - Custom response
```

This numbered user interaction is guidance-level behaviour in v0.10.1. It does not add a new Acceptance Engine state.

---

## 12. Acceptance criteria

### AC-LUIP-001 — UI intent arms preview
Given UI/design context, classification returns `previewRequired: true` and `ensure` persists an armed/waiting/running state.

### AC-LUIP-002 — New app waits safely
Given UI intent but no runnable frontend, `ensure` returns success with `WAITING_FOR_RUNNABLE_UI` and does not invent commands.

### AC-LUIP-003 — Existing dev script is authoritative
Given a package.json with `scripts.dev`, DKF launches that script using the detected package manager.

### AC-LUIP-004 — Existing healthy server is reused
Repeated `ensure` calls do not create duplicate DKF-managed servers when the persisted URL remains healthy.

### AC-LUIP-005 — State is project-local
Runtime state is persisted only beneath `.development-kit/runtime/`.

### AC-LUIP-006 — Browser contract is provider-neutral
Preview core requests display through a BrowserProvider contract and has no Antigravity-specific import/dependency.

### AC-LUIP-007 — Browser can be opened automatically
On an interactive local host, `system-browser` can open the preview URL without third-party dependencies; host agents may instead fulfill `host-browser` OPEN_OR_REUSE actions.

### AC-LUIP-008 — UI workflow integrates before verification
`/dk-autopilot`, `/dk-design`, `/dk-build`, `/dk-build-auto`, the conductor, and frontend implementer explicitly ensure preview during UI work rather than waiting for `/dk-test`.

### AC-LUIP-009 — HMR workflow preserved
Preview uses the normal development server and does not force a production build after each UI change.

### AC-LUIP-010 — Stop is ownership-safe
`--stop` never kills a reused external server that DKF did not start.

### AC-LUIP-011 — Existing browser verification remains authoritative
`browser-runtime-verification` remains the verification skill and is updated to reuse the live preview when available.

### AC-LUIP-012 — Scope exclusions remain excluded
No generic runtime-smoke gate, baseline-failure redesign, or Acceptance Engine redesign is introduced.

---

## 13. Required tests

1. UI classifier positive/negative cases.
2. package manager detection.
3. framework/default-port detection.
4. missing dev script -> waiting state.
5. state store round-trip.
6. state store stale process recovery.
7. healthy persisted URL reuse.
8. no duplicate server on repeated ensure.
9. start explicit fixture dev server and discover it.
10. stop DKF-owned fixture server.
11. refuse to stop reused external fixture server.
12. host-browser provider action contract.
13. none provider for headless tests.
14. system-browser command resolution by platform without executing during unit tests.
15. route normalization.
16. CLI classify/status/ensure contract.
17. documentation/command integration assertions.
18. package tarball includes preview runtime and CLI.

---

## 14. Files affected

New canonical files:

- `runtime/ui-preview/ui-context-classifier.mjs`
- `runtime/ui-preview/frontend-project-detector.mjs`
- `runtime/ui-preview/state-store.mjs`
- `runtime/ui-preview/browser-providers.mjs`
- `runtime/ui-preview/preview-manager.mjs`
- `scripts/ui-preview.mjs`
- `scripts/ui-preview.test.mjs`
- `skills/live-ui-preview/SKILL.md`
- this specification

Existing files expected to change:

- `commands/dk-autopilot.md`
- `commands/dk-design.md`
- `commands/dk-build.md`
- `commands/dk-build-auto.md`
- `agents/development-conductor.md`
- `agents/frontend-implementer.md`
- `skills/browser-runtime-verification/SKILL.md`
- `AGENTS.md`
- `package.json`
- `.agents/plugins/development-kit/plugin.json`
- mirrored skill/agent/command files generated by plugin sync
- version-consistency/runtime metadata
- README/docs/roadmap/release documentation as required

---

## 15. Versioning

Ship as **v0.10.1**.

Reason:

- v0.11 is already reserved for Adaptive Reliability;
- this increment hardens the existing v0.10 UI/design workflow without changing the canonical lifecycle or Acceptance Engine;
- the public roadmap remains unchanged.

---

## 16. Release gate

The increment is ready only when:

1. preview unit/integration tests pass;
2. existing DKF release validation remains green;
3. plugin mirror is synchronized;
4. package consumer test proves preview assets are included;
5. a real Next.js fixture/project demonstrates:
   - UI context -> ensure;
   - dev server starts or is reused;
   - browser display action is produced/fulfilled;
   - repeated ensure does not duplicate the server;
   - UI changes continue through normal HMR;
6. documentation and version metadata agree on v0.10.1;
7. no deferred runtime-smoke or Acceptance Engine scope has entered the diff.
