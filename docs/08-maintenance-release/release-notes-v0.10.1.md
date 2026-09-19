# Release Notes v0.10.1

## Live UI Preview & Visual Verification

Development Kit v0.10.1 is a focused hardening release for frontend development visibility.

### What changed

- UI/design context now automatically arms Live UI Preview.
- New applications may enter `WAITING_FOR_RUNNABLE_UI` until the first runnable frontend exists.
- DKF detects the project's package manager and uses the declared `scripts.dev`.
- Healthy project-bound previews are reused instead of starting duplicate DKF development servers.
- The provider-neutral browser contract supports host-controlled browser reuse, native system-browser opening, and headless test mode.
- Preview process shutdown is ownership-safe.
- `/dk-autopilot`, `/dk-design`, `/dk-build`, and `/dk-build-auto` now activate live preview during UI work.
- `browser-runtime-verification` reuses the live preview when appropriate but remains the authoritative browser verification procedure during VERIFY.

### Compatibility

The public slash-command surface remains unchanged at 16 commands. v0.10.1 adds one engineering skill, bringing the canonical engineering-skill count to 48.

No generic non-UI runtime-smoke gate or Acceptance Engine redesign is included. v0.11 remains reserved for Adaptive Reliability.

### Upgrade

Install or upgrade with the normal Development Kit installer after v0.10.1 is published:

```bash
npx development-kit@0.10.1 --global
```

For project-local installation use the existing supported installer mode documented in the user guide.
