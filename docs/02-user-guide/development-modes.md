# Development Modes

Development Mode is a project-owned methodology policy. It is separate from Autopilot autonomy and cannot disable DKF reliability controls.

## Modes

| Mode | Purpose |
|---|---|
| **Rapid Development** (`rapid`) | Concise planning and documentation for low-ceremony delivery while preserving required verification and approvals. |
| **Balanced Development** (`balanced`) | Default adaptive workflow with standard planning, documentation and testing depth. |
| **Specification-Driven Development** (`spec-driven`) | Requires explicit feature specifications for behavioural work and stronger contract/test traceability. |
| **Documentation-Driven Development** (`doc-driven`) | Comprehensive planning/documentation with continuous canonical-document maintenance. |
| **Maintenance & Evolution** (`maintenance-evolution`) | Existing-project context that inherits one methodology and additionally requires repository audit/impact analysis. |

The non-configurable floor always includes the canonical lifecycle, Development Contracts, independent evidence-backed verification, source freshness/provenance, deterministic acceptance, execution safety and required human approvals, applicable security/Design Authority controls, and release validation.

## Initialize a project

Interactive terminal:

```bash
node scripts/bootstrap.mjs --init
```

Headless or explicit selection:

```bash
node scripts/bootstrap.mjs --init --mode=spec-driven --no-interactive
node scripts/bootstrap.mjs --init --mode=maintenance-evolution --base-methodology=balanced --no-interactive
```

Fresh headless execution records Balanced if no explicit selection is provided. Interactive hosts should obtain the Product Owner's choice instead of silently selecting a methodology.

A validated JSON selection inside the project may also be used:

```bash
node scripts/bootstrap.mjs --init --config-file=mode-selection.json
```

The project stores the current selection and logical revision history together in:

```text
.development-kit/development-mode.json
```

Lock/temp files are ignored; the canonical mode file is intended to be repository-owned project state.

## Inspect or change the mode

```bash
node scripts/bootstrap.mjs --mode-status
node scripts/bootstrap.mjs --history
node scripts/bootstrap.mjs --set-mode --mode=doc-driven --expected-revision=1 --reason=Approved-process-change
```

Mode changes use compare-and-swap revision protection and require a reason. Corrupt or inconsistent persisted state fails closed. A repeated identical selection does not create a new revision.

## Recommendation

Recommendations are deterministic and advisory only:

```bash
node scripts/bootstrap.mjs --recommend --project-type=existing --delivery=production --requirements=clear --documentation=standard --governance=strict
```

Allowed values:

| Input | Values |
|---|---|
| `project-type` | `new`, `existing` |
| `delivery` | `prototype`, `internal`, `production` |
| `requirements` | `unclear`, `evolving`, `clear` |
| `documentation` | `lean`, `standard`, `comprehensive` |
| `governance` | `lightweight`, `standard`, `strict` |

A recommendation never writes project state and never overrides an explicit user selection.

## How DKF consumes the mode

DKF resolves the persisted selection into an immutable policy snapshot and uses it for:

- specification/artifact formality;
- planning depth;
- documentation depth and maintenance expectations;
- test/verification breadth;
- Product Owner acceptance cadence where discretionary;
- context-packing preference;
- Maintenance & Evolution repository-audit requirements.

Every new Development Contract binds the current mode snapshot, revision and fingerprint. If the mode changes later, existing contracts retain the methodology under which they were approved; future contracts receive the new snapshot.

Mode policy can make a workflow more formal. It cannot remove required controls or turn missing evidence into a PASS.

## Existing projects

When an already-bootstrapped project has no mode file, bootstrap records a Balanced `legacy-migration` revision without rewriting project identity, settings or prior artifacts. Maintenance & Evolution should normally be selected when the developer wants explicit existing-project audit/impact behavior.

## Failure behavior

DKF blocks rather than silently repairs:

- malformed mode JSON or history;
- unknown mode/policy values;
- project overrides that weaken configured governance;
- stale revision updates;
- concurrent writers;
- symlink/directory substitution for the mode state file;
- project-external `--config-file` paths.

Use `/dk-status` or `node scripts/bootstrap.mjs --status` to inspect mode health.
