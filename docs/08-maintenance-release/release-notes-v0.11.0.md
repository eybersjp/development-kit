# Release Notes v0.11.0

**Released:** 30 September 2026

## Secrets & Configuration Readiness Gate

Development Kit v0.11.0 introduced a non-bypassable runtime gate for external configuration and secrets that require Product Owner action.

### Shipped behavior

- Deterministic configuration requirement states separated from overall gate state.
- Automatic lifecycle integration across build, build-auto, Autopilot, test, ship and status workflows.
- Zero-credential AI-context exposure: secret values are excluded from role contexts, persisted DKF state, generated setup guidance and runtime API views.
- Fail-closed acceptance for missing/invalid configuration and release-critical requirements.
- Deferred configuration forces dependent acceptance criteria to remain `UNVERIFIED`.
- Git tracking protection blocks secret entry when a target secret-bearing file is already tracked.
- Secure local generation for generated-secret requirements.
- Deterministic `.development-kit/SECRETS_SETUP.md` guidance without secret values.
- Runtime API and orchestration CLI support for readiness inspection and Product Owner decisions.

### Release relationship

v0.11.0 became the baseline onto which the previously prepared Live UI Preview/Token Efficiency release candidate was reconciled. That combined work shipped the same day as v0.11.1.

See `CHANGELOG.md` for the complete change record.
