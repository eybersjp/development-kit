# Release Notes v0.11.1

**Released:** 30 September 2026

## Live UI Preview, Visual Verification and Token Efficiency

Development Kit v0.11.1 integrates the accepted Live UI Preview and Token & Context Efficiency work on top of the v0.11.0 Secrets & Configuration Readiness baseline.

### Live UI Preview

- UI/design context automatically arms project-local preview.
- New applications may remain in `WAITING_FOR_RUNNABLE_UI` until a runnable frontend exists.
- DKF discovers the package manager and uses the project's declared `scripts.dev`.
- Healthy project-bound previews are reused instead of starting duplicate DKF-managed servers.
- Provider-neutral browser behavior supports host-browser, system-browser and headless/no-browser operation.
- Windows system-browser launch avoids command-shell interpolation.
- Preview process ownership is explicit; DKF shutdown only terminates processes it owns.
- Startup-timeout cleanup releases owned processes safely.
- Formal `browser-runtime-verification` remains the authoritative VERIFY-stage browser check and may reuse a healthy live preview.

### Token & Context Efficiency

- Development Contract `authoritativeSources[].sections` materialize scoped excerpts instead of automatically embedding whole source files.
- Whole-file fingerprints remain authoritative for staleness detection.
- Unresolved selectors fail safe to full-source delivery with explicit warning.
- Role contexts include deterministic token-profile metadata and budget state.
- Frequently loaded runtime instructions and chained role prompts were compacted.
- Repository orientation and handoffs prefer targeted references over repeated narrative.
- `npm run token:audit` reports instruction weight and `npm run token:audit:check` gates regressions.

### Release facts

- Package version: `0.11.1`.
- Public command surface: 16 workflow commands.
- Canonical engineering-skill count: 48.
- Development Modes remains unreleased work and is tracked separately in Issue #50.

See `CHANGELOG.md` for the complete change record.
