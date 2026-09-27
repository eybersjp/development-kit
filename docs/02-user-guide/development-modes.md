# Development Modes — Project Initialization

Development methodology is selected per project, separately from Autopilot's existing autonomy level. Five user-facing choices use the [Increment 001 policy contract](../04-architecture/dkf-development-modes-increment-001-spec.md): Rapid, Balanced (default), Specification-Driven, Documentation-Driven and Maintenance & Evolution. Maintenance inherits one of the first four methodologies and marks repository inspection as required.

## Project bootstrap

Run after installing DKF's project-local runtime or from a standalone installation:

```bash
node scripts/bootstrap.mjs --init
```

On a fresh interactive terminal, select a numbered methodology (Enter chooses Balanced). Maintenance asks one additional numbered question to select the underlying methodology. Headless automation automatically records Balanced unless an explicit option is supplied:

```bash
node scripts/bootstrap.mjs --init --mode=spec-driven --no-interactive
node scripts/bootstrap.mjs --init --mode=maintenance-evolution --base-methodology=balanced
```

For custom policies, prepare a JSON selection file *inside the project* and use:

```bash
node scripts/bootstrap.mjs --init --config-file=mode-selection.json
```

The file follows [the v1 schema](../../schemas/development-mode-config.schema.json). The resolver checks policy strictness in addition to schema enums. The explicit file must be in the project tree; path escapes are refused.

The project stores the selection and revision history together at `.development-kit/development-mode.json`. Commit this file with your project documentation. `.development-kit/project.json`, `settings.json`, approved specifications and Autopilot state remain separate and are not rewritten during subsequent mode changes. Existing valid selection is preserved by repeated bootstrap. A legacy initialized project with no mode configuration receives recorded Balanced migration; corrupt existing configuration blocks progress instead of being silently replaced.

## Recommendation without mutation

```bash
node scripts/bootstrap.mjs --recommend --project-type=existing --delivery=production --requirements=clear --documentation=standard --governance=strict
```

Allowed questionnaire values:

| Question | Values |
| --- | --- |
| `--project-type` | `new`, `existing` |
| `--delivery` | `prototype`, `internal`, `production` |
| `--requirements` | `unclear`, `evolving`, `clear` |
| `--documentation` | `lean`, `standard`, `comprehensive` |
| `--governance` | `lightweight`, `standard`, `strict` |

Recommendation is deterministic, explains its rule, and does not write any project state. Explicit developer selection takes precedence.

## Inspect and change an established mode

```bash
node scripts/bootstrap.mjs --mode-status
node scripts/bootstrap.mjs --history
node scripts/bootstrap.mjs --set-mode --mode=doc-driven --expected-revision=1 --reason=Approved-process-change
```

Changing modes requires an explicit operation, recorded actor/reason, and expected revision. If another developer has already updated the file, a revision conflict blocks the stale change. Repeating an identical selection does not create a new history entry. Historical evidence remains recorded; downstream contract reconciliation and lifecycle consumption will be added in Increment 003.

## Status and controls

```bash
node scripts/bootstrap.mjs --status
```

Status reports `modeConfigurationStatus` (`absent`, `configured` or `invalid`) and revision. Existing autonomy levels and mandatory security, execution-safety, evidence, design and deterministic-acceptance controls remain unchanged. Installer operations such as global `npx development-kit init --global` install the package and do **not** silently select a methodology for every project. Run project bootstrap in the intended project directory.

See the [Increment 002 acceptance specification](../04-architecture/dkf-development-modes-increment-002-spec.md).
